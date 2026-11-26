"use client"

// The list of people in an analytics drill-down (a pathway's enrollees, a cohort's
// members): search, filter by completion and other columns, and export what's shown.

import { useMemo, useState } from "react"
import { Check, Download, Search, Users, X } from "lucide-react"

type Value = string | number | null

export type PeopleColumn = {
  key: string
  label: string
  kind?: "text" | "pct" | "date"
  sub?: string // key of a value shown under this one (on screen only)
  filter?: boolean // offer a dropdown of this column's values
  exportOnly?: boolean
}

export type PeopleRow = { id: string } & Record<string, Value>

type Progress = "completed" | "in_progress" | "not_started"

const PROGRESS_OPTIONS: { key: Progress; label: string }[] = [
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
]

// Dates are ISO strings; deadlines are UTC calendar dates, so format everything in UTC.
function formatDate(v: Value) {
  if (!v) return ""
  return new Date(String(v)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}

function progressOf(pct: number): Progress {
  if (pct >= 100) return "completed"
  return pct > 0 ? "in_progress" : "not_started"
}

function PctCell({ value }: { value: Value }) {
  if (value === null || value === undefined) return <span className="text-slate-300">—</span>
  const pct = Number(value)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 shrink-0 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs ${pct >= 100 ? "font-medium text-green-700" : "text-slate-600"}`}>{pct}%</span>
    </div>
  )
}

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function PeopleTable({
  title,
  rows,
  columns,
  progressKey = "pct",
  fileName,
  sheetName,
  empty,
}: {
  title: string
  rows: PeopleRow[]
  columns: PeopleColumn[]
  progressKey?: string // the % column that the completion filter uses
  fileName: string
  sheetName: string
  empty: string
}) {
  const [search, setSearch] = useState("")
  // Several can be picked (e.g. Not started + In progress = everyone who hasn't finished).
  const [progress, setProgress] = useState<Set<Progress>>(new Set())
  const [colFilters, setColFilters] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)

  const filterColumns = columns.filter((c) => c.filter)
  const options = useMemo(
    () =>
      Object.fromEntries(
        filterColumns.map((c) => [c.key, [...new Set(rows.map((r) => String(r[c.key] ?? "")))].filter(Boolean).sort((a, b) => a.localeCompare(b))])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !(String(r.name ?? "").toLowerCase().includes(q) || String(r.email ?? "").toLowerCase().includes(q))) return false
      if (progress.size && !progress.has(progressOf(Number(r[progressKey] ?? 0)))) return false
      for (const [key, value] of Object.entries(colFilters)) if (value && String(r[key] ?? "") !== value) return false
      return true
    })
  }, [rows, search, progress, colFilters, progressKey])

  const filtering = !!(search || progress.size || Object.values(colFilters).some(Boolean))

  function toggleProgress(key: Progress) {
    setProgress((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const shown = columns.filter((c) => !c.exportOnly)

  async function handleExport() {
    setExporting(true)
    try {
      const xlsx = await import("xlsx")
      const data: Value[][] = [
        columns.map((c) => (c.kind === "pct" ? `${c.label} (%)` : c.label)),
        ...filtered.map((r) => columns.map((c) => (c.kind === "date" ? formatDate(r[c.key]) : r[c.key] ?? ""))),
      ]
      const ws = xlsx.utils.aoa_to_sheet(data)
      ws["!cols"] = columns.map((c) => ({ wch: Math.min(40, Math.max(12, c.label.length + 4)) }))
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "People")
      xlsx.writeFile(wb, fileName)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="mr-2 flex items-center gap-2 font-semibold text-slate-900">
          <Users size={16} className="text-blue-600" />
          {title}
          <span className="text-sm font-normal text-slate-400">
            {filtering ? `${filtered.length} of ${rows.length}` : rows.length}
          </span>
        </h2>
        <div className="relative min-w-[11rem] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Progress (pick one or more)">
          {PROGRESS_OPTIONS.map((o, i) => {
            const on = progress.has(o.key)
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleProgress(o.key)}
                title={on ? `Stop showing ${o.label.toLowerCase()}` : `Show ${o.label.toLowerCase()}`}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-sm ${i > 0 ? "border-l border-slate-200" : ""} ${
                  on ? "bg-blue-50 font-medium text-blue-700" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {on && <Check size={12} />}
                {o.label}
              </button>
            )
          })}
        </div>
        {filterColumns.map((c) => (
          <select
            key={c.key}
            value={colFilters[c.key] ?? ""}
            onChange={(e) => setColFilters((f) => ({ ...f, [c.key]: e.target.value }))}
            className={selectCls}
            aria-label={c.label}
          >
            <option value="">All {c.label.toLowerCase()}</option>
            {options[c.key]?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {filtering && (
          <button
            onClick={() => { setSearch(""); setProgress(new Set()); setColFilters({}) }}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={12} /> Clear
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={exporting || filtered.length === 0}
          title="Export the people shown to Excel"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {shown.map((c) => <th key={c.key} className="whitespace-nowrap px-4 py-3 first:pl-5">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={shown.length} className="px-5 py-10 text-center text-sm text-slate-400">No one matches these filters.</td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    {shown.map((c, i) => (
                      <td key={c.key} className={`px-4 py-2.5 first:pl-5 ${i === 0 ? "min-w-[12rem]" : "whitespace-nowrap"}`}>
                        {c.kind === "pct" ? (
                          <PctCell value={r[c.key]} />
                        ) : c.kind === "date" ? (
                          r[c.key] ? <span className="text-xs text-slate-500">{formatDate(r[c.key])}</span> : <span className="text-slate-300">—</span>
                        ) : (
                          <>
                            <p className={i === 0 ? "font-medium text-slate-900" : "text-slate-600"}>
                              {r[c.key] === null || r[c.key] === "" ? <span className="text-slate-300">—</span> : r[c.key]}
                            </p>
                            {c.sub && r[c.sub] ? <p className="text-xs text-slate-400">{r[c.sub]}</p> : null}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
