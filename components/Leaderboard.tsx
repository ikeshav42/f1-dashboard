import TyreChip from "./TyreChip"

interface Driver {
  position: number
  driver_number: number
  driver_name: string
  driver_abbr: string
  team_name: string
  team_color: string
  gap_to_leader: string
  interval: string
  last_lap_time: string
  sector_1: string
  sector_2: string
  sector_3: string
  tyre_compound: string
  is_in_pit: boolean
}

function positionColor(pos: number) {
  if (pos === 1) return "text-yellow-400"
  if (pos === 2) return "text-gray-300"
  if (pos === 3) return "text-amber-500"
  return "text-gray-500"
}

function podiumRowClass(pos: number) {
  if (pos === 1) return "bg-yellow-950/40"
  if (pos === 2) return "bg-zinc-800/60"
  if (pos === 3) return "bg-orange-950/40"
  return ""
}

function DriverCell({ driver }: { driver: Driver }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-1 h-5 rounded-sm flex-shrink-0"
        style={{ backgroundColor: driver.team_color }}
      />
      <span
        className="text-xs px-1.5 py-0.5 rounded font-bold text-black flex-shrink-0 text-center min-w-[1.75rem]"
        style={{ backgroundColor: driver.team_color }}
      >
        {driver.driver_number}
      </span>
      <span className="font-bold text-white w-8 flex-shrink-0">{driver.driver_abbr}</span>
      <span className="text-gray-400 text-xs hidden sm:inline">{driver.driver_name}</span>
      {driver.is_in_pit && (
        <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-bold">
          PIT
        </span>
      )}
    </div>
  )
}

export default function Leaderboard({ drivers }: { drivers: Driver[] }) {
  if (!drivers.length) {
    return <p className="text-gray-500 text-sm">Waiting for data...</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700 text-left">
            <th className="py-2 pr-4 w-8 text-right">Pos</th>
            <th className="py-2 pr-4">Driver</th>
            <th className="py-2 pr-4 hidden md:table-cell">Team</th>
            <th className="py-2 pr-4 text-right">Gap</th>
            <th className="py-2 pr-4 text-right hidden sm:table-cell">Interval</th>
            <th className="py-2 pr-4 text-right hidden sm:table-cell">Last Lap</th>
            <th className="py-2 pr-4 text-right hidden lg:table-cell text-purple-400">S1</th>
            <th className="py-2 pr-4 text-right hidden lg:table-cell text-green-400">S2</th>
            <th className="py-2 pr-4 text-right hidden lg:table-cell text-blue-400">S3</th>
            <th className="py-2">Tyre</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr
              key={d.driver_number}
              className={`border-b border-gray-800 hover:bg-gray-900 transition-colors ${podiumRowClass(d.position)}`}
              style={{ borderLeft: `3px solid ${d.team_color}` }}
            >
              <td className={`py-2 pr-4 font-bold text-right ${positionColor(d.position)}`}>
                {d.position}
              </td>
              <td className="py-2 pr-4">
                <DriverCell driver={d} />
              </td>
              <td className="py-2 pr-4 text-gray-400 text-xs hidden md:table-cell">{d.team_name}</td>
              <td className="py-2 pr-4 text-gray-300 text-right tabular-nums">{d.gap_to_leader}</td>
              <td className="py-2 pr-4 text-gray-300 text-right tabular-nums hidden sm:table-cell">
                {d.interval}
              </td>
              <td className="py-2 pr-4 text-gray-200 text-right tabular-nums hidden sm:table-cell">
                {d.last_lap_time}
              </td>
              <td className="py-2 pr-4 text-purple-300 text-right tabular-nums hidden lg:table-cell">
                {d.sector_1}
              </td>
              <td className="py-2 pr-4 text-green-300 text-right tabular-nums hidden lg:table-cell">
                {d.sector_2}
              </td>
              <td className="py-2 pr-4 text-blue-300 text-right tabular-nums hidden lg:table-cell">
                {d.sector_3}
              </td>
              <td className="py-2">
                <TyreChip compound={d.tyre_compound} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
