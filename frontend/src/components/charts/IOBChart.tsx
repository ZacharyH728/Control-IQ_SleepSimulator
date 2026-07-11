import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TickData } from "../../types/simulation";

interface Props {
  ticks: TickData[];
}

function formatHr(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function IOBChart({ ticks }: Props) {
  const data = ticks.map((t) => ({
    time_hr: t.sim_time,
    iob: t.iob,
  }));

  const maxIob = Math.max(1, ...ticks.map((t) => t.iob + 0.2));

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-widest">
        Insulin on Board (U)
      </h2>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time_hr" tickFormatter={formatHr} stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis domain={[0, maxIob]} stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <Tooltip
            formatter={(val: number) => [`${val.toFixed(3)} U`]}
            labelFormatter={(v) => `t = ${formatHr(Number(v))}`}
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          />
          <Area
            type="monotone"
            dataKey="iob"
            name="IOB"
            stroke="#818cf8"
            fill="#818cf8"
            fillOpacity={0.2}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
