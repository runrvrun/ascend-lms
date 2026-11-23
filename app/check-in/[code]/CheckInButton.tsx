"use client"

import { useState, useTransition } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { checkIn, type CheckInResult } from "../actions"

export function CheckInButton({ code }: { code: string }) {
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [pending, startTransition] = useTransition()

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-3">
        <CheckCircle2 size={36} className="text-green-500" />
        <p className="text-sm font-semibold text-green-700">{result.already ? "You were already checked in." : "You're checked in. Thanks for attending!"}</p>
        {result.pathwayId && (
          <a href={`/pathways/${result.pathwayId}`} className="text-sm font-medium text-blue-600 hover:underline">
            Continue your pathway
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => startTransition(async () => setResult(await checkIn(code)))}
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Checking in…" : "Check in to this session"}
      </button>
      {result && !result.ok && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {result.error}
        </div>
      )}
    </div>
  )
}
