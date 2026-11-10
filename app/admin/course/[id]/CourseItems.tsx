"use client"

import { useState, useTransition } from "react"
import { Plus, ChevronUp, ChevronDown, ExternalLink, Pencil, Trash2, HelpCircle, ListChecks } from "lucide-react"
import {
  createContent,
  updateContent,
  deleteContent,
  deleteTest,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  swapCourseItemOrder,
  type CourseItemKind,
} from "../actions"
import type { OutlineItem } from "./courseOutline"
import { ContentFormModal, TYPE_LABELS, TYPE_STYLES, type ContentRow } from "./LessonFormModal"
import { TestSetupModal, TestQuestionsModal, type TestRow } from "./TestModals"
import { PopQuizzesModal, type PopQuizRow } from "./PopQuizModals"
import { AssignmentFormModal } from "./AssignmentModals"
import { ConfirmDelete } from "./ConfirmDelete"
import { ActionsMenu, type ActionsMenuItem } from "../../../components/ActionsMenu"
import { contentImageUrl } from "../../../lib/contentImageUrl"

type LessonRow = ContentRow & { popQuizzes: PopQuizRow[] }
type AssignmentItemRow = { id: string; title: string; order: number; description: string; submitUrl: string | null }

type Row =
  | { kind: "CONTENT"; order: number; item: LessonRow }
  | { kind: "TEST"; order: number; item: TestRow }
  | { kind: "ASSIGNMENT"; order: number; item: AssignmentItemRow }

type Modal =
  | { type: "add-lesson" }
  | { type: "add-test" }
  | { type: "add-assignment" }
  | { type: "edit"; kind: CourseItemKind; id: string }
  | { type: "delete"; kind: CourseItemKind; id: string }
  | { type: "questions"; id: string }
  | { type: "pop-quizzes"; id: string }

const KIND_BADGE: Record<"TEST" | "ASSIGNMENT", { label: string; style: string }> = {
  TEST: { label: "Test", style: "bg-indigo-100 text-indigo-700" },
  ASSIGNMENT: { label: "Assignment", style: "bg-amber-100 text-amber-800" },
}

