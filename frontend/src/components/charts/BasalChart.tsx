import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TickData } from "../../types/simulation";

interface Props {
  ticks: TickData[];
  programmedBasal: number;
}

const ACTION_COLORS: Record<string, string> = {
  suspend: "#ef4444",
  basal: "#6b7280",
  increased_basal: "#f59e0b",
  auto_correction: "#f97316",
};

function formatHr(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function BasalChart({ ticks, programmedBasal }: Props) {
  const data = ticks.map((t) => ({
    time_hr: t.sim_time,
    basal_rate: t.basal_rate,
    action: t.action,
  }));

  const maxRate = Math.max(programmedBasal * 1.8, ...ticks.map((t) => t.basal_rate + 0.1));

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-widest">
        Basal Rate (U/hr)
      </h2>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time_hr" tickFormatter={formatHr} stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis domain={[0, maxRate]} stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <Tooltip
            formatter={(val: number) => [`${val.toFixed(3)} U/hr`]}
            labelFormatter={(v) => `t = ${formatHr(Number(v))}`}
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          />
          <ReferenceLine y={programmedBasal} stroke="#60a5fa" strokeDasharray="4 3" strokeWidth={1} label={{ value: "programmed", fill: "#60a5fa", fontSize: 9 }} />
          <Area
            type="stepAfter"
            dataKey="basal_rate"
            name="Delivered Basal"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.25}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded-sm bg-red-500 mr-1" />Suspended</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-gray-500 mr-1" />Programmed</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-500 mr-1" />Increased</span>
      </div>
    </div>
  );
}
