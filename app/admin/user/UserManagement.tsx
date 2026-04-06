"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Division, JobTitle, Role } from "@prisma/client"
import { Pencil, Trash2, X, UserPlus, ShieldCheck, Search, Upload, Download, CheckCircle2, AlertCircle, SkipForward, Users, ChevronDown, Mail, KeyRound } from "lucide-react"
import { SearchableSelect } from "../../components/SearchableSelect"
import { createUser, updateUser, deleteUser, setUserRoles, setUserCohorts, bulkCreateUsers, sendActivationEmail, adminSetPassword, addUserManager, removeUserManager, UserFormData, BulkImportResult } from "./actions"

type ManagerOption = { id: string; name: string | null }
type CohortOption = { id: string; name: string }
type OfficeOption = { id: string; name: string }

type UserRow = {
  id: string
  name: string | null
  email: string | null
  division: Division
  title: JobTitle
  officeId: string | null
  office: OfficeOption | null
  managers: { managerId: string; manager: ManagerOption }[]
  roles: { role: Role }[]
  cohorts: { cohortId: string }[]
}

const DIVISIONS = Object.values(Division)
const TITLES = Object.values(JobTitle)
const ALL_ROLES: Role[] = ["ADMIN", "MANAGER", "TRAINER", "SME"]

