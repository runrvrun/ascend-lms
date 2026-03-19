"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, BookOpen, ArrowRight, Search } from "lucide-react"
import { createCourse, updateCourse, deleteCourse, CourseFormData } from "./actions"

type CourseRow = {
  id: string
  name: string
  description: string | null
  _count: { contents: number; pathways: number }
}

const empty: CourseFormData = { name: "", description: "" }

function CourseFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string
  initial: CourseFormData
  onClose: () => void
  onSubmit: (data: CourseFormData) => Promise<void>
}) {
  const [form, setForm] = useState<CourseFormData>(initial)
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
        setError("A course with this name already exists.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name <span className="text-red-500">*</span></label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Financial Modeling Basics"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this course…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

function DeleteConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete course?</h2>
        <p className="mt-2 text-sm text-slate-500"><span className="font-medium text-slate-700">{name}</span> will be archived.</p>
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

export function CourseManagement({ courses }: { courses: CourseRow[] }) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [deleting, setDeleting] = useState<CourseRow | null>(null)
  const [search, setSearch] = useState("")

  const filtered = search
    ? courses.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : courses

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {courses.length} courses</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Course
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3 text-center">Contents</th>
              <th className="px-5 py-3 text-center">In Pathways</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">{courses.length === 0 ? "No courses yet. Add one above." : "No courses match your search."}</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="shrink-0 text-blue-400" />
                    <span className="font-medium text-slate-900">{c.name}</span>
                  </div>
                </td>
                <td className="max-w-xs truncate px-5 py-3 text-slate-500">
                  {c.description ?? <span className="italic text-slate-300">No description</span>}
                </td>
                <td className="px-5 py-3 text-center text-slate-600">{c._count.contents}</td>
                <td className="px-5 py-3 text-center text-slate-600">{c._count.pathways}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`/admin/course/${c.id}`}
                      title="Manage contents"
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      Contents <ArrowRight size={12} />
                    </a>
                    <button onClick={() => setEditing(c)} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(c)} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CourseFormModal title="Add Course" initial={empty} onClose={() => setCreating(false)} onSubmit={(d) => createCourse(d)} />
      )}
      {editing && (
        <CourseFormModal
          title="Edit Course"
          initial={{ name: editing.name, description: editing.description ?? "" }}
          onClose={() => setEditing(null)}
          onSubmit={(d) => updateCourse(editing.id, d)}
        />
      )}
      {deleting && (
        <DeleteConfirm name={deleting.name} onCancel={() => setDeleting(null)} onConfirm={() => deleteCourse(deleting.id)} />
      )}
    </>
  )
}
