import { Star, Flame } from "lucide-react"

type LeaderRow = {
  userId: string
  name: string | null
  title: string
  division: string
  office: string | null
  value: number
  isCurrentUser: boolean
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">1</span>
  if (rank === 2) return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white">2</span>
  if (rank === 3) return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">3</span>
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold text-slate-400">{rank}</span>
}

function LeaderboardCard({
  title,
  icon,
  rows,
  valueSuffix,
  valueColor,
}: {
  title: string
  icon: React.ReactNode
  rows: LeaderRow[]
  valueSuffix: string
  valueColor: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        {icon}
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No data yet.</p>
        )}
        {rows.map((row, i) => (
          <div
            key={row.userId}
            className={`flex items-center gap-3 px-5 py-3 ${row.isCurrentUser ? "bg-blue-50" : ""}`}
          >
            <RankBadge rank={i + 1} />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${row.isCurrentUser ? "text-blue-700" : "text-slate-800"}`}>
                {row.name ?? "—"}
                {row.isCurrentUser && <span className="ml-1.5 text-xs font-normal text-blue-400">(you)</span>}
              </p>
              <p className="truncate text-xs text-slate-400">
                {[row.title.replace(/_/g, " "), row.division, row.office].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-bold ${valueColor}`}>
              {row.value.toLocaleString()}{valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Leaderboard({
  pointsRows,
  streakRows,
}: {
  pointsRows: LeaderRow[]
  streakRows: LeaderRow[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LeaderboardCard
        title="Points Leaderboard"
        icon={<Star size={15} className="text-yellow-500" />}
        rows={pointsRows}
        valueSuffix=" pts"
        valueColor="text-yellow-600"
      />
      <LeaderboardCard
        title="Learning Streak"
        icon={<Flame size={15} className="text-orange-500" />}
        rows={streakRows}
        valueSuffix=" days"
        valueColor="text-orange-500"
      />
    </div>
  )
}
