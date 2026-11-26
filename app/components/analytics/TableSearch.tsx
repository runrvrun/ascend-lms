"use client"

// Live name search for the server-rendered Pathways / Courses / Cohorts tables: hides the
// rows (marked with data-search) whose name doesn't match, without a round trip.

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

export function TableSearch({ targetId, placeholder }: { targetId: string; placeholder: string }) {
  const [q, setQ] = useState("")
  const [shown, setShown] = useState<number | null>(null)
  const total = useRef(0)

  useEffect(() => {
    const rows = document.querySelectorAll<HTMLTableRowElement>(`#${targetId} tr[data-search]`)
    total.current = rows.length
    const needle = q.trim().toLowerCase()
    let n = 0
    rows.forEach((tr) => {
      const match = !needle || (tr.dataset.search ?? "").includes(needle)
      tr.hidden = !match
      if (match) n++
    })
    const empty = document.querySelector<HTMLElement>(`#${targetId} [data-search-empty]`)
    if (empty) empty.hidden = n > 0
    setShown(needle ? n : null)
  }, [q, targetId])

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-7 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X size={13} />
          </button>
        )}
      </div>
      {shown !== null && <span className="text-xs text-slate-400">{shown} of {total.current}</span>}
    </div>
  )
}
