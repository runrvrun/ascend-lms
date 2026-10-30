"use client"

import { useRouter } from "next/navigation"
import { Filter, X } from "lucide-react"
import { Division, JobTitle } from "@prisma/client"

const DIVISIONS = Object.values(Division)
const TITLES = Object.values(JobTitle)

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

type Props = {
  offices: { id: string; name: string }[]
  current: { division: string; title: string; officeId: string }
  basePath: string
  // Other query params to carry over when a filter changes (e.g. the active tab).
  keep?: Record<string, string>
}

export function AnalyticsFilter({ offices, current, basePath, keep = {} }: Props) {
  const router = useRouter()

  function handleChange(key: string, value: string) {
    const next = { ...current, [key]: value }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v)
    if (next.division) params.set("division", next.division)
    if (next.title) params.set("title", next.title)
    if (next.officeId) params.set("officeId", next.officeId)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  const hasFilter = current.division || current.title || current.officeId
  const activeCount = [current.division, current.title, current.officeId].filter(Boolean).length

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <Filter size={14} />
        Filter
        {activeCount > 0 && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
            {activeCount}
          </span>
        )}
      </div>

      <select
        value={current.division}
        onChange={(e) => handleChange("division", e.target.value)}
        className="min-w-0 max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Divisions</option>
        {DIVISIONS.map((d) => (
          <option key={d} value={d}>{d === "NA" ? "N/A" : d}</option>
        ))}
      </select>

      <select
        value={current.title}
        onChange={(e) => handleChange("title", e.target.value)}
        className="min-w-0 max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Titles</option>
        {TITLES.map((t) => (
          <option key={t} value={t}>{formatEnum(t)}</option>
        ))}
      </select>

      <select
        value={current.officeId}
        onChange={(e) => handleChange("officeId", e.target.value)}
        className="min-w-0 max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Offices</option>
        {offices.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>

      {hasFilter && (
        <button
          onClick={() => {
            const params = new URLSearchParams()
            for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v)
            const qs = params.toString()
            router.push(qs ? `${basePath}?${qs}` : basePath)
          }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500"
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  )
}
