"use client"

import { useState, useTransition, useMemo } from "react"
import { X, UserCircle2, Plus, CheckCircle2, Star, Search, BarChart2 } from "lucide-react"
import { assignPathway } from "./actions"

type PathwayOption = {
  id: string
  name: string
}

type EnrolledPathwayId = string

type Professional = {
  id: string
  name: string | null
  email: string | null
  division: string
  title: string
  office: string | null
  enrolledPathwayIds: EnrolledPathwayId[]
  pathwayCount: number
  completedPathways: number
  totalPoints: number
}

function AssignModal({
  user,
  pathways,
  onClose,
}: {
  user: Professional
  pathways: PathwayOption[]
  onClose: () => void
}) {
  const available = pathways.filter((p) => !user.enrolledPathwayIds.includes(p.id))
  const [pathwayId, setPathwayId] = useState(available[0]?.id ?? "")
  const [deadline, setDeadline] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pathwayId) return
    startTransition(async () => {
      await assignPathway(user.id, pathwayId, deadline || null)
      onClose()
    })
  }

  if (available.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Assign Pathway</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">{user.name ?? user.email} is already enrolled in all available pathways.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assign Pathway</h2>
            <p className="text-sm text-slate-500">{user.name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Pathway <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={pathwayId}
              onChange={(e) => setPathwayId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Deadline <span className="text-slate-400">(optional)</span></label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ProfessionalsList({
  professionals,
  pathways,
}: {
  professionals: Professional[]
  pathways: PathwayOption[]
}) {
  const [assigning, setAssigning] = useState<Professional | null>(null)
  const [search, setSearch] = useState("")

  function formatEnum(val: string) {
    return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return professionals
    return professionals.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.division.toLowerCase().includes(q) ||
      formatEnum(p.title).toLowerCase().includes(q) ||
      p.office?.toLowerCase().includes(q)
    )
  }, [professionals, search])

  return (
    <>
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, division, title, office…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {professionals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
          No professionals are assigned to you yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
          No professionals match your search.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Division</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3 text-center">Pathways</th>
                <th className="px-5 py-3 text-center">Points</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle2 size={15} className="shrink-0 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{p.name ?? "—"}</p>
                        <p className="text-xs text-slate-400">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.division}</td>
                  <td className="px-5 py-3 text-slate-600">{formatEnum(p.title)}</td>
                  <td className="px-5 py-3 text-center">
                    {p.pathwayCount === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          {p.completedPathways > 0 && (
                            <CheckCircle2 size={13} className="text-green-500" />
                          )}
                          <span className="text-sm font-semibold text-slate-800">
                            {p.completedPathways}/{p.pathwayCount}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">completed</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star size={13} className="text-yellow-400" />
                      <span className="text-sm font-semibold text-slate-800">
                        {p.totalPoints.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/devmanager/professionals/${p.id}`}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <BarChart2 size={13} />
                        Progress
                      </a>
                      <button
                        onClick={() => setAssigning(p)}
                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Plus size={13} />
                        Assign
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
        <AssignModal
          user={assigning}
          pathways={pathways}
          onClose={() => setAssigning(null)}
        />
      )}
    </>
  )
}
