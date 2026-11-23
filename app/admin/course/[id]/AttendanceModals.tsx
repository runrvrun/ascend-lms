"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { CheckCircle2, ClipboardPaste, Printer, Search, X } from "lucide-react"
import type { ContentCompletionMethod } from "@prisma/client"
import {
  getAttendance,
  getCheckInCode,
  markAttendanceByEmails,
  setAttendance,
  type AttendanceRow,
  type EmailAttendanceResult,
} from "../attendanceActions"

const METHOD_LABELS: Record<ContentCompletionMethod, string> = {
  ADMIN: "Marked present",
  CHECK_IN: "Checked in (QR)",
  RECORDING: "Watched recording",
  SELF: "Marked complete",
}

function Shell({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`flex max-h-[90vh] w-full flex-col rounded-2xl bg-white p-6 shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Who attended an in-person session: tick people off, or paste a list of emails.
export function AttendanceModal({ contentId, title, onClose }: { contentId: string; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<AttendanceRow[] | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [pasteResult, setPasteResult] = useState<EmailAttendanceResult | null>(null)
  const [pending, startTransition] = useTransition()

  function load() {
    getAttendance(contentId).then(setRows).catch(() => setError("Couldn't load the attendance list."))
  }
  useEffect(load, [contentId])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows ?? []).filter((r) => !q || r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))
  }, [rows, search])
  const doneCount = rows?.filter((r) => r.method).length ?? 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function apply(attended: boolean) {
    const ids = [...selected]
    startTransition(async () => {
      await setAttendance(contentId, ids, attended)
      setSelected(new Set())
      load()
    })
  }

  function submitPaste() {
    startTransition(async () => {
      setPasteResult(await markAttendanceByEmails(contentId, pasteText))
      setPasteText("")
      load()
    })
  }

  return (
    <Shell title="Attendance" subtitle={title} onClose={onClose} wide>
      {pasting ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Paste the email addresses of everyone who attended, e.g. copied from a Teams attendance report. Any text works: the
            email addresses are picked out of it.
          </p>
          <textarea
            rows={8}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="name@ycp.com, other@ycp.com…"
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {pasteResult && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-800">
                {pasteResult.marked} marked present{pasteResult.alreadyMarked > 0 && `, ${pasteResult.alreadyMarked} already done`}.
              </p>
              {pasteResult.notEnrolled.length > 0 && (
                <p className="mt-1">Not enrolled in a pathway with this course ({pasteResult.notEnrolled.length}): {pasteResult.notEnrolled.join(", ")}</p>
              )}
              {pasteResult.notFound.length > 0 && (
                <p className="mt-1">No active Ascend user ({pasteResult.notFound.length}): {pasteResult.notFound.join(", ")}</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setPasting(false); setPasteResult(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Back to list
            </button>
            <button onClick={submitPaste} disabled={pending || !pasteText.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Marking…" : "Mark present"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <a href="/help/in-person#trainers" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
              How this works
            </a>
            <button onClick={() => setPasting(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <ClipboardPaste size={14} />
              Paste emails
            </button>
          </div>
          {rows && (
            <p className="mb-2 text-xs text-slate-500">
              {doneCount} of {rows.length} enrolled learners have completed this session.
            </p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
            {!rows ? (
              <p className="p-6 text-center text-sm text-slate-400">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">
                {rows.length === 0 ? "Nobody is enrolled in a pathway with this course yet." : "No one matches your search."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all shown"
                        checked={visible.length > 0 && visible.every((r) => selected.has(r.userId))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.userId)) : new Set())}
                      />
                    </th>
                    <th className="px-3 py-2">Learner</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => toggle(r.userId)}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(r.userId)} onChange={() => toggle(r.userId)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{r.name ?? "—"}</p>
                        <p className="text-xs text-slate-400">{r.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        {r.method ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 size={12} />
                            {METHOD_LABELS[r.method]}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Not yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-slate-500">{selected.size} selected</span>
            <button onClick={() => apply(false)} disabled={pending || selected.size === 0} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Mark not attended
            </button>
            <button onClick={() => apply(true)} disabled={pending || selected.size === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Mark present"}
            </button>
          </div>
        </>
      )}
    </Shell>
  )
}

// The session's permanent check-in code, with a link to the printable QR page.
export function CheckInQrModal({ contentId, title, onClose }: { contentId: string; title: string; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    getCheckInCode(contentId).then(setCode).catch(() => setError("Couldn't create the check-in code."))
  }, [contentId])

  return (
    <Shell title="Check-in QR Code" subtitle={title} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm text-slate-600">
        <p>
          Print the QR code and pass it around the room. Learners scan it with their phone, sign in and tap Check in.
          The code never changes, so you can print it once and reuse it.
        </p>
        <div className="rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-xs text-slate-500">Code to type in, for anyone without a camera</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-slate-900">{error || code || "…"}</p>
        </div>
        <a
          href={`/check-in/print/${contentId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer size={15} />
          Open printable QR code
        </a>
        <a href="/help/in-person" target="_blank" rel="noreferrer" className="text-center text-xs text-blue-600 hover:underline">
          Guide: running an in-person session
        </a>
      </div>
    </Shell>
  )
}
