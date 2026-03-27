"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Plus, Pencil, Trash2, X, BookOpen, ArrowRight, Search, ChevronDown } from "lucide-react"
import { createCourse, updateCourse, deleteCourse, toggleCourseStatus, setCourseTrainer, CourseFormData } from "./actions"

type TrainerUser = { id: string; name: string | null }

type CourseRow = {
  id: string
  name: string
  description: string | null
  status: "DRAFT" | "PUBLISHED"
  _count: { contents: number; pathways: number }
  trainers: { user: TrainerUser }[]
}

function ActionsMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick?: () => void; href?: string; variant?: "danger" }[]
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuStyle({ position: "fixed", bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        Actions
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div style={menuStyle} className="z-[9999] min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item, i) =>
            item.href ? (
              <a
                key={i}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                {item.icon}
                {item.label}
              </a>
            ) : (
              <button
                key={i}
                onClick={() => { item.onClick?.(); setOpen(false) }}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 ${item.variant === "danger" ? "text-red-600" : "text-slate-700"}`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

function StatusToggle({ id, status }: { id: string; status: "DRAFT" | "PUBLISHED" }) {
  const [pending, startTransition] = useTransition()
  const isOn = status === "PUBLISHED"
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleCourseStatus(id, isOn ? "DRAFT" : "PUBLISHED"))}
      className="flex items-center gap-2 disabled:opacity-50"
      title={isOn ? "Published — click to set Draft" : "Draft — click to Publish"}
    >
      <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${isOn ? "bg-green-500" : "bg-slate-300"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isOn ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </div>
      <span className={`text-xs font-medium ${isOn ? "text-green-700" : "text-slate-400"}`}>
        {pending ? "…" : isOn ? "Published" : "Draft"}
      </span>
    </button>
  )
}

function CourseFormModal({
  title,
  initial,
  initialTrainerId,
  courseId,
  trainerUsers,
  onClose,
  onSubmit,
}: {
  title: string
  initial: CourseFormData
  initialTrainerId?: string
  courseId?: string
  trainerUsers: TrainerUser[]
  onClose: () => void
  onSubmit: (data: CourseFormData) => Promise<void>
}) {
  const [form, setForm] = useState<CourseFormData>(initial)
  const [trainerId, setTrainerId] = useState(initialTrainerId ?? "")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await onSubmit(form)
        if (courseId !== undefined) {
          await setCourseTrainer(courseId, trainerId || null)
        }
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
          {courseId !== undefined && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Trainer</label>
              <select
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No trainer —</option>
                {trainerUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                ))}
              </select>
            </div>
          )}
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

export function CourseManagement({ courses, trainerUsers }: { courses: CourseRow[]; trainerUsers: TrainerUser[] }) {
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Contents</th>
              <th className="px-5 py-3 text-center">In Pathways</th>
              <th className="px-5 py-3">Trainer</th>
              <th className="sticky right-0 bg-slate-50 px-5 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">{courses.length === 0 ? "No courses yet. Add one above." : "No courses match your search."}</td></tr>
            )}
            {filtered.map((c) => {
              const trainer = c.trainers[0]?.user ?? null
              return (
                <tr key={c.id} className="group hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen size={15} className="shrink-0 text-blue-400" />
                      <span className="font-medium text-slate-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="max-w-xs truncate px-5 py-3 text-slate-500">
                    {c.description ?? <span className="italic text-slate-300">No description</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusToggle id={c.id} status={c.status} />
                  </td>
                  <td className="px-5 py-3 text-center text-slate-600">{c._count.contents}</td>
                  <td className="px-5 py-3 text-center text-slate-600">{c._count.pathways}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {trainer
                      ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{trainer.name}</span>
                      : <span className="text-xs text-slate-300 italic">Unassigned</span>}
                  </td>
                  <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)] group-hover:bg-slate-50">
                    <ActionsMenu items={[
                      { label: "Manage Contents", icon: <ArrowRight size={14} />, href: `/admin/course/${c.id}` },
                      { label: "Edit", icon: <Pencil size={14} />, onClick: () => setEditing(c) },
                      { label: "Delete", icon: <Trash2 size={14} />, onClick: () => setDeleting(c), variant: "danger" },
                    ]} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <CourseFormModal
          title="Add Course"
          initial={{ name: "", description: "" }}
          trainerUsers={trainerUsers}
          onClose={() => setCreating(false)}
          onSubmit={(d) => createCourse(d)}
        />
      )}
      {editing && (
        <CourseFormModal
          title="Edit Course"
          initial={{ name: editing.name, description: editing.description ?? "" }}
          initialTrainerId={editing.trainers[0]?.user.id}
          courseId={editing.id}
          trainerUsers={trainerUsers}
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
