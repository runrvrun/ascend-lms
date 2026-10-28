"use client"

import { useEffect, useState, useTransition } from "react"
import { X, CheckCircle2 } from "lucide-react"
import { SearchableSelect } from "../components/SearchableSelect"
import { getShareRecipients, sharePathway } from "./actions"

export function SharePathwayModal({
  pathway,
  onClose,
}: {
  pathway: { id: string; name: string }
  onClose: () => void
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[] | null>(null)
  const [recipientId, setRecipientId] = useState("")
  const [error, setError] = useState("")
  const [sharedWith, setSharedWith] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    getShareRecipients()
      .then(setOptions)
      .catch(() => setError("Failed to load users."))
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientId) return
    setError("")
    startTransition(async () => {
      try {
        const result = await sharePathway(pathway.id, recipientId)
        if (result.error) { setError(result.error); return }
        setSharedWith(options?.find((o) => o.value === recipientId)?.label ?? "the user")
        setRecipientId("")
      } catch {
        setError("Failed to share pathway.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Share Pathway</h2>
            <p className="text-sm text-slate-500">{pathway.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Share with</label>
            {options ? (
              <SearchableSelect
                options={options}
                value={recipientId}
                onChange={(v) => { setRecipientId(v); setSharedWith(null) }}
                placeholder="Search by name or email…"
              />
            ) : (
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400">Loading users…</div>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              They&apos;ll get an email and an in-app notification with a link to preview this pathway. They won&apos;t be enrolled.
            </p>
          </div>

          {sharedWith && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-green-600">
              <CheckCircle2 size={13} />
              Shared with {sharedWith}.
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              {sharedWith ? "Done" : "Cancel"}
            </button>
            <button type="submit" disabled={pending || !recipientId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Sharing…" : "Share"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
