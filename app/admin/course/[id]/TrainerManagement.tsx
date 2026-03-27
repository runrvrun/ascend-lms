"use client"

import { useState, useTransition } from "react"
import { UserPlus, X, Search } from "lucide-react"
import { addCourseTrainer, removeCourseTrainer } from "../actions"

type TrainerRow = {
  userId: string
  user: { id: string; name: string | null; email: string | null }
}

type UserOption = { id: string; name: string | null; email: string | null }

export function TrainerManagement({
  courseId,
  trainers,
  allUsers,
}: {
  courseId: string
  trainers: TrainerRow[]
  allUsers: UserOption[]
}) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const [pending, startTransition] = useTransition()

  const trainerIds = new Set(trainers.map((t) => t.userId))
  const filtered = allUsers.filter((u) => {
    if (trainerIds.has(u.id)) return false
    const q = query.toLowerCase()
    return (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q)
  })

  function handleAdd(userId: string) {
    startTransition(async () => {
      await addCourseTrainer(courseId, userId)
      setAdding(false)
      setQuery("")
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeCourseTrainer(courseId, userId)
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Trainers</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <UserPlus size={14} />
          Add Trainer
        </button>
      </div>

      {trainers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">
          No trainers assigned. Add one above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainers.map((t) => (
                <tr key={t.userId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.user.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{t.user.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={pending}
                      onClick={() => handleRemove(t.userId)}
                      className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add Trainer</h2>
              <button onClick={() => { setAdding(false); setQuery("") }} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No users found.</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    disabled={pending}
                    onClick={() => handleAdd(u.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.name ?? "—"}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
