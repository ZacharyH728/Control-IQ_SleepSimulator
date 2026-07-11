interface Props {
  onStop: () => void;
  onSpeedChange: (ms: number) => void;
  speedMs: number;
  status: string;
}

const SPEED_PRESETS = [
  { label: "0.5×", ms: 1000 },
  { label: "1×", ms: 500 },
  { label: "5×", ms: 100 },
  { label: "20×", ms: 25 },
  { label: "Max", ms: 1 },
];

export default function ControlBar({ onStop, onSpeedChange, speedMs, status }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Speed</span>
        {SPEED_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onSpeedChange(p.ms)}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors
              ${speedMs === p.ms
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full animate-pulse ${status === "running" ? "bg-green-400" : "bg-gray-600"}`} />
        <span className="text-xs text-gray-500 uppercase">{status}</span>
        {status === "running" && (
          <button
            onClick={onStop}
            className="px-4 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
