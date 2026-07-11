"""
Map user-provided IOB (units) to Bergman initial state variables (I0, X0).

Because we don't know the bolus history, we use a quasi-steady-state
approximation with a 60% X-lag (insulin peaked earlier and remote action lags).
The simulation self-corrects within ~15 minutes.
"""

from .bergman import BergmanParams


def iob_to_state(iob_units: float, params: BergmanParams) -> tuple[float, float]:
    """
    Returns (I_init, X_init) for the Bergman model given current IOB in units.
    Both values represent the excess above basal.
    """
    iob_mu = iob_units * 1000.0                        # mU
    I_extra = iob_mu / params.Vi                       # mU/L above basal
    I_init = params.Ib + I_extra

    # Remote compartment: quasi-SS with 60% lag factor
    X_extra = (params.p3 / params.p2) * I_extra * 0.6
    X_init = max(0.0, X_extra)

    return I_init, X_init
