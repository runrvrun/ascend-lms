"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, Check, Search, UserPlus } from "lucide-react"
import { createTopic, updateTopic, deleteTopic, addTopicSME, removeTopicSME } from "./actions"

type UserOption = { id: string; name: string | null; email: string | null }
type SMERow = { userId: string; user: UserOption }
type TopicRow = { id: string; name: string; smes: SMERow[]; _count: { courses: number } }

function SMEManager({
  topic,
  allUsers,
}: {
  topic: TopicRow
  allUsers: UserOption[]
}) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const [pending, startTransition] = useTransition()

  const smeIds = new Set(topic.smes.map((s) => s.userId))
  const filtered = allUsers.filter((u) => {
    if (smeIds.has(u.id)) return false
    const q = query.toLowerCase()
    return (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q)
  })

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">SMEs</p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          <UserPlus size={12} />
          Add SME
        </button>
      </div>

      {topic.smes.length === 0 && !adding && (
        <p className="text-xs italic text-slate-300">No SMEs assigned</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {topic.smes.map((s) => (
          <div key={s.userId} className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            {s.user.name ?? s.user.email}
            <button
              onClick={() => startTransition(() => removeTopicSME(topic.id, s.userId))}
              disabled={pending}
              className="ml-0.5 rounded-full hover:text-red-500 disabled:opacity-50"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-2">
          <div className="relative mb-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user…"
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No users found</p>
            ) : (
              filtered.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    startTransition(() => addTopicSME(topic.id, u.id))
                    setAdding(false)
                    setQuery("")
                  }}
                  disabled={pending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="font-medium text-slate-800">{u.name ?? "—"}</span>
                  <span className="text-slate-400">{u.email}</span>
                </button>
              ))
            )}
          </div>
          <button onClick={() => { setAdding(false); setQuery("") }} className="mt-1 text-xs text-slate-400 hover:text-slate-600">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function TopicCard({
  topic,
  allUsers,
  onDelete,
}: {
  topic: TopicRow
  allUsers: UserOption[]
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(topic.name)
  const [pending, startTransition] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      await updateTopic(topic.id, name)
      setEditing(false)
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={handleSave} className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={pending || !name.trim()} className="rounded-lg p-1 text-green-600 hover:bg-green-50 disabled:opacity-50">
                <Check size={14} />
              </button>
              <button type="button" onClick={() => { setEditing(false); setName(topic.name) }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={14} />
              </button>
            </form>
          ) : (
            <h3 className="text-base font-semibold text-slate-900">{topic.name}</h3>
          )}
          <p className="mt-0.5 text-xs text-slate-400">{topic._count.courses} course{topic._count.courses !== 1 ? "s" : ""}</p>
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600">
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              disabled={topic._count.courses > 0}
              title={topic._count.courses > 0 ? "Remove all courses from this topic first" : "Delete topic"}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <SMEManager topic={topic} allUsers={allUsers} />
    </div>
  )
}

export function TopicManagement({ topics, allUsers }: { topics: TopicRow[]; allUsers: UserOption[] }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    startTransition(async () => {
      await createTopic(newName)
      setNewName("")
      setCreating(false)
    })
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Topics</h1>
          <p className="mt-1 text-sm text-slate-500">Organise courses by topic and assign Subject Matter Experts.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Topic
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">New Topic</h2>
              <button onClick={() => setCreating(false)} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <input
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Financial Modeling"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending || !newName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {pending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Delete topic?</h2>
            <p className="mt-2 text-sm text-slate-500">This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await deleteTopic(deleting!); setDeleting(null) })}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          No topics yet. Add one above.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <TopicCard key={t.id} topic={t} allUsers={allUsers} onDelete={() => setDeleting(t.id)} />
          ))}
        </div>
      )}
    </>
  )
}
