import { COMPLETION_BUCKETS, type BucketCounts } from "../../lib/analytics"

// Sequential ramp for completion buckets: neutral for "not started", then one hue from
// light (barely started) to dark (completed).
export const BUCKET_COLORS = ["bg-slate-200", "bg-blue-200", "bg-blue-300", "bg-blue-400", "bg-blue-600", "bg-blue-800"]

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color = "blue",
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  color?: "blue" | "green" | "purple" | "amber"
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-xl p-2 ${colors[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export function BarRow({ label, value, max, sub, color = "bg-blue-500" }: { label: string; value: number; max: number; sub?: string; color?: string }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div title={`${label}: ${value}`}>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-slate-800">{label}</span>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          {sub && <span className="text-xs text-slate-400">{sub}</span>}
          <span>{value}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function BucketLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
      {COMPLETION_BUCKETS.map((b, i) => (
        <span key={b.key} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${BUCKET_COLORS[i]}`} />
          {b.label}
        </span>
      ))}
    </div>
  )
}

// One horizontal 100% bar split by completion bucket; hover a segment for its count.
export function DistributionBar({ buckets }: { buckets: BucketCounts }) {
  const total = buckets.reduce((s, n) => s + n, 0)
  if (total === 0) return <div className="h-2.5 w-full min-w-32 rounded bg-slate-100" title="No learners yet" />
  return (
    <div className="flex h-2.5 w-full min-w-32 gap-[2px]">
      {buckets.map((n, i) =>
        n > 0 ? (
          <div
            key={i}
            className={`h-full rounded-[3px] ${BUCKET_COLORS[i]}`}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${COMPLETION_BUCKETS[i].label}: ${n} ${n === 1 ? "person" : "people"} (${Math.round((n / total) * 100)}%)`}
          />
        ) : null
      )}
    </div>
  )
}

// Column chart of how many people sit in each completion bucket.
export function CompletionHistogram({ buckets, unit = "people" }: { buckets: BucketCounts; unit?: string }) {
  const max = Math.max(...buckets, 1)
  const total = buckets.reduce((s, n) => s + n, 0)
  return (
    <div>
      <div className="flex h-44 items-end gap-2 border-b border-slate-200 pb-px">
        {buckets.map((n, i) => (
          <div
            key={i}
            className="group flex h-full flex-1 flex-col items-center justify-end"
            title={`${COMPLETION_BUCKETS[i].label}: ${n} ${unit}${total ? ` (${Math.round((n / total) * 100)}%)` : ""}`}
          >
            <span className="mb-1 text-xs font-semibold text-slate-700">{n}</span>
            <div
              className={`w-full max-w-14 rounded-t-[4px] ${BUCKET_COLORS[i]} group-hover:opacity-80`}
              style={{ height: `${(n / max) * 100}%`, minHeight: n > 0 ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {COMPLETION_BUCKETS.map((b) => (
          <span key={b.key} className="flex-1 text-center text-[11px] leading-tight text-slate-500">{b.label}</span>
        ))}
      </div>
    </div>
  )
}

export function Card({ title, icon: Icon, iconColor = "text-blue-600", children, action }: { title: string; icon: React.ElementType; iconColor?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className={iconColor} />
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
