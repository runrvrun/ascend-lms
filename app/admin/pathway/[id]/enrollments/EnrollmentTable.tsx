"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Search, Download, UserCircle2, X } from "lucide-react"
import type { ReminderItem } from "./ReminderModal"

export type EnrollmentRow = {
  id: string
  type: "SELF_ENROLL" | "ASSIGNED" | "USER_REQUEST"
  status: "PENDING" | "APPROVED" | "REJECTED"
  deadline: Date | null
  createdAt: Date
  cohortId: string | null
  user: { id: string; name: string | null; email: string | null; division: string; office: { name: string } | null }
  reminders: ReminderItem[]
  coursesCompleted: number
  coursesTotal: number
}

type CompletionFilter = "" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

// ── Helpers ──────────────────────────────────────────────────────────────────

export function typeLabel(type: EnrollmentRow["type"]) {
  if (type === "SELF_ENROLL") return "Self-enrolled"
  if (type === "ASSIGNED") return "Assigned"
  return "Requested"
}

function statusLabel(status: EnrollmentRow["status"]) {
  if (status === "APPROVED") return "Approved"
  if (status === "PENDING") return "Pending"
  return "Rejected"
}

function statusBadge(status: EnrollmentRow["status"]) {
  const cls =
    status === "APPROVED" ? "bg-green-100 text-green-700" : status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{statusLabel(status)}</span>
}

export function completionPct(r: EnrollmentRow) {
  return r.coursesTotal > 0 ? Math.round((r.coursesCompleted / r.coursesTotal) * 100) : 0
}

function completionBucket(r: EnrollmentRow): Exclude<CompletionFilter, ""> {
  if (r.coursesTotal > 0 && r.coursesCompleted >= r.coursesTotal) return "COMPLETED"
  return r.coursesCompleted > 0 ? "IN_PROGRESS" : "NOT_STARTED"
}

export function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// Deadlines are calendar dates stored as UTC midnight — always format in UTC.
export function formatDeadline(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

// ── Excel export ─────────────────────────────────────────────────────────────

async function exportToExcel(rows: EnrollmentRow[], fileName: string, sheetName: string) {
  const xlsx = await import("xlsx")
  const data = [
    ["Name", "Email", "Office", "Division", "Type", "Status", "Completion (%)", "Courses Completed", "Courses Required", "Enrolled", "Deadline"],
    ...rows.map((r) => [
      r.user.name ?? "",
      r.user.email ?? "",
      r.user.office?.name ?? "",
      r.user.division,
      typeLabel(r.type),
      statusLabel(r.status),
      completionPct(r),
      r.coursesCompleted,
      r.coursesTotal,
      formatDate(r.createdAt),
      r.deadline ? formatDeadline(r.deadline) : "",
    ]),
  ]
  const ws = xlsx.utils.aoa_to_sheet(data)
  ws["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 17 }, { wch: 16 }, { wch: 13 }, { wch: 13 }]
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Enrollments")
  xlsx.writeFile(wb, fileName)
}

export function safeFileName(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "enrollments"
}

// ── Filterable table ─────────────────────────────────────────────────────────

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function EnrollmentTable({
  rows,
  exportFileName,
  exportSheetName,
  renderDeadline,
  renderActions,
  emptyText,
}: {
  rows: EnrollmentRow[]
  exportFileName: string
  exportSheetName: string
  renderDeadline?: (r: EnrollmentRow) => ReactNode
  renderActions?: (r: EnrollmentRow) => ReactNode
  emptyText: string
}) {
  const [search, setSearch] = useState("")
  const [office, setOffice] = useState("")
  const [division, setDivision] = useState("")
  const [status, setStatus] = useState("")
  const [completion, setCompletion] = useState<CompletionFilter>("")
  const [exporting, setExporting] = useState(false)

  const offices = useMemo(() => uniqueSorted(rows.map((r) => r.user.office?.name ?? "")).filter(Boolean), [rows])
  const hasNoOffice = rows.some((r) => !r.user.office)
  const divisions = useMemo(() => uniqueSorted(rows.map((r) => r.user.division)), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !(r.user.name?.toLowerCase().includes(q) || r.user.email?.toLowerCase().includes(q))) return false
      if (office && (office === "__none__" ? !!r.user.office : r.user.office?.name !== office)) return false
      if (division && r.user.division !== division) return false
      if (status && r.status !== status) return false
      if (completion && completionBucket(r) !== completion) return false
      return true
    })
  }, [rows, search, office, division, status, completion])

  const filtering = !!(search || office || division || status || completion)

  function clear() {
    setSearch("")
    setOffice("")
    setDivision("")
    setStatus("")
    setCompletion("")
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportToExcel(filtered, exportFileName, exportSheetName)
    } finally {
      setExporting(false)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={office} onChange={(e) => setOffice(e.target.value)} className={selectCls} aria-label="Office">
          <option value="">All offices</option>
          {offices.map((o) => <option key={o} value={o}>{o}</option>)}
          {hasNoOffice && <option value="__none__">No office</option>}
        </select>
        <select value={division} onChange={(e) => setDivision(e.target.value)} className={selectCls} aria-label="Division">
          <option value="">All divisions</option>
          {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Status">
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select value={completion} onChange={(e) => setCompletion(e.target.value as CompletionFilter)} className={selectCls} aria-label="Completion">
          <option value="">All completion</option>
          <option value="NOT_STARTED">Not started (0%)</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed (100%)</option>
        </select>
        {filtering && (
          <button onClick={clear} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <X size={12} /> Clear
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={exporting || filtered.length === 0}
          title="Export the rows shown to Excel"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {filtering && (
        <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
          Showing {filtered.length} of {rows.length}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Office</th>
              <th className="px-5 py-3">Division</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Completion</th>
              <th className="px-5 py-3">Enrolled</th>
              <th className="px-5 py-3">Deadline</th>
              {renderActions && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={renderActions ? 9 : 8} className="px-5 py-10 text-center text-sm text-slate-400">
                  No enrollments match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const pct = completionPct(e)
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <UserCircle2 size={15} className="shrink-0 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{e.user.name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{e.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">{e.user.office?.name ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-slate-600">{e.user.division}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{typeLabel(e.type)}</td>
                    <td className="px-5 py-3">{statusBadge(e.status)}</td>
                    <td className="px-5 py-3" title={`${e.coursesCompleted} of ${e.coursesTotal} required course${e.coursesTotal !== 1 ? "s" : ""} completed`}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-slate-100">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs ${pct >= 100 ? "font-medium text-green-700" : "text-slate-600"}`}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{formatDate(e.createdAt)}</td>
                    <td className="px-5 py-3">
                      {renderDeadline ? renderDeadline(e) : e.deadline ? (
                        <span className="text-xs text-slate-600">{formatDeadline(e.deadline)}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    {renderActions && <td className="px-5 py-3">{renderActions(e)}</td>}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
