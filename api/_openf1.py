import asyncio
import httpx
from datetime import datetime, timezone

BASE = "https://api.openf1.org/v1"

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


async def _get(client, path, params=None):
    for attempt in range(3):
        try:
            if attempt > 0:
                await asyncio.sleep(attempt * 1.5)
            r = await client.get(BASE + path, params=params, timeout=15)
            if r.status_code == 429:
                continue
            r.raise_for_status()
            return r.json()
        except Exception:
            return []
    return []


async def _get_live(client, path, params=None):
    try:
        r = await client.get(BASE + path, params=params, timeout=4)
        if not r.is_success:
            return []
        return r.json()
    except Exception:
        return []


def _fmt_gap(value):
    if value is None:
        return "—"
    try:
        f = float(value)
    except (ValueError, TypeError):
        return str(value) if value else "—"
    if f == 0.0:
        return "—"
    return f"+{f:.3f}"


def _fmt_sector(value):
    if value is None:
        return "—"
    try:
        return f"{float(value):.3f}"
    except (ValueError, TypeError):
        return "—"


def _fmt_lap(seconds):
    if seconds is None:
        return "—"
    try:
        total = float(seconds)
        mins = int(total // 60)
        secs = total % 60
        return f"{mins}:{secs:06.3f}"
    except (ValueError, TypeError):
        return "—"


def build_leaderboard(positions, intervals, laps, drivers, stints, pits):
    driver_map   = {d["driver_number"]: d for d in drivers if "driver_number" in d}
    interval_map = {e["driver_number"]: e for e in intervals if "driver_number" in e}
    stint_map    = {e["driver_number"]: e for e in stints if "driver_number" in e}
    pit_map      = {e["driver_number"]: e for e in pits if "driver_number" in e}
    pos_map      = {e["driver_number"]: e for e in positions if "driver_number" in e}

    lap_map = {}
    for e in laps:
        num = e.get("driver_number")
        if num is None:
            continue
        cur = lap_map.get(num)
        if not cur:
            lap_map[num] = e
            continue
        new_has = e.get("lap_duration") is not None
        cur_has = cur.get("lap_duration") is not None
        if new_has and (not cur_has or e["lap_number"] > cur["lap_number"]):
            lap_map[num] = e
        elif not new_has and not cur_has and e["lap_number"] > cur["lap_number"]:
            lap_map[num] = e

    rows = []
    for num, pos in pos_map.items():
        d     = driver_map.get(num, {})
        iv    = interval_map.get(num, {})
        lap   = lap_map.get(num, {})
        stint = stint_map.get(num, {})
        pit   = pit_map.get(num, {})
        team  = d.get("team_name", "—")
        gap_raw = iv.get("gap_to_leader")
        rows.append({
            "position":      pos.get("position", 0),
            "driver_number": num,
            "driver_name":   d.get("full_name") or d.get("last_name", "—"),
            "driver_abbr":   d.get("name_acronym", "???"),
            "team_name":     team,
            "team_color":    TEAM_COLORS.get(team, "#FFFFFF"),
            "gap_to_leader": "—" if gap_raw in (0, 0.0) else _fmt_gap(gap_raw),
            "interval":      _fmt_gap(iv.get("interval")),
            "last_lap_time": _fmt_lap(lap.get("lap_duration")),
            "sector_1":      _fmt_sector(lap.get("duration_sector_1")),
            "sector_2":      _fmt_sector(lap.get("duration_sector_2")),
            "sector_3":      _fmt_sector(lap.get("duration_sector_3")),
            "tyre_compound": (stint.get("compound") or "—").upper(),
            "is_in_pit":     pit.get("pit_in_lap") is not None and pit.get("pit_out_lap") is None,
        })

    rows.sort(key=lambda r: r["position"])
    return rows


def extract_race_events(rc_messages):
    events = []
    msgs = sorted(rc_messages, key=lambda m: m.get("date", ""))
    sc_start = vsc_start = None
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
        events.append({"type": "SC",  "lap_start": sc_start,  "lap_end": sc_start + 5})
    if vsc_start is not None:
        events.append({"type": "VSC", "lap_start": vsc_start, "lap_end": vsc_start + 3})
    return events


# ── live data ──────────────────────────────────────────────────────────────────

async def fetch_leaderboard():
    async with httpx.AsyncClient() as client:
        drivers = await _get_live(client, "/drivers", {"session_key": "latest"})
        pos, ivs, stints = await asyncio.gather(
            _get_live(client, "/position",  {"session_key": "latest"}),
            _get_live(client, "/intervals", {"session_key": "latest"}),
            _get_live(client, "/stints",    {"session_key": "latest"}),
        )
    return build_leaderboard(pos, ivs, [], drivers, stints, [])


def _format_rc_msgs(data):
    msgs = sorted(data, key=lambda m: m.get("date", ""), reverse=True)
    return [
        {
            "flag":       m.get("flag", ""),
            "message":    m.get("message", ""),
            "date":       m.get("date", ""),
            "lap_number": m.get("lap_number"),
            "category":   m.get("category", ""),
        }
        for m in msgs
    ]


async def fetch_race_control():
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/race_control", {"session_key": "latest"})
    return _format_rc_msgs(data)


async def fetch_race_control_for_session(session_key: int):
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/race_control", {"session_key": session_key})
    return _format_rc_msgs(data)


async def fetch_session():
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/sessions", {"session_key": "latest"})
    if not data:
        return {}
    s = data[-1]
    status = "Unknown"
    try:
        dt = datetime.fromisoformat(s.get("date_start", "").replace("Z", "+00:00"))
        delta = (datetime.now(timezone.utc) - dt).total_seconds()
        status = "LIVE" if 0 <= delta <= 10800 else "Final"
    except Exception:
        pass
    return {
        "session_key":        s.get("session_key"),
        "session_name":       s.get("session_name"),
        "circuit_short_name": s.get("circuit_short_name"),
        "session_type":       s.get("session_type"),
        "date_start":         s.get("date_start"),
        "year":               s.get("year"),
        "status":             status,
    }


async def fetch_schedule():
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient() as client:
        sessions = await _get(client, "/sessions", {"year": now.year})
    if not sessions:
        return {}

    def _dt(s):
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None

    for s in sessions:
        s["_start"] = _dt(s.get("date_start", ""))
        s["_end"]   = _dt(s.get("date_end", ""))

    sessions = [s for s in sessions if s["_start"]]
    sessions.sort(key=lambda s: s["_start"])

    next_ending = next((s for s in sessions if s["_end"] and s["_end"] > now), None)
    target = next_ending["meeting_key"] if next_ending else (sessions[-1]["meeting_key"] if sessions else None)
    if not target:
        return {}

    meeting_sessions = [s for s in sessions if s.get("meeting_key") == target]
    next_session = next((s for s in meeting_sessions if s["_end"] and s["_end"] > now), None)

    async with httpx.AsyncClient() as client:
        meetings = await _get(client, "/meetings", {"meeting_key": target})
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


# ── history data ───────────────────────────────────────────────────────────────

async def fetch_meetings(year):
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/meetings", {"year": year})
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


async def fetch_sessions_for_meeting(meeting_key):
    async with httpx.AsyncClient() as client:
        data = await _get(client, "/sessions", {"meeting_key": meeting_key})
    sessions = [
        {
            "session_key":  s["session_key"],
            "session_name": s["session_name"],
            "session_type": s.get("session_type", ""),
            "date_start":   s.get("date_start", ""),
        }
        for s in data
    ]
    sessions.sort(key=lambda s: s["date_start"])
    return sessions


def build_timed_leaderboard(laps, drivers, stints):
    """For qualifying and practice: rank by best lap, compute gaps from lap delta."""
    driver_map = {d["driver_number"]: d for d in drivers if "driver_number" in d}

    # keep the last stint per driver (most recent compound)
    stint_map = {}
    for s in stints:
        num = s.get("driver_number")
        if num is None:
            continue
        if num not in stint_map or s.get("stint_number", 0) > stint_map[num].get("stint_number", 0):
            stint_map[num] = s

    # find best (minimum) timed lap per driver
    best_map = {}
    for lap in laps:
        num      = lap.get("driver_number")
        duration = lap.get("lap_duration")
        if num is None or duration is None:
            continue
        try:
            t = float(duration)
        except (ValueError, TypeError):
            continue
        if num not in best_map or t < float(best_map[num]["lap_duration"]):
            best_map[num] = lap

    if not best_map:
        return []

    ranked = sorted(best_map.items(), key=lambda x: float(x[1]["lap_duration"]))
    pole_time = float(ranked[0][1]["lap_duration"])

    rows = []
    prev_time = pole_time
    for pos_idx, (num, lap) in enumerate(ranked):
        d     = driver_map.get(num, {})
        stint = stint_map.get(num, {})
        team  = d.get("team_name", "—")
        t     = float(lap["lap_duration"])
        gap   = t - pole_time
        ivl   = t - prev_time
        prev_time = t
        rows.append({
            "position":      pos_idx + 1,
            "driver_number": num,
            "driver_name":   d.get("full_name") or d.get("last_name", "—"),
            "driver_abbr":   d.get("name_acronym", "???"),
            "team_name":     team,
            "team_color":    TEAM_COLORS.get(team, "#FFFFFF"),
            "gap_to_leader": "—" if gap == 0 else f"+{gap:.3f}",
            "interval":      "—" if ivl == 0 else f"+{ivl:.3f}",
            "last_lap_time": _fmt_lap(lap.get("lap_duration")),
            "sector_1":      _fmt_sector(lap.get("duration_sector_1")),
            "sector_2":      _fmt_sector(lap.get("duration_sector_2")),
            "sector_3":      _fmt_sector(lap.get("duration_sector_3")),
            "tyre_compound": (stint.get("compound") or "—").upper(),
            "is_in_pit":     False,
        })
    return rows


async def fetch_history_leaderboard(session_key):
    # fetch session type and driver info first
    async with httpx.AsyncClient() as client:
        sessions_data, drivers = await asyncio.gather(
            _get(client, "/sessions", {"session_key": session_key}),
            _get(client, "/drivers",  {"session_key": session_key}),
        )

    stype = (sessions_data[0].get("session_type", "") if sessions_data else "").lower()
    # practice, qualifying, sprint qualifying, sprint shootout → use best-lap ranking
    use_timed = stype not in ("race", "sprint")

    if use_timed:
        async with httpx.AsyncClient() as client:
            laps, stints = await asyncio.gather(
                _get(client, "/laps",   {"session_key": session_key}),
                _get(client, "/stints", {"session_key": session_key}),
            )
        return build_timed_leaderboard(laps, drivers, stints)
    else:
        async with httpx.AsyncClient() as client:
            pos, ivs = await asyncio.gather(
                _get(client, "/position",  {"session_key": session_key}),
                _get(client, "/intervals", {"session_key": session_key}),
            )
            laps, pits, stints = await asyncio.gather(
                _get(client, "/laps",   {"session_key": session_key}),
                _get(client, "/pit",    {"session_key": session_key}),
                _get(client, "/stints", {"session_key": session_key}),
            )
        return build_leaderboard(pos, ivs, laps, drivers, stints, pits)


def _split_qualifying_segments(laps, rc_messages):
    """Split qualifying laps into [q1_laps, q2_laps, q3_laps] using RC green/chequered boundaries."""
    boundaries = []
    for m in rc_messages:
        flag = (m.get("flag") or "").upper()
        date = m.get("date", "")
        if date and flag in ("GREEN", "CHEQUERED"):
            boundaries.append({"type": flag, "date": date})
    boundaries.sort(key=lambda x: x["date"])

    segments = []  # list of (start_date, end_date) strings
    i = 0
    while i < len(boundaries) and len(segments) < 3:
        if boundaries[i]["type"] == "GREEN":
            start = boundaries[i]["date"]
            j = i + 1
            while j < len(boundaries) and boundaries[j]["type"] != "CHEQUERED":
                j += 1
            if j < len(boundaries):
                segments.append((start, boundaries[j]["date"]))
                i = j + 1
            else:
                i += 1
        else:
            i += 1

    if len(segments) >= 2:
        q_laps = [[], [], []]
        for lap in laps:
            lap_date = lap.get("date_start", "")
            if not lap_date:
                continue
            for idx, (start, end) in enumerate(segments):
                if start <= lap_date <= end:
                    q_laps[idx].append(lap)
                    break
        return q_laps

    # fallback: split by time gaps > 4 minutes between consecutive lap dates
    timed = sorted([l for l in laps if l.get("date_start")], key=lambda x: x["date_start"])
    if not timed:
        return [laps, [], []]
    groups = [[timed[0]]]
    for k in range(1, len(timed)):
        try:
            prev_dt = datetime.fromisoformat(timed[k-1]["date_start"].replace("Z", "+00:00"))
            curr_dt = datetime.fromisoformat(timed[k]["date_start"].replace("Z", "+00:00"))
            gap = (curr_dt - prev_dt).total_seconds()
        except Exception:
            gap = 0
        if gap > 240 and len(groups) < 3:
            groups.append([])
        groups[-1].append(timed[k])
    while len(groups) < 3:
        groups.append([])
    return groups[:3]


async def fetch_qualifying_segments(session_key):
    # sequential requests to stay under the 30/min rate limit
    async with httpx.AsyncClient() as client:
        laps    = await _get(client, "/laps",         {"session_key": session_key})
        await asyncio.sleep(0.5)
        drivers = await _get(client, "/drivers",      {"session_key": session_key})
        await asyncio.sleep(0.5)
        stints  = await _get(client, "/stints",       {"session_key": session_key})
        await asyncio.sleep(0.5)
        rc      = await _get(client, "/race_control", {"session_key": session_key})

    q1_laps, q2_laps, q3_laps = _split_qualifying_segments(laps, rc)
    return {
        "overall":       build_timed_leaderboard(laps, drivers, stints),
        "q1":            build_timed_leaderboard(q1_laps, drivers, stints),
        "q2":            build_timed_leaderboard(q2_laps, drivers, stints),
        "q3":            build_timed_leaderboard(q3_laps, drivers, stints),
        "race_control":  _format_rc_msgs(rc),
    }


async def fetch_lap_times(session_key):
    async with httpx.AsyncClient() as client:
        laps, drivers, rc = await asyncio.gather(
            _get(client, "/laps",         {"session_key": session_key}),
            _get(client, "/drivers",      {"session_key": session_key}),
            _get(client, "/race_control", {"session_key": session_key}),
        )

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

    driver_laps = {}
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
    return {"drivers": driver_list, "events": extract_race_events(rc)}
