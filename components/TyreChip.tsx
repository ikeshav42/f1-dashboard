const TYRE_STYLES: Record<string, string> = {
  SOFT:         "bg-red-600 text-white",
  MEDIUM:       "bg-yellow-400 text-black",
  HARD:         "bg-gray-200 text-black",
  INTERMEDIATE: "bg-green-600 text-white",
  INTER:        "bg-green-600 text-white",
  WET:          "bg-blue-600 text-white",
}

const TYRE_LABEL: Record<string, string> = {
  MEDIUM:       "MED",
  INTERMEDIATE: "INTER",
}

export default function TyreChip({ compound }: { compound: string }) {
  const cls = TYRE_STYLES[compound] ?? "bg-gray-700 text-gray-300"
  const label = TYRE_LABEL[compound] ?? compound
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>
      {label}
    </span>
  )
}
