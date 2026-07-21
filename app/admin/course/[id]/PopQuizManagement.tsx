"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, HelpCircle } from "lucide-react"
import { createPopQuiz, updatePopQuiz, deletePopQuiz, type PopQuizFormData, type PopQuizOptionDraft } from "../actions"

type PopQuizOptionRow = {
  id: string
  text: string
  isCorrect: boolean
  order: number
}

type PopQuizRow = {
  id: string
  contentId: string
  time: number
  question: string
  options: PopQuizOptionRow[]
}

type YoutubeContent = {
  id: string
  title: string
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function defaultOptions(): PopQuizOptionDraft[] {
  return [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]
}

// ── Options editor (single correct answer) ─────────────────────────────────

function PopQuizOptionsEditor({ options, onChange }: { options: PopQuizOptionDraft[]; onChange: (o: PopQuizOptionDraft[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="pop-quiz-correct-option"
            checked={o.isCorrect}
            onChange={() => onChange(options.map((x, j) => ({ ...x, isCorrect: j === i })))}
            className="h-4 w-4 accent-blue-600"
            title="Mark as correct answer"
          />
          <input
            required
            value={o.text}
            onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            placeholder={`Option ${i + 1}`}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, { text: "", isCorrect: false }])}
        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
      >
        <Plus size={12} /> Add option
      </button>
      <p className="text-xs text-slate-400">Select the radio button for the correct answer.</p>
    </div>
  )
}

// ── Pop Quiz modal ───────────────────────────────────────────────────────────

function PopQuizModal({
  title,
  initial,
  courseId,
  youtubeContents,
  onClose,
  onSubmit,
}: {
  title: string
  initial: PopQuizFormData
  courseId: string
  youtubeContents: YoutubeContent[]
  onClose: () => void
  onSubmit: (data: PopQuizFormData) => Promise<void>
}) {
  const [contentId, setContentId] = useState(initial.contentId)
  const [hours, setHours] = useState(Math.floor(initial.time / 3600))
  const [minutes, setMinutes] = useState(Math.floor((initial.time % 3600) / 60))
  const [seconds, setSeconds] = useState(initial.time % 60)
  const [question, setQuestion] = useState(initial.question)
  const [options, setOptions] = useState<PopQuizOptionDraft[]>(initial.options)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!options.some((o) => o.isCorrect)) {
      setError("Select a correct answer.")
      return
    }
    const time = hours * 3600 + minutes * 60 + seconds
    startTransition(async () => {
      try {
        await onSubmit({ contentId, time, question, options })
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : "This video already has a pop quiz at that time. Choose a different time.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">YouTube Video <span className="text-red-500">*</span></label>
            <select
              required
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select a video…</option>
              {youtubeContents.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Time <span className="text-red-500">*</span> <span className="font-normal text-slate-400">(when playback should pause)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-500">h</span>
              <input
                type="number" min={0} max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                placeholder="0"
                className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-500">m</span>
              <input
                type="number" min={0} max={59}
                value={seconds}
                onChange={(e) => setSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                placeholder="0"
                className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-500">s</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Question <span className="text-red-500">*</span></label>
            <input
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What did we just cover?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Options <span className="text-red-500">*</span></label>
            <PopQuizOptionsEditor options={options} onChange={setOptions} />
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

// ── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete pop quiz?</h2>
        <p className="mt-2 text-sm text-slate-500"><span className="font-medium text-slate-700">{label}</span> will be permanently removed.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button disabled={pending} onClick={() => startTransition(async () => { await onConfirm(); onCancel() })}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function PopQuizManagement({
  courseId,
  youtubeContents,
  popQuizzes,
}: {
  courseId: string
  youtubeContents: YoutubeContent[]
  popQuizzes: PopQuizRow[]
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PopQuizRow | null>(null)
  const [deleting, setDeleting] = useState<PopQuizRow | null>(null)

  const titleById = Object.fromEntries(youtubeContents.map((c) => [c.id, c.title]))
  const rows = popQuizzes.slice().sort((a, b) => {
    const t = (titleById[a.contentId] ?? "").localeCompare(titleById[b.contentId] ?? "")
    return t !== 0 ? t : a.time - b.time
  })

  return (
    <>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Pop Quiz</h2>
          </div>
          {youtubeContents.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={14} /> Add Pop Quiz
            </button>
          )}
        </div>

        {youtubeContents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">
            Add a YouTube Video content item first to attach a pop quiz.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">
            No pop quizzes yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Video</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Question</th>
                  <th className="px-5 py-3 text-center">Options</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{titleById[q.contentId] ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-slate-500">{formatTime(q.time)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 max-w-xs truncate">{q.question}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{q.options.length}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={13} /></button>
                        <button onClick={() => setDeleting(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && (
        <PopQuizModal
          title="Add Pop Quiz"
          initial={{ contentId: youtubeContents[0]?.id ?? "", time: 0, question: "", options: defaultOptions() }}
          courseId={courseId}
          youtubeContents={youtubeContents}
          onClose={() => setAdding(false)}
          onSubmit={(d) => createPopQuiz(courseId, d)}
        />
      )}

      {editing && (
        <PopQuizModal
          title="Edit Pop Quiz"
          initial={{
            contentId: editing.contentId,
            time: editing.time,
            question: editing.question,
            options: editing.options.slice().sort((a, b) => a.order - b.order).map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          }}
          courseId={courseId}
          youtubeContents={youtubeContents}
          onClose={() => setEditing(null)}
          onSubmit={(d) => updatePopQuiz(editing.id, courseId, d)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          label={`"${deleting.question}" at ${formatTime(deleting.time)}`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deletePopQuiz(deleting.id, courseId)}
        />
      )}
    </>
  )
}
