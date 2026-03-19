"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, GripVertical, GraduationCap } from "lucide-react"
import { addCourseToPathway, updatePathwayCourse, removeCourseFromPathway } from "../actions"

type CourseOption = {
  id: string
  name: string
}

type PathwayCourseRow = {
  id: string
  order: number
  points: number
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
            <select
              required
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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

  const usedCourseIds = new Set(entries.map((e) => e.course.id))
  const availableCourses = allCourses.filter((c) => !usedCourseIds.has(c.id))
  const nextOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.order)) + 1 : 1

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
              {entries.map((e) => (
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
    </>
  )
}
