"""
Control-IQ+ Sleep Mode algorithm.

Thresholds (30-min predicted BG from CGM linear trend):
  < 80          suspend basal
  80–120        programmed basal
  120–160       increased basal, linear 0%→60%
  160–180       max increased basal (+60%)
  > 180         auto-correction bolus + max increased basal (once per 60 min)

Correction bolus formula: (predicted_BG - 110) / CF * 0.7
"""

from dataclasses import dataclass
from typing import Literal

from control.predictor import predict_cgm_30min
from simulation.state import SimulationState, SimulationConfig


ActionType = Literal["suspend", "basal", "increased_basal", "auto_correction"]


@dataclass
class ControlDecision:
    action: ActionType
    delivered_rate: float
    bolus_amount: float
    predicted_bg: float
    reason: str


_SUSPEND_THRESHOLD = 80.0
_UPPER_THRESHOLD = 180.0
_CORRECTION_TARGET = 110.0
_CORRECTION_FACTOR = 0.70
_MAX_BASAL_INCREASE = 0.60
_BOLUS_LOCKOUT_MIN = 60.0


def control_iq_sleep_decision(state: SimulationState, config: SimulationConfig) -> ControlDecision:
    pred_bg = predict_cgm_30min(
        current_cgm=state.current_cgm,
        prev_cgm=state.prev_cgm,
        noise_sd=config.pred_noise_sd,
    )

    can_bolus = (state.sim_time - state.last_bolus_time) >= _BOLUS_LOCKOUT_MIN

    if pred_bg < _SUSPEND_THRESHOLD:
        return ControlDecision(
            action="suspend",
            delivered_rate=0.0,
            bolus_amount=0.0,
            predicted_bg=pred_bg,
            reason=f"Predicted {pred_bg:.0f} < 80 — basal suspended",
        )

    if pred_bg <= 120.0:
        return ControlDecision(
            action="basal",
            delivered_rate=config.basal_rate,
            bolus_amount=0.0,
            predicted_bg=pred_bg,
            reason=f"Predicted {pred_bg:.0f} in target range",
        )

    if pred_bg <= 160.0:
        pct = _MAX_BASAL_INCREASE * (pred_bg - 120.0) / 40.0
    else:
        pct = _MAX_BASAL_INCREASE
    increased_rate = config.basal_rate * (1.0 + pct)

    if pred_bg > _UPPER_THRESHOLD and can_bolus:
        correction = (pred_bg - _CORRECTION_TARGET) / config.isf * _CORRECTION_FACTOR
        correction = max(0.0, round(correction, 2))
        return ControlDecision(
            action="auto_correction",
            delivered_rate=increased_rate,
            bolus_amount=correction,
            predicted_bg=pred_bg,
            reason=f"Predicted {pred_bg:.0f} > 180 — auto-correction {correction:.2f}U",
        )

    return ControlDecision(
        action="increased_basal",
        delivered_rate=increased_rate,
        bolus_amount=0.0,
        predicted_bg=pred_bg,
        reason=f"Predicted {pred_bg:.0f} elevated — basal +{pct*100:.0f}%",
    )
