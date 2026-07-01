"use client"

import { useState } from "react"
import SessionHeader from "@/components/SessionHeader"
import RaceControlCard from "@/components/RaceControlCard"
import Leaderboard from "@/components/Leaderboard"
import Schedule from "@/components/Schedule"
import History from "@/components/History"
import { LeaderboardSkeleton } from "@/components/Skeleton"
import { useF1Data } from "@/hooks/useF1Data"

type Tab = "leaderboard" | "schedule" | "history"

export default function Page() {
  const [tab, setTab] = useState<Tab>("leaderboard")
  const { drivers, session, raceControl, schedule, lastUpdated, error } = useF1Data()

  const isLive = session.status === "LIVE"

  if (isLive && tab !== "leaderboard") setTab("leaderboard")

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
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0">
              {drivers.length > 0
                ? <Leaderboard drivers={drivers} />
                : <LeaderboardSkeleton />
              }
              {lastUpdated && !error && (
                <p className="text-gray-700 text-xs mt-4">Updated {lastUpdated}</p>
              )}
            </div>
            {raceControl.length > 0 && (
              <div className="w-72 flex-shrink-0">
                <RaceControlCard messages={raceControl} live={isLive} />
              </div>
            )}
          </div>
        )}

        {tab === "schedule" && <Schedule data={schedule} />}

        {tab === "history" && <History />}
      </div>
    </main>
  )
}
