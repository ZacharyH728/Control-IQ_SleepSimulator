"""Pydantic schemas for WebSocket and REST messages."""

from pydantic import BaseModel, Field
from typing import Optional


class BergmanConfig(BaseModel):
    p1: float = 0.028
    p2: float = 0.025
    p3: float = 0.000013
    n: float = 0.093
    Vg: float = 117.0
    Vi: float = 12.0
    Gb: float = 100.0
    Ib: float = 10.0
    kabs: float = 0.05
    counter_reg_factor: float = 0.1   # 0=T1D, 1=normal physiology
    tau_ig: float = 10.0              # CGM lag time constant (min)


class StartConfig(BaseModel):
    bg_init: float = Field(150.0, ge=40, le=400)
    iob_init: float = Field(0.0, ge=0, le=15)
    basal_rate: float = Field(1.0, ge=0.025, le=5)
    isf: float = Field(50.0, ge=10, le=400)
    carb_ratio: float = Field(10.0, ge=1, le=30)
    dia_hours: float = Field(5.0, ge=2, le=8)
    duration_min: int = Field(480, ge=5, le=720)
    tick_real_ms: float = Field(150.0, ge=1, le=5000)
    cgm_noise_sd: float = Field(3.0, ge=0, le=10)
    pred_noise_sd: float = Field(15.0, ge=0, le=50)  # pump prediction noise
    bergman: Optional[BergmanConfig] = None


class MealMessage(BaseModel):
    carbs: float = Field(..., ge=1, le=300)


class CalibrationResult(BaseModel):
    carb_ratio: Optional[float] = None
    isf: Optional[float] = None
    basal_rate: Optional[float] = None
    dia_hours: float = 5.0
    confidence: dict = {}
    sample_count: dict = {}
    bergman_fitted: Optional[BergmanConfig] = None
