export interface RcMessage {
  flag: string
  message: string
  date: string
  lap_number?: number | null
  category?: string
}

type StyleDef = {
  dot: string
  badgeText: string
  badgeBg: string
  label: string
  rowBg: string
}

function getStyle(flag: string, category: string, message: string): StyleDef {
  const f   = (flag     ?? "").toUpperCase()
  const cat = (category ?? "").toUpperCase()
  const msg = (message  ?? "").toUpperCase()

  if (f === "RED")
    return { dot: "bg-red-500",    badgeText: "text-red-300",    badgeBg: "bg-red-950",    label: "RED FLAG",    rowBg: "bg-red-950/30" }
  if (f === "SAFETY CAR" || f === "SC")
    return { dot: "bg-orange-400", badgeText: "text-orange-300", badgeBg: "bg-orange-950", label: "SAFETY CAR",  rowBg: "bg-orange-950/25" }
  if (f === "VSC")
    return { dot: "bg-amber-400",  badgeText: "text-amber-300",  badgeBg: "bg-amber-950",  label: "VSC",         rowBg: "bg-amber-950/25" }
  if (f === "DOUBLE YELLOW")
    return { dot: "bg-yellow-400", badgeText: "text-yellow-300", badgeBg: "bg-yellow-950", label: "DBL YELLOW",  rowBg: "bg-yellow-950/20" }
  if (f === "YELLOW")
    return { dot: "bg-yellow-400", badgeText: "text-yellow-300", badgeBg: "bg-yellow-950", label: "YELLOW",      rowBg: "bg-yellow-950/20" }
  if (f === "CHEQUERED")
    return { dot: "bg-gray-100",   badgeText: "text-gray-100",   badgeBg: "bg-gray-800",   label: "CHEQUERED",   rowBg: "bg-gray-800/30" }
  if (f === "GREEN" || f === "CLEAR")
    return { dot: "bg-green-500",  badgeText: "text-green-300",  badgeBg: "bg-green-950",  label: "GREEN",       rowBg: "bg-green-950/10" }
  if (f === "BLACK AND WHITE")
    return { dot: "bg-gray-300",   badgeText: "text-gray-300",   badgeBg: "bg-gray-800",   label: "WARNING",     rowBg: "bg-gray-800/20" }
  if (cat === "DRS" || msg.includes("DRS"))
    return { dot: "bg-blue-400",   badgeText: "text-blue-300",   badgeBg: "bg-blue-950",   label: "DRS",         rowBg: "bg-blue-950/15" }

  return { dot: "bg-gray-500", badgeText: "text-gray-400", badgeBg: "bg-gray-800", label: "INFO", rowBg: "" }
}

function formatTime(iso: string) {
  if (!iso) return "--:--"
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })
  } catch {
    return "--:--"
  }
}

export default function RaceControlCard({
  messages,
  live = false,
}: {
  messages: RcMessage[]
  live?: boolean
}) {
  if (!messages.length) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-gray-600"}`}
          />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Race Control
          </span>
        </div>
        <span className="text-gray-600 text-xs">{messages.length} msgs</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-800/50">
        {messages.map((m, i) => {
          const s = getStyle(m.flag, m.category ?? "", m.message)
          return (
            <div key={i} className={`px-3 py-2 ${s.rowBg}`}>
              <div className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0 ${s.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    {m.flag && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badgeText} ${s.badgeBg}`}
                      >
                        {s.label}
                      </span>
                    )}
                    <span className="text-gray-600 text-[10px]">{formatTime(m.date)}</span>
                    {m.lap_number != null && (
                      <span className="text-gray-600 text-[10px]">Lap {m.lap_number}</span>
                    )}
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{m.message}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
