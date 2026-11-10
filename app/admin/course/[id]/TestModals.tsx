"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, GripVertical, ChevronUp, ChevronDown } from "lucide-react"
import { QuestionType } from "@prisma/client"
import {
  createTest, updateTest,
  createQuestion, updateQuestion, deleteQuestion, swapQuestionOrder,
  type OptionDraft, type QuestionFormData, type TestFormData,
} from "../actions"
import { ConfirmDelete } from "./ConfirmDelete"
import { PositionSelect } from "./PositionSelect"
import type { OutlineItem } from "./courseOutline"

type QuestionRow = {
  id: string
  type: QuestionType
  question: string
  order: number
  options: { id: string; text: string; isCorrect: boolean | null; matchKey: string | null; order: number | null }[]
}

export type TestRow = {
  id: string
  title: string
  order: number
  passThreshold: number
  questions: QuestionRow[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const Q_TYPES: QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK", "RANKING", "MATCHING"]

const Q_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple Choice",
  TRUE_FALSE: "True / False",
  FILL_BLANK: "Fill in the Blank",
  RANKING: "Ranking",
  MATCHING: "Matching",
}

const Q_STYLES: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "bg-blue-100 text-blue-700",
  TRUE_FALSE: "bg-green-100 text-green-700",
  FILL_BLANK: "bg-orange-100 text-orange-700",
  RANKING: "bg-purple-100 text-purple-700",
  MATCHING: "bg-pink-100 text-pink-700",
}

// ── Default options per type ────────────────────────────────────────────────

function defaultOptions(type: QuestionType): OptionDraft[] {
  if (type === "TRUE_FALSE") return [
    { text: "True", isCorrect: true },
    { text: "False", isCorrect: false },
  ]
  if (type === "MULTIPLE_CHOICE") return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]
  return [{ text: "", isCorrect: type === "FILL_BLANK" ? true : undefined, order: type === "RANKING" ? 1 : undefined }]
}

// ── Option editors per type ────────────────────────────────────────────────

