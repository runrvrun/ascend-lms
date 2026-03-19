"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Pencil, Trash2, X, Building2, Search, UserCircle2, CheckSquare, Square, Users } from "lucide-react"
import { createOffice, updateOffice, deleteOffice, assignUsersToOffice, removeUserFromOffice } from "./actions"

type UserOption = {
  id: string
  name: string | null
  email: string | null
  division: string
  title: string
}

type OfficeMember = UserOption

type OfficeRow = {
  id: string
  name: string
  _count: { users: number }
  users: OfficeMember[]
}

function formatEnum(val: string) {
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

// ── Add Users Modal ─────────────────────────────────────────────────────────

function AddUsersModal({
  office,
  unassignedUsers,
  onClose,
}: {
  office: OfficeRow
  unassignedUsers: UserOption[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return unassignedUsers
    return unassignedUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.division.toLowerCase().includes(q) ||
        formatEnum(u.title).toLowerCase().includes(q)
    )
  }, [unassignedUsers, search])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (filtered.every((u) => selected.has(u.id))) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((u) => next.delete(u.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((u) => next.add(u.id))
        return next
      })
    }
  }

  function handleSubmit() {
    if (selected.size === 0) return
    startTransition(async () => {
      await assignUsersToOffice(office.id, Array.from(selected))
      onClose()
    })
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id))

  if (unassignedUsers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Add Users</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">All users are already assigned to an office.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Users to {office.name}</h2>
            {selected.size > 0 && (
              <p className="text-xs text-blue-600">{selected.size} selected</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, division, title…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Select-all row */}
        <div className="shrink-0 border-b border-slate-100 px-4 py-2">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            {allFilteredSelected
              ? <CheckSquare size={14} className="text-blue-600" />
              : <Square size={14} />}
            {allFilteredSelected ? "Deselect" : "Select"} all visible ({filtered.length})
          </button>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No users match your search.</p>
          ) : (
            filtered.map((u) => {
              const isSelected = selected.has(u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-blue-50" : ""}`}
                >
                  {isSelected
                    ? <CheckSquare size={16} className="shrink-0 text-blue-600" />
                    : <Square size={16} className="shrink-0 text-slate-300" />}
                  <UserCircle2 size={16} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{u.name ?? "—"}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{u.division}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{formatEnum(u.title)}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">
            {selected.size === 0 ? "Select users to add" : `Adding ${selected.size} user${selected.size !== 1 ? "s" : ""}`}
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
              {pending ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""} User${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Members Modal ────────────────────────────────────────────────────────────

function MembersModal({
  office,
  onClose,
}: {
  office: OfficeRow
  onClose: () => void
}) {
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return office.users
    return office.users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.division.toLowerCase().includes(q)
    )
  }, [office.users, search])

  function handleRemove(userId: string) {
    setRemovingId(userId)
    startTransition(async () => {
      await removeUserFromOffice(userId)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" style={{ maxHeight: "85vh" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{office.name}</h2>
            <p className="text-xs text-slate-500">{office._count.users} member{office._count.users !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {office.users.length > 5 && (
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {office.users.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No users assigned to this office yet.</p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No members match your search.</p>
          ) : (
            filtered.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <UserCircle2 size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{u.name ?? "—"}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{u.division}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{formatEnum(u.title)}</span>
                </div>
                <button
                  disabled={pending && removingId === u.id}
                  onClick={() => handleRemove(u.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Remove from office"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Form & Delete modals ─────────────────────────────────────────────────────

function OfficeFormModal({
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
        setError("An office with this name already exists.")
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
              placeholder="e.g. SEA - YCP Singapore"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
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

function DeleteConfirm({
  office,
  onCancel,
  onConfirm,
}: {
  office: OfficeRow
  onCancel: () => void
  onConfirm: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete office?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{office.name}</span> will be permanently deleted.
          {office._count.users > 0 && (
            <span className="mt-1 block text-amber-600">
              Warning: {office._count.users} user{office._count.users !== 1 ? "s are" : " is"} currently assigned to this office and will be unassigned.
            </span>
          )}
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

// ── Main component ───────────────────────────────────────────────────────────

export function OfficeManagement({
  offices,
  allUsers,
}: {
  offices: OfficeRow[]
  allUsers: UserOption[]
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<OfficeRow | null>(null)
  const [deleting, setDeleting] = useState<OfficeRow | null>(null)
  const [addingUsers, setAddingUsers] = useState<OfficeRow | null>(null)
  const [viewingMembers, setViewingMembers] = useState<OfficeRow | null>(null)
  const [search, setSearch] = useState("")

  // Users with no office assigned — available to be added to any office
  const unassignedUsers = useMemo(
    () => allUsers.filter((u) => !offices.some((o) => o.users.some((m) => m.id === u.id))),
    [allUsers, offices]
  )

  const filtered = search
    ? offices.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : offices

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offices</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {offices.length} office{offices.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Office
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
              <th className="px-5 py-3 text-center">Users</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-400">
                  {offices.length === 0 ? "No offices yet. Add one above." : "No offices match your search."}
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="shrink-0 text-blue-400" />
                    <span className="font-medium text-slate-900">{o.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  {o._count.users > 0 ? (
                    <button
                      onClick={() => setViewingMembers(o)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {o._count.users}
                    </button>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setAddingUsers(o)}
                      title="Add users"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <Users size={13} />
                      Add Users
                    </button>
                    <button
                      onClick={() => setEditing(o)}
                      title="Edit office"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(o)}
                      title="Delete office"
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
        <OfficeFormModal
          title="Add Office"
          initial=""
          onClose={() => setCreating(false)}
          onSubmit={(name) => createOffice(name)}
        />
      )}
      {editing && (
        <OfficeFormModal
          title="Edit Office"
          initial={editing.name}
          onClose={() => setEditing(null)}
          onSubmit={(name) => updateOffice(editing.id, name)}
        />
      )}
      {deleting && (
        <DeleteConfirm
          office={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteOffice(deleting.id)}
        />
      )}
      {addingUsers && (
        <AddUsersModal
          office={addingUsers}
          unassignedUsers={unassignedUsers}
          onClose={() => setAddingUsers(null)}
        />
      )}
      {viewingMembers && (
        <MembersModal
          office={viewingMembers}
          onClose={() => setViewingMembers(null)}
        />
      )}
    </>
  )
}
