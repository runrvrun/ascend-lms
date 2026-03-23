"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Trash2, X, BookOpen, Search } from "lucide-react"
import { addPathwayToCohort, removePathwayFromCohort } from "../actions"

type PathwayOption = {
  id: string
  name: string
  description: string | null
  _count: { courses: number }
}

type PathwayRow = {
  id: string
  pathway: PathwayOption
}

function AssignPathwaysModal({
  cohortId,
  availablePathways,
  onClose,
}: {
  cohortId: string
  availablePathways: PathwayOption[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return availablePathways
    return availablePathways.filter((p) => p.name.toLowerCase().includes(q))
  }, [availablePathways, search])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0) return
    startTransition(async () => {
      for (const pathwayId of selected) {
        await addPathwayToCohort(cohortId, pathwayId)
      }
      onClose()
    })
  }

  if (availablePathways.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Assign Pathways</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">All available pathways are already assigned to this cohort.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" style={{ maxHeight: "80vh" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assign Pathways</h2>
            {selected.size > 0 && <p className="text-xs text-blue-600">{selected.size} selected</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {availablePathways.length > 5 && (
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pathways…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No pathways match your search.</p>
          ) : (
            filtered.map((p) => {
              const isSelected = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-blue-50" : ""}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-blue-100" : "bg-slate-100"}`}>
                    <BookOpen size={14} className={isSelected ? "text-blue-600" : "text-slate-400"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    {p.description && <p className="truncate text-xs text-slate-400">{p.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{p._count.courses} course{p._count.courses !== 1 ? "s" : ""}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">
            {selected.size === 0 ? "Select pathways to assign" : `Assigning ${selected.size} pathway${selected.size !== 1 ? "s" : ""}`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              disabled={selected.size === 0 || pending}
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Assigning…" : `Assign${selected.size > 0 ? ` ${selected.size}` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RemoveConfirm({
  pathwayName,
  onCancel,
  onConfirm,
}: {
  pathwayName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Remove pathway?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{pathwayName}</span> will be removed from this cohort.
          Existing enrollments from this cohort will not be affected.
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

export function CohortPathwayManagement({
  cohortId,
  assignedPathways,
  allPathways,
}: {
  cohortId: string
  assignedPathways: PathwayRow[]
  allPathways: PathwayOption[]
}) {
  const [assigning, setAssigning] = useState(false)
  const [removing, setRemoving] = useState<PathwayRow | null>(null)

  const assignedIds = new Set(assignedPathways.map((r) => r.pathway.id))
  const availablePathways = allPathways.filter((p) => !assignedIds.has(p.id))

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Pathways</h2>
        <button
          onClick={() => setAssigning(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          Assign Pathways
        </button>
      </div>

      {assignedPathways.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          No pathways assigned yet. Use the button above to assign pathways to this cohort.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Pathway</th>
                <th className="px-5 py-3 text-center">Courses</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedPathways.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen size={15} className="shrink-0 text-blue-400" />
                      <div>
                        <p className="font-medium text-slate-900">{r.pathway.name}</p>
                        {r.pathway.description && (
                          <p className="max-w-xs truncate text-xs text-slate-400">{r.pathway.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center text-slate-600">{r.pathway._count.courses}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setRemoving(r)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove pathway from cohort"
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
      )}

      {assigning && (
        <AssignPathwaysModal
          cohortId={cohortId}
          availablePathways={availablePathways}
          onClose={() => setAssigning(false)}
        />
      )}
      {removing && (
        <RemoveConfirm
          pathwayName={removing.pathway.name}
          onCancel={() => setRemoving(null)}
          onConfirm={() => removePathwayFromCohort(removing.id, cohortId)}
        />
      )}
    </>
  )
}
