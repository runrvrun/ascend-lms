"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Trash2, X, UserCircle2, Search, CheckSquare, Square, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react"
import { addUsersToCohort, removeUserFromCohort, bulkAddMembersToCohort, type BulkAddMembersResult } from "../actions"

type UserOption = {
  id: string
  name: string | null
  email: string | null
  division: string
  title: string
  office: string | null
}

type MemberRow = {
  id: string
  user: UserOption
}

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

function AddMembersModal({
  cohortId,
  availableUsers,
  onClose,
}: {
  cohortId: string
  availableUsers: UserOption[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return availableUsers
    return availableUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.office?.toLowerCase().includes(q) ||
        u.division.toLowerCase().includes(q)
    )
  }, [availableUsers, search])

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
      await addUsersToCohort(cohortId, Array.from(selected))
      onClose()
    })
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id))

  if (availableUsers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Add Members</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">All users are already members of this cohort.</p>
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
            <h2 className="text-lg font-semibold text-slate-900">Add Members</h2>
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
              placeholder="Search by name, email, office, division…"
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
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{u.division}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{formatEnum(u.title)}</span>
                    </div>
                    {u.office && (
                      <span className="text-xs text-slate-400">{u.office}</span>
                    )}
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
              {pending ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""} Member${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BulkUploadModal({
  cohortId,
  onClose,
}: {
  cohortId: string
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkAddMembersResult | null>(null)
  const [pending, startTransition] = useTransition()

  function handleUpload() {
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    startTransition(async () => {
      const res = await bulkAddMembersToCohort(cohortId, fd)
      setResult(res)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Upload Members</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">1</span>
                Download the template
              </p>
              <a
                href="/api/admin/cohort-member-template"
                download
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Download size={14} />
                cohort-member-template.xlsx
              </a>
              <p className="mt-2 text-xs text-slate-400">
                Fill in the <strong>Email</strong> column with one email address per row. Only existing users will be added.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">2</span>
                Upload your completed file
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload size={22} className="text-slate-400" />
                <span className="text-sm text-slate-500">
                  {file ? file.name : "Click to choose .xlsx file"}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                disabled={!file || pending}
                onClick={handleUpload}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload size={14} />
                {pending ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-600">{result.added}</p>
                <p className="text-xs text-green-700">Added</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-2xl font-bold text-amber-600">{result.alreadyMember.length}</p>
                <p className="text-xs text-amber-700">Already Member</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-600">{result.notFound.length + result.errors.length}</p>
                <p className="text-xs text-red-700">Not Found / Errors</p>
              </div>
            </div>

            {result.notFound.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">
                  <AlertCircle size={12} /> Not found in system
                </p>
                <ul className="max-h-28 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 space-y-0.5">
                  {result.notFound.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">
                  <AlertCircle size={12} /> Errors
                </p>
                <ul className="max-h-28 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i}><span className="font-semibold">Row {e.row}:</span> {e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.added > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700">
                <CheckCircle2 size={15} />
                {result.added} member{result.added !== 1 ? "s" : ""} successfully added.
              </div>
            )}

            <div className="flex justify-end gap-2">
              {(result.errors.length > 0 || result.notFound.length > 0) && (
                <button
                  onClick={() => { setResult(null); setFile(null) }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Try Again
                </button>
              )}
              <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RemoveConfirm({
  userName,
  onCancel,
  onConfirm,
}: {
  userName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Remove member?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{userName}</span> will be removed from this cohort.
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

export function CohortMemberManagement({
  cohortId,
  members,
  allUsers,
}: {
  cohortId: string
  members: MemberRow[]
  allUsers: UserOption[]
}) {
  const [adding, setAdding] = useState(false)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [removing, setRemoving] = useState<MemberRow | null>(null)

  const memberUserIds = new Set(members.map((m) => m.user.id))
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id))

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Members</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkUploading(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload size={14} />
            Bulk Upload
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            Add Members
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          No members yet. Add the first ones above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Division</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Office</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle2 size={15} className="shrink-0 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{m.user.name ?? "—"}</p>
                        <p className="text-xs text-slate-400">{m.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{m.user.division}</td>
                  <td className="px-5 py-3 text-slate-600">{formatEnum(m.user.title)}</td>
                  <td className="px-5 py-3 text-slate-500">{m.user.office ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setRemoving(m)}
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
      )}

      {bulkUploading && (
        <BulkUploadModal
          cohortId={cohortId}
          onClose={() => setBulkUploading(false)}
        />
      )}
      {adding && (
        <AddMembersModal
          cohortId={cohortId}
          availableUsers={availableUsers}
          onClose={() => setAdding(false)}
        />
      )}
      {removing && (
        <RemoveConfirm
          userName={removing.user.name ?? removing.user.email ?? ""}
          onCancel={() => setRemoving(null)}
          onConfirm={() => removeUserFromCohort(removing.id, cohortId)}
        />
      )}
    </>
  )
}
