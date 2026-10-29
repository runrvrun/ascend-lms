"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { uploadContentImage } from "../actions"
import { compressImage, IMAGE_ACCEPT } from "../../../lib/compressImage"
import { contentImageUrl } from "../../../lib/contentImageUrl"

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Picks an image, compresses it in the browser, uploads it, and reports the stored key.
export function ContentImageUpload({
  courseId,
  imageKey,
  onChange,
  onBusyChange,
}: {
  courseId: string
  imageKey: string | null
  onChange: (imageKey: string | null) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<"idle" | "compressing" | "uploading">("idle")
  const [error, setError] = useState("")
  const [savings, setSavings] = useState("")

  async function handleFile(file: File) {
    setError("")
    setSavings("")
    onBusyChange?.(true)
    try {
      setStatus("compressing")
      const { blob, width, height } = await compressImage(file)
      setStatus("uploading")
      const formData = new FormData()
      formData.append("image", blob, file.name)
      const result = await uploadContentImage(courseId, formData)
      if (result.error || !result.key) {
        setError(result.error ?? "Upload failed. Please try again.")
        return
      }
      onChange(result.key)
      setSavings(
        blob === file
          ? `${width}×${height}, ${formatBytes(file.size)} (already optimised)`
          : `${width}×${height}, ${formatBytes(file.size)} → ${formatBytes(blob.size)}`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process this image.")
    } finally {
      setStatus("idle")
      onBusyChange?.(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const busy = status !== "idle"

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {imageKey ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={contentImageUrl(imageKey)} alt="" className="h-20 w-32 shrink-0 rounded-lg border border-slate-200 object-cover" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? (status === "compressing" ? "Compressing…" : "Uploading…") : "Replace"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onChange(null)
                  setSavings("")
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
            {savings && <p className="text-xs text-slate-400">{savings}</p>}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {status === "compressing" ? "Compressing…" : status === "uploading" ? "Uploading…" : "Choose an image from your computer"}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1 text-xs text-slate-400">JPEG, PNG, WebP or GIF. Resized to 1600 px wide and compressed before upload.</p>
    </div>
  )
}
