"""
Main simulation loop — async generator that yields TickResult every 5 sim-minutes.
"""

import asyncio
from dataclasses import dataclass
from typing import AsyncGenerator

import numpy as np

from models.bergman import integrate_step
from models.iob_mapping import iob_to_state
from simulation.state import SimulationState, SimulationConfig, MealEvent
from control.control_iq import control_iq_sleep_decision, ControlDecision


@dataclass
class TickResult:
    sim_time: float
    bg: float           # interstitial CGM reading (mg/dL)
    bg_smooth: float    # true blood glucose (ODE state G)
    iob: float
    basal_rate: float
    predicted_bg: float
    action: str
    bolus_amount: float
    reason: str

    def to_dict(self) -> dict:
        return {
            "type": "tick",
            "sim_time": self.sim_time,
            "bg": round(self.bg, 1),
            "bg_smooth": round(self.bg_smooth, 1),
            "iob": round(self.iob, 3),
            "basal_rate": round(self.basal_rate, 4),
            "predicted_bg": round(self.predicted_bg, 1),
            "action": self.action,
            "bolus_amount": round(self.bolus_amount, 3),
            "reason": self.reason,
        }


def _build_u_func(rate_u_hr: float):
    rate_mu_min = rate_u_hr * 1000.0 / 60.0

    def u_func(t):
        return rate_mu_min

    return u_func


def _init_state(config: SimulationConfig) -> SimulationState:
    params = config.bergman
    I_init, X_init = iob_to_state(config.iob_init, params)
    # State vector: [G, X, I, Qgut, Cig]
    # Cig starts equal to BG — assume equilibrium at t=0.
    y0 = np.array([config.bg_init, X_init, I_init, 0.0, config.bg_init])

    state = SimulationState(y=y0)
    state.current_basal_rate = config.basal_rate
    state.current_cgm = config.bg_init
    state.prev_cgm = config.bg_init  # no prior reading; assume flat trend

    if config.iob_init > 0:
        state.delivery_log.append(
            type("D", (), {"sim_time": -config.dia_hours * 60 * 0.5, "amount": config.iob_init})()
        )
    return state


async def run_simulation(
    config: SimulationConfig,
    meal_queue: asyncio.Queue,
) -> AsyncGenerator[TickResult, None]:
    state = _init_state(config)
    rng = np.random.default_rng()

    for tick in range(0, config.duration_min, 5):
        state.sim_time = float(tick)

        # Drain pending meal events
        while not meal_queue.empty():
            meal: MealEvent = meal_queue.get_nowait()
            state.add_meal(meal.carbs)

        # CGM reading from interstitial compartment (y[4] = Cig) + sensor noise.
        # This is what the pump actually sees — blood glucose (y[0]) is not
        # directly observable and lags behind by tau_ig.
        cgm_bg = float(state.y[4]) + rng.normal(0, config.cgm_noise_sd)
        cgm_bg = max(cgm_bg, 40.0)

        # Update CGM history for linear trend prediction
        state.prev_cgm = state.current_cgm
        state.current_cgm = cgm_bg

        # Control-IQ+ decision (uses CGM trend, not internal ODE state)
        decision: ControlDecision = control_iq_sleep_decision(state, config)
        state.current_basal_rate = decision.delivered_rate

        # Apply auto-correction bolus immediately
        if decision.bolus_amount > 0:
            state.apply_bolus(decision.bolus_amount, config)

        iob = state.compute_iob(config)

        yield TickResult(
            sim_time=state.sim_time,
            bg=cgm_bg,
            bg_smooth=float(state.y[0]),
            iob=iob,
            basal_rate=decision.delivered_rate,
            predicted_bg=decision.predicted_bg,
            action=decision.action,
            bolus_amount=decision.bolus_amount,
            reason=decision.reason,
        )

        # Integrate ODE for 5 minutes
        u_func = _build_u_func(decision.delivered_rate)
        state.y = integrate_step(state.y, (0.0, 5.0), config.bergman, u_func)

        # Record basal delivery for IOB
        basal_units = decision.delivered_rate * (5.0 / 60.0)
        if basal_units > 0:
            state.delivery_log.append(
                type("D", (), {"sim_time": float(tick), "amount": basal_units})()
            )

        await asyncio.sleep(config.tick_real_ms / 1000.0)
