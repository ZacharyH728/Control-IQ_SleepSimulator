"""
Simulation state and configuration dataclasses.
"""

from dataclasses import dataclass, field
from typing import Literal
import numpy as np

from models.bergman import BergmanParams


@dataclass
class SimulationConfig:
    # Initial conditions
    bg_init: float = 150.0          # mg/dL
    iob_init: float = 0.0           # units

    # Pump settings
    basal_rate: float = 1.0         # U/hr (programmed rate)
    isf: float = 50.0               # mg/dL per unit
    carb_ratio: float = 10.0        # g/U
    dia_hours: float = 5.0          # duration of insulin action

    # Simulation parameters
    duration_min: int = 480         # 8 hours default
    tick_real_ms: float = 150.0     # real ms per 5-min sim tick
    cgm_noise_sd: float = 3.0       # mg/dL CGM noise std dev

    # Realism: prediction noise (mimics pump's imperfect 30-min forecast)
    pred_noise_sd: float = 15.0     # mg/dL; 0 = perfect ODE-based prediction

    # Bergman model (can be tuned by calibration)
    bergman: BergmanParams = field(default_factory=BergmanParams)

    def __post_init__(self):
        if isinstance(self.bergman, dict):
            self.bergman = BergmanParams(**self.bergman)


@dataclass
class DeliveryEvent:
    sim_time: float
    amount: float


@dataclass
class MealEvent:
    sim_time: float
    carbs: float


ActionType = Literal["suspend", "basal", "increased_basal", "auto_correction"]


@dataclass
class SimulationState:
    # ODE state vector: [G, X, I, Qgut, Cig]
    y: np.ndarray

    sim_time: float = 0.0
    current_basal_rate: float = 0.0
    last_bolus_time: float = -120.0

    # CGM history for linear trend prediction
    current_cgm: float = 0.0
    prev_cgm: float = 0.0

    delivery_log: list = field(default_factory=list)
    meal_log: list = field(default_factory=list)

    def add_meal(self, carbs: float):
        self.y[3] += carbs * 1000.0
        self.meal_log.append(MealEvent(self.sim_time, carbs))

    def apply_bolus(self, units: float, config: SimulationConfig):
        params = config.bergman
        self.y[2] += (units * 1000.0) / params.Vi
        self.delivery_log.append(DeliveryEvent(self.sim_time, units))
        self.last_bolus_time = self.sim_time

    def compute_iob(self, config: SimulationConfig) -> float:
        dia_min = config.dia_hours * 60.0
        total = 0.0
        for event in self.delivery_log:
            age = self.sim_time - event.sim_time
            if 0 <= age <= dia_min:
                frac = (1.0 - age / dia_min) ** 2
                total += event.amount * frac
        return total
