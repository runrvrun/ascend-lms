"use client"

import { useTransition } from "react"

// Shared delete confirmation for course items (lessons, tests, questions, pop quizzes, assignments).
export function ConfirmDelete({
  heading,
  message,
  onCancel,
  onConfirm,
}: {
  heading: string
  message: React.ReactNode
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm()
                onCancel()
              })
            }
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}
