"use client"

import { useState, useEffect } from "react"
import SessionHeader from "@/components/SessionHeader"
import RaceControlCard from "@/components/RaceControlCard"
import Leaderboard from "@/components/Leaderboard"
import LapChart from "@/components/LapChart"
import Schedule from "@/components/Schedule"
import History from "@/components/History"
import { LeaderboardSkeleton } from "@/components/Skeleton"
import { useF1Data } from "@/hooks/useF1Data"

const API = process.env.NEXT_PUBLIC_API_URL ?? ""

type Tab = "leaderboard" | "schedule" | "history"
type MainView = "results" | "chart"

export default function Page() {
  const [tab, setTab]           = useState<Tab>("leaderboard")
  const [showRC, setShowRC]     = useState(true)
  const [mainView, setMainView] = useState<MainView>("results")
  const [lapData, setLapData]   = useState<{ drivers: any[]; events: any[] } | null>(null)
  const [loadingChart, setLoadingChart] = useState(false)
  const { drivers, session, raceControl, schedule, lastUpdated, error } = useF1Data()

  const isLive = session.status === "LIVE"

  if (isLive && tab !== "leaderboard") setTab("leaderboard")

  useEffect(() => {
    setLapData(null)
    setMainView("results")
  }, [session.session_key])

  async function loadChart() {
    if (!session.session_key) return
    setMainView("chart")
    if (lapData !== null) return
    setLoadingChart(true)
    try {
      const res = await fetch(API + "/api/history/laps?session_key=" + session.session_key)
      setLapData(await res.json())
    } catch {
      // silently ignore
    } finally {
      setLoadingChart(false)
    }
  }

  return (
    <main className="bg-gray-950 text-gray-100 min-h-screen p-6 font-mono">
      <div className="max-w-7xl mx-auto">
        <SessionHeader session={session} />

        <div className="flex gap-1 mb-5 border-b border-gray-800">
          <button
            onClick={() => setTab("leaderboard")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "leaderboard"
                ? "text-white border-b-2 border-red-500 -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {isLive ? "Live" : "Results"}
          </button>
          <button
            onClick={() => setTab("schedule")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "schedule"
                ? "text-white border-b-2 border-red-500 -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Schedule
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "history"
                ? "text-white border-b-2 border-red-500 -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            History
          </button>
        </div>

        {error && (
          <p className="text-yellow-600 text-xs mb-4">{error}</p>
        )}

        {tab === "leaderboard" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setMainView("results")}
                  className={`px-3 py-1 rounded transition-colors ${
                    mainView === "results"
                      ? "bg-gray-700 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Results
                </button>
                {session.session_key && (
                  <button
                    onClick={loadChart}
                    className={`px-3 py-1 rounded transition-colors ${
                      mainView === "chart"
                        ? "bg-gray-700 text-white"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Lap Chart
                  </button>
                )}
                {raceControl.length > 0 && (
                  <button
                    onClick={() => setShowRC(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                      showRC
                        ? "bg-gray-700 text-white"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-red-500" : "bg-gray-400"}`} />
                    Race Control
                  </button>
                )}
              </div>
              {lastUpdated && !error && (
                <p className="text-gray-700 text-xs">Updated {lastUpdated}</p>
              )}
            </div>

            <div className="flex gap-5 items-start">
              <div className="flex-1 min-w-0">
                {mainView === "results" && (
                  drivers.length > 0
                    ? <Leaderboard drivers={drivers} />
                    : <LeaderboardSkeleton />
                )}
                {mainView === "chart" && (
                  loadingChart
                    ? <LeaderboardSkeleton />
                    : lapData !== null && lapData.drivers.length > 0
                      ? <LapChart driverLaps={lapData.drivers} events={lapData.events} />
                      : <p className="text-gray-600 text-sm">No lap data available</p>
                )}
              </div>
              {showRC && raceControl.length > 0 && (
                <div className="w-72 flex-shrink-0">
                  <RaceControlCard messages={raceControl} live={isLive} />
                </div>
              )}
            </div>
          </>
        )}

        {tab === "schedule" && <Schedule data={schedule} />}

        {tab === "history" && <History />}
      </div>
    </main>
  )
}
