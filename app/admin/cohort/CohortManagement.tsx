"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Plus, Pencil, Trash2, X, Users, Search, ChevronDown, BarChart2, BookOpen } from "lucide-react"
import { createCohort, updateCohort, deleteCohort } from "./actions"

type CohortRow = {
  id: string
  name: string
  _count: { users: number }
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

function CohortFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string
  initial: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await onSubmit(name)
        onClose()
      } catch {
        setError("A cohort with this name already exists.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Batch 2025-A"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

function DeleteConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete cohort?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{name}</span> will be archived and all its members removed.
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

export function CohortManagement({ cohorts }: { cohorts: CohortRow[] }) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CohortRow | null>(null)
  const [deleting, setDeleting] = useState<CohortRow | null>(null)
  const [search, setSearch] = useState("")

  const filtered = search
    ? cohorts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : cohorts

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cohorts</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {cohorts.length} cohort{cohorts.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Cohort
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
              <th className="px-5 py-3 text-center">Members</th>
              <th className="sticky right-0 bg-slate-50 px-5 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-400">
                  {cohorts.length === 0 ? "No cohorts yet. Add one above." : "No cohorts match your search."}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="group hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="shrink-0 text-blue-400" />
                    <span className="font-medium text-slate-900">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-center text-slate-600">{c._count.users}</td>
                <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)] group-hover:bg-slate-50">
                  <ActionsMenu items={[
                    { label: "Members", icon: <Users size={14} />, href: `/admin/cohort/${c.id}` },
                    { label: "Pathways", icon: <BookOpen size={14} />, href: `/admin/cohort/${c.id}/pathways` },
                    { label: "View Progress", icon: <BarChart2 size={14} />, href: `/admin/cohort/${c.id}/progress` },
                    { label: "Edit", icon: <Pencil size={14} />, onClick: () => setEditing(c) },
                    { label: "Delete", icon: <Trash2 size={14} />, onClick: () => setDeleting(c), variant: "danger" },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CohortFormModal
          title="Add Cohort"
          initial=""
          onClose={() => setCreating(false)}
          onSubmit={(name) => createCohort(name)}
        />
      )}
      {editing && (
        <CohortFormModal
          title="Edit Cohort"
          initial={editing.name}
          onClose={() => setEditing(null)}
          onSubmit={(name) => updateCohort(editing.id, name)}
        />
      )}
      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteCohort(deleting.id)}
        />
      )}
    </>
  )
}
