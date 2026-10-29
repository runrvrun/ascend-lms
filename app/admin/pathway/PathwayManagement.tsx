"use client"

import { useState, useTransition, useRef } from "react"
import { Plus, Pencil, Trash2, X, BookOpen, GraduationCap, Search, Users, Copy, Eye, Star } from "lucide-react"
import { createPathway, updatePathway, deletePathway, togglePathwayStatus, duplicatePathway, setPathwayFeatured, PathwayFormData } from "./actions"
import { MAX_FEATURED_PATHWAYS } from "../../lib/featuredPathways"
import { ActionsMenu } from "../../components/ActionsMenu"
import { SearchableMultiSelect } from "../../components/SearchableSelect"
import type { PathwayVisibility } from "@prisma/client"

type PathwayRow = {
  id: string
  name: string
  description: string | null
  visibility: PathwayVisibility
  tags: string[]
  status: "DRAFT" | "PUBLISHED"
  featuredAt: Date | null
  _count: { courses: number }
  pathwayEnrollments: { id: string }[]
  cohortPathways: { cohort: { _count: { users: number } } }[]
  owners: { user: { id: string; name: string | null } }[]
  createdAt: Date
}

type OwnerOption = { id: string; name: string | null; email: string | null }

const VISIBILITY_OPTIONS: { value: PathwayVisibility; label: string; description: string }[] = [
  { value: "PUBLIC_FREE", label: "Public — free enroll", description: "Visible to everyone. Users can enroll immediately, no approval needed." },
  { value: "PUBLIC_APPROVAL", label: "Public — needs approval", description: "Visible to everyone. Users must request enrollment and get approval from their manager." },
  { value: "HIDDEN", label: "Hidden — assigned only", description: "Not shown on the Pathways page. Only enrolled by an admin or manager assigning it directly." },
]

const VISIBILITY_BADGE: Record<PathwayVisibility, { label: string; className: string }> = {
  PUBLIC_FREE: { label: "Free enroll", className: "bg-green-100 text-green-700" },
  PUBLIC_APPROVAL: { label: "Approval required", className: "bg-amber-100 text-amber-700" },
  HIDDEN: { label: "Hidden", className: "bg-slate-200 text-slate-600" },
}

const empty: PathwayFormData = { name: "", description: "", visibility: "PUBLIC_FREE", tags: [] }

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Tags</label>
      <div
        className="flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 cursor-text focus-within:ring-2 focus-within:ring-blue-500"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="hover:text-blue-900">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? "Type and press Enter or comma…" : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">Press Enter or comma to add a tag</p>
    </div>
  )
}

function StatusToggle({ id, status }: { id: string; status: "DRAFT" | "PUBLISHED" }) {
  const [pending, startTransition] = useTransition()
  const isOn = status === "PUBLISHED"
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => togglePathwayStatus(id, isOn ? "DRAFT" : "PUBLISHED"))}
      className="flex items-center gap-2 disabled:opacity-50"
      title={isOn ? "Published — click to set Draft" : "Draft — click to Publish"}
    >
      <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${isOn ? "bg-green-500" : "bg-slate-300"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isOn ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </div>
      <span className={`text-xs font-medium ${isOn ? "text-green-700" : "text-slate-400"}`}>
        {pending ? "…" : isOn ? "Published" : "Draft"}
      </span>
    </button>
  )
}

function FeaturedToggle({ pathway, featuredCount }: { pathway: PathwayRow; featuredCount: number }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const isOn = !!pathway.featuredAt
  const eligible = pathway.status === "PUBLISHED" && pathway.visibility !== "HIDDEN"
  const full = !isOn && featuredCount >= MAX_FEATURED_PATHWAYS
  const disabled = pending || (!isOn && (!eligible || full))
  const title = isOn
    ? "Featured — click to unfeature"
    : !eligible
    ? "Only published, non-hidden pathways can be featured"
    : full
    ? `Already ${MAX_FEATURED_PATHWAYS} featured pathways — unfeature one first`
    : "Feature this pathway on the Pathways page"

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        disabled={disabled}
        title={title}
        onClick={() => {
          setError("")
          startTransition(async () => {
            const result = await setPathwayFeatured(pathway.id, !isOn)
            if (result.error) setError(result.error)
          })
        }}
        className={`rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isOn ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-100 hover:text-amber-400"
        }`}
      >
        <Star size={16} fill={isOn ? "currentColor" : "none"} />
      </button>
      {error && <p className="max-w-[10rem] text-[11px] leading-tight text-red-500">{error}</p>}
    </div>
  )
}

