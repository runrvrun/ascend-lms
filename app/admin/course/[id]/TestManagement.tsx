"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, ClipboardList, GripVertical } from "lucide-react"
import { QuestionType } from "@prisma/client"
import {
  createTest, updateTest, deleteTest,
  createQuestion, updateQuestion, deleteQuestion,
  type OptionDraft, type QuestionFormData,
} from "../actions"

type QuestionRow = {
  id: string
  type: QuestionType
  question: string
  order: number
  options: { id: string; text: string; isCorrect: boolean | null; matchKey: string | null; order: number | null }[]
}

type TestRow = {
  id: string
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
  title, initial, nextOrder, testId, courseId, onClose, onSubmit,
}: {
  title: string
  initial: QuestionFormData
  nextOrder: number
  testId: string
  courseId: string
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
        setError("Order number already in use. Choose a different one.")
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

          {/* Question text + order */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Question <span className="text-red-500">*</span></label>
              <input
                required
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="e.g. What is the formula for…?"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Order <span className="text-red-500">*</span></label>
              <input
                required type="number" min={1}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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

function TestSetupModal({ initial, courseId, testId, onClose }: {
  initial: number; courseId: string; testId?: string; onClose: () => void
}) {
  const [threshold, setThreshold] = useState(initial)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (testId) await updateTest(testId, courseId, threshold)
      else await createTest(courseId, threshold)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{testId ? "Edit Test" : "Create Test"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Pass Threshold (%) <span className="text-red-500">*</span>
            </label>
            <input
              required type="number" min={1} max={100}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">Minimum score to pass this test.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : testId ? "Save" : "Create Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────

function DeleteConfirm({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete?</h2>
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

// ── Main component ─────────────────────────────────────────────────────────

export function TestManagement({ courseId, test }: { courseId: string; test: TestRow | null }) {
  const [testModal, setTestModal] = useState(false)
  const [deletingTest, setDeletingTest] = useState(false)
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionRow | null>(null)

  const questions = test?.questions.slice().sort((a, b) => a.order - b.order) ?? []
  const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order)) + 1 : 1

  function optionOptionsFromRow(q: QuestionRow): OptionDraft[] {
    return q.options.map((o) => ({
      text: o.text,
      isCorrect: o.isCorrect ?? undefined,
      matchKey: o.matchKey ?? undefined,
      order: o.order ?? undefined,
    }))
  }

  return (
    <>
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Test</h2>
          </div>

          {!test ? (
            <button onClick={() => setTestModal(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus size={14} /> Create Test
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Pass threshold: <span className="font-semibold text-slate-800">{test.passThreshold}%</span></span>
              <button onClick={() => setTestModal(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
              <button onClick={() => setDeletingTest(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          )}
        </div>

        {!test ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
            No test yet. Create one to add questions.
          </div>
        ) : (
          <>
            {questions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">
                No questions yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 w-10">#</th>
                      <th className="px-5 py-3">Question</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-center">Options</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questions.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-400">{q.order}</td>
                        <td className="px-5 py-3 font-medium text-slate-900 max-w-xs truncate">{q.question}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${Q_STYLES[q.type]}`}>{Q_LABELS[q.type]}</span>
                        </td>
                        <td className="px-5 py-3 text-center text-slate-500">{q.options.length}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditingQuestion(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={13} /></button>
                            <button onClick={() => setDeletingQuestion(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button onClick={() => setAddingQuestion(true)}
              className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
              <Plus size={14} /> Add Question
            </button>
          </>
        )}
      </div>

      {testModal && (
        <TestSetupModal
          initial={test?.passThreshold ?? 70}
          courseId={courseId}
          testId={test?.id}
          onClose={() => setTestModal(false)}
        />
      )}

      {deletingTest && test && (
        <DeleteConfirm
          label="This test and all its questions"
          onCancel={() => setDeletingTest(false)}
          onConfirm={() => deleteTest(test.id, courseId)}
        />
      )}

      {addingQuestion && test && (
        <QuestionModal
          title="Add Question"
          initial={{ type: "MULTIPLE_CHOICE", question: "", order: nextOrder, options: defaultOptions("MULTIPLE_CHOICE") }}
          nextOrder={nextOrder}
          testId={test.id}
          courseId={courseId}
          onClose={() => setAddingQuestion(false)}
          onSubmit={(d) => createQuestion(test.id, courseId, d)}
        />
      )}

      {editingQuestion && test && (
        <QuestionModal
          title="Edit Question"
          initial={{ type: editingQuestion.type, question: editingQuestion.question, order: editingQuestion.order, options: optionOptionsFromRow(editingQuestion) }}
          nextOrder={nextOrder}
          testId={test.id}
          courseId={courseId}
          onClose={() => setEditingQuestion(null)}
          onSubmit={(d) => updateQuestion(editingQuestion.id, courseId, d)}
        />
      )}

      {deletingQuestion && (
        <DeleteConfirm
          label={`Question ${deletingQuestion.order}: ${deletingQuestion.question}`}
          onCancel={() => setDeletingQuestion(null)}
          onConfirm={() => deleteQuestion(deletingQuestion.id, courseId)}
        />
      )}
    </>
  )
}
