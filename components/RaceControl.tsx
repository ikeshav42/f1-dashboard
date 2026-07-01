interface RaceControlMessage {
  flag: string
  message: string
  date: string
}

const FLAG_STYLES: Record<string, string> = {
  "RED":           "border-red-600 bg-red-950 text-red-200",
  "YELLOW":        "border-yellow-500 bg-yellow-950 text-yellow-200",
  "DOUBLE YELLOW": "border-yellow-500 bg-yellow-950 text-yellow-200",
  "SAFETY CAR":    "border-yellow-500 bg-yellow-950 text-yellow-200",
  "SC":            "border-yellow-500 bg-yellow-950 text-yellow-200",
  "VSC":           "border-yellow-500 bg-yellow-950 text-yellow-200",
  "CHEQUERED":     "border-gray-300 bg-gray-800 text-gray-100",
}

const QUIET_FLAGS = new Set(["GREEN", "CLEAR", ""])

export default function RaceControl({ messages }: { messages: RaceControlMessage[] }) {
  if (!messages.length) return null
  const latest = messages[0]
  const flag = (latest.flag ?? "").toUpperCase()
  if (QUIET_FLAGS.has(flag)) return null

  const style = FLAG_STYLES[flag] ?? "border-gray-600 bg-gray-900 text-gray-300"

  return (
    <div className={`mb-4 border-l-4 px-4 py-2 text-sm font-mono rounded-r ${style}`}>
      {flag && <span className="font-bold mr-3">{flag}</span>}
      {latest.message}
    </div>
  )
}
