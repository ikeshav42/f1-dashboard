import asyncio
import time
from datetime import datetime, timezone
import httpx

BASE_URL = "https://api.openf1.org/v1"

_openf1_lock = asyncio.Lock()

TEAM_COLORS = {
    "Mercedes":        "#27F4D2",
    "Red Bull Racing": "#3671C6",
    "Ferrari":         "#E8002D",
    "McLaren":         "#FF8000",
    "Aston Martin":    "#229971",
    "Alpine":          "#FF87BC",
    "Williams":        "#64C4FF",
    "Racing Bulls":    "#6692FF",
    "Haas F1 Team":    "#B6BABD",
    "Audi":            "#C23B22",
    "Cadillac":        "#FFFFFF",
    "Sauber":          "#52E252",
}


async def _get(client, path, params=None, retries=3):
    for attempt in range(retries):
        try:
            resp = await client.get(BASE_URL + path, params=params, timeout=15)
            if resp.status_code == 429:
                wait = (attempt + 1) * 3
                print(f"OpenF1 429 on {path} — retrying in {wait}s (attempt {attempt+1}/{retries})")
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"OpenF1 request failed for {path}: {e}")
            return []
    print(f"OpenF1 gave up on {path} after {retries} attempts")
    return []


_REQUEST_GAP         = 0.5   # seconds — live poll
_REQUEST_GAP_HISTORY = 1.0   # seconds — historical fetches


async def _get_spaced(client, path, params=None, gap=None):
    await asyncio.sleep(gap if gap is not None else _REQUEST_GAP)
    return await _get(client, path, params=params)


async def fetch_session(client):
    data = await _get(client, "/sessions", params={"session_key": "latest"})
    if not data:
        return {}
    return data[-1]