function MultipleChoiceOptions({ options, onChange }: { options: OptionDraft[]; onChange: (o: OptionDraft[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!o.isCorrect}
            onChange={(e) => onChange(options.map((x, j) => j === i ? { ...x, isCorrect: e.target.checked } : x))}
            className="h-4 w-4 accent-blue-600"
            title="Mark as correct"
          />
          <input
            required
            value={o.text}
            onChange={(e) => onChange(options.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
            placeholder={`Option ${i + 1}`}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {options.length > 2 && (
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, { text: "", isCorrect: false }])}
        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Plus size={12} /> Add option
      </button>
      <p className="text-xs text-slate-400">Check the box(es) for correct answer(s).</p>
    </div>
  )
}

function TrueFalseOptions({ options, onChange }: { options: OptionDraft[]; onChange: (o: OptionDraft[]) => void }) {
  const correctIndex = options.findIndex((o) => o.isCorrect)
  return (
    <div className="flex gap-4">
      {options.map((o, i) => (
        <label key={i} className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            checked={!!o.isCorrect}
            onChange={() => onChange(options.map((x, j) => ({ ...x, isCorrect: j === i })))}
            className="accent-blue-600"
          />
          <span className="text-sm text-slate-700">{o.text}</span>
        </label>
      ))}
      {correctIndex === -1 && <p className="text-xs text-red-500">Select the correct answer.</p>}
    </div>
  )
}

function FillBlankOptions({ options, onChange }: { options: OptionDraft[]; onChange: (o: OptionDraft[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-400">List all accepted correct answers.</p>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            required
            value={o.text}
            onChange={(e) => onChange(options.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
            placeholder={`Answer ${i + 1}`}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {options.length > 1 && (
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, { text: "", isCorrect: true }])}
        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Plus size={12} /> Add accepted answer
      </button>
    </div>
  )
}

function RankingOptions({ options, onChange }: { options: OptionDraft[]; onChange: (o: OptionDraft[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-400">List items in the correct order (top = first).</p>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-center text-xs font-semibold text-slate-400">{i + 1}</span>
          <GripVertical size={13} className="text-slate-300" />
          <input
            required
            value={o.text}
            onChange={(e) => onChange(options.map((x, j) => j === i ? { ...x, text: e.target.value, order: j + 1 } : x))}
            placeholder={`Item ${i + 1}`}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {options.length > 1 && (
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i).map((x, j) => ({ ...x, order: j + 1 })))}
              className="text-slate-400 hover:text-red-500"><X size={14} /></button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, { text: "", order: options.length + 1 }])}
        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Plus size={12} /> Add item
      </button>
    </div>
  )
}

function MatchingOptions({ options, onChange }: { options: OptionDraft[]; onChange: (o: OptionDraft[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-500">
        <span>Left (term)</span><span>Right (match)</span>
      </div>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            required
            value={o.text}
            onChange={(e) => onChange(options.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
            placeholder="Term"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400">→</span>
          <input
            required
            value={o.matchKey ?? ""}
            onChange={(e) => onChange(options.map((x, j) => j === i ? { ...x, matchKey: e.target.value } : x))}
            placeholder="Match"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {options.length > 1 && (
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-500"><X size={14} /></button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, { text: "", matchKey: "" }])}
        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Plus size={12} /> Add pair
      </button>
    </div>
  )
}

// ── Question Modal ─────────────────────────────────────────────────────────

function QuestionModal({
  title, initial, onClose, onSubmit,
}: {
  title: string
  initial: QuestionFormData
  onClose: () => void
  onSubmit: (data: QuestionFormData) => Promise<void>
}) {
  const [form, setForm] = useState<QuestionFormData>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function setType(type: QuestionType) {
    setForm((f) => ({ ...f, type, options: defaultOptions(type) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await onSubmit(form)
        onClose()
      } catch {
        setError("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Type selector */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Question Type</label>
            <div className="flex flex-wrap gap-2">
              {Q_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.type === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  {Q_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Question text */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Question <span className="text-red-500">*</span></label>
            <input
              required
              autoFocus
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="e.g. What is the formula for…?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Options */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">
              {form.type === "FILL_BLANK" ? "Accepted Answers" : form.type === "MATCHING" ? "Pairs" : "Options"}
              {" "}<span className="text-red-500">*</span>
            </label>
            {form.type === "MULTIPLE_CHOICE" && <MultipleChoiceOptions options={form.options} onChange={(o) => setForm((f) => ({ ...f, options: o }))} />}
            {form.type === "TRUE_FALSE" && <TrueFalseOptions options={form.options} onChange={(o) => setForm((f) => ({ ...f, options: o }))} />}
            {form.type === "FILL_BLANK" && <FillBlankOptions options={form.options} onChange={(o) => setForm((f) => ({ ...f, options: o }))} />}
            {form.type === "RANKING" && <RankingOptions options={form.options} onChange={(o) => setForm((f) => ({ ...f, options: o }))} />}
            {form.type === "MATCHING" && <MatchingOptions options={form.options} onChange={(o) => setForm((f) => ({ ...f, options: o }))} />}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Test Setup Modal ───────────────────────────────────────────────────────

export function TestSetupModal({ initial, courseId, testId, outline, initialInsertAfterOrder, onClose }: {
  initial: TestFormData; courseId: string; testId?: string
  outline: OutlineItem[]
  initialInsertAfterOrder?: number
  onClose: () => void
}) {
  const [form, setForm] = useState<TestFormData>(initial)
  const [insertAfterOrder, setInsertAfterOrder] = useState(initialInsertAfterOrder ?? 0)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (testId) await updateTest(testId, courseId, { ...form, insertAfterOrder })
      else await createTest(courseId, { ...form, insertAfterOrder })
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{testId ? "Edit Test" : "Add Test"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title <span className="text-red-500">*</span></label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
              placeholder="e.g. Module 1 Quiz"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <PositionSelect outline={outline} value={insertAfterOrder} onChange={setInsertAfterOrder} />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Pass Threshold (%) <span className="text-red-500">*</span>
            </label>
            <input
              required type="number" min={1} max={100}
              value={form.passThreshold}
              onChange={(e) => setForm((f) => ({ ...f, passThreshold: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">Minimum score to pass this test.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : testId ? "Save" : "Add Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Questions popup (one test) ─────────────────────────────────────────────

export function TestQuestionsModal({ test, courseId, onClose }: { test: TestRow; courseId: string; onClose: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<QuestionRow | null>(null)
  const [deleting, setDeleting] = useState<QuestionRow | null>(null)
  const [reordering, startReorder] = useTransition()

  const questions = test.questions.slice().sort((a, b) => a.order - b.order)
  const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order)) + 1 : 1

  function move(i: number, dir: -1 | 1) {
    const other = questions[i + dir]
    if (!other) return
    startReorder(() => swapQuestionOrder(questions[i].id, other.id, courseId))
  }

  function optionsFromRow(q: QuestionRow): OptionDraft[] {
    return q.options.map((o) => ({
      text: o.text,
      isCorrect: o.isCorrect ?? undefined,
      matchKey: o.matchKey ?? undefined,
      order: o.order ?? undefined,
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{test.title}</h2>
            <p className="text-xs text-slate-500">
              {questions.length} question{questions.length === 1 ? "" : "s"} · pass mark {test.passThreshold}%
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-400">
              No questions yet. Add the first one below.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {questions.map((q, i) => (
                <li key={q.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900" title={q.question}>{q.question}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${Q_STYLES[q.type]}`}>{Q_LABELS[q.type]}</span>
                      <span className="text-xs text-slate-400">{q.options.length} option{q.options.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => move(i, -1)} disabled={reordering || i === 0} title="Move up"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={reordering || i === questions.length - 1} title="Move down"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25">
                      <ChevronDown size={14} />
                    </button>
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
            <Plus size={14} /> Add Question
          </button>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Done
          </button>
        </div>
      </div>

      {adding && (
        <QuestionModal
          title="Add Question"
          initial={{ type: "MULTIPLE_CHOICE", question: "", order: nextOrder, options: defaultOptions("MULTIPLE_CHOICE") }}
          onClose={() => setAdding(false)}
          onSubmit={(d) => createQuestion(test.id, courseId, d)}
        />
      )}
      {editing && (
        <QuestionModal
          title="Edit Question"
          initial={{ type: editing.type, question: editing.question, order: editing.order, options: optionsFromRow(editing) }}
          onClose={() => setEditing(null)}
          onSubmit={(d) => updateQuestion(editing.id, courseId, d)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          heading="Delete question?"
          message={<><span className="font-medium text-slate-700">{deleting.question}</span> will be permanently removed.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteQuestion(deleting.id, courseId)}
        />
      )}
    </div>
  )
}