// The course's lessons, tests and assignments in one ordered list (they share one order sequence).
export function CourseItems({
  courseId,
  contents,
  tests,
  assignments,
  outline,
}: {
  courseId: string
  contents: LessonRow[]
  tests: TestRow[]
  assignments: AssignmentItemRow[]
  outline: OutlineItem[]
}) {
  const [modal, setModal] = useState<Modal | null>(null)
  const [reordering, startReorder] = useTransition()
  const close = () => setModal(null)

  const rows: Row[] = [
    ...contents.map((c) => ({ kind: "CONTENT" as const, order: c.order, item: c })),
    ...tests.map((t) => ({ kind: "TEST" as const, order: t.order, item: t })),
    ...assignments.map((a) => ({ kind: "ASSIGNMENT" as const, order: a.order, item: a })),
  ].sort((a, b) => a.order - b.order)

  const lastOrder = rows.length > 0 ? rows[rows.length - 1].order : 0

  function move(index: number, dir: -1 | 1) {
    const a = rows[index]
    const b = rows[index + dir]
    if (!b) return
    startReorder(() =>
      swapCourseItemOrder(
        { kind: a.kind, id: a.item.id, order: a.order },
        { kind: b.kind, id: b.item.id, order: b.order },
        courseId
      )
    )
  }

  // For editing an item's position: the outline without the item, and the order of the item before it.
  function positionFor(kind: CourseItemKind, id: string) {
    const idx = outline.findIndex((o) => o.kind === kind && o.id === id)
    return {
      outline: outline.filter((_, i) => i !== idx),
      insertAfterOrder: idx > 0 ? outline[idx - 1].order : 0,
    }
  }

  // Look rows up on every render so open popups show fresh data after each save.
  const find = <K extends Row["kind"]>(kind: K, id: string) =>
    rows.find((r) => r.kind === kind && r.item.id === id) as Extract<Row, { kind: K }> | undefined

  function menuItems(row: Row): ActionsMenuItem[] {
    const items: ActionsMenuItem[] = [
      { label: "Edit", icon: <Pencil size={13} />, onClick: () => setModal({ type: "edit", kind: row.kind, id: row.item.id }) },
    ]
    if (row.kind === "CONTENT" && row.item.type === "YOUTUBE_VIDEO") {
      items.push({ label: "Pop quizzes", icon: <HelpCircle size={13} />, onClick: () => setModal({ type: "pop-quizzes", id: row.item.id }) })
    }
    if (row.kind === "TEST") {
      items.push({ label: "Questions", icon: <ListChecks size={13} />, onClick: () => setModal({ type: "questions", id: row.item.id }) })
    }
    items.push({
      label: "Delete",
      icon: <Trash2 size={13} />,
      variant: "danger",
      onClick: () => setModal({ type: "delete", kind: row.kind, id: row.item.id }),
    })
    return items
  }

  function details(row: Row) {
    if (row.kind === "TEST") {
      const t = row.item
      return (
        <button
          onClick={() => setModal({ type: "questions", id: t.id })}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ListChecks size={13} />
          Questions ({t.questions.length})
          <span className="font-normal text-slate-400">· pass {t.passThreshold}%</span>
        </button>
      )
    }
    if (row.kind === "ASSIGNMENT") {
      return <span className="block min-w-0 truncate italic text-slate-400" title={row.item.description}>{row.item.description}</span>
    }
    const c = row.item
    return (
      <div className="flex min-w-0 items-center gap-2">
        {c.imageKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contentImageUrl(c.imageKey)} alt="" className="h-10 w-16 shrink-0 rounded border border-slate-200 object-cover" />
        )}
        {c.type === "TEXT" || c.type === "IN_PERSON" || c.type === "IMAGE" ? (
          c.value && <span className="block min-w-0 truncate italic text-slate-400">{c.value}</span>
        ) : (
          c.value && (
            <a
              href={c.value}
              target="_blank"
              rel="noreferrer"
              title={c.value}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              <ExternalLink size={13} />
              Open
            </a>
          )
        )}
        {c.type === "YOUTUBE_VIDEO" && (
          <button
            onClick={() => setModal({ type: "pop-quizzes", id: c.id })}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            title="Pop quizzes"
          >
            <HelpCircle size={13} />
            {c.popQuizzes.length} pop {c.popQuizzes.length === 1 ? "quiz" : "quizzes"}
          </button>
        )}
      </div>
    )
  }

  const editing = modal?.type === "edit" ? modal : null
  const deleting = modal?.type === "delete" ? modal : null
  const deletingRow = deleting ? rows.find((r) => r.kind === deleting.kind && r.item.id === deleting.id) : undefined
  const questionsTest = modal?.type === "questions" ? find("TEST", modal.id)?.item : undefined
  const popQuizVideo = modal?.type === "pop-quizzes" ? find("CONTENT", modal.id)?.item : undefined

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Lessons</h2>
        <div className="flex flex-wrap gap-2">
          <AddButton label="Add Lesson" onClick={() => setModal({ type: "add-lesson" })} />
          <AddButton label="Add Test" onClick={() => setModal({ type: "add-test" })} />
          <AddButton label="Add Assignment" onClick={() => setModal({ type: "add-assignment" })} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          Nothing here yet. Add a lesson, test or assignment above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => {
                const badge =
                  row.kind === "CONTENT"
                    ? { label: TYPE_LABELS[row.item.type], style: TYPE_STYLES[row.item.type] }
                    : KIND_BADGE[row.kind]
                return (
                  <tr key={`${row.kind}-${row.item.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.item.title}</td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.style}`}>{badge.label}</span>
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 text-slate-500">{details(row)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => move(i, -1)}
                          disabled={reordering || i === 0}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
                          title="Move up"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={reordering || i === rows.length - 1}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
                          title="Move down"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <div className="ml-1">
                          <ActionsMenu items={menuItems(row)} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === "add-lesson" && (
        <ContentFormModal
          courseId={courseId}
          title="Add Lesson"
          initial={{ title: "", type: "YOUTUBE_VIDEO", value: "", duration: null, imageKey: null }}
          outline={outline}
          initialInsertAfterOrder={lastOrder}
          onClose={close}
          onSubmit={(d, insertAfterOrder) => createContent(courseId, { ...d, insertAfterOrder })}
        />
      )}
      {modal?.type === "add-test" && (
        <TestSetupModal
          initial={{ title: "", passThreshold: 70 }}
          courseId={courseId}
          outline={outline}
          initialInsertAfterOrder={lastOrder}
          onClose={close}
        />
      )}
      {modal?.type === "add-assignment" && (
        <AssignmentFormModal
          title="Add Assignment"
          initial={{ title: "", description: "", submitUrl: "" }}
          outline={outline}
          initialInsertAfterOrder={lastOrder}
          onClose={close}
          onSubmit={(d, insertAfterOrder) => createAssignment(courseId, { ...d, insertAfterOrder })}
        />
      )}

      {editing?.kind === "CONTENT" && (() => {
        const c = find("CONTENT", editing.id)?.item
        return c ? (
          <ContentFormModal
            courseId={courseId}
            title="Edit Lesson"
            initial={{ title: c.title, type: c.type, value: c.value, duration: c.duration, imageKey: c.imageKey }}
            outline={null}
            onClose={close}
            onSubmit={(d) => updateContent(c.id, courseId, d)}
          />
        ) : null
      })()}
      {editing?.kind === "TEST" && (() => {
        const t = find("TEST", editing.id)?.item
        if (!t) return null
        const pos = positionFor("TEST", t.id)
        return (
          <TestSetupModal
            initial={{ title: t.title, passThreshold: t.passThreshold }}
            courseId={courseId}
            testId={t.id}
            outline={pos.outline}
            initialInsertAfterOrder={pos.insertAfterOrder}
            onClose={close}
          />
        )
      })()}
      {editing?.kind === "ASSIGNMENT" && (() => {
        const a = find("ASSIGNMENT", editing.id)?.item
        if (!a) return null
        const pos = positionFor("ASSIGNMENT", a.id)
        return (
          <AssignmentFormModal
            title="Edit Assignment"
            initial={{ title: a.title, description: a.description, submitUrl: a.submitUrl ?? "" }}
            outline={pos.outline}
            initialInsertAfterOrder={pos.insertAfterOrder}
            onClose={close}
            onSubmit={(d, insertAfterOrder) => updateAssignment(a.id, courseId, { ...d, insertAfterOrder })}
          />
        )
      })()}

      {deleting && deletingRow && (
        <ConfirmDelete
          heading={`Delete ${deleting.kind === "CONTENT" ? "lesson" : deleting.kind === "TEST" ? "test" : "assignment"}?`}
          message={
            <>
              <span className="font-medium text-slate-700">{deletingRow.item.title}</span>
              {deleting.kind === "TEST"
                ? " and all its questions will be removed from this course."
                : deleting.kind === "ASSIGNMENT"
                  ? " will be removed from this course, along with its submissions."
                  : " will be removed from this course."}
            </>
          }
          onCancel={close}
          onConfirm={() =>
            deleting.kind === "CONTENT"
              ? deleteContent(deleting.id, courseId)
              : deleting.kind === "TEST"
                ? deleteTest(deleting.id, courseId)
                : deleteAssignment(deleting.id, courseId)
          }
        />
      )}

      {questionsTest && <TestQuestionsModal test={questionsTest} courseId={courseId} onClose={close} />}
      {popQuizVideo && (
        <PopQuizzesModal
          courseId={courseId}
          video={{ id: popQuizVideo.id, title: popQuizVideo.title }}
          popQuizzes={popQuizVideo.popQuizzes}
          onClose={close}
        />
      )}
    </>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
    >
      <Plus size={14} />
      {label}
    </button>
  )
}
