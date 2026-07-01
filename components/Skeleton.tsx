function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800 animate-pulse">
      <td className="py-2.5 pr-4">
        <div className="h-3 w-4 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5 pr-4">
        <div className="h-3 w-32 bg-gray-800 rounded" />
      </td>
      <td className="py-2.5 pr-4 hidden md:table-cell">
        <div className="h-3 w-20 bg-gray-800 rounded" />
      </td>
      <td className="py-2.5 pr-4">
        <div className="h-3 w-12 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5 pr-4 hidden sm:table-cell">
        <div className="h-3 w-12 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5 pr-4 hidden sm:table-cell">
        <div className="h-3 w-16 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5 pr-4 hidden lg:table-cell">
        <div className="h-3 w-10 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5 pr-4 hidden lg:table-cell">
        <div className="h-3 w-10 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5 pr-4 hidden lg:table-cell">
        <div className="h-3 w-10 bg-gray-800 rounded ml-auto" />
      </td>
      <td className="py-2.5">
        <div className="h-5 w-12 bg-gray-800 rounded" />
      </td>
    </tr>
  )
}

export function LeaderboardSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
