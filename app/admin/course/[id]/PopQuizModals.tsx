"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { createPopQuiz, updatePopQuiz, deletePopQuiz, type PopQuizFormData, type PopQuizOptionDraft } from "../actions"
import { ConfirmDelete } from "./ConfirmDelete"

type PopQuizOptionRow = {
  id: string
  text: string
  isCorrect: boolean
  order: number
}

export type PopQuizRow = {
  id: string
  contentId: string
  time: number
  question: string
  options: PopQuizOptionRow[]
}

type YoutubeLesson = {
  id: string
  title: string
}

export function formatTime(totalSeconds: number): string {
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
  onClose,
  onSubmit,
}: {
  title: string
  initial: PopQuizFormData
  onClose: () => void
  onSubmit: (data: PopQuizFormData) => Promise<void>
}) {
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
        await onSubmit({ contentId: initial.contentId, time, question, options })
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
              autoFocus
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

// ── Pop quizzes popup (one YouTube lesson) ─────────────────────────────────

export function PopQuizzesModal({
  courseId,
  video,
  popQuizzes,
  onClose,
}: {
  courseId: string
  video: YoutubeLesson
  popQuizzes: PopQuizRow[]
  onClose: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PopQuizRow | null>(null)
  const [deleting, setDeleting] = useState<PopQuizRow | null>(null)
  const rows = popQuizzes.slice().sort((a, b) => a.time - b.time)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Pop quizzes</h2>
            <p className="truncate text-xs text-slate-500" title={video.title}>{video.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs text-slate-500">The video pauses at each time and asks the question.</p>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-400">
              No pop quizzes on this video yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {rows.map((q) => (
                <li key={q.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-14 shrink-0 font-mono text-xs text-slate-500">{formatTime(q.time)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900" title={q.question}>{q.question}</p>
                    <p className="text-xs text-slate-400">{q.options.length} options</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => setEditing(q)} title="Edit"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                    <button onClick={() => setDeleting(q)} title="Delete"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={14} /> Add Pop Quiz
          </button>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Done
          </button>
        </div>
      </div>

      {adding && (
        <PopQuizModal
          title="Add Pop Quiz"
          initial={{ contentId: video.id, time: 0, question: "", options: defaultOptions() }}
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
          onClose={() => setEditing(null)}
          onSubmit={(d) => updatePopQuiz(editing.id, courseId, d)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          heading="Delete pop quiz?"
          message={<><span className="font-medium text-slate-700">{deleting.question}</span> at {formatTime(deleting.time)} will be permanently removed.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deletePopQuiz(deleting.id, courseId)}
        />
      )}
    </div>
  )
}
