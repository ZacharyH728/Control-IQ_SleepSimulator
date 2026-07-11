export type ActionType =
  | "suspend"
  | "basal"
  | "increased_basal"
  | "auto_correction";

export interface TickData {
  sim_time: number;
  bg: number;           // interstitial CGM reading (mg/dL)
  bg_smooth: number;    // true blood glucose (ODE state G)
  iob: number;
  basal_rate: number;
  predicted_bg: number;
  action: ActionType;
  bolus_amount: number;
  reason: string;
}

export interface SimConfig {
  bg_init: number;
  iob_init: number;
  basal_rate: number;
  isf: number;
  carb_ratio: number;
  dia_hours: number;
  duration_min: number;
  tick_real_ms: number;
  cgm_noise_sd: number;
  pred_noise_sd: number;
  bergman?: BergmanConfig;
}

export interface BergmanConfig {
  p1: number;
  p2: number;
  p3: number;
  n: number;
  Vg: number;
  Vi: number;
  Gb: number;
  Ib: number;
  kabs: number;
  counter_reg_factor: number;
  tau_ig: number;
}

export interface CalibrationResult {
  carb_ratio: number | null;
  isf: number | null;
  basal_rate: number | null;
  dia_hours: number;
  confidence: Record<string, string>;
  sample_count: Record<string, number>;
  bergman_fitted: BergmanConfig | null;
}

export type SimStatus = "idle" | "running" | "complete" | "error";
