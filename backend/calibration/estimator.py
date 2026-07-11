"""
Heuristic extraction of pump settings from parsed Tandem export data.

CR:    median(Carb Size / Food Delivered) for food boluses with Carb Size > 0
ISF:   median((BG - 100) / Correction Delivered) for correction boluses
Basal: median(Dose * 12) where concurrent CGM was 80-130 mg/dL
"""

import statistics
from datetime import timedelta

from calibration.parser import CGMReading, BolusRecord, BasalDose


_CR_MIN, _CR_MAX = 2.0, 40.0       # g/U plausible bounds
_ISF_MIN, _ISF_MAX = 15.0, 400.0   # mg/dL per U
_BASAL_MIN, _BASAL_MAX = 0.05, 5.0 # U/hr


def _confidence_label(n: int) -> str:
    if n >= 10:
        return "high"
    if n >= 4:
        return "medium"
    return "low"


def _cgm_at(cgm: list[CGMReading], ts, window_min: int = 5) -> float | None:
    """Find the CGM reading closest to ts within ±window_min minutes."""
    best, best_delta = None, timedelta(minutes=window_min + 1)
    for r in cgm:
        d = abs(r.timestamp - ts)
        if d < best_delta:
            best_delta = d
            best = r.glucose
    return best


def estimate_carb_ratio(boluses: list[BolusRecord]) -> tuple[float | None, int]:
    estimates = []
    for b in boluses:
        if b.carb_size > 0 and b.food_delivered > 0.1:
            cr = b.carb_size / b.food_delivered
            if _CR_MIN <= cr <= _CR_MAX:
                estimates.append(cr)
    if not estimates:
        return None, 0
    return round(statistics.median(estimates), 1), len(estimates)


def estimate_isf(boluses: list[BolusRecord]) -> tuple[float | None, int]:
    estimates = []
    for b in boluses:
        if b.correction_delivered > 0.1 and b.bg_at_bolus > 110:
            isf = (b.bg_at_bolus - 100.0) / b.correction_delivered
            if _ISF_MIN <= isf <= _ISF_MAX:
                estimates.append(isf)
    if not estimates:
        return None, 0
    return round(statistics.median(estimates), 1), len(estimates)


def estimate_basal_rate(
    basal_doses: list[BasalDose],
    cgm: list[CGMReading],
) -> tuple[float | None, int]:
    """
    Filter basal doses to those where concurrent CGM was 80-130 mg/dL
    (Control-IQ+ likely delivering near programmed rate) and take the median.
    """
    if not cgm:
        # No CGM data — use global median of all doses
        rates = [d.dose_units * 12.0 for d in basal_doses if d.dose_units > 0]
        if not rates:
            return None, 0
        return round(statistics.median(rates), 3), len(rates)

    in_range_rates = []
    for dose in basal_doses:
        bg = _cgm_at(cgm, dose.timestamp)
        if bg is not None and 80.0 <= bg <= 130.0:
            rate_u_hr = dose.dose_units * 12.0
            if _BASAL_MIN <= rate_u_hr <= _BASAL_MAX:
                in_range_rates.append(rate_u_hr)

    if not in_range_rates:
        return None, 0
    return round(statistics.median(in_range_rates), 3), len(in_range_rates)


def estimate_all(
    cgm: list[CGMReading],
    boluses: list[BolusRecord],
    basal_doses: list[BasalDose],
) -> dict:
    cr, cr_n = estimate_carb_ratio(boluses)
    isf, isf_n = estimate_isf(boluses)
    basal, basal_n = estimate_basal_rate(basal_doses, cgm)

    return {
        "carb_ratio": cr,
        "isf": isf,
        "basal_rate": basal,
        "dia_hours": 5.0,
        "confidence": {
            "cr": _confidence_label(cr_n),
            "isf": _confidence_label(isf_n),
            "basal": _confidence_label(basal_n),
        },
        "sample_count": {
            "cr": cr_n,
            "isf": isf_n,
            "basal": basal_n,
        },
        "bergman_fitted": None,
    }
