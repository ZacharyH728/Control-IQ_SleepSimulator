import { useState } from "react";

interface Props {
  onInject: (carbs: number) => void;
  disabled: boolean;
}

const QUICK_AMOUNTS = [15, 30, 45, 60, 80];

export default function MealInjector({ onInject, disabled }: Props) {
  const [carbs, setCarbs] = useState(30);
  const [flash, setFlash] = useState(false);

  const inject = (amount: number) => {
    if (disabled) return;
    onInject(amount);
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  };

  return (
    <div className={`bg-gray-900 rounded-xl p-4 transition-all ${flash ? "ring-2 ring-green-400" : ""}`}>
      <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
        Inject Meal (mid-simulation)
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_AMOUNTS.map((g) => (
          <button
            key={g}
            onClick={() => inject(g)}
            disabled={disabled}
            className="px-3 py-1 rounded text-sm bg-gray-800 text-amber-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          >
            {g}g
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={1}
          max={300}
          value={carbs}
          onChange={(e) => setCarbs(Number(e.target.value))}
          className="w-20 rounded bg-gray-800 border border-gray-700 text-gray-100 px-2 py-1 text-sm"
        />
        <span className="text-gray-500 text-sm">g carbs</span>
        <button
          onClick={() => inject(carbs)}
          disabled={disabled || carbs < 1}
          className="px-4 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Inject
        </button>
      </div>
    </div>
  );
}
