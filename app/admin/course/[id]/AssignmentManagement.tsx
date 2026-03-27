"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, ExternalLink, ClipboardCheck, CheckCircle2, XCircle, Clock } from "lucide-react"
import {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  gradeSubmission,
  AssignmentFormData,
} from "../actions"

type SubmissionRow = {
  id: string
  submissionUrl: string
  grade: number | null
  status: "SUBMITTED" | "PASSED" | "FAILED"
  adminNote: string | null
  gradedAt: Date | null
  createdAt: Date
  user: { id: string; name: string | null; email: string | null }
  pathway: { id: string; name: string }
  gradedBy: { name: string | null } | null
}

type AssignmentRow = {
  id: string
  description: string
  submitUrl: string
  submissions: SubmissionRow[]
} | null

const STATUS_STYLES = {
  SUBMITTED: "bg-yellow-100 text-yellow-700",
  PASSED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
}
const STATUS_LABELS = { SUBMITTED: "Pending", PASSED: "Passed", FAILED: "Failed" }

// ─── Assignment Form Modal ────────────────────────────────────────────────────

function AssignmentFormModal({
  title,
  initial,
  courseId,
  onClose,
  onSubmit,
}: {
  title: string
  initial: AssignmentFormData
  courseId: string
  onClose: () => void
  onSubmit: (data: AssignmentFormData) => Promise<void>
}) {
  const [form, setForm] = useState<AssignmentFormData>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await onSubmit(form)
        onClose()
      } catch {
        setError("Failed to save. Please try again.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              Submission link <span className="text-red-500">*</span>
            </label>
            <input
              required
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Review Submission</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">Submitted by</p>
          <p className="font-medium text-slate-800">{submission.user.name ?? submission.user.email}</p>
          <p className="text-xs text-slate-500 mt-1">Pathway: {submission.pathway.name}</p>
          <a
            href={submission.submissionUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            View submission <ExternalLink size={11} />
          </a>
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

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete assignment?</h2>
        <p className="mt-2 text-sm text-slate-500">This will remove the assignment and all its submissions.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await onConfirm(); onCancel() })}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assignment config (create / edit / delete) ───────────────────────────────

export function AssignmentManagement({
  courseId,
  assignment,
}: {
  courseId: string
  assignment: AssignmentRow
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Assignment</h2>
        {!assignment && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            Add Assignment
          </button>
        )}
      </div>

      {!assignment ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          No assignment yet. Add one above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck size={16} className="text-orange-500" />
                <span className="text-sm font-semibold text-slate-800">Assignment</span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{assignment.description}</p>
              <a
                href={assignment.submitUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Submission folder <ExternalLink size={11} />
              </a>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <Pencil size={13} />
              </button>
              <button onClick={() => setDeleting(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <AssignmentFormModal
          title="Add Assignment"
          initial={{ description: "", submitUrl: "" }}
          courseId={courseId}
          onClose={() => setCreating(false)}
          onSubmit={(d) => createAssignment(courseId, d)}
        />
      )}
      {editing && assignment && (
        <AssignmentFormModal
          title="Edit Assignment"
          initial={{ description: assignment.description, submitUrl: assignment.submitUrl }}
          courseId={courseId}
          onClose={() => setEditing(false)}
          onSubmit={(d) => updateAssignment(assignment.id, courseId, d)}
        />
      )}
      {deleting && assignment && (
        <DeleteConfirm
          onCancel={() => setDeleting(false)}
          onConfirm={() => deleteAssignment(assignment.id, courseId)}
        />
      )}
    </>
  )
}

// ─── Submissions panel (separate tab) ────────────────────────────────────────

export function SubmissionsPanel({
  courseId,
  assignment,
}: {
  courseId: string
  assignment: AssignmentRow
}) {
  const [grading, setGrading] = useState<SubmissionRow | null>(null)

  if (!assignment) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-400">
        No assignment configured for this course yet.
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Submissions</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {assignment.submissions.length}
        </span>
      </div>

      {assignment.submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-400">
          No submissions yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                    <a href={s.submissionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      View <ExternalLink size={10} />
                    </a>
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
