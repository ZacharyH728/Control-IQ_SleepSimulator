import {
  ComposedChart,
  Line,
  Area,
  ReferenceLine,
  ReferenceArea,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TickData } from "../../types/simulation";

interface Props {
  ticks: TickData[];
}

interface ChartPoint {
  time_hr: number;
  bg: number;            // interstitial CGM (what the pump sees)
  bg_smooth: number;     // true blood glucose
  predicted_bg: number;
  bolus_marker?: number;
}

function formatHr(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function GlucoseChart({ ticks }: Props) {
  const data: ChartPoint[] = ticks.map((t) => ({
    time_hr: t.sim_time,
    bg: t.bg,
    bg_smooth: t.bg_smooth,
    predicted_bg: t.predicted_bg,
    bolus_marker: t.bolus_amount > 0 ? t.bg : undefined,
  }));

  const maxBg = Math.max(250, ...ticks.map((t) => t.bg + 20));

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-widest">
        Glucose (mg/dL)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time_hr"
            tickFormatter={formatHr}
            label={{ value: "Sim Time", position: "insideBottomRight", offset: -4, fill: "#9ca3af", fontSize: 11 }}
            stroke="#4b5563"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
          />
          <YAxis domain={[40, maxBg]} stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <Tooltip
            formatter={(val: number, name: string) => [`${val.toFixed(1)} mg/dL`, name]}
            labelFormatter={(v) => `t = ${formatHr(Number(v))}`}
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />

          {/* Target band 100–120 */}
          <ReferenceArea y1={100} y2={120} fill="#16a34a" fillOpacity={0.08} />

          {/* Threshold lines */}
          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "80", fill: "#ef4444", fontSize: 10 }} />
          <ReferenceLine y={180} stroke="#f97316" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "180", fill: "#f97316", fontSize: 10 }} />
          <ReferenceLine y={110} stroke="#4ade80" strokeDasharray="2 4" strokeWidth={1} label={{ value: "110 target", fill: "#4ade80", fontSize: 9 }} />

          {/* True blood glucose (what's actually happening) */}
          <Line type="monotone" dataKey="bg_smooth" name="Blood Glucose" stroke="#34d399" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />

          {/* Interstitial CGM (what the pump sees, lags BG) */}
          <Line type="monotone" dataKey="bg" name="CGM (interstitial)" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />

          {/* 30-min prediction from CGM trend */}
          <Line type="monotone" dataKey="predicted_bg" name="30-min Predicted" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />

          {/* Auto-correction bolus markers */}
          <Scatter dataKey="bolus_marker" name="Auto Bolus" fill="#fbbf24" shape="diamond" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
