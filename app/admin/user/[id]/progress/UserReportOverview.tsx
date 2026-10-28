import {
  ArrowLeft,
  UserCircle2,
  Download,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Flame,
  Star,
  Clock,
  Map,
  BookOpen,
  CalendarCheck,
  Target,
} from "lucide-react"
import type { UserReport, Timeliness, PathwayStatus } from "../../../../lib/userReport"

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

function ago(iso: string | null, now: number) {
  if (!iso) return null
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months < 12 ? `${months} month${months === 1 ? "" : "s"} ago` : `${Math.floor(days / 365)}y ago`
}

const STATUS_STYLE: Record<PathwayStatus, string> = {
  Completed: "bg-green-100 text-green-700",
  "In progress": "bg-blue-100 text-blue-700",
  "Not started": "bg-slate-100 text-slate-600",
  "Pending approval": "bg-yellow-100 text-yellow-700",
}

const TIMELINESS_STYLE: Record<Timeliness, string> = {
  "On time": "bg-green-100 text-green-700",
  Late: "bg-orange-100 text-orange-700",
  Overdue: "bg-red-100 text-red-700",
  "On track": "bg-blue-50 text-blue-700",
  "No deadline": "bg-slate-100 text-slate-500",
}

const FLAG_STYLE = {
  critical: { icon: <AlertTriangle size={14} />, cls: "border-red-200 bg-red-50 text-red-800" },
  warning: { icon: <AlertCircle size={14} />, cls: "border-orange-200 bg-orange-50 text-orange-800" },
  info: { icon: <Info size={14} />, cls: "border-slate-200 bg-slate-50 text-slate-700" },
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone = "text-slate-900",
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: string
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export function UserReportOverview({ report }: { report: UserReport }) {
  const { user, activity, summary, flags, pathways } = report
  const now = new Date(report.generatedAt).getTime()
  const a = summary.assigned
  const allOnTime = a.total > 0 && a.completedOnTime === a.total

  return (
    <div className="mb-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/admin/user" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} />
          Back to Users
        </a>
        <a
          href={`/api/admin/users/${user.id}/report`}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Download size={15} />
          Download Excel Report
        </a>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
            <UserCircle2 size={28} className="text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user.name ?? "—"}</h1>
              {user.deactivatedAt && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Deactivated {fmtDate(user.deactivatedAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[user.division, formatEnum(user.title), user.office, ...user.roles.map(formatEnum)]
                .filter(Boolean)
                .map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-1">
            <div>
              <dt className="text-slate-400">Manager</dt>
              <dd className="font-medium text-slate-700">{user.managers.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last sign-in</dt>
              <dd className="font-medium text-slate-700">
                {user.lastLoginAt ? `${fmtDate(user.lastLoginAt)} (${ago(user.lastLoginAt, now)})` : "Not recorded yet"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Last active</dt>
              <dd className="font-medium text-slate-700">
                {user.lastActiveAt ? ago(user.lastActiveAt, now) : "Not recorded yet"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">On Ascend since</dt>
              <dd className="font-medium text-slate-700">{fmtDate(user.accountCreatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          icon={<Map size={13} />}
          label="Pathways completed"
          value={`${summary.pathwaysCompleted}/${summary.pathwaysEnrolled}`}
          sub={`${summary.pathwaysInProgress} in progress · ${summary.pathwaysNotStarted} not started`}
        />
        <Stat
          icon={<CalendarCheck size={13} />}
          label="Assigned on time"
          value={a.total ? `${a.completedOnTime}/${a.total}` : "—"}
          tone={a.total === 0 ? "text-slate-400" : allOnTime ? "text-green-600" : a.overdue ? "text-red-600" : "text-slate-900"}
          sub={a.total ? `${a.overdue} overdue · ${a.completedLate} late · ${a.open} open` : "No assigned pathways"}
        />
        <Stat
          icon={<BookOpen size={13} />}
          label="Courses completed"
          value={summary.coursesCompleted}
          sub={`${summary.coursesInProgress} in progress · avg test ${summary.averageTestScore ?? "—"}${summary.averageTestScore != null ? "%" : ""}`}
        />
        <Stat
          icon={<Flame size={13} />}
          label="Longest streak"
          value={`${activity.longestStreak}d`}
          sub={`Current ${activity.currentStreak}d · ${activity.activeDaysLast30} active days in 30d`}
        />
        <Stat
          icon={<Clock size={13} />}
          label="Last learning activity"
          value={<span className="text-lg">{ago(activity.lastLearningActivityAt, now) ?? "Never"}</span>}
          sub={`${activity.activeLearningDays} active learning days total`}
        />
        <Stat
          icon={<Star size={13} />}
          label="Points"
          value={activity.totalPoints}
          sub={`${activity.commentsPosted} comments · ${activity.feedbackGiven} feedback`}
        />
      </div>

      {/* Attention needed */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Attention needed</h2>
        {flags.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={15} />
            Nothing flagged. This user is on track.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {flags.map((f, i) => (
              <li key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${FLAG_STYLE[f.level].cls}`}>
                <span className="mt-0.5 shrink-0">{FLAG_STYLE[f.level].icon}</span>
                <span className="min-w-0">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pathway overview */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Pathway overview</h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Target size={12} />
            Growth plan: {summary.growthPlan.completed}/{summary.growthPlan.total} done, {summary.growthPlan.confirmed} confirmed
          </p>
        </div>
        {pathways.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No pathway enrollments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-2.5">Pathway</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Progress</th>
                  <th className="px-3 py-2.5">Enrolled</th>
                  <th className="px-3 py-2.5">Deadline</th>
                  <th className="px-3 py-2.5">Completed</th>
                  <th className="px-3 py-2.5">Timeliness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pathways.map((p) => (
                  <tr key={p.enrollmentId}>
                    <td className="px-6 py-3">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.enrolledVia}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-100">
                          <div
                            className={`h-1.5 rounded-full ${p.status === "Completed" ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${p.progressPct}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                          {p.coursesCompleted}/{p.coursesTotal}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fmtDate(p.enrolledAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fmtDate(p.deadline)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fmtDate(p.completedAt)}</td>
                    <td className="px-3 py-3">
                      {p.timeliness && (
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TIMELINESS_STYLE[p.timeliness]}`}>
                          {p.timeliness}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="-mb-2 text-lg font-bold text-slate-900">Details</h2>
    </div>
  )
}
