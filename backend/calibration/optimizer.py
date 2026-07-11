"""
Optional Bergman parameter fitting using scipy.optimize.

Selects a clean overnight window (no meals, BG 80-220), feeds in actual
basal doses as u(t), and minimizes sum of squared errors vs observed CGM.
Runs in a threadpool to avoid blocking the event loop.
"""

import math
import numpy as np
from scipy.optimize import minimize
from scipy.integrate import solve_ivp
from datetime import timedelta

from calibration.parser import CGMReading, BasalDose
from models.bergman import BergmanParams


_PARAM_BOUNDS = [
    (0.005, 0.08),    # p1
    (0.005, 0.08),    # p2
    (1e-6, 5e-5),     # p3
    (0.05, 0.20),     # n
]
_PARAM_NAMES = ["p1", "p2", "p3", "n"]


def _build_u_func(basal_doses: list[BasalDose], t0):
    """
    Build u(t) [mU/min] as a step function from actual basal dose records.
    t0 is the start of the fitting window (datetime).
    """
    events = []
    for d in basal_doses:
        t_min = (d.timestamp - t0).total_seconds() / 60.0
        rate_mu_min = d.dose_units * 12.0 * 1000.0 / 60.0  # U/hr → mU/min
        events.append((t_min, rate_mu_min))
    events.sort()

    def u_func(t):
        rate = 0.0
        for t_event, r in events:
            if t >= t_event:
                rate = r
            else:
                break
        return rate

    return u_func


def _simulate(params_vec, y0, t_eval, u_func, Gb, Ib, Vg, Vi, kabs):
    p1, p2, p3, n = params_vec

    def rhs(t, y):
        G, X, I, Qgut = y
        u = u_func(t)
        D = kabs * Qgut / Vg
        return [
            -p1 * (G - Gb) - X * G + D,
            -p2 * X + p3 * (I - Ib),
            -n * I + u / Vi,
            -kabs * Qgut,
        ]

    sol = solve_ivp(rhs, (t_eval[0], t_eval[-1]), y0, method="LSODA",
                    t_eval=t_eval, max_step=1.0)
    return sol.y[0] if sol.success else np.full(len(t_eval), np.inf)


def _select_window(
    cgm: list[CGMReading],
    basal_doses: list[BasalDose],
    min_duration_min: int = 120,
) -> tuple | None:
    """
    Find the longest clean window: BG 80-220, no boluses.
    Returns (cgm_window, basal_window, t0) or None.
    """
    if not cgm:
        return None

    sorted_cgm = sorted(cgm, key=lambda r: r.timestamp)
    best, current = [], []

    for r in sorted_cgm:
        if 80 <= r.glucose <= 220:
            if current and (r.timestamp - current[-1].timestamp) > timedelta(minutes=15):
                if len(current) > len(best):
                    best = current
                current = []
            current.append(r)
        else:
            if len(current) > len(best):
                best = current
            current = []
    if len(current) > len(best):
        best = current

    if len(best) < max(4, min_duration_min // 5):
        return None

    t0 = best[0].timestamp
    t_end = best[-1].timestamp
    window_basal = [d for d in basal_doses if t0 <= d.timestamp <= t_end]
    return best, window_basal, t0


def fit_bergman_params(
    cgm: list[CGMReading],
    basal_doses: list[BasalDose],
    base_params: BergmanParams,
) -> BergmanParams | None:
    """
    Fit p1, p2, p3, n to real CGM/basal data.
    Returns updated BergmanParams or None if fitting fails.
    """
    window = _select_window(cgm, basal_doses)
    if window is None:
        return None

    cgm_window, basal_window, t0 = window

    t_eval = np.array([(r.timestamp - t0).total_seconds() / 60.0 for r in cgm_window])
    g_obs = np.array([r.glucose for r in cgm_window])

    u_func = _build_u_func(basal_window, t0)

    # Initial steady-state guess
    G0 = g_obs[0]
    I0 = base_params.Ib
    y0 = [G0, 0.0, I0, 0.0]

    p = base_params
    fixed = (p.Gb, p.Ib, p.Vg, p.Vi, p.kabs)

    x0 = [p.p1, p.p2, p.p3, p.n]

    def cost(x):
        g_sim = _simulate(x, y0, t_eval, u_func, *fixed)
        return float(np.sum((g_sim - g_obs) ** 2))

    result = minimize(
        cost, x0,
        method="L-BFGS-B",
        bounds=_PARAM_BOUNDS,
        options={"maxiter": 200, "ftol": 1e-8},
    )

    if not result.success:
        return None

    p1_f, p2_f, p3_f, n_f = result.x
    return BergmanParams(
        p1=p1_f, p2=p2_f, p3=p3_f, n=n_f,
        Vg=p.Vg, Vi=p.Vi, Gb=p.Gb, Ib=p.Ib, kabs=p.kabs,
    )
