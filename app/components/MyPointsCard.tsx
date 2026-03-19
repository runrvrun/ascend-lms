import { PointSource } from "@prisma/client"
import { Star } from "lucide-react"

type PointItem = {
  id: string
  points: number
  source: PointSource
  referenceId: string | null
  courseName: string | null
  pathwayName: string | null
  createdAt: Date
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function PointLabel({ item }: { item: PointItem }) {
  if (item.source === "COURSE_COMPLETION") {
    return (
      <div className="min-w-0">
        <p className="text-sm text-slate-700">Course Completion</p>
        {item.pathwayName && (
          <p className="truncate text-xs text-slate-500">{item.pathwayName}</p>
        )}
        {item.courseName && (
          <p className="truncate text-xs text-slate-500">
            <span className="mr-1 text-slate-400">›</span>
            {item.courseName}
          </p>
        )}
        <p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-slate-700">Activity</p>
      <p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p>
    </div>
  )
}

export function MyPointsCard({
  total,
  recent,
}: {
  total: number
  recent: PointItem[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
        <Star size={18} className="text-yellow-500" />
        <h2 className="font-semibold text-slate-900">My Points</h2>
      </div>

      <div className="px-6 py-5">
        <p className="text-4xl font-black text-slate-900">
          {total.toLocaleString()}
          <span className="ml-2 text-base font-medium text-slate-400">pts</span>
        </p>
      </div>

      {recent.length === 0 ? (
        <div className="px-6 pb-10 text-center text-sm text-slate-400">
          No points earned yet.
        </div>
      ) : (
        <>
          <p className="px-6 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Recent activity
          </p>
          <ul className="divide-y divide-slate-100">
            {recent.map((item) => (
              <li key={item.id} className="flex items-start justify-between px-6 py-3">
                <PointLabel item={item} />
                <span className="ml-4 shrink-0 font-semibold text-green-600">
                  +{item.points}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
