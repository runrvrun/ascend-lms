"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, GripVertical, GraduationCap, SeparatorHorizontal, ChevronUp, ChevronDown } from "lucide-react"
import { addCourseToPathway, updatePathwayCourse, removeCourseFromPathway, updateSectionTitle, swapPathwayCourseOrder } from "../actions"
import { SearchableSelect } from "../../../components/SearchableSelect"

type CourseOption = {
  id: string
  name: string
}

type PathwayCourseRow = {
  id: string
  order: number
  points: number
  sectionTitle: string | null
  course: { id: string; name: string }
}

function AddCourseModal({
  pathwayId,
  availableCourses,
  nextOrder,
  onClose,
}: {
  pathwayId: string
  availableCourses: CourseOption[]
  nextOrder: number
  onClose: () => void
}) {
  const [courseId, setCourseId] = useState(availableCourses[0]?.id ?? "")
  const [order, setOrder] = useState(nextOrder)
  const [points, setPoints] = useState(10)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseId) return
    setError("")
    startTransition(async () => {
      try {
        await addCourseToPathway(pathwayId, courseId, order, points)
        onClose()
      } catch {
        setError("Order number already in use. Choose a different one.")
      }
    })
  }

  if (availableCourses.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Add Course</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">All courses have already been added to this pathway.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add Course</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Course <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={courseId}
              onChange={setCourseId}
              options={availableCourses.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="— Select a course —"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Order <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Points <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditCourseModal({
  entry,
  pathwayId,
  onClose,
}: {
  entry: PathwayCourseRow
  pathwayId: string
  onClose: () => void
}) {
  const [order, setOrder] = useState(entry.order)
  const [points, setPoints] = useState(entry.points)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await updatePathwayCourse(entry.id, pathwayId, order, points)
        onClose()
      } catch {
        setError("Order number already in use. Choose a different one.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Edit Course Entry</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <p className="mb-4 text-sm font-medium text-slate-700">{entry.course.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Order <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Points <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SectionModal({
  entry,
  pathwayId,
  onClose,
}: {
  entry: PathwayCourseRow
  pathwayId: string
  onClose: () => void
}) {
  const [title, setTitle] = useState(entry.sectionTitle ?? "")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateSectionTitle(entry.id, pathwayId, title.trim() || null)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Section Separator</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          This separator will appear above <span className="font-medium text-slate-700">{entry.course.name}</span> in the pathway sidebar.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Section Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Foundations, Week 1, Advanced Topics…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending || !title.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RemoveConfirm({
  courseName,
  onCancel,
  onConfirm,
}: {
  courseName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Remove course?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{courseName}</span> will be removed from this pathway.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await onConfirm(); onCancel() })}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PathwayCourseManagement({
  pathwayId,
  entries,
  allCourses,
}: {
  pathwayId: string
  entries: PathwayCourseRow[]
  allCourses: CourseOption[]
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PathwayCourseRow | null>(null)
  const [removing, setRemoving] = useState<PathwayCourseRow | null>(null)
  const [editingSection, setEditingSection] = useState<PathwayCourseRow | null>(null)
  const [, startTransition] = useTransition()
  const [reordering, startReorder] = useTransition()

  const usedCourseIds = new Set(entries.map((e) => e.course.id))
  const availableCourses = allCourses.filter((c) => !usedCourseIds.has(c.id))
  const nextOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.order)) + 1 : 1

  function removeSection(entry: PathwayCourseRow) {
    startTransition(() => updateSectionTitle(entry.id, pathwayId, null))
  }

  function moveUp(i: number) {
    const a = entries[i - 1], b = entries[i]
    startReorder(() => swapPathwayCourseOrder(a.id, a.order, b.id, b.order, pathwayId))
  }

  function moveDown(i: number) {
    const a = entries[i], b = entries[i + 1]
    startReorder(() => swapPathwayCourseOrder(a.id, a.order, b.id, b.order, pathwayId))
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Courses</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          Add Course
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          No courses yet. Add the first one above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3 text-center">Points</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e, i) => (
                <>
                  {e.sectionTitle && (
                    <tr key={`section-${e.id}`} className="bg-slate-50">
                      <td colSpan={4} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-slate-300" />
                          <SeparatorHorizontal size={12} className="shrink-0 text-slate-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{e.sectionTitle}</span>
                          <SeparatorHorizontal size={12} className="shrink-0 text-slate-400" />
                          <div className="h-px flex-1 bg-slate-300" />
                          <button
                            onClick={() => setEditingSection(e)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                            title="Edit section title"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => removeSection(e)}
                            className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                            title="Remove section separator"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr key={e.id} className="group hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400">
                      <div className="flex items-center gap-1">
                        <GripVertical size={13} className="text-slate-300" />
                        {e.order}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <GraduationCap size={14} className="shrink-0 text-blue-400" />
                        <span className="font-medium text-slate-900">{e.course.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        {e.points} pts
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => moveUp(i)}
                          disabled={reordering || i === 0}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => moveDown(i)}
                          disabled={reordering || i === entries.length - 1}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <div className="mx-1 h-4 w-px bg-slate-200" />
                        {!e.sectionTitle && (
                          <button
                            onClick={() => setEditingSection(e)}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                            title="Add section separator before this course"
                          >
                            <SeparatorHorizontal size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setRemoving(e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddCourseModal
          pathwayId={pathwayId}
          availableCourses={availableCourses}
          nextOrder={nextOrder}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditCourseModal
          entry={editing}
          pathwayId={pathwayId}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <RemoveConfirm
          courseName={removing.course.name}
          onCancel={() => setRemoving(null)}
          onConfirm={() => removeCourseFromPathway(removing.id, pathwayId)}
        />
      )}
      {editingSection && (
        <SectionModal
          entry={editingSection}
          pathwayId={pathwayId}
          onClose={() => setEditingSection(null)}
        />
      )}
    </>
  )
}
