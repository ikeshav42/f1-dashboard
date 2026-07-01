"use client"

import { useEffect, useState } from "react"
import Leaderboard from "./Leaderboard"
import LapChart from "./LapChart"
import { LeaderboardSkeleton } from "./Skeleton"
import RaceControlCard, { RcMessage } from "./RaceControlCard"

const API = process.env.NEXT_PUBLIC_API_URL ?? ""

interface Meeting {
  meeting_key: number
  meeting_name: string
  circuit_short_name: string
  country_name: string
  country_code: string
  date_start: string
  date_end: string
  round_number: number
}

interface Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
}

const ISO3_TO_2: Record<string, string> = {
  AUS: "AU", CHN: "CN", JPN: "JP", BRN: "BH", SAU: "SA", KSA: "SA", USA: "US",
  ITA: "IT", MCO: "MC", MON: "MC", CAN: "CA", ESP: "ES", AUT: "AT", GBR: "GB",
  HUN: "HU", BEL: "BE", NLD: "NL", NED: "NL", AZE: "AZ", SGP: "SG", MEX: "MX",
  BRA: "BR", UAE: "AE", QAT: "QA",
}

function flagEmoji(code: string) {
  const iso2 = code?.length === 3 ? ISO3_TO_2[code.toUpperCase()] : code?.toUpperCase()
  if (!iso2 || iso2.length !== 2) return ""
  return String.fromCodePoint(...[...iso2].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

function formatDate(iso: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

type ViewMode = "results" | "chart"
type QualiSeg = "q1" | "q2" | "q3"

function isQualifying(session_type: string) {
  return session_type.toLowerCase().includes("qualifying")
}

export default function History() {
  const [meetings, setMeetings]         = useState<Meeting[]>([])
  const [sessions, setSessions]         = useState<Session[]>([])
  const [drivers, setDrivers]           = useState<any[]>([])
  const [lapData, setLapData]           = useState<{ drivers: any[]; events: any[] } | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [rcMessages, setRcMessages]     = useState<RcMessage[]>([])
  const [showRC, setShowRC]             = useState(true)
  const [expanded, setExpanded]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)
  const [view, setView]                 = useState<ViewMode>("results")
  const [error, setError]               = useState("")
  const [qualiData, setQualiData]       = useState<Record<QualiSeg, any[]> | null>(null)
  const [qualiSeg, setQualiSeg]         = useState<QualiSeg>("q3")

  useEffect(() => {
    fetch(API + "/api/history/meetings")
      .then(r => r.json())
      .then((data: Meeting[]) => {
        const now = Date.now()
        setMeetings(
          data
            .filter(m =>
              new Date(m.date_end).getTime() < now &&
              m.meeting_name.toLowerCase().includes("grand prix")
            )
            .reverse()
        )
      })
      .catch(() => setError("Could not load meetings"))
  }, [])

  async function selectMeeting(m: Meeting) {
    setSelectedMeeting(m)
    setSelectedSession(null)
    setDrivers([])
    setLapData(null)
    setQualiData(null)
    setError("")
    setView("results")
    setLoading(true)
    try {
      const res = await fetch(API + "/api/history/sessions?meeting_key=" + m.meeting_key)
      setSessions(await res.json())
    } catch {
      setError("Could not load sessions")
    } finally {
      setLoading(false)
    }
  }

  async function selectSession(s: Session) {
    setSelectedSession(s)
    setDrivers([])
    setLapData(null)
    setRcMessages([])
    setQualiData(null)
    setQualiSeg("q3")
    setShowRC(true)
    setExpanded(false)
    setError("")
    setView("results")
    setLoading(true)
    try {
      if (isQualifying(s.session_type)) {
        const [lbRes, rcRes, qRes] = await Promise.all([
          fetch(API + "/api/history/leaderboard?session_key=" + s.session_key, { cache: "no-store" }),
          fetch(API + "/api/history/race_control?session_key=" + s.session_key),
          fetch(API + "/api/history/qualifying?session_key=" + s.session_key),
        ])
        const [lb, rc, qd] = await Promise.all([lbRes.json(), rcRes.json(), qRes.json()])
        setDrivers(lb)
        setRcMessages(rc)
        setQualiData(qd)
      } else {
        const [lbRes, rcRes] = await Promise.all([
          fetch(API + "/api/history/leaderboard?session_key=" + s.session_key, { cache: "no-store" }),
          fetch(API + "/api/history/race_control?session_key=" + s.session_key),
        ])
        const [lb, rc] = await Promise.all([lbRes.json(), rcRes.json()])
        setDrivers(lb)
        setRcMessages(rc)
      }
    } catch {
      setError("Could not load session data")
    } finally {
      setLoading(false)
    }
  }

  async function loadChart() {
    if (!selectedSession) return
    setView("chart")
    if (lapData !== null) return
    setLoadingChart(true)
    try {
      const res = await fetch(API + "/api/history/laps?session_key=" + selectedSession.session_key)
      setLapData(await res.json())
    } catch {
      setError("Could not load lap data")
    } finally {
      setLoadingChart(false)
    }
  }

  const hasResults    = !loading && drivers.length > 0
  const isQuali       = selectedSession ? isQualifying(selectedSession.session_type) : false
  const displayDrivers = isQuali && qualiData ? (qualiData[qualiSeg] ?? []) : drivers

  return (
    <div className="flex gap-6 mt-1">
      {/* Meeting list — hidden when chart is expanded */}
      <div className={`w-56 flex-shrink-0 ${expanded && view === "chart" ? "hidden" : ""}`}>
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Grand Prix</p>
        <div className="space-y-0.5 max-h-[70vh] overflow-y-auto pr-1">
          {meetings.map(m => (
            <button
              key={m.meeting_key}
              onClick={() => selectMeeting(m)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedMeeting?.meeting_key === m.meeting_key
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
              }`}
            >
              <div className="text-xs text-gray-600 mb-0.5">R{m.round_number}</div>
              <div className="font-medium truncate">
                {flagEmoji(m.country_code)} {m.circuit_short_name}
              </div>
              <div className="text-xs text-gray-600">{formatDate(m.date_start)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Session + data panel */}
      <div className="flex-1 min-w-0">
        {!selectedMeeting && (
          <p className="text-gray-600 text-sm mt-8">Select a Grand Prix</p>
        )}

        {selectedMeeting && (
          <>
            {/* meeting header + session tabs */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">{selectedMeeting.meeting_name}</h2>
              <div className="flex gap-2 mt-2 flex-wrap">
                {sessions.map(s => (
                  <button
                    key={s.session_key}
                    onClick={() => selectSession(s)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      selectedSession?.session_key === s.session_key
                        ? "bg-red-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {s.session_name}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-yellow-600 text-sm mb-3">{error}</p>}

            {loading && <LeaderboardSkeleton />}

            {hasResults && (
              <>
                {/* toolbar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-gray-600 text-xs">
                      {selectedSession?.session_name} · {formatDate(selectedSession?.date_start ?? "")}
                    </p>
                    {displayDrivers.length > 0 && (
                      <p className="text-yellow-500 text-xs font-semibold">
                        🏆 {displayDrivers[0].driver_abbr} — {displayDrivers[0].team_name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 text-xs">
                    {/* Q1/Q2/Q3 toggles for qualifying sessions */}
                    {isQuali && qualiData && (
                      <>
                        {(["q1", "q2", "q3"] as QualiSeg[]).map(seg => (
                          <button
                            key={seg}
                            onClick={() => { setView("results"); setQualiSeg(seg) }}
                            className={`px-3 py-1 rounded transition-colors ${
                              view === "results" && qualiSeg === seg
                                ? "bg-red-700 text-white"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {seg.toUpperCase()}
                          </button>
                        ))}
                        <div className="w-px bg-gray-800 mx-1" />
                      </>
                    )}
                    {!isQuali && (
                      <button
                        onClick={() => setView("results")}
                        className={`px-3 py-1 rounded transition-colors ${
                          view === "results"
                            ? "bg-gray-700 text-white"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        Results
                      </button>
                    )}
                    <button
                      onClick={loadChart}
                      className={`px-3 py-1 rounded transition-colors ${
                        view === "chart"
                          ? "bg-gray-700 text-white"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Lap Chart
                    </button>
                    {rcMessages.length > 0 && (
                      <button
                        onClick={() => setShowRC(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                          showRC
                            ? "bg-gray-700 text-white"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        Race Control
                      </button>
                    )}
                    {view === "chart" && (
                      <button
                        onClick={() => setExpanded(v => !v)}
                        className={`px-3 py-1 rounded transition-colors ${
                          expanded
                            ? "bg-gray-700 text-white"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                    )}
                  </div>
                </div>

                {view === "results" && (
                  <div className="flex gap-5 items-start">
                    <div className="flex-1 min-w-0">
                      <Leaderboard drivers={displayDrivers} />
                    </div>
                    {showRC && rcMessages.length > 0 && (
                      <div className="w-72 flex-shrink-0">
                        <RaceControlCard messages={rcMessages} />
                      </div>
                    )}
                  </div>
                )}

                {view === "chart" && (
                  <div className="flex gap-5 items-start">
                    <div className="flex-1 min-w-0">
                      {loadingChart
                        ? <LeaderboardSkeleton />
                        : lapData !== null && lapData.drivers.length > 0
                          ? <LapChart driverLaps={lapData.drivers} events={lapData.events} />
                          : <p className="text-gray-600 text-sm">No lap data available</p>
                      }
                    </div>
                    {showRC && rcMessages.length > 0 && !expanded && (
                      <div className="w-72 flex-shrink-0">
                        <RaceControlCard messages={rcMessages} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!loading && !error && selectedSession && drivers.length === 0 && (
              <p className="text-gray-600 text-sm">No data available for this session</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
