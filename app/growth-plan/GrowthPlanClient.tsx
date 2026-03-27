"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, Check, CheckCircle2, Circle, Target, BadgeCheck } from "lucide-react"
import { createGrowthPlan, updateGrowthPlan, deleteGrowthPlan, toggleGrowthPlanComplete } from "./actions"

type GrowthPlanItem = {
  id: string
  title: string
  pathwayId: string | null
  pathwayName: string | null
  completedAt: Date | null
  confirmedAt: Date | null
}

function GrowthPlanRow({ item }: { item: GrowthPlanItem }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [pending, startTransition] = useTransition()

  const isDone = !!item.completedAt
  const isConfirmed = !!item.confirmedAt

  function handleToggle() {
    startTransition(() => toggleGrowthPlanComplete(item.id, !isDone))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      await updateGrowthPlan(item.id, title)
      setEditing(false)
    })
  }

  function handleDelete() {
    startTransition(() => deleteGrowthPlan(item.id))
  }

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${isDone ? "border-green-100 bg-green-50" : "border-slate-100 bg-white"}`}>
      <button
        onClick={handleToggle}
        disabled={pending}
        className="mt-0.5 shrink-0 disabled:opacity-50"
        title={isDone ? "Mark incomplete" : "Mark complete"}
      >
        {isDone
          ? <CheckCircle2 size={18} className="text-green-500" />
          : <Circle size={18} className="text-slate-300 hover:text-slate-400" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={handleSave} className="flex items-center gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={pending || !title.trim()} className="rounded-lg p-1 text-green-600 hover:bg-green-50 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => { setEditing(false); setTitle(item.title) }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X size={14} />
            </button>
          </form>
        ) : (
          <>
            <p className={`text-sm font-medium ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
              {item.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {item.pathwayName && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  {item.pathwayName}
                </span>
              )}
              {isConfirmed && (
                <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600">
                  <BadgeCheck size={11} />
                  Confirmed by manager
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600">
            <Pencil size={13} />
          </button>
          <button onClick={handleDelete} disabled={pending} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function AddItemForm({ pathwayId }: { pathwayId?: string }) {
  const [title, setTitle] = useState("")
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      await createGrowthPlan(title, pathwayId)
      setTitle("")
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        <Plus size={15} />
        Add growth plan item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What will you do after this training?"
        className="flex-1 bg-transparent text-sm focus:outline-none"
      />
      <button type="submit" disabled={pending || !title.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
        {pending ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={() => { setOpen(false); setTitle("") }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
        <X size={14} />
      </button>
    </form>
  )
}

export function GrowthPlanClient({ items }: { items: GrowthPlanItem[] }) {
  // Group by pathway
  const groups = new Map<string | null, { label: string | null; items: GrowthPlanItem[] }>()

  for (const item of items) {
    const key = item.pathwayId
    if (!groups.has(key)) {
      groups.set(key, { label: item.pathwayName, items: [] })
    }
    groups.get(key)!.items.push(item)
  }

  // Personal (no pathway) first, then alphabetical
  const personal = groups.get(null)
  const pathwayGroups = [...groups.entries()]
    .filter(([k]) => k !== null)
    .sort((a, b) => (a[1].label ?? "").localeCompare(b[1].label ?? ""))

  return (
    <div className="flex flex-col gap-8">
      {/* Personal items */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Target size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Personal</h2>
        </div>
        <div className="flex flex-col gap-2">
          {personal?.items.map((item) => <GrowthPlanRow key={item.id} item={item} />) ?? null}
          <AddItemForm />
        </div>
      </section>

      {/* Pathway groups */}
      {pathwayGroups.map(([pathwayId, group]) => (
        <section key={pathwayId}>
          <div className="mb-3 flex items-center gap-2">
            <Target size={15} className="text-blue-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
          </div>
          <div className="flex flex-col gap-2">
            {group.items.map((item) => <GrowthPlanRow key={item.id} item={item} />)}
          </div>
        </section>
      ))}

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Target size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-400">No growth plans yet.</p>
          <p className="mt-1 text-xs text-slate-400">Add your first item above or after completing a pathway.</p>
        </div>
      )}
    </div>
  )
}
