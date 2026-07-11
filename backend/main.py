"""
FastAPI application — WebSocket simulation endpoint + REST calibration endpoint.
"""

import asyncio
import concurrent.futures
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from schemas.messages import StartConfig, CalibrationResult
from simulation.engine import run_simulation, MealEvent
from simulation.state import SimulationConfig
from models.bergman import BergmanParams
from calibration.parser import classify_and_parse, CGMReading, BolusRecord, BasalDose
from calibration.estimator import estimate_all
from calibration.optimizer import fit_bergman_params


_thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    _thread_pool.shutdown(wait=False)


app = FastAPI(title="Control-IQ+ Simulator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/simulation")
async def simulation_ws(websocket: WebSocket):
    await websocket.accept()
    meal_queue: asyncio.Queue = asyncio.Queue()
    sim_task = None

    try:
        raw = await websocket.receive_json()
        if raw.get("type") != "start":
            await websocket.send_json({"type": "error", "message": "Expected start message"})
            return

        sc = StartConfig(**raw.get("config", {}))
        bergman = BergmanParams(**(sc.bergman.model_dump() if sc.bergman else {}))
        config = SimulationConfig(
            bg_init=sc.bg_init,
            iob_init=sc.iob_init,
            basal_rate=sc.basal_rate,
            isf=sc.isf,
            carb_ratio=sc.carb_ratio,
            dia_hours=sc.dia_hours,
            duration_min=sc.duration_min,
            tick_real_ms=sc.tick_real_ms,
            cgm_noise_sd=sc.cgm_noise_sd,
            bergman=bergman,
        )

        async def stream():
            async for tick in run_simulation(config, meal_queue):
                await websocket.send_json(tick.to_dict())
            await websocket.send_json({"type": "complete"})

        sim_task = asyncio.create_task(stream())

        while not sim_task.done():
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.05)
                if msg.get("type") == "meal":
                    carbs = float(msg.get("carbs", 0))
                    if carbs > 0:
                        await meal_queue.put(MealEvent(sim_time=0, carbs=carbs))
                elif msg.get("type") == "stop":
                    sim_task.cancel()
                    break
                elif msg.get("type") == "speed":
                    # Update tick speed — engine reads config ref on each loop
                    config.tick_real_ms = float(msg.get("ms", config.tick_real_ms))
            except asyncio.TimeoutError:
                pass
            except Exception:
                break

    except WebSocketDisconnect:
        pass
    finally:
        if sim_task and not sim_task.done():
            sim_task.cancel()


@app.post("/api/calibrate", response_model=CalibrationResult)
async def calibrate(
    files: list[UploadFile] = File(...),
    fit_bergman: bool = False,
):
    cgm_data: list[CGMReading] = []
    bolus_data: list[BolusRecord] = []
    basal_data: list[BasalDose] = []

    for f in files:
        content = await f.read()
        kind, parsed = classify_and_parse(f.filename or "", content)
        if kind == "cgm":
            cgm_data.extend(parsed)
        elif kind == "bolus":
            bolus_data.extend(parsed)
        elif kind == "basal_doses":
            basal_data.extend(parsed)

    result = estimate_all(cgm_data, bolus_data, basal_data)

    if fit_bergman and (cgm_data and basal_data):
        loop = asyncio.get_running_loop()
        fitted = await loop.run_in_executor(
            _thread_pool,
            fit_bergman_params,
            cgm_data,
            basal_data,
            BergmanParams(),
        )
        if fitted:
            result["bergman_fitted"] = fitted.__dict__

    return CalibrationResult(**result)


# Serve built frontend in production
_static_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_static_path):
    app.mount("/", StaticFiles(directory=_static_path, html=True), name="static")
