import { Map } from "lucide-react"
import type { LearnerPathway } from "../lib/learnerPathways"
import { LearnerPathwayRow } from "./LearnerPathwayParts"

const PREVIEW_COUNT = 3

// `pathways` comes from getLearnerPathways(), already sorted: in progress (most
// recently active first), not started, awaiting approval, completed.
export function MyPathwaysCard({ pathways }: { pathways: LearnerPathway[] }) {
  const preview = pathways.slice(0, PREVIEW_COUNT)

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
        <Map size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-900">My Pathways</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {pathways.length}
        </span>
      </div>

      {pathways.length === 0 ? (
        <div className="flex-1 px-6 py-10 text-center text-sm text-slate-400">
          No pathways enrolled yet.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100">
          {preview.map((item) => (
            <LearnerPathwayRow key={item.enrollmentId} item={item} />
          ))}
        </ul>
      )}

      <div className="border-t border-slate-100 px-6 py-3 text-right">
        <a href="/learning-history" className="text-xs font-medium text-blue-600 hover:underline">
          View all pathways →
        </a>
      </div>
    </div>
  )
}
