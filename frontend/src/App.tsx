import { useState } from "react";
import SetupForm from "./components/setup/SetupForm";
import StatusBanner from "./components/simulation/StatusBanner";
import ControlBar from "./components/simulation/ControlBar";
import MealInjector from "./components/simulation/MealInjector";
import GlucoseChart from "./components/charts/GlucoseChart";
import BasalChart from "./components/charts/BasalChart";
import IOBChart from "./components/charts/IOBChart";
import { useSimulation } from "./hooks/useSimulation";
import type { SimConfig } from "./types/simulation";

export default function App() {
  const { state, start, stop, injectMeal, setSpeed } = useSimulation();
  const [speedMs, setSpeedMs] = useState(100);
  const [config, setConfig] = useState<SimConfig | null>(null);

  const handleStart = (cfg: SimConfig) => {
    setConfig(cfg);
    setSpeedMs(cfg.tick_real_ms);
    start(cfg);
  };

  const handleSpeed = (ms: number) => {
    setSpeedMs(ms);
    setSpeed(ms);
  };

  const latest = state.ticks.at(-1) ?? null;
  const isActive = state.status === "running" || state.status === "complete";

  if (!isActive) {
    return <SetupForm onStart={handleStart} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-400">Control-IQ+ Sleep Mode Simulation</h1>
        <button
          onClick={stop}
          className="text-sm text-gray-500 hover:text-gray-300 underline"
        >
          ← New simulation
        </button>
      </div>

      {state.error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {state.error}
        </div>
      )}

      <StatusBanner latest={latest} status={state.status} />

      <ControlBar
        onStop={stop}
        onSpeedChange={handleSpeed}
        speedMs={speedMs}
        status={state.status}
      />

      <GlucoseChart ticks={state.ticks} />
      <BasalChart ticks={state.ticks} programmedBasal={config?.basal_rate ?? 1} />
      <IOBChart ticks={state.ticks} />

      <MealInjector
        onInject={injectMeal}
        disabled={state.status !== "running"}
      />
    </div>
  );
}