def format_lap_time(seconds):
    if seconds is None:
        return "—"
    try:
        total = float(seconds)
        mins = int(total // 60)
        secs = total % 60
        return f"{mins}:{secs:06.3f}"
    except (ValueError, TypeError):
        return "—"


def _format_sector(seconds):
    if seconds is None:
        return "—"
    try:
        return f"{float(seconds):.3f}"
    except (ValueError, TypeError):
        return "—"


def _format_gap(value):
    if value is None:
        return "—"
    try:
        f = float(value)
    except (ValueError, TypeError):
        return str(value) if value else "—"
    if f == 0.0:
        return "—"
    return f"+{f:.3f}"


def build_leaderboard(positions, intervals, laps, drivers, stints, pits):
    driver_map = {}
    for d in drivers:
        num = d.get("driver_number")
        if num is not None:
            driver_map[num] = {
                "driver_name": d.get("full_name") or d.get("last_name", "—"),
                "driver_abbr": d.get("name_acronym", "???"),
                "team_name":   d.get("team_name", "—"),
            }

    interval_map = {}
    for entry in intervals:
        num = entry.get("driver_number")
        if num is not None:
            interval_map[num] = entry

    lap_map = {}
    for entry in laps:
        num = entry.get("driver_number")
        if num is None:
            continue
        cur = lap_map.get(num)
        new_lap = entry.get("lap_number", 0)
        if cur is None:
            lap_map[num] = entry
            continue
        cur_has_time = cur.get("lap_duration") is not None
        new_has_time = entry.get("lap_duration") is not None
        cur_lap = cur.get("lap_number", 0)
        # final lap of a race often has null duration — prefer last lap with valid timing
        if new_has_time and (not cur_has_time or new_lap > cur_lap):
            lap_map[num] = entry
        elif not cur_has_time and not new_has_time and new_lap > cur_lap:
            lap_map[num] = entry

    stint_map = {}
    for entry in stints:
        num = entry.get("driver_number")
        if num is not None:
            stint_map[num] = entry

    pit_map = {}
    for entry in pits:
        num = entry.get("driver_number")
        if num is not None:
            pit_map[num] = entry

    pos_map = {}
    for entry in positions:
        num = entry.get("driver_number")
        if num is not None:
            pos_map[num] = entry

    rows = []
    for driver_number, pos_entry in pos_map.items():
        position = pos_entry.get("position", 0)

        info = driver_map.get(driver_number, {})
        driver_name = info.get("driver_name", "—")
        driver_abbr = info.get("driver_abbr", "???")
        team_name   = info.get("team_name", "—")
        team_color  = TEAM_COLORS.get(team_name, "#FFFFFF")

        iv = interval_map.get(driver_number, {})
        gap_raw = iv.get("gap_to_leader")
        gap_to_leader = "—" if (gap_raw == 0 or gap_raw == 0.0) else _format_gap(gap_raw)
        interval = _format_gap(iv.get("interval"))

        lap_entry = lap_map.get(driver_number, {})
        last_lap_time = format_lap_time(lap_entry.get("lap_duration"))
        sector_1 = _format_sector(lap_entry.get("duration_sector_1"))
        sector_2 = _format_sector(lap_entry.get("duration_sector_2"))
        sector_3 = _format_sector(lap_entry.get("duration_sector_3"))

        stint_entry = stint_map.get(driver_number, {})
        tyre_compound = stint_entry.get("compound", "—") or "—"

        pit_entry = pit_map.get(driver_number, {})
        is_in_pit = (
            pit_entry.get("pit_in_lap") is not None
            and pit_entry.get("pit_out_lap") is None
        )

        rows.append({
            "position":      position,
            "driver_number": driver_number,
            "driver_name":   driver_name,
            "driver_abbr":   driver_abbr,
            "team_name":     team_name,
            "team_color":    team_color,
            "gap_to_leader": gap_to_leader,
            "interval":      interval,
            "last_lap_time": last_lap_time,
            "sector_1":      sector_1,
            "sector_2":      sector_2,
            "sector_3":      sector_3,
            "tyre_compound": tyre_compound.upper(),
            "is_in_pit":     is_in_pit,
        })

    rows.sort(key=lambda r: r["position"])
    return rows


def summarise_race_control(messages):
    if not messages:
        return []
    sorted_msgs = sorted(messages, key=lambda m: m.get("date", ""), reverse=True)
    return [
        {
            "flag":    m.get("flag", ""),
            "message": m.get("message", ""),
            "date":    m.get("date", ""),
        }
        for m in sorted_msgs[:3]
    ]


_cache = {
    "drivers": {"data": [], "ts": 0},
    "stints":  {"data": [], "ts": 0},
}
_DRIVER_TTL = 120
_STINTS_TTL = 30


async def get_leaderboard_data():
    now = time.time()
    async with _openf1_lock:
        async with httpx.AsyncClient() as client:
            positions = await _get(client, "/position",        params={"session_key": "latest"})
            intervals = await _get_spaced(client, "/intervals",    params={"session_key": "latest"})
            laps      = await _get_spaced(client, "/laps",         params={"session_key": "latest"})
            pits      = await _get_spaced(client, "/pit",          params={"session_key": "latest"})
            rc        = await _get_spaced(client, "/race_control",  params={"session_key": "latest"})

            if now - _cache["drivers"]["ts"] > _DRIVER_TTL:
                fresh = await _get_spaced(client, "/drivers", params={"session_key": "latest"})
                if fresh:
                    _cache["drivers"]["data"] = fresh
                    _cache["drivers"]["ts"] = now
            if now - _cache["stints"]["ts"] > _STINTS_TTL:
                fresh = await _get_spaced(client, "/stints", params={"session_key": "latest"})
                if fresh:
                    _cache["stints"]["data"] = fresh
                    _cache["stints"]["ts"] = now

        leaderboard = build_leaderboard(
            positions, intervals, laps,
            _cache["drivers"]["data"],
            _cache["stints"]["data"],
            pits,
        )
        race_control = summarise_race_control(rc)
        return leaderboard, race_control


async def get_meetings(year: int):
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/meetings", params={"year": year})
    result = []
    for m in data:
        result.append({
            "meeting_key":        m["meeting_key"],
            "meeting_name":       m.get("meeting_name", "—"),
            "circuit_short_name": m.get("circuit_short_name", "—"),
            "country_name":       m.get("country_name", "—"),
            "country_code":       m.get("country_code", ""),
            "date_start":         m.get("date_start", ""),
            "date_end":           m.get("date_end", ""),
        })
    result.sort(key=lambda m: m["date_start"])
    gp_round = 0
    for m in result:
        if "grand prix" in m["meeting_name"].lower():
            gp_round += 1
            m["round_number"] = gp_round
        else:
            m["round_number"] = 0
    return result


async def get_sessions_for_meeting(meeting_key: int):
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/sessions", params={"meeting_key": meeting_key})
    sessions = []
    for s in data:
        sessions.append({
            "session_key":  s["session_key"],
            "session_name": s["session_name"],
            "session_type": s.get("session_type", ""),
            "date_start":   s.get("date_start", ""),
        })
    sessions.sort(key=lambda s: s["date_start"])
    return sessions


_history_cache: dict[int, list] = {}
_laps_cache: dict[int, list] = {}


async def get_leaderboard_for_session(session_key: int):
    if session_key in _history_cache:
        return _history_cache[session_key]

    g = _REQUEST_GAP_HISTORY
    async with _openf1_lock:
        async with httpx.AsyncClient() as client:
            positions = await _get(client, "/position",    params={"session_key": session_key})
            intervals = await _get_spaced(client, "/intervals", params={"session_key": session_key}, gap=g)
            laps      = await _get_spaced(client, "/laps",      params={"session_key": session_key}, gap=g)
            pits      = await _get_spaced(client, "/pit",       params={"session_key": session_key}, gap=g)
            drivers   = await _get_spaced(client, "/drivers",   params={"session_key": session_key}, gap=g)
            stints    = await _get_spaced(client, "/stints",    params={"session_key": session_key}, gap=g)

        result = build_leaderboard(positions, intervals, laps, drivers, stints, pits)
        if result:
            _history_cache[session_key] = result
        return result


def _extract_race_events(rc_messages):
    events = []
    msgs = sorted(rc_messages, key=lambda m: m.get("date", ""))
    sc_start = None
    vsc_start = None
    for m in msgs:
        msg = m.get("message", "") or ""
        lap = m.get("lap_number")
        if lap is None:
            continue
        if "SAFETY CAR DEPLOYED" in msg:
            sc_start = lap
        elif sc_start is not None and ("SAFETY CAR IN THIS LAP" in msg or "SAFETY CAR RETURNING" in msg):
            events.append({"type": "SC", "lap_start": sc_start, "lap_end": lap + 1})
            sc_start = None
        elif "VSC DEPLOYED" in msg:
            vsc_start = lap
        elif vsc_start is not None and "VSC ENDING" in msg:
            events.append({"type": "VSC", "lap_start": vsc_start, "lap_end": lap + 1})
            vsc_start = None
    if sc_start is not None:
        events.append({"type": "SC",  "lap_start": sc_start,  "lap_end": sc_start  + 5})
    if vsc_start is not None:
        events.append({"type": "VSC", "lap_start": vsc_start, "lap_end": vsc_start + 3})
    return events


async def get_lap_times_for_session(session_key: int):
    if session_key in _laps_cache:
        return _laps_cache[session_key]

    g = _REQUEST_GAP_HISTORY
    async with _openf1_lock:
        async with httpx.AsyncClient() as client:
            laps    = await _get(client, "/laps",         params={"session_key": session_key})
            drivers = await _get_spaced(client, "/drivers",      params={"session_key": session_key}, gap=g)
            rc      = await _get_spaced(client, "/race_control", params={"session_key": session_key}, gap=g)

    driver_info = {}
    for d in drivers:
        num = d.get("driver_number")
        if num is None:
            continue
        team = d.get("team_name", "—")
        driver_info[num] = {
            "driver_abbr": d.get("name_acronym", "???"),
            "team_name":   team,
            "team_color":  TEAM_COLORS.get(team, "#FFFFFF"),
        }

    driver_laps: dict = {}
    for lap in laps:
        num      = lap.get("driver_number")
        lap_num  = lap.get("lap_number")
        lap_time = lap.get("lap_duration")
        if num is None or lap_num is None or lap_time is None:
            continue
        if num not in driver_laps:
            driver_laps[num] = []
        driver_laps[num].append({"lap": lap_num, "time": round(float(lap_time), 3)})

    driver_list = []
    for num, lap_list in driver_laps.items():
        info = driver_info.get(num, {})
        lap_list.sort(key=lambda x: x["lap"])
        driver_list.append({
            "driver_number": num,
            "driver_abbr":   info.get("driver_abbr", "???"),
            "team_name":     info.get("team_name", "—"),
            "team_color":    info.get("team_color", "#FFFFFF"),
            "laps":          lap_list,
        })

    driver_list.sort(key=lambda d: d["driver_abbr"])
    events = _extract_race_events(rc)
    result = {"drivers": driver_list, "events": events}
    if driver_list:
        _laps_cache[session_key] = result
    return result


def _parse_dt(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


async def get_schedule_data():
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient() as client:
        sessions = await _get(client, "/sessions", params={"year": now.year})

    if not sessions:
        return {}

    for s in sessions:
        s["_start"] = _parse_dt(s.get("date_start", ""))
        s["_end"]   = _parse_dt(s.get("date_end", ""))

    sessions = [s for s in sessions if s["_start"]]
    sessions.sort(key=lambda s: s["_start"])

    next_ending = next((s for s in sessions if s["_end"] and s["_end"] > now), None)
    target_meeting = next_ending["meeting_key"] if next_ending else (sessions[-1]["meeting_key"] if sessions else None)
    if not target_meeting:
        return {}

    meeting_sessions = [s for s in sessions if s.get("meeting_key") == target_meeting]
    next_session = next((s for s in meeting_sessions if s["_end"] and s["_end"] > now), None)

    # /sessions returns meeting_name=None; must fetch from /meetings
    async with httpx.AsyncClient() as client:
        meetings = await _get(client, "/meetings", params={"meeting_key": target_meeting})
    info = meetings[0] if meetings else {}

    return {
        "meeting_name":       info.get("meeting_name") or "—",
        "country_name":       info.get("country_name") or "—",
        "circuit_short_name": info.get("circuit_short_name") or "—",
        "year":               now.year,
        "sessions": [
            {
                "session_key":  s["session_key"],
                "session_name": s["session_name"],
                "date_start":   s.get("date_start", ""),
                "date_end":     s.get("date_end", ""),
                "is_past":      bool(s["_end"] and s["_end"] < now),
                "is_next":      s is next_session,
            }
            for s in meeting_sessions
        ],
        "next_session_start": next_session["date_start"] if next_session else None,
        "next_session_name":  next_session["session_name"] if next_session else None,
    }