function formatEnum(val: string) {
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

const empty: UserFormData = {
  name: "",
  email: "",
  division: Division.MSD,
  title: JobTitle.ANALYST,
  officeId: "",
}

function ActionsMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; variant?: "danger" }[]
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
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 ${item.variant === "danger" ? "text-red-600" : "text-slate-700"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    ADMIN: "bg-red-100 text-red-700",
    MANAGER: "bg-purple-100 text-purple-700",
    TRAINER: "bg-green-100 text-green-700",
    SME: "bg-violet-100 text-violet-700",
  }
  const labels: Record<Role, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    TRAINER: "Trainer",
    SME: "SME",
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[role]}`}>
      {labels[role]}
    </span>
  )
}

function UserFormModal({
  title,
  initial,
  offices,
  onClose,
  onSubmit,
}: {
  title: string
  initial: UserFormData
  offices: OfficeOption[]
  onClose: () => void
  onSubmit: (data: UserFormData) => Promise<void>
}) {
  const [form, setForm] = useState<UserFormData>(initial)
  const [pending, startTransition] = useTransition()

  function set(field: keyof UserFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await onSubmit(form)
      onClose()
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
            <label className="mb-1 block text-xs font-medium text-slate-600">Full Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Division</label>
              <select
                value={form.division}
                onChange={(e) => set("division", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
              <select
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TITLES.map((t) => (
                  <option key={t} value={t}>{formatEnum(t)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Office <span className="text-slate-400">(optional)</span>
            </label>
            <SearchableSelect
              value={form.officeId}
              onChange={(v) => set("officeId", v)}
              options={offices.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="— Select Office —"
              clearLabel="— No office —"
            />
          </div>

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

function RoleModal({
  user,
  onClose,
}: {
  user: UserRow
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<Role>>(
    new Set(user.roles.map((r) => r.role))
  )
  const [pending, startTransition] = useTransition()

  function toggle(role: Role) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(role) ? next.delete(role) : next.add(role)
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      await setUserRoles(user.id, Array.from(selected))
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assign Roles</h2>
            <p className="text-xs text-slate-500">{user.name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.has(role)}
                onChange={() => toggle(role)}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{formatEnum(role)}</p>
              </div>
              <RoleBadge role={role} />
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? "Saving…" : "Save Roles"}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignCohortModal({
  user,
  cohorts,
  onClose,
}: {
  user: UserRow
  cohorts: CohortOption[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(user.cohorts.map((c) => c.cohortId))
  )
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      await setUserCohorts(user.id, Array.from(selected))
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assign Cohorts</h2>
            <p className="text-xs text-slate-500">{user.name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {cohorts.length === 0 ? (
          <p className="text-sm text-slate-500">No cohorts available. Create one first.</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {cohorts.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                <span className="text-sm font-medium text-slate-800">{c.name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignManagerModal({
  user,
  allManagers,
  onClose,
}: {
  user: UserRow
  allManagers: ManagerOption[]
  onClose: () => void
}) {
  const [assigned, setAssigned] = useState<ManagerOption[]>(
    user.managers.map((m) => m.manager)
  )
  const [query, setQuery] = useState("")
  const [pending, startTransition] = useTransition()

  const assignedIds = new Set(assigned.map((m) => m.id))
  const suggestions = query.trim()
    ? allManagers.filter(
        (m) => !assignedIds.has(m.id) && (m.name ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : []

  function handleAdd(manager: ManagerOption) {
    setAssigned((prev) => [...prev, manager])
    setQuery("")
    startTransition(() => addUserManager(user.id, manager.id))
  }

  function handleRemove(managerId: string) {
    setAssigned((prev) => prev.filter((m) => m.id !== managerId))
    startTransition(() => removeUserManager(user.id, managerId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assign Managers</h2>
            <p className="text-xs text-slate-500">{user.name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Current managers */}
        {assigned.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {assigned.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                {m.name ?? m.id}
                <button
                  disabled={pending}
                  onClick={() => handleRemove(m.id)}
                  className="rounded-full hover:bg-purple-200 disabled:opacity-50"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manager by name…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="mt-1 max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
            {suggestions.map((m) => (
              <button
                key={m.id}
                disabled={pending}
                onClick={() => handleAdd(m)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {m.name ?? m.id}
              </button>
            ))}
          </div>
        )}

        {query.trim() && suggestions.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">No managers found matching "{query}".</p>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ name, onCancel, onConfirm }: { name: string | null; onCancel: () => void; onConfirm: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete user?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{name ?? "This user"}</span> will be permanently deleted.
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

function ChangePasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [newPw, setNewPw] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [ok, setOk] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return }
    if (newPw !== confirm) { setError("Passwords do not match."); return }
    startTransition(async () => {
      try {
        await adminSetPassword(user.id, newPw)
        setOk(true)
      } catch (err: any) {
        setError(err.message ?? "Failed to update password.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500">{user.name ?? user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {ok ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="text-sm text-slate-700">Password updated successfully.</p>
            <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">New password</label>
              <input type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Confirm password</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function BulkImportModal({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)

  function handleUpload() {
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    startTransition(async () => {
      const res = await bulkCreateUsers(fd)
      setResult(res)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Import Users</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <div className="flex flex-col gap-5">
            {/* Step 1 */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">1</span>
                Download the template
              </p>
              <a
                href="/api/admin/user-template"
                download
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Download size={14} />
                user-import-template.xlsx
              </a>
              <p className="mt-2 text-xs text-slate-400">
                Fill in the <strong>Users</strong> sheet. Refer to the <strong>Valid Values</strong> sheet for accepted Division and Title values.
                Leave <em>Manager Email</em> blank if not applicable.
              </p>
            </div>

            {/* Step 2 */}
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
                {pending ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-xs text-green-700">Created</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-2xl font-bold text-amber-600">{result.skipped.length}</p>
                <p className="text-xs text-amber-700">Skipped</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                <p className="text-xs text-red-700">Errors</p>
              </div>
            </div>

            {/* Skipped */}
            {result.skipped.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  <SkipForward size={12} /> Skipped (email already exists)
                </p>
                <ul className="max-h-28 overflow-y-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  {result.skipped.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">
                  <AlertCircle size={12} /> Errors
                </p>
                <ul className="max-h-36 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i}><span className="font-semibold">Row {e.row}:</span> {e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.created > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700">
                <CheckCircle2 size={15} />
                {result.created} user{result.created !== 1 ? "s" : ""} successfully imported.
              </div>
            )}

            <div className="flex justify-end gap-2">
              {result.errors.length > 0 && (
                <button onClick={() => { setResult(null); setFile(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
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

export function UserManagement({ users, allManagers, cohorts, offices }: { users: UserRow[]; allManagers: ManagerOption[]; cohorts: CohortOption[]; offices: OfficeOption[] }) {
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState<UserRow | null>(null)
  const [assigningRoles, setAssigningRoles] = useState<UserRow | null>(null)
  const [assigningCohorts, setAssigningCohorts] = useState<UserRow | null>(null)
  const [assigningManagers, setAssigningManagers] = useState<UserRow | null>(null)
  const [changingPassword, setChangingPassword] = useState<UserRow | null>(null)
  const [sendingActivation, setSendingActivation] = useState<string | null>(null) // userId
  const [activationSentFor, setActivationSentFor] = useState<string | null>(null) // display name/email
  const [, startActivation] = useTransition()
  const [search, setSearch] = useState("")
  const [divisionFilter, setDivisionFilter] = useState<Division | "">("")
  const [titleFilter, setTitleFilter] = useState<JobTitle | "">("")

  const filtered = users.filter((u) => {
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (divisionFilter && u.division !== divisionFilter) return false
    if (titleFilter && u.title !== titleFilter) return false
    return true
  })

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {users.length} users</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <UserPlus size={16} />
            Add User
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value as Division | "")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Divisions</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value as JobTitle | "")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Titles</option>
          {TITLES.map((t) => <option key={t} value={t}>{formatEnum(t)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Division</th>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Office</th>
              <th className="px-5 py-3">Manager(s)</th>
              <th className="sticky right-0 bg-slate-50 px-5 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  {users.length === 0 ? "No users yet. Add one above." : "No users match your filters."}
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="group hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-900">{u.name ?? "—"}</span>
                    {u.roles.map((r) => <RoleBadge key={r.role} role={r.role} />)}
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-500">{u.email ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">{u.division}</td>
                <td className="px-5 py-3 text-slate-600">{formatEnum(u.title)}</td>
                <td className="px-5 py-3 text-slate-500">{u.office?.name ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">
                  {u.managers.length === 0 ? <span className="text-slate-300 italic">—</span> : u.managers.map((m) => m.manager.name ?? "—").join(", ")}
                </td>
                <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)] group-hover:bg-slate-50">
                  <ActionsMenu items={[
                    { label: "Assign Cohorts", icon: <Users size={14} />, onClick: () => setAssigningCohorts(u) },
                    { label: "Assign Managers", icon: <Users size={14} />, onClick: () => setAssigningManagers(u) },
                    { label: "Assign Roles", icon: <ShieldCheck size={14} />, onClick: () => setAssigningRoles(u) },
                    { label: "Change Password", icon: <KeyRound size={14} />, onClick: () => setChangingPassword(u) },
                    {
                      label: sendingActivation === u.id ? "Sending…" : "Send Activation Email",
                      icon: <Mail size={14} />,
                      onClick: () => {
                        setSendingActivation(u.id)
                        startActivation(async () => {
                          await sendActivationEmail(u.id)
                          setSendingActivation(null)
                          setActivationSentFor(u.name ?? u.email ?? "User")
                          setTimeout(() => setActivationSentFor(null), 5000)
                        })
                      },
                    },
                    { label: "Edit", icon: <Pencil size={14} />, onClick: () => setEditing(u) },
                    { label: "Delete", icon: <Trash2 size={14} />, onClick: () => setDeleting(u), variant: "danger" },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importing && <BulkImportModal onClose={() => setImporting(false)} />}

      {creating && (
        <UserFormModal
          title="Add User"
          initial={empty}
          offices={offices}
          onClose={() => setCreating(false)}
          onSubmit={(data) => createUser(data)}
        />
      )}

      {editing && (
        <UserFormModal
          title="Edit User"
          initial={{
            name: editing.name ?? "",
            email: editing.email ?? "",
            division: editing.division,
            title: editing.title,
            officeId: editing.officeId ?? "",
          }}
          offices={offices}
          onClose={() => setEditing(null)}
          onSubmit={(data) => updateUser(editing.id, data)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteUser(deleting.id)}
        />
      )}

      {assigningRoles && (
        <RoleModal
          user={assigningRoles}
          onClose={() => setAssigningRoles(null)}
        />
      )}

      {assigningCohorts && (
        <AssignCohortModal
          user={assigningCohorts}
          cohorts={cohorts}
          onClose={() => setAssigningCohorts(null)}
        />
      )}

      {assigningManagers && (
        <AssignManagerModal
          user={assigningManagers}
          allManagers={allManagers}
          onClose={() => setAssigningManagers(null)}
        />
      )}

      {changingPassword && (
        <ChangePasswordModal
          user={changingPassword}
          onClose={() => setChangingPassword(null)}
        />
      )}

      {activationSentFor && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-lg">
          <CheckCircle2 size={18} className="shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">Activation email sent</p>
            <p className="text-xs text-green-700">Sent to <span className="font-medium">{activationSentFor}</span></p>
          </div>
          <button onClick={() => setActivationSentFor(null)} className="ml-2 rounded p-0.5 text-green-500 hover:bg-green-100">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
