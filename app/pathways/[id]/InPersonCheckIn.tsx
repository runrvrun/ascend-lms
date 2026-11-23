"use client"

import { useState, useTransition } from "react"
import { QrCode } from "lucide-react"
import { checkIn } from "../../check-in/actions"

// The "type the code" fallback to scanning an in-person session's printed QR code.
export function InPersonCheckIn({ disabled }: { disabled?: boolean }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const result = await checkIn(code)
      if (!result.ok) setError(result.error)
      // On success the page refreshes (the action revalidates it) and shows Completed.
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="mb-2 flex items-center gap-2">
        <QrCode size={16} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Attending in person?</h3>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Scan the QR code handed around at the session with your phone camera, or type the code printed under it.
      </p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={disabled}
          placeholder="XXXX-XXXX"
          aria-label="Check-in code"
          className="w-40 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={disabled || pending || !code.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Checking in…" : "Check in"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
