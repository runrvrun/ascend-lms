"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, GripVertical } from "lucide-react"
import { ContentType } from "@prisma/client"
import { createContent, updateContent, deleteContent, ContentFormData } from "../actions"

type ContentRow = {
  id: string
  title: string
  type: ContentType
  value: string
  order: number
  duration: number | null
}

const TYPE_LABELS: Record<ContentType, string> = {
  TEXT: "Text",
  LINK: "Link",
  VIDEO: "Video",
}

const TYPE_STYLES: Record<ContentType, string> = {
  TEXT: "bg-slate-100 text-slate-600",
  LINK: "bg-blue-100 text-blue-700",
  VIDEO: "bg-purple-100 text-purple-700",
}

function ContentFormModal({
  title,
  initial,
  nextOrder,
  courseId,
  onClose,
  onSubmit,
}: {
  title: string
  initial: ContentFormData
  nextOrder: number
  courseId: string
  onClose: () => void
  onSubmit: (data: ContentFormData) => Promise<void>
}) {
  const [form, setForm] = useState<ContentFormData>(initial)
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
        setError("Order number already in use. Choose a different one.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Title <span className="text-red-500">*</span></label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Introduction"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Order <span className="text-red-500">*</span></label>
              <input
                required
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {(Object.keys(TYPE_LABELS) as ContentType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                    form.type === t
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {form.type === "TEXT" ? "Content" : "URL"} <span className="text-red-500">*</span>
            </label>
            {form.type === "TEXT" ? (
              <textarea
                required
                rows={5}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="Write the text content here…"
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <>
                <input
                  required
                  type="url"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder={form.type === "VIDEO"
                    ? "https://ycphd.sharepoint.com/sites/2_Academy/_layouts/15/embed.aspx?UniqueId=92da88a0-c7fe-4eba-899a-0f18944cdd54"
                    : "https://…"}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {form.type === "VIDEO" && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    For SharePoint/Stream recordings: open the video in Stream → click <span className="font-medium text-slate-700">Share</span> → <span className="font-medium text-slate-700">Embed</span> → copy the <span className="font-mono font-medium text-slate-700">src</span> URL from the iframe code up to the uniqueId code.
                    <br/>Example: https://ycphd.sharepoint.com/sites/2_Academy/_layouts/15/embed.aspx?UniqueId=92da88a0-c7fe-4eba-899a-0f18944cdd54
                  </p>
                )}
                {form.type === "VIDEO" && (form.value.includes("sharepoint.com") || form.value.includes("microsoftstream.com")) && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Video length <span className="text-slate-400">(used to track watch progress of SharePoint videos)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={form.duration != null ? Math.floor(form.duration / 3600) : ""}
                        onChange={(e) => {
                          const h = parseInt(e.target.value) || 0
                          const rest = form.duration != null ? form.duration % 3600 : 0
                          const total = h * 3600 + rest
                          setForm((f) => ({ ...f, duration: total > 0 ? total : null }))
                        }}
                        placeholder="0"
                        className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-500">h</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={form.duration != null ? Math.floor((form.duration % 3600) / 60) : ""}
                        onChange={(e) => {
                          const m = Math.min(59, parseInt(e.target.value) || 0)
                          const h = form.duration != null ? Math.floor(form.duration / 3600) : 0
                          const s = form.duration != null ? form.duration % 60 : 0
                          const total = h * 3600 + m * 60 + s
                          setForm((f) => ({ ...f, duration: total > 0 ? total : null }))
                        }}
                        placeholder="0"
                        className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-500">m</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={form.duration != null ? form.duration % 60 : ""}
                        onChange={(e) => {
                          const s = Math.min(59, parseInt(e.target.value) || 0)
                          const h = form.duration != null ? Math.floor(form.duration / 3600) : 0
                          const m = form.duration != null ? Math.floor((form.duration % 3600) / 60) : 0
                          const total = h * 3600 + m * 60 + s
                          setForm((f) => ({ ...f, duration: total > 0 ? total : null }))
                        }}
                        placeholder="0"
                        className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete content?</h2>
        <p className="mt-2 text-sm text-slate-500"><span className="font-medium text-slate-700">{title}</span> will be removed from this course.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
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

export function ContentManagement({ courseId, contents }: { courseId: string; contents: ContentRow[] }) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ContentRow | null>(null)
  const [deleting, setDeleting] = useState<ContentRow | null>(null)

  const nextOrder = contents.length > 0 ? Math.max(...contents.map((c) => c.order)) + 1 : 1

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Contents</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          Add Content
        </button>
      </div>

      {contents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
          No contents yet. Add the first one above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contents.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400">
                    <div className="flex items-center gap-1">
                      <GripVertical size={13} className="text-slate-300" />
                      {c.order}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.title}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[c.type]}`}>
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-500">
                    {c.type === "TEXT" ? (
                      <span className="truncate italic text-slate-400">{c.value.slice(0, 60)}{c.value.length > 60 ? "…" : ""}</span>
                    ) : (
                      <a href={c.value} target="_blank" rel="noreferrer" className="truncate text-blue-500 hover:underline">{c.value}</a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleting(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <ContentFormModal
          title="Add Content"
          initial={{ title: "", type: "TEXT", value: "", order: nextOrder, duration: null }}
          nextOrder={nextOrder}
          courseId={courseId}
          onClose={() => setCreating(false)}
          onSubmit={(d) => createContent(courseId, d)}
        />
      )}
      {editing && (
        <ContentFormModal
          title="Edit Content"
          initial={{ title: editing.title, type: editing.type, value: editing.value, order: editing.order, duration: editing.duration }}
          nextOrder={nextOrder}
          courseId={courseId}
          onClose={() => setEditing(null)}
          onSubmit={(d) => updateContent(editing.id, courseId, d)}
        />
      )}
      {deleting && (
        <DeleteConfirm
          title={deleting.title}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteContent(deleting.id, courseId)}
        />
      )}
    </>
  )
}
