"use client"

import { useState, useTransition } from "react"
import { X, ExternalLink, Download } from "lucide-react"
import { gradeSubmission } from "../actions"
import { PositionSelect } from "./PositionSelect"
import type { OutlineItem } from "./courseOutline"

type SubmissionRow = {
  id: string
  submissionUrl: string | null
  fileName: string | null
  fileDeletedAt: Date | null
  grade: number | null
  status: "SUBMITTED" | "PASSED" | "FAILED"
  adminNote: string | null
  gradedAt: Date | null
  createdAt: Date
  user: { id: string; name: string | null; email: string | null }
  pathway: { id: string; name: string }
  gradedBy: { name: string | null } | null
}

export type AssignmentRow = {
  id: string
  title: string
  order: number
  description: string
  submitUrl: string | null
  submissions: SubmissionRow[]
}

export type AssignmentDraft = { title: string; description: string; submitUrl: string }

const STATUS_STYLES = {
  SUBMITTED: "bg-yellow-100 text-yellow-700",
  PASSED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
}
const STATUS_LABELS = { SUBMITTED: "Pending", PASSED: "Passed", FAILED: "Failed" }

// Uploaded file → authenticated download route; link → external URL.
function SubmissionLink({ submission, label }: { submission: SubmissionRow; label: string }) {
  if (submission.fileName) {
    if (submission.fileDeletedAt) {
      return <span className="text-xs text-slate-400" title="Removed after the 6-month retention period">File removed</span>
    }
    return (
      <a
        href={`/api/assignment-submissions/${submission.id}/file`}
        title={submission.fileName}
        className="inline-flex max-w-[16rem] items-center gap-1 text-xs text-blue-600 hover:underline"
      >
        <span className="truncate">{label === "View" ? "Download" : submission.fileName}</span>
        <Download size={11} className="shrink-0" />
      </a>
    )
  }
  if (!submission.submissionUrl) return null
  return (
    <a href={submission.submissionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
      {label} <ExternalLink size={11} />
    </a>
  )
}

// ─── Assignment Form Modal ────────────────────────────────────────────────────

export function AssignmentFormModal({
  title,
  initial,
  outline,
  initialInsertAfterOrder,
  onClose,
  onSubmit,
}: {
  title: string
  initial: AssignmentDraft
  outline: OutlineItem[]
  initialInsertAfterOrder: number
  onClose: () => void
  onSubmit: (data: AssignmentDraft, insertAfterOrder: number) => Promise<void>
}) {
  const [form, setForm] = useState<AssignmentDraft>(initial)
  const [insertAfterOrder, setInsertAfterOrder] = useState(initialInsertAfterOrder)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await onSubmit(form, insertAfterOrder)
        onClose()
      } catch {
        setError("Failed to save. Please try again.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title <span className="text-red-500">*</span></label>
            <input
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Case study write-up"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <PositionSelect outline={outline} value={insertAfterOrder} onChange={setInsertAfterOrder} />

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the assignment task and objectives…"
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Submission folder link <span className="text-slate-400">(optional — learners can also upload files directly)</span>
            </label>
            <input
              type="url"
              value={form.submitUrl}
              onChange={(e) => setForm((f) => ({ ...f, submitUrl: e.target.value }))}
              placeholder="https://…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Grade Modal ─────────────────────────────────────────────────────────────

function GradeModal({
  submission,
  courseId,
  onClose,
}: {
  submission: SubmissionRow
  courseId: string
  onClose: () => void
}) {
  const [verdict, setVerdict] = useState<"PASSED" | "FAILED" | null>(
    submission.status !== "SUBMITTED" ? submission.status : null
  )
  const [note, setNote] = useState(submission.adminNote ?? "")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!verdict) return
    startTransition(async () => {
      await gradeSubmission(submission.id, courseId, verdict, note || null)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Review Submission</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">Submitted by</p>
          <p className="font-medium text-slate-800">{submission.user.name ?? submission.user.email}</p>
          <p className="text-xs text-slate-500 mt-1">Pathway: {submission.pathway.name}</p>
          <div className="mt-2">
            <SubmissionLink submission={submission} label="View submission" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Result <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerdict("PASSED")}
                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                  verdict === "PASSED"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-slate-200 text-slate-500 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                ✓ Pass
              </button>
              <button
                type="button"
                onClick={() => setVerdict("FAILED")}
                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                  verdict === "FAILED"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50"
                }`}
              >
                ✗ Fail
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Feedback <span className="text-slate-400">{verdict === "FAILED" ? "(shown to learner on failure)" : "(optional)"}</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Leave feedback for the learner…"
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending || !verdict} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save Result"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Submissions panel (Assignment Submissions tab) ──────────────────────────

export function SubmissionsPanel({
  courseId,
  assignments,
}: {
  courseId: string
  assignments: AssignmentRow[] // in course order
}) {
  const [grading, setGrading] = useState<SubmissionRow | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-400">
        This course has no assignments yet. Add one from the Contents tab.
      </div>
    )
  }

  // Default to the first assignment; fall back to it if the selected one was deleted.
  const assignment = assignments.find((a) => a.id === selectedId) ?? assignments[0]
  const pendingCount = (a: AssignmentRow) => a.submissions.filter((s) => s.status === "SUBMITTED").length

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Submissions</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {assignment.submissions.length}
          </span>
        </div>
        <label className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
          <span className="shrink-0 text-xs font-medium text-slate-500">Assignment</span>
          <select
            value={assignment.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-72 sm:flex-none"
          >
            {assignments.map((a) => {
              const pending = pendingCount(a)
              return (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {pending > 0 ? ` (${pending} to review)` : ""}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      {assignment.submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-400">
          No submissions for this assignment yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Pathway</th>
                <th className="px-4 py-3">Submission</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignment.submissions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.user.name ?? s.user.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.pathway.name}</td>
                  <td className="px-4 py-3">
                    <SubmissionLink submission={s} label="View" />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setGrading(s)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {s.status === "SUBMITTED" ? "Review" : "Re-review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grading && (
        <GradeModal submission={grading} courseId={courseId} onClose={() => setGrading(null)} />
      )}
    </>
  )
}
