"use client"

import type { OutlineItem } from "./courseOutline"

export function PositionSelect({
  outline,
  value,
  onChange,
}: {
  outline: OutlineItem[]
  value: number
  onChange: (afterOrder: number) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Position</label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={0}>At the beginning</option>
        {outline.map((item) => (
          <option key={`${item.kind}-${item.id}`} value={item.order}>
            After: {item.label}
          </option>
        ))}
      </select>
    </div>
  )
}
