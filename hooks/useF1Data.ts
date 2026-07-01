"use client"

import { useEffect, useRef, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL ?? ""
const POLL_MS = 4000

async function safeFetch(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export function useF1Data() {
  const [drivers, setDrivers]         = useState<any[]>([])
  const [session, setSession]         = useState<any>({})
  const [raceControl, setRaceControl] = useState<any[]>([])
  const [schedule, setSchedule]       = useState<any>({})
  const [lastUpdated, setLastUpdated] = useState("")
  const [error, setError]             = useState("")

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const scheduletick = useRef(0)

  async function poll() {
    let failed = 0

    await Promise.allSettled([
      safeFetch(API + "/api/leaderboard").then(lb => {
        if (lb?.length) setDrivers(lb)
      }).catch(() => { failed++ }),

      safeFetch(API + "/api/race_control").then(rc => {
        setRaceControl(rc ?? [])
      }).catch(() => { failed++ }),

      safeFetch(API + "/api/session/current").then(s => {
        if (s?.session_key) setSession(s)
      }).catch(() => { failed++ }),
    ])

    setLastUpdated(new Date().toLocaleTimeString())
    setError(failed === 3 ? "Waiting for backend..." : "")
  }

  async function fetchSchedule() {
    try {
      const data = await safeFetch(API + "/api/schedule")
      if (data?.meeting_name) setSchedule(data)
    } catch {
      // retries automatically every ~60s
    }
  }

  useEffect(() => {
    fetchSchedule()
    poll()
    intervalRef.current = setInterval(() => {
      poll()
      scheduletick.current = (scheduletick.current + 1) % 15
      if (scheduletick.current === 0) fetchSchedule()
    }, POLL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return { drivers, session, raceControl, schedule, lastUpdated, error }
}
