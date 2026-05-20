"use client"

import { useState, useTransition, useMemo } from "react"
import {
  Plus, Trash2, X, UserCircle2, Search,
  CheckSquare, Square, Users, UsersRound,
} from "lucide-react"
import {
  adminEnrollUsers,
  adminRemoveEnrollment,
  adminAssignCohortToPathway,
  adminRemoveCohortFromPathway,
} from "../../actions"

type IndividualEnrollment = {
  id: string
  type: "SELF_ENROLL" | "ASSIGNED" | "USER_REQUEST"
  status: "PENDING" | "APPROVED" | "REJECTED"
  createdAt: Date
  user: { id: string; name: string | null; email: string | null; division: string }
}

type CohortAssignment = {
  id: string
  cohort: { id: string; name: string; _count: { users: number } }
}

type UserOption = {
  id: string
  name: string | null
  email: string | null
  division: string
}

type CohortOption = {
  id: string
  name: string
  _count: { users: number }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: IndividualEnrollment["type"]) {
  if (type === "SELF_ENROLL") return "Self-enrolled"
  if (type === "ASSIGNED") return "Assigned"
  return "Requested"
}

function statusBadge(status: IndividualEnrollment["status"]) {
  if (status === "APPROVED") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Approved</span>
  if (status === "PENDING") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejected</span>
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Add Users Modal ───────────────────────────────────────────────────────────

function AddUsersModal({
  pathwayId,
  availableUsers,
  onClose,
}: {
  pathwayId: string
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
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.division.toLowerCase().includes(q)
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
      setSelected((prev) => { const next = new Set(prev); filtered.forEach((u) => next.delete(u.id)); return next })
    } else {
      setSelected((prev) => { const next = new Set(prev); filtered.forEach((u) => next.add(u.id)); return next })
    }
  }

  function handleSubmit() {
    if (selected.size === 0) return
    startTransition(async () => {
      await adminEnrollUsers(pathwayId, Array.from(selected))
      onClose()
    })
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id))

  if (availableUsers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Enroll Users</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">All users are already enrolled in this pathway.</p>
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
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Enroll Users</h2>
            {selected.size > 0 && <p className="text-xs text-blue-600">{selected.size} selected</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, division…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-4 py-2">
          <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800">
            {allFilteredSelected ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
            {allFilteredSelected ? "Deselect" : "Select"} all visible ({filtered.length})
          </button>
        </div>

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
                  {isSelected ? <CheckSquare size={16} className="shrink-0 text-blue-600" /> : <Square size={16} className="shrink-0 text-slate-300" />}
                  <UserCircle2 size={16} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{u.name ?? "—"}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 shrink-0">{u.division}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">
            {selected.size === 0 ? "Select users to enroll" : `Enrolling ${selected.size} user${selected.size !== 1 ? "s" : ""}`}
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
              {pending ? "Enrolling…" : `Enroll${selected.size > 0 ? ` ${selected.size}` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Assign Cohort Modal ───────────────────────────────────────────────────────

function AssignCohortModal({
  pathwayId,
  availableCohorts,
  onClose,
}: {
  pathwayId: string
  availableCohorts: CohortOption[]
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState(availableCohorts[0]?.id ?? "")
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? availableCohorts.filter((c) => c.name.toLowerCase().includes(q)) : availableCohorts
  }, [availableCohorts, search])

  function handleSubmit() {
    if (!selectedId) return
    startTransition(async () => {
      await adminAssignCohortToPathway(pathwayId, selectedId)
      onClose()
    })
  }

  if (availableCohorts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Assign Cohort</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-500">All cohorts are already assigned to this pathway.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ maxHeight: "80vh" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Assign Cohort</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cohorts…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        <p className="shrink-0 px-4 py-2 text-xs text-slate-500">
          Assigning a cohort will auto-enroll all its current members.
        </p>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No cohorts match your search.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selectedId === c.id ? "bg-blue-50" : ""}`}
              >
                {selectedId === c.id
                  ? <CheckSquare size={16} className="shrink-0 text-blue-600" />
                  : <Square size={16} className="shrink-0 text-slate-300" />}
                <UsersRound size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{c._count.users} member{c._count.users !== 1 ? "s" : ""}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            disabled={!selectedId || pending}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Assigning…" : "Assign Cohort"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Remove Confirm ────────────────────────────────────────────────────────────

function RemoveConfirm({
  label,
  description,
  onCancel,
  onConfirm,
}: {
  label: string
  description: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
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

// ── Main Component ────────────────────────────────────────────────────────────

export function PathwayEnrollmentManagement({
  pathwayId,
  individualEnrollments,
  cohortAssignments,
  availableUsers,
  availableCohorts,
}: {
  pathwayId: string
  individualEnrollments: IndividualEnrollment[]
  cohortAssignments: CohortAssignment[]
  availableUsers: UserOption[]
  availableCohorts: CohortOption[]
}) {
  const [addingUsers, setAddingUsers] = useState(false)
  const [assigningCohort, setAssigningCohort] = useState(false)
  const [removingEnrollment, setRemovingEnrollment] = useState<IndividualEnrollment | null>(null)
  const [removingCohort, setRemovingCohort] = useState<CohortAssignment | null>(null)

  const cohortMemberTotal = cohortAssignments.reduce((s, ca) => s + ca.cohort._count.users, 0)
  const total = individualEnrollments.length + cohortMemberTotal

  return (
    <>
      {/* Summary */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
          <p className="text-3xl font-bold text-slate-900">{individualEnrollments.length}</p>
          <p className="mt-1 text-xs text-slate-500">Individual enrollments</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
          <p className="text-3xl font-bold text-slate-900">{cohortMemberTotal}</p>
          <p className="mt-1 text-xs text-slate-500">Via {cohortAssignments.length} cohort{cohortAssignments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm text-center">
          <p className="text-3xl font-bold text-blue-700">{total}</p>
          <p className="mt-1 text-xs text-blue-500">Total enrolled users</p>
        </div>
      </div>

      {/* Individual Enrollments */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Individual Enrollments</h2>
          <button
            onClick={() => setAddingUsers(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            Enroll Users
          </button>
        </div>

        {individualEnrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
            No individual enrollments yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Division</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Enrolled</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {individualEnrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <UserCircle2 size={15} className="shrink-0 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{e.user.name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{e.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{e.user.division}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{typeLabel(e.type)}</td>
                    <td className="px-5 py-3">{statusBadge(e.status)}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{formatDate(e.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setRemovingEnrollment(e)}
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
      </section>

      {/* Cohort Assignments */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Cohort Assignments</h2>
          <button
            onClick={() => setAssigningCohort(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            Assign Cohort
          </button>
        </div>

        {cohortAssignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
            No cohorts assigned yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Cohort</th>
                  <th className="px-5 py-3 text-center">Members</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cohortAssignments.map((ca) => (
                  <tr key={ca.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="shrink-0 text-slate-400" />
                        <span className="font-medium text-slate-900">{ca.cohort.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {ca.cohort._count.users}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setRemovingCohort(ca)}
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
      </section>

      {/* Modals */}
      {addingUsers && (
        <AddUsersModal
          pathwayId={pathwayId}
          availableUsers={availableUsers}
          onClose={() => setAddingUsers(false)}
        />
      )}
      {assigningCohort && (
        <AssignCohortModal
          pathwayId={pathwayId}
          availableCohorts={availableCohorts}
          onClose={() => setAssigningCohort(false)}
        />
      )}
      {removingEnrollment && (
        <RemoveConfirm
          label="Remove enrollment?"
          description={`${removingEnrollment.user.name ?? removingEnrollment.user.email} will be unenrolled from this pathway.`}
          onCancel={() => setRemovingEnrollment(null)}
          onConfirm={() => adminRemoveEnrollment(removingEnrollment.id, pathwayId)}
        />
      )}
      {removingCohort && (
        <RemoveConfirm
          label="Remove cohort assignment?"
          description={`"${removingCohort.cohort.name}" will be unassigned. Existing individual enrollments created through this cohort are not removed.`}
          onCancel={() => setRemovingCohort(null)}
          onConfirm={() => adminRemoveCohortFromPathway(removingCohort.id, pathwayId)}
        />
      )}
    </>
  )
}
