import { useCallback, useRef, useState } from "react";
import type { TickData, SimConfig, SimStatus } from "../types/simulation";

const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/simulation`;

export interface SimulationState {
  status: SimStatus;
  ticks: TickData[];
  error: string | null;
}

export function useSimulation() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<SimulationState>({
    status: "idle",
    ticks: [],
    error: null,
  });

  const start = useCallback((config: SimConfig) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setState({ status: "running", ticks: [], error: null });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", config }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "tick") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type: _t, ...tick } = msg as { type: string } & TickData;
        setState((s) => ({ ...s, ticks: [...s.ticks, tick as TickData] }));
      } else if (msg.type === "complete") {
        setState((s) => ({ ...s, status: "complete" }));
      } else if (msg.type === "error") {
        setState((s) => ({ ...s, status: "error", error: msg.message }));
      }
    };

    ws.onerror = () => {
      setState((s) => ({
        ...s,
        status: "error",
        error: "WebSocket connection failed. Is the backend running?",
      }));
    };

    ws.onclose = () => {
      setState((s) =>
        s.status === "running" ? { ...s, status: "complete" } : s
      );
    };
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "stop" }));
    wsRef.current?.close();
    setState((s) => ({ ...s, status: "idle" }));
  }, []);

  const injectMeal = useCallback((carbs: number) => {
    wsRef.current?.send(JSON.stringify({ type: "meal", carbs }));
  }, []);

  const setSpeed = useCallback((ms: number) => {
    wsRef.current?.send(JSON.stringify({ type: "speed", ms }));
  }, []);

  return { state, start, stop, injectMeal, setSpeed };
}
