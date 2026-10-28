import { useId } from "react"
import { Star, Flame, Crown } from "lucide-react"

type LeaderRow = {
  userId: string
  name: string | null
  title: string
  division: string
  office: string | null
  value: number
  isCurrentUser: boolean
}

const MEDALS = {
  1: { light: "#fef08a", mid: "#facc15", dark: "#ca8a04", text: "#713f12", row: "bg-gradient-to-r from-yellow-50 via-yellow-50/40 to-transparent" },
  2: { light: "#f8fafc", mid: "#cbd5e1", dark: "#94a3b8", text: "#334155", row: "bg-gradient-to-r from-slate-100 via-slate-50/60 to-transparent" },
  3: { light: "#fed7aa", mid: "#f59e0b", dark: "#b45309", text: "#7c2d12", row: "bg-gradient-to-r from-orange-50 via-orange-50/40 to-transparent" },
} as const

// Medal hanging from a ribbon for the top 3; plain number for everyone else.
function RankBadge({ rank }: { rank: number }) {
  const id = useId()
  const medal = MEDALS[rank as keyof typeof MEDALS]
  if (!medal) {
    return <span className="flex h-6 w-7 shrink-0 items-center justify-center text-xs font-semibold text-slate-400">{rank}</span>
  }
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" className="shrink-0 drop-shadow-sm" role="img" aria-label={`Rank ${rank}`}>
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={medal.light} />
          <stop offset="55%" stopColor={medal.mid} />
          <stop offset="100%" stopColor={medal.dark} />
        </linearGradient>
      </defs>
      <polygon points="4,0 11,0 17,16 10,16" fill="#2563eb" />
      <polygon points="24,0 17,0 11,16 18,16" fill="#1d4ed8" />
      <polygon points="7,0 9,0 14.5,14.5 13.5,15.5" fill="#ffffff" opacity="0.55" />
      <circle cx="14" cy="23" r="10" fill={`url(#${id}-m)`} stroke={medal.dark} strokeWidth="1" />
      <circle cx="14" cy="23" r="7.3" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" />
      <text x="14" y="23" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="800" fill={medal.text}>
        {rank}
      </text>
    </svg>
  )
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            className={`flex items-center gap-3 px-5 py-3 ${row.isCurrentUser ? "bg-blue-50" : MEDALS[(i + 1) as keyof typeof MEDALS]?.row ?? ""}`}
          >
            <RankBadge rank={i + 1} />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${row.isCurrentUser ? "text-blue-700" : "text-slate-800"}`}>
                {i === 0 && <Crown size={13} className="mr-1 inline -translate-y-px fill-yellow-400 text-yellow-500" aria-hidden />}
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
