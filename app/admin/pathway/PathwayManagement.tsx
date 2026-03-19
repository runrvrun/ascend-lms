"use client"

import { useState, useTransition, useRef } from "react"
import { Plus, Pencil, Trash2, X, BookOpen, GraduationCap, Search, Tag } from "lucide-react"
import { createPathway, updatePathway, deletePathway, PathwayFormData } from "./actions"

type PathwayRow = {
  id: string
  name: string
  description: string | null
  requiresApproval: boolean
  tags: string[]
  _count: { courses: number; pathwayEnrollments: number }
  createdAt: Date
}

const empty: PathwayFormData = { name: "", description: "", requiresApproval: false, tags: [] }

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Tags</label>
      <div
        className="flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 cursor-text focus-within:ring-2 focus-within:ring-blue-500"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="hover:text-blue-900">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? "Type and press Enter or comma…" : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">Press Enter or comma to add a tag</p>
    </div>
  )
}

function PathwayFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string
  initial: PathwayFormData
  onClose: () => void
  onSubmit: (data: PathwayFormData) => Promise<void>
}) {
  const [form, setForm] = useState<PathwayFormData>(initial)
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
        setError("A pathway with this name already exists.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Analyst Track"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this pathway…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.requiresApproval ?? false}
                onChange={(e) => setForm((f) => ({ ...f, requiresApproval: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Requires approval</p>
                <p className="text-xs text-slate-500">Enrollment must be approved by the user's development manager before starting.</p>
              </div>
            </label>
          </div>

          <TagInput tags={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />

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

function DeleteConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete pathway?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{name}</span> will be archived and hidden from users.
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
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PathwayManagement({ pathways }: { pathways: PathwayRow[] }) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PathwayRow | null>(null)
  const [deleting, setDeleting] = useState<PathwayRow | null>(null)
  const [search, setSearch] = useState("")

  const filtered = search
    ? pathways.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : pathways

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pathways</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {pathways.length} pathways</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Pathway
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
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Tags</th>
              <th className="px-5 py-3 text-center">Enrollment</th>
              <th className="px-5 py-3 text-center">Courses</th>
              <th className="px-5 py-3 text-center">Enrollments</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  {pathways.length === 0 ? "No pathways yet. Add one above." : "No pathways match your search."}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="shrink-0 text-blue-400" />
                    <span className="font-medium text-slate-900">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 max-w-xs text-slate-500 truncate">
                  {p.description ?? <span className="italic text-slate-300">No description</span>}
                </td>
                <td className="px-5 py-3">
                  {p.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="italic text-slate-300 text-xs">No tags</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  {p.requiresApproval ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Approval required</span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Free enroll</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center text-slate-600">{p._count.courses}</td>
                <td className="px-5 py-3 text-center text-slate-600">{p._count.pathwayEnrollments}</td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`/admin/pathway/${p.id}`}
                      title="Manage courses"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <GraduationCap size={13} />
                      Courses
                    </a>
                    <button
                      onClick={() => setEditing(p)}
                      title="Edit pathway"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(p)}
                      title="Delete pathway"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
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
        <PathwayFormModal
          title="Add Pathway"
          initial={empty}
          onClose={() => setCreating(false)}
          onSubmit={(data) => createPathway(data)}
        />
      )}

      {editing && (
        <PathwayFormModal
          title="Edit Pathway"
          initial={{ name: editing.name, description: editing.description ?? "", requiresApproval: editing.requiresApproval, tags: editing.tags }}
          onClose={() => setEditing(null)}
          onSubmit={(data) => updatePathway(editing.id, data)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deletePathway(deleting.id)}
        />
      )}
    </>
  )
}
