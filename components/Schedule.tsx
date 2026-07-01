"use client"

import { useEffect, useState } from "react"

interface SessionEntry {
  session_key: number
  session_name: string
  date_start: string
  date_end: string
  is_past: boolean
  is_next: boolean
}

interface ScheduleData {
  meeting_name?: string
  country_name?: string
  circuit_short_name?: string
  year?: number
  sessions?: SessionEntry[]
  next_session_start?: string
  next_session_name?: string
}

function useCountdown(target: string | null | undefined) {
  const [remaining, setRemaining] = useState("")

  useEffect(() => {
    if (!target) {
      setRemaining("")
      return
    }

    function tick() {
      const diff = new Date(target!).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining("Starting now")
        return
      }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setRemaining(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
          : `${m}m ${String(s).padStart(2, "0")}s`
      )
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return remaining
}

function formatSessionTime(iso: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month:   "short",
      day:     "numeric",
      hour:    "2-digit",
      minute:  "2-digit",
    })
  } catch {
    return iso
  }
}

export default function Schedule({ data }: { data: ScheduleData }) {
  const countdown = useCountdown(data.next_session_start)

  if (!data.meeting_name) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">No session data available</p>
        <p className="text-sm mt-2">Check back during a race weekend</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-10">
      <div className="text-center mb-8">
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-1">
          {data.year} · {data.circuit_short_name}
        </p>
        <h2 className="text-3xl font-bold text-white">{data.meeting_name}</h2>
        <p className="text-gray-400 text-sm mt-1">{data.country_name}</p>
      </div>

      {data.next_session_start && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6 text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">
            Next — {data.next_session_name}
          </p>
          <p className="text-4xl font-mono font-bold text-white">{countdown}</p>
        </div>
      )}

      {!data.next_session_start && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6 text-center">
          <p className="text-gray-400 text-sm">All sessions for this weekend are complete</p>
        </div>
      )}

      <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
        {(data.sessions ?? []).map((s) => (
          <div
            key={s.session_key}
            className={`flex justify-between items-center px-4 py-3 text-sm ${
              s.is_next
                ? "bg-gray-800 text-white"
                : s.is_past
                ? "text-gray-600"
                : "text-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {s.is_next && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
              <span className={s.is_next ? "font-semibold" : ""}>{s.session_name}</span>
            </div>
            <span className="text-xs tabular-nums">{formatSessionTime(s.date_start)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
