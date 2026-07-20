"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Download,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  ClipboardCheck,
  FileText,
  Star,
  Search,
} from "lucide-react"
import type { CourseReportData } from "../../../../lib/courseReport"

function StatCard({
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

function formatDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function CourseReport({ data }: { data: CourseReportData }) {
  const { course, stats, users, feedbacks } = data
  const [search, setSearch] = useState("")

  const filtered = search
    ? users.filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (u.email ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : users

  return (
    <>
      <a
        href="/admin/course"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={15} />
        Back to Courses
      </a>

      <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{course.name} — Report</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{course.status === "PUBLISHED" ? "Published" : "Draft"}</span>
            {course.topic && <span>· {course.topic}</span>}
            <span>· {course.contentCount} content item{course.contentCount !== 1 ? "s" : ""}</span>
            {course.pathwayCount > 0 && (
              <span>· in {course.pathwayCount} pathway{course.pathwayCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <a
          href={`/api/admin/course/${course.id}/report/export`}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Download size={16} />
          Export Excel
        </a>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled" value={stats.enrolledCount} icon={Users} color="blue" />
        <StatCard label="Completed" value={stats.completedCount} icon={CheckCircle2} color="green" />
        <StatCard label="In Progress" value={stats.inProgressCount} icon={Clock} color="amber" />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={TrendingUp}
          color="purple"
          sub={`${stats.completedCount} of ${stats.enrolledCount} enrolled`}
        />
      </div>

      {(course.hasTest || course.hasAssignment || stats.feedbackCount > 0) && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {course.hasTest && (
            <StatCard
              label="Test Average Score"
              value={stats.avgTestScore != null ? `${stats.avgTestScore}%` : "—"}
              icon={ClipboardCheck}
              color="blue"
              sub={`${stats.testPassedCount} passed of ${stats.testAttemptCount} attempt${stats.testAttemptCount !== 1 ? "s" : ""}`}
            />
          )}
          {course.hasAssignment && (
            <StatCard
              label="Assignment Submissions"
              value={stats.assignmentSubmittedCount}
              icon={FileText}
              color="amber"
              sub={`${stats.assignmentPassedCount} passed`}
            />
          )}
          {stats.feedbackCount > 0 && (
            <StatCard
              label="Average Feedback"
              value={stats.avgFeedbackRating != null ? `${stats.avgFeedbackRating} / 5` : "—"}
              icon={Star}
              color="purple"
              sub={`${stats.feedbackCount} response${stats.feedbackCount !== 1 ? "s" : ""}`}
            />
          )}
        </div>
      )}

      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 min-w-[200px]">Name</th>
              <th className="px-5 py-3 min-w-[120px]">Division</th>
              <th className="px-5 py-3 min-w-[110px]">Enrolled</th>
              <th className="px-5 py-3 text-center min-w-[130px]">Status</th>
              <th className="px-5 py-3 min-w-[110px]">Completed</th>
              <th className="px-5 py-3 text-center min-w-[100px]">Time Taken</th>
              <th className="px-5 py-3 text-center min-w-[90px]">Test</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  {users.length === 0 ? "No one is enrolled in this course yet." : "No users match your search."}
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.userId} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-900">{u.name ?? "Unknown"}</div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </td>
                <td className="px-5 py-3 text-slate-600">{u.division}</td>
                <td className="px-5 py-3 text-slate-600">{formatDate(u.enrollDate)}</td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.completed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {u.completed ? "Completed" : "In Progress"}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">{formatDate(u.completedAt)}</td>
                <td className="px-5 py-3 text-center text-slate-600">
                  {u.timeTakenDays != null ? `${u.timeTakenDays}d` : "—"}
                </td>
                <td className="px-5 py-3 text-center text-slate-600">
                  {u.testScore != null ? `${Math.round(u.testScore)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.feedbackCount > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Feedback</h2>
          <div className="flex flex-col gap-3">
            {feedbacks.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{f.name ?? "Unknown"}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          size={13}
                          className={j < f.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(f.date)}</span>
                  </div>
                </div>
                {f.comment && <p className="text-xs text-slate-600">{f.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