function PathwayFormModal({
  title,
  initial,
  ownerOptions,
  onClose,
  onSubmit,
}: {
  title: string
  initial: PathwayFormData
  // Only passed for admins; owners can't change who owns a pathway
  ownerOptions?: OwnerOption[]
  onClose: () => void
  onSubmit: (data: PathwayFormData) => Promise<void>
}) {
  const [form, setForm] = useState<PathwayFormData>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        await onSubmit(form)
        onClose()
      } catch {
        setError("A pathway with this name already exists.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl md:max-w-3xl">
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Two columns from md up; the fields scroll inside the modal so Save stays visible */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-4 md:grid-cols-2 md:gap-6">
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Analyst Track"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this pathway…"
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <TagInput tags={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />

              {ownerOptions && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Owners</label>
                  <SearchableMultiSelect
                    value={form.ownerIds ?? []}
                    onChange={(ownerIds) => setForm((f) => ({ ...f, ownerIds }))}
                    options={ownerOptions.map((u) => ({ value: u.id, label: u.name ? `${u.name} (${u.email ?? "no email"})` : u.email ?? u.id }))}
                    placeholder="— No owners —"
                  />
                  <p className="mt-1 text-xs text-slate-400">Owners can manage this pathway&apos;s courses, enrollments and settings under Admin &gt; Pathways.</p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Visibility</label>
              <div className="flex flex-col gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50/50"
                  >
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.visibility === opt.value}
                      onChange={() => setForm((f) => ({ ...f, visibility: opt.value }))}
                      className="mt-0.5 h-4 w-4 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 px-6 py-4">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
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
        <h2 className="text-lg font-semibold text-slate-900">Delete pathway?</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{name}</span> will be archived and hidden from users.
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

export function PathwayManagement({
  pathways,
  isAdmin,
  ownerOptions,
}: {
  pathways: PathwayRow[]
  isAdmin: boolean
  ownerOptions: OwnerOption[]
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PathwayRow | null>(null)
  const [deleting, setDeleting] = useState<PathwayRow | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [, startDupTransition] = useTransition()
  const [search, setSearch] = useState("")

  function handleDuplicate(pathwayId: string) {
    setDuplicating(pathwayId)
    startDupTransition(async () => {
      await duplicatePathway(pathwayId)
      setDuplicating(null)
    })
  }

  const filtered = search
    ? pathways.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : pathways
  const featuredCount = pathways.filter((p) => p.featuredAt).length

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pathways</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? <>{filtered.length} of {pathways.length} pathways · {featuredCount}/{MAX_FEATURED_PATHWAYS} featured</>
              : <>{filtered.length} of {pathways.length} pathways you own</>}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Pathway
          </button>
        )}
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
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Tags</th>
              <th className="px-5 py-3">Owners</th>
              {isAdmin && <th className="px-5 py-3 text-center">Featured</th>}
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Visibility</th>
              <th className="px-5 py-3 text-center">Courses</th>
              <th className="px-5 py-3 text-center">Enrolled Users</th>
              <th className="sticky right-0 bg-slate-50 px-5 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} className="px-5 py-10 text-center text-slate-400">
                  {pathways.length === 0
                    ? isAdmin ? "No pathways yet. Add one above." : "You don't own any pathways."
                    : "No pathways match your search."}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="group hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="shrink-0 text-blue-400" />
                    <span className="font-medium text-slate-900">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 max-w-xs text-slate-500 truncate">
                  {p.description ?? <span className="italic text-slate-300">No description</span>}
                </td>
                <td className="px-5 py-3">
                  {p.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="italic text-slate-300 text-xs">No tags</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-slate-600">
                  {p.owners.length > 0
                    ? p.owners.map((o) => o.user.name ?? "—").join(", ")
                    : <span className="italic text-slate-300">No owners</span>}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-center">
                    <FeaturedToggle pathway={p} featuredCount={featuredCount} />
                  </td>
                )}
                <td className="px-5 py-3 text-center">
                  <StatusToggle id={p.id} status={p.status} />
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VISIBILITY_BADGE[p.visibility].className}`}>
                    {VISIBILITY_BADGE[p.visibility].label}
                  </span>
                </td>
                <td className="px-5 py-3 text-center text-slate-600">{p._count.courses}</td>
                <td className="px-5 py-3 text-center">
                  {(() => {
                    const individual = p.pathwayEnrollments.length
                    const viaCohort = p.cohortPathways.reduce((s, cp) => s + cp.cohort._count.users, 0)
                    const total = individual + viaCohort
                    return (
                      <a
                        href={`/admin/pathway/${p.id}/enrollments`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        {total}
                      </a>
                    )
                  })()}
                </td>
                <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)] group-hover:bg-slate-50">
                  <ActionsMenu items={[
                    { label: "Manage Courses", icon: <GraduationCap size={14} />, href: `/admin/pathway/${p.id}` },
                    { label: "Manage Enrollments", icon: <Users size={14} />, href: `/admin/pathway/${p.id}/enrollments` },
                    { label: "Preview", icon: <Eye size={14} />, href: `/pathways/${p.id}?preview=1` },
                    { label: "Edit", icon: <Pencil size={14} />, onClick: () => setEditing(p) },
                    ...(isAdmin
                      ? [
                          { label: duplicating === p.id ? "Duplicating…" : "Duplicate", icon: <Copy size={14} />, onClick: () => handleDuplicate(p.id) },
                          { label: "Delete", icon: <Trash2 size={14} />, onClick: () => setDeleting(p), variant: "danger" as const },
                        ]
                      : []),
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <PathwayFormModal
          title="Add Pathway"
          initial={empty}
          onClose={() => setCreating(false)}
          ownerOptions={ownerOptions}
          onSubmit={(data) => createPathway(data)}
        />
      )}

      {editing && (
        <PathwayFormModal
          title="Edit Pathway"
          initial={{
            name: editing.name,
            description: editing.description ?? "",
            visibility: editing.visibility,
            tags: editing.tags,
            ownerIds: editing.owners.map((o) => o.user.id),
          }}
          ownerOptions={isAdmin ? ownerOptions : undefined}
          onClose={() => setEditing(null)}
          onSubmit={(data) => updatePathway(editing.id, data)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deletePathway(deleting.id)}
        />
      )}
    </>
  )
}
