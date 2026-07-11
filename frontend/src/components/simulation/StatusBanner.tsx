import type { TickData } from "../../types/simulation";

interface Props {
  latest: TickData | null;
  status: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  suspend: { label: "SUSPENDED", color: "text-red-400 bg-red-900/30" },
  basal: { label: "BASAL", color: "text-gray-300 bg-gray-800" },
  increased_basal: { label: "INCREASED BASAL", color: "text-amber-400 bg-amber-900/30" },
  auto_correction: { label: "AUTO CORRECTION", color: "text-orange-400 bg-orange-900/30" },
};

function bgColor(bg: number) {
  if (bg < 70) return "text-red-400";
  if (bg < 80) return "text-orange-400";
  if (bg <= 180) return "text-green-400";
  return "text-amber-400";
}

export default function StatusBanner({ latest, status }: Props) {
  if (!latest) return null;

  const action = ACTION_LABELS[latest.action] ?? { label: latest.action, color: "text-gray-300 bg-gray-800" };
  const timeHr = Math.floor(latest.sim_time / 60);
  const timeMin = latest.sim_time % 60;

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex flex-wrap gap-6 items-center">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">CGM</div>
        <div className={`text-3xl font-bold tabular-nums ${bgColor(latest.bg)}`}>
          {latest.bg.toFixed(0)}
          <span className="text-base font-normal text-gray-500 ml-1">mg/dL</span>
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">Predicted (30 min)</div>
        <div className="text-2xl font-semibold tabular-nums text-purple-400">
          {latest.predicted_bg.toFixed(0)}
          <span className="text-sm font-normal text-gray-500 ml-1">mg/dL</span>
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">IOB</div>
        <div className="text-2xl font-semibold tabular-nums text-indigo-400">
          {latest.iob.toFixed(2)}
          <span className="text-sm font-normal text-gray-500 ml-1">U</span>
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">Basal</div>
        <div className="text-xl font-semibold tabular-nums text-amber-400">
          {latest.basal_rate.toFixed(3)}
          <span className="text-sm font-normal text-gray-500 ml-1">U/hr</span>
        </div>
      </div>
      <div className="ml-auto flex flex-col items-end gap-1">
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${action.color}`}>
          {action.label}
        </span>
        <span className="text-xs text-gray-500">
          t = {timeHr}:{timeMin.toString().padStart(2, "0")}
          {latest.bolus_amount > 0 && (
            <span className="ml-2 text-orange-400 font-semibold">+{latest.bolus_amount.toFixed(2)}U bolus</span>
          )}
        </span>
        <span className="text-xs text-gray-600 italic">{latest.reason}</span>
      </div>
    </div>
  );
}
