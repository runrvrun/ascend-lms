"use client"

import { useState, useTransition } from "react"
import { AlertTriangle } from "lucide-react"
import { getCoursePathwayNames, toggleCourseStatus } from "../actions"

// Publish/unpublish logic shared by the course list toggle and the course page toggle.
// Unpublishing a course that is in any pathway first asks to remove it from them all.
export function useCourseStatusToggle(id: string, status: "DRAFT" | "PUBLISHED") {
  const [pending, startTransition] = useTransition()
  const [pathwayNames, setPathwayNames] = useState<string[] | null>(null)
  const [error, setError] = useState("")
  const isOn = status === "PUBLISHED"

  function toggle() {
    setError("")
    startTransition(async () => {
      if (isOn) {
        const names = await getCoursePathwayNames(id)
        if (names.length > 0) return setPathwayNames(names)
      }
      const result = await toggleCourseStatus(id, isOn ? "DRAFT" : "PUBLISHED")
      if (result.error) setError(result.error)
    })
  }

  function confirmUnpublish() {
    startTransition(async () => {
      const result = await toggleCourseStatus(id, "DRAFT", { removeFromPathways: true })
      if (result.error) setError(result.error)
      else setPathwayNames(null)
    })
  }

  const dialog =
    pathwayNames || error ? (
      <UnpublishDialog
        pathwayNames={pathwayNames ?? []}
        error={error}
        pending={pending}
        onCancel={() => {
          setPathwayNames(null)
          setError("")
        }}
        onConfirm={pathwayNames ? confirmUnpublish : null}
      />
    ) : null

  return { isOn, pending, toggle, dialog }
}

function UnpublishDialog({
  pathwayNames,
  error,
  pending,
  onCancel,
  onConfirm,
}: {
  pathwayNames: string[]
  error: string
  pending: boolean
  onCancel: () => void
  onConfirm: (() => void) | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-xl">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900">{onConfirm ? "Unpublish course?" : "Can't change status"}</h2>
        </div>
        {onConfirm && (
          <>
            <p className="mt-2 text-sm text-slate-500">
              Unpublishing this course will remove it from {pathwayNames.length === 1 ? "this pathway" : `these ${pathwayNames.length} pathways`}:
            </p>
            <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 text-sm font-medium text-slate-700">
              {pathwayNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              Learners will no longer see it in those pathways. Publishing it again does not add it back.
            </p>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {onConfirm ? "Cancel" : "Close"}
          </button>
          {onConfirm && (
            <button
              disabled={pending}
              onClick={onConfirm}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Removing…" : "Yes, remove and unpublish"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function CourseStatusToggle({ id, status }: { id: string; status: "DRAFT" | "PUBLISHED" }) {
  const { isOn, pending, toggle, dialog } = useCourseStatusToggle(id, status)
  return (
    <>
      <button
        disabled={pending}
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm disabled:opacity-50 hover:bg-slate-50"
        title={isOn ? "Published — click to set Draft" : "Draft — click to Publish"}
      >
        <div className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${isOn ? "bg-green-500" : "bg-slate-300"}`}>
          <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${isOn ? "translate-x-[14px]" : "translate-x-0.5"}`} />
        </div>
        <span className={isOn ? "text-green-700" : "text-slate-400"}>
          {pending ? "…" : isOn ? "Published" : "Draft"}
        </span>
      </button>
      {dialog}
    </>
  )
}
