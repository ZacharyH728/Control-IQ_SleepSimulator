"""
30-minute glucose predictor — CGM linear trend extrapolation.

Mirrors how the real Control-IQ+ pump works: the pump extrapolates from
recent CGM trend rather than running a physiological ODE. Adding Gaussian
noise to the prediction simulates the pump's real-world forecast error
(~15 mg/dL SD at 30 minutes is typical for commercial CGM-based predictors).
"""

import numpy as np


def predict_cgm_30min(
    current_cgm: float,
    prev_cgm: float,
    interval_min: float = 5.0,
    horizon_min: float = 30.0,
    noise_sd: float = 0.0,
) -> float:
    """
    Linear trend extrapolation from two consecutive CGM readings.

    current_cgm  — latest CGM reading (mg/dL)
    prev_cgm     — reading one interval ago (mg/dL)
    interval_min — time between readings (5 min at CGM cadence)
    horizon_min  — prediction horizon (30 min for Control-IQ+)
    noise_sd     — std dev of Gaussian prediction error; 0 = perfect prediction
    """
    rate = (current_cgm - prev_cgm) / interval_min   # mg/dL per min
    pred = current_cgm + rate * horizon_min
    if noise_sd > 0:
        pred += float(np.random.normal(0.0, noise_sd))
    return max(40.0, pred)
