"use client"

import { useState, useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts"

interface RaceEvent {
  type: "SC" | "VSC"
  lap_start: number
  lap_end: number
}

interface DriverLaps {
  driver_number: number
  driver_abbr: string
  team_name: string
  team_color: string
  laps: { lap: number; time: number }[]
}

function formatLapTime(seconds: number) {
  if (!seconds) return "—"
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3).padStart(6, "0")
  return `${mins}:${secs}`
}

export default function LapChart({ driverLaps, events = [] }: { driverLaps: DriverLaps[]; events?: RaceEvent[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [filterPitLaps, setFilterPitLaps] = useState(true)

  function toggleDriver(abbr: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(abbr)) next.delete(abbr)
      else next.add(abbr)
      return next
    })
  }

  // per-driver median — much better for detecting pit laps than a global threshold
  const driverMedians = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of driverLaps) {
      const sorted = [...d.laps.map(l => l.time)].sort((a, b) => a - b)
      map.set(d.driver_abbr, sorted[Math.floor(sorted.length / 2)] ?? 90)
    }
    return map
  }, [driverLaps])

  // global median used only for Y axis range + reference line
  const allTimes = useMemo(() => {
    return driverLaps
      .flatMap(d => d.laps.map(l => l.time))
      .sort((a, b) => a - b)
  }, [driverLaps])

  const globalMedian = allTimes[Math.floor(allTimes.length / 2)] ?? 90

  // build chart data: one row per lap, each driver is a key
  const chartData = useMemo(() => {
    const allLapNums = new Set<number>()
    for (const d of driverLaps) {
      for (const l of d.laps) allLapNums.add(l.lap)
    }

    return Array.from(allLapNums)
      .sort((a, b) => a - b)
      .map(lapNum => {
        const row: Record<string, number | undefined> = { lap: lapNum }
        for (const d of driverLaps) {
          if (hidden.has(d.driver_abbr)) continue
          const entry = d.laps.find(l => l.lap === lapNum)
          if (!entry) continue
          // filter if lap is >115% of this driver's own median (pit stop)
          if (filterPitLaps && entry.time > (driverMedians.get(d.driver_abbr) ?? 90) * 1.15) continue
          row[d.driver_abbr] = entry.time
        }
        return row
      })
  }, [driverLaps, hidden, filterPitLaps, driverMedians])

  const yMin = Math.floor((allTimes[Math.floor(allTimes.length * 0.05)] ?? globalMedian) * 0.995)
  const yMax = Math.ceil(
    filterPitLaps
      ? globalMedian * 1.12
      : (allTimes[allTimes.length - 1] ?? globalMedian) * 1.01
  )

  const visibleDrivers = driverLaps.filter(d => !hidden.has(d.driver_abbr))

  return (
    <div>
      {/* controls */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {driverLaps.map(d => (
            <button
              key={d.driver_abbr}
              onClick={() => toggleDriver(d.driver_abbr)}
              title={d.driver_abbr}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-opacity ${
                hidden.has(d.driver_abbr) ? "opacity-25" : "opacity-100"
              }`}
              style={{ backgroundColor: d.team_color, color: "#000" }}
            >
              {d.driver_abbr}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFilterPitLaps(p => !p)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            filterPitLaps
              ? "border-gray-600 text-gray-400 hover:text-gray-200"
              : "border-red-600 text-red-400"
          }`}
        >
          {filterPitLaps ? "Show pit laps" : "Hide pit laps"}
        </button>
      </div>

      {/* chart */}
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="lap"
            stroke="#4b5563"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            label={{ value: "Lap", position: "insideBottom", offset: -8, fill: "#6b7280", fontSize: 11 }}
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke="#4b5563"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={formatLapTime}
            width={62}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: "6px",
              fontSize: 12,
            }}
            labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value)
              const abbr = String(name ?? "")
              const driver = driverLaps.find(d => d.driver_abbr === abbr)
              return [
                <span key={abbr} style={{ color: driver?.team_color ?? "#fff" }}>
                  {formatLapTime(v)}
                </span>,
                abbr,
              ]
            }}
            labelFormatter={lap => `Lap ${lap}`}
          />
          <ReferenceLine
            y={globalMedian}
            stroke="#374151"
            strokeDasharray="4 4"
            label={{ value: "median", position: "insideTopRight", fill: "#4b5563", fontSize: 10 }}
          />
          {events.map((ev, i) => (
            <ReferenceArea
              key={i}
              x1={ev.lap_start}
              x2={ev.lap_end}
              fill={ev.type === "SC" ? "#f59e0b" : "#a78bfa"}
              fillOpacity={0.12}
              stroke={ev.type === "SC" ? "#f59e0b" : "#a78bfa"}
              strokeOpacity={0.4}
              strokeWidth={1}
              label={{ value: ev.type, position: "insideTop", fill: ev.type === "SC" ? "#f59e0b" : "#a78bfa", fontSize: 10, fontWeight: "bold" }}
            />
          ))}
          {visibleDrivers.map(d => (
            <Line
              key={d.driver_abbr}
              type="monotone"
              dataKey={d.driver_abbr}
              stroke={d.team_color}
              dot={false}
              strokeWidth={1.5}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-between mt-1">
        {events.length > 0 && (
          <div className="flex gap-3 text-xs">
            {[...new Set(events.map(e => e.type))].map(type => (
              <span key={type} className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-sm opacity-70"
                  style={{ backgroundColor: type === "SC" ? "#f59e0b" : "#a78bfa" }}
                />
                <span className="text-gray-500">{type === "SC" ? "Safety Car" : "Virtual SC"}</span>
              </span>
            ))}
          </div>
        )}
        <p className="text-gray-700 text-xs ml-auto">
          {visibleDrivers.length} drivers · {filterPitLaps ? "pit laps hidden" : "all laps shown"}
        </p>
      </div>
    </div>
  )
}
