interface Session {
  session_name?: string
  circuit_short_name?: string
  year?: number
  session_type?: string
  status?: string
}

export default function SessionHeader({ session }: { session: Session }) {
  const title = [session.session_name, session.circuit_short_name]
    .filter(Boolean)
    .join(" — ")

  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-red-500 mb-1">
        {title || "F1 Live Dashboard"}
      </h1>
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <span>
          {session.year}
          {session.session_type ? ` · ${session.session_type}` : ""}
        </span>
        {session.status === "LIVE" ? (
          <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse">
            LIVE
          </span>
        ) : session.status === "Final" ? (
          <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">
            Final
          </span>
        ) : null}
      </div>
    </div>
  )
}
