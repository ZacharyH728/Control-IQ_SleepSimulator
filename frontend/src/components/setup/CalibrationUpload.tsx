import { useRef, useState } from "react";
import type { CalibrationResult, SimConfig } from "../../types/simulation";

interface Props {
  onCalibrated: (result: CalibrationResult) => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-green-400",
  medium: "text-yellow-400",
  low: "text-red-400",
};

export default function CalibrationUpload({ onCalibrated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fitBergman, setFitBergman] = useState(false);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const filesRef = useRef<File[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    filesRef.current = arr;
    setFileNames(arr.map((f) => f.name));
    setResult(null);
    setError(null);
  };

  const runCalibration = async () => {
    if (!filesRef.current.length) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of filesRef.current) form.append("files", f);

      const url = `/api/calibrate${fitBergman ? "?fit_bergman=true" : ""}`;
      const res = await fetch(url, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data: CalibrationResult = await res.json();
      setResult(data);
      onCalibrated(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 text-sm font-semibold text-gray-300"
      >
        <span>📂 Auto-fill from Tandem export CSVs</span>
        <span className="text-gray-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 bg-gray-900/60 space-y-4">
          <p className="text-xs text-gray-500">
            Upload the CSVs from a Tandem t:slim X2 export folder (CGM, Bolus, Basal-doses files).
            Settings will be estimated and pre-filled into the form below.
          </p>

          <label className="block border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition-colors">
            <input
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="text-gray-400 text-sm">
              {fileNames.length > 0
                ? fileNames.map((n) => <div key={n} className="truncate text-xs text-green-400">{n}</div>)
                : "Drop CSV files here or click to browse"}
            </div>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={fitBergman}
              onChange={(e) => setFitBergman(e.target.checked)}
              className="rounded"
            />
            Fit Bergman model parameters to my data (~5–10s)
          </label>

          <button
            onClick={runCalibration}
            disabled={!fileNames.length || loading}
            className="w-full py-2 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm"
          >
            {loading ? "Extracting..." : "Extract Settings"}
          </button>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          {result && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: "cr", label: "Carb Ratio", val: result.carb_ratio, unit: "g/U" },
                { key: "isf", label: "ISF", val: result.isf, unit: "mg/dL/U" },
                { key: "basal", label: "Basal Rate", val: result.basal_rate, unit: "U/hr" },
              ].map(({ key, label, val, unit }) => (
                <div key={key} className="bg-gray-800 rounded p-2">
                  <div className="text-gray-500">{label}</div>
                  <div className="font-bold text-gray-100">{val?.toFixed(2) ?? "—"} <span className="font-normal text-gray-500">{unit}</span></div>
                  <div className={`${CONFIDENCE_COLORS[result.confidence[key]] ?? "text-gray-500"} capitalize`}>
                    {result.confidence[key] ?? "—"} ({result.sample_count[key] ?? 0} samples)
                  </div>
                </div>
              ))}
              {result.bergman_fitted && (
                <div className="bg-gray-800 rounded p-2 col-span-2">
                  <div className="text-gray-500">Bergman params fitted ✓</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
