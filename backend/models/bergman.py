"""
Bergman Minimal Model — 5-state ODE system.

State vector: [G, X, I, Qgut, Cig]
  G     — plasma glucose (mg/dL)
  X     — remote insulin action (min^-1)
  I     — plasma insulin (mU/L)
  Qgut  — gut carbohydrate compartment (mg)
  Cig   — interstitial glucose / CGM compartment (mg/dL), lags G by tau_ig

Realism additions vs. original 4-state model:
  counter_reg_factor  0=T1D (no glucagon EGP recovery), 1=normal physiology
  tau_ig              CGM lag time constant (min), typically 10 min

Units (strictly enforced):
  u(t)  mU/min   (1 U/hr = 16.6667 mU/min)
  D(t)  mg/dL/min
  Vg    dL
  Vi    L
"""

from dataclasses import dataclass
import numpy as np
from scipy.integrate import solve_ivp


@dataclass
class BergmanParams:
    p1: float = 0.028        # glucose effectiveness (min^-1)
    p2: float = 0.025        # remote insulin disappearance (min^-1)
    p3: float = 0.000013     # remote insulin action rate (mU^-1 min^-2)
    n: float = 0.093         # plasma insulin decay (min^-1)
    Vg: float = 117.0        # glucose distribution volume (dL)
    Vi: float = 12.0         # insulin distribution volume (L)
    Gb: float = 100.0        # basal glucose (mg/dL)
    Ib: float = 10.0         # basal insulin (mU/L)
    kabs: float = 0.05       # gut absorption rate (min^-1)
    counter_reg_factor: float = 0.1  # 0=T1D (impaired), 1=full counter-regulation
    tau_ig: float = 10.0     # CGM interstitial lag time constant (min)


def bergman_rhs(t, y, params: BergmanParams, u_func, meal_schedule):
    """ODE right-hand side. u_func(t) returns delivery rate in mU/min."""
    G, X, I, Qgut, Cig = y

    u = u_func(t)
    D = params.kabs * Qgut / params.Vg

    # Counter-regulation: scale the EGP recovery term (positive when G < Gb).
    # T1D patients have impaired glucagon response, so the liver does not
    # adequately raise glucose during hypoglycemia.
    p1_term = -params.p1 * (G - params.Gb)
    if G < params.Gb:
        p1_term *= params.counter_reg_factor

    dG = p1_term - X * G + D
    dX = -params.p2 * X + params.p3 * (I - params.Ib)
    dI = -params.n * I + u / params.Vi
    dQgut = -params.kabs * Qgut
    dCig = (G - Cig) / params.tau_ig

    return [dG, dX, dI, dQgut, dCig]


def _glucose_zero_event(t, y, *args):
    return y[0] - 1.0


_glucose_zero_event.terminal = True
_glucose_zero_event.direction = -1


def integrate_step(y0, t_span, params: BergmanParams, u_func, meal_schedule=None):
    """
    Integrate the ODE over t_span (minutes). Returns final state [G, X, I, Qgut, Cig].
    Clamps G and Cig >= 1 mg/dL via terminal event and hard floor.
    """
    sol = solve_ivp(
        bergman_rhs,
        t_span,
        y0,
        args=(params, u_func, meal_schedule or []),
        method="LSODA",
        max_step=0.5,
        events=_glucose_zero_event,
        dense_output=False,
    )

    y_final = sol.y[:, -1].copy()
    y_final[0] = max(y_final[0], 1.0)   # blood glucose floor
    y_final[4] = max(y_final[4], 1.0)   # interstitial glucose floor
    return y_final
