import { useState } from "react";
import type { SimConfig, CalibrationResult } from "../../types/simulation";
import CalibrationUpload from "./CalibrationUpload";

interface Props {
  onStart: (config: SimConfig) => void;
}

interface FormState {
  bg_init: number;
  iob_init: number;
  basal_rate: number;
  isf: number;
  carb_ratio: number;
  dia_hours: number;
  duration_hr: number;
  speed_label: string;
  // Realism settings
  counter_reg_factor: number;   // 0=T1D, 0.5=partial, 1.0=normal
  tau_ig: number;               // CGM lag (min)
  pred_noise_sd: number;        // pump prediction noise (mg/dL)
}

const SPEED_OPTIONS = [
  { label: "0.5×", ms: 1000 },
  { label: "1×", ms: 500 },
  { label: "5×", ms: 100 },
  { label: "20×", ms: 25 },
  { label: "Max", ms: 1 },
];

function Field({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  highlight,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
        {label}{" "}
        {highlight && <span className="ml-1 text-green-400 text-xs">(from data)</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-32 rounded bg-gray-800 border px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            highlight ? "border-green-600" : "border-gray-700"
          }`}
        />
        <span className="text-gray-500 text-sm">{unit}</span>
      </div>
    </div>
  );
}

const STORAGE_KEY = "ciq_sim_form";

function loadForm(): { form: FormState; wasRestored: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { form: { ...defaultForm(), ...JSON.parse(raw) }, wasRestored: true };
  } catch {}
  return { form: defaultForm(), wasRestored: false };
}

function defaultForm(): FormState {
  return {
    bg_init: 150,
    iob_init: 0,
    basal_rate: 1.0,
    isf: 50,
    carb_ratio: 10,
    dia_hours: 5,
    duration_hr: 8,
    speed_label: "5×",
    counter_reg_factor: 0.1,
    tau_ig: 10,
    pred_noise_sd: 15,
  };
}

export default function SetupForm({ onStart }: Props) {
  const [form, setForm] = useState<FormState>(() => loadForm().form);
  const [showRestoreNotice, setShowRestoreNotice] = useState(() => loadForm().wasRestored);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const set = (key: keyof FormState) => (val: number | string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleCalibrated = (result: CalibrationResult) => {
    const updates: Partial<FormState> = {};
    const hl: string[] = [];
    if (result.carb_ratio !== null) { updates.carb_ratio = result.carb_ratio; hl.push("carb_ratio"); }
    if (result.isf !== null) { updates.isf = result.isf; hl.push("isf"); }
    if (result.basal_rate !== null) { updates.basal_rate = result.basal_rate; hl.push("basal_rate"); }
    setForm((f) => ({ ...f, ...updates }));
    setHighlighted(new Set(hl));
  };

  const handleStart = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    const speed = SPEED_OPTIONS.find((s) => s.label === form.speed_label) ?? SPEED_OPTIONS[2];
    const config: SimConfig = {
      bg_init: form.bg_init,
      iob_init: form.iob_init,
      basal_rate: form.basal_rate,
      isf: form.isf,
      carb_ratio: form.carb_ratio,
      dia_hours: form.dia_hours,
      duration_min: Math.round(form.duration_hr * 60),
      tick_real_ms: speed.ms,
      cgm_noise_sd: 3.0,
      pred_noise_sd: form.pred_noise_sd,
      bergman: {
        p1: 0.028, p2: 0.025, p3: 0.000013, n: 0.093,
        Vg: 117, Vi: 12, Gb: 100, Ib: 10, kabs: 0.05,
        counter_reg_factor: form.counter_reg_factor,
        tau_ig: form.tau_ig,
      },
    };
    onStart(config);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-blue-400 mb-1">Control-IQ+ Sleep Mode Simulator</h1>
        <p className="text-gray-500 text-sm">Configure initial conditions and run a forward simulation.</p>
      </div>

      {showRestoreNotice && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-950 border border-blue-800 px-4 py-2.5 text-sm text-blue-300">
          <span>Settings restored from your last session.</span>
          <button
            onClick={() => setShowRestoreNotice(false)}
            className="text-blue-500 hover:text-blue-300 shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <CalibrationUpload onCalibrated={handleCalibrated} />

      <div className="bg-gray-900 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Initial Conditions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current BG" unit="mg/dL" value={form.bg_init} min={40} max={400} step={1} onChange={set("bg_init") as (v: number) => void} />
          <Field label="Current IOB" unit="U" value={form.iob_init} min={0} max={15} step={0.05} onChange={set("iob_init") as (v: number) => void} />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Pump Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Programmed Basal" unit="U/hr" value={form.basal_rate} min={0.025} max={5} step={0.025}
            onChange={set("basal_rate") as (v: number) => void} highlight={highlighted.has("basal_rate")} />
          <Field label="Correction Factor (CF)" unit="mg/dL per U" value={form.isf} min={10} max={400} step={1}
            onChange={set("isf") as (v: number) => void} highlight={highlighted.has("isf")} />
          <Field label="Carb Ratio" unit="g/U" value={form.carb_ratio} min={1} max={30} step={0.5}
            onChange={set("carb_ratio") as (v: number) => void} highlight={highlighted.has("carb_ratio")} />
          <Field label="DIA" unit="hours" value={form.dia_hours} min={2} max={8} step={0.5}
            onChange={set("dia_hours") as (v: number) => void} />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Simulation</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration" unit="hours" value={form.duration_hr} min={1} max={12} step={0.5}
            onChange={set("duration_hr") as (v: number) => void} />
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Speed</label>
            <div className="flex gap-2 flex-wrap">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setForm((f) => ({ ...f, speed_label: s.label }))}
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                    form.speed_label === s.label
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Realism</h2>
          <p className="text-xs text-gray-600 mt-1">
            These factors make the simulation more physiologically accurate.
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">
            Counter-regulation (glucagon response)
          </label>
          <div className="flex gap-2">
            {[
              { label: "T1D — none", value: 0.0, desc: "No glucagon response (most realistic for T1D)" },
              { label: "Partial", value: 0.3, desc: "Blunted response" },
              { label: "Normal", value: 1.0, desc: "Full response (non-T1D)" },
            ].map((o) => (
              <button
                key={o.label}
                title={o.desc}
                onClick={() => setForm((f) => ({ ...f, counter_reg_factor: o.value }))}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  form.counter_reg_factor === o.value
                    ? "bg-purple-700 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">
            CGM lag (interstitial delay)
          </label>
          <div className="flex gap-2">
            {[
              { label: "None", value: 0 },
              { label: "5 min", value: 5 },
              { label: "10 min", value: 10 },
              { label: "15 min", value: 15 },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setForm((f) => ({ ...f, tau_ig: o.value === 0 ? 0.1 : o.value }))}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  (o.value === 0 ? form.tau_ig <= 0.1 : form.tau_ig === o.value)
                    ? "bg-purple-700 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">
            Pump prediction noise (30-min forecast error)
          </label>
          <div className="flex gap-2">
            {[
              { label: "Perfect", value: 0, desc: "Ideal ODE-based prediction (not realistic)" },
              { label: "Mild (±10)", value: 10, desc: "Lower-than-real prediction error" },
              { label: "Realistic (±15)", value: 15, desc: "Typical pump prediction accuracy" },
              { label: "High (±25)", value: 25, desc: "Conservative/high-noise scenario" },
            ].map((o) => (
              <button
                key={o.label}
                title={o.desc}
                onClick={() => setForm((f) => ({ ...f, pred_noise_sd: o.value }))}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  form.pred_noise_sd === o.value
                    ? "bg-purple-700 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleStart}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-colors"
      >
        Run Simulation →
      </button>
    </div>
  );
}
