import asyncio
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from openf1_client import (
    fetch_session, get_leaderboard_data, get_schedule_data,
    get_meetings, get_sessions_for_meeting, get_leaderboard_for_session,
    get_lap_times_for_session,
)

POLL_INTERVAL = 15

_state = {
    "leaderboard":  [],
    "session":      {},
    "race_control": [],
    "schedule":     {},
}

_schedule_last_fetch = 0
_session_last_fetch  = 0
_SCHEDULE_TTL = 3600
_SESSION_TTL  = 60


def _detect_status(session):
    start = session.get("date_start")
    if not start:
        return "Unknown"
    try:
        dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        delta = (datetime.now(timezone.utc) - dt).total_seconds()
        return "LIVE" if 0 <= delta <= 10800 else "Final"
    except Exception:
        return "Unknown"


async def background_poll():
    global _schedule_last_fetch, _session_last_fetch
    while True:
        now = time.time()

        try:
            lb, rc = await get_leaderboard_data()
            if lb:
                _state["leaderboard"] = lb
            _state["race_control"] = rc
        except Exception as e:
            print(f"Background poll error: {e}")

        if now - _session_last_fetch > _SESSION_TTL:
            try:
                async with httpx.AsyncClient() as client:
                    fresh = await fetch_session(client)
                if fresh:
                    _state["session"] = fresh
                    _session_last_fetch = now
            except Exception as e:
                print(f"Session refresh error: {e}")

        if now - _schedule_last_fetch > _SCHEDULE_TTL:
            try:
                _state["schedule"] = await get_schedule_data()
                _schedule_last_fetch = now
            except Exception as e:
                print(f"Schedule fetch error: {e}")

        await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _schedule_last_fetch
    async with httpx.AsyncClient() as client:
        _state["session"] = await fetch_session(client)
    try:
        _state["schedule"] = await get_schedule_data()
        _schedule_last_fetch = time.time()
    except Exception as e:
        print(f"Initial schedule fetch error: {e}")
    task = asyncio.create_task(background_poll())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/session/current")
async def session_current():
    s = _state["session"]
    if not s:
        return {}
    return {
        "session_key":        s.get("session_key"),
        "session_name":       s.get("session_name"),
        "circuit_short_name": s.get("circuit_short_name"),
        "session_type":       s.get("session_type"),
        "date_start":         s.get("date_start"),
        "year":               s.get("year"),
        "status":             _detect_status(s),
    }


@app.get("/api/leaderboard")
async def leaderboard():
    return _state["leaderboard"]


@app.get("/api/race_control")
async def race_control():
    return _state["race_control"]


@app.get("/api/schedule")
async def schedule():
    return _state["schedule"]


@app.get("/api/history/meetings")
async def history_meetings(year: int = None):
    if year is None:
        year = datetime.now(timezone.utc).year
    return await get_meetings(year)


@app.get("/api/history/sessions")
async def history_sessions(meeting_key: int):
    return await get_sessions_for_meeting(meeting_key)


@app.get("/api/history/leaderboard")
async def history_leaderboard(session_key: int):
    return await get_leaderboard_for_session(session_key)


@app.get("/api/history/laps")
async def history_laps(session_key: int):
    return await get_lap_times_for_session(session_key)
