"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, X, Check } from "lucide-react"

type Option = { value: string; label: string }

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Select —",
  clearLabel,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  clearLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleOpen() {
    setOpen(true)
    setQuery("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && clearLabel !== undefined && (
            <span
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleSelect("")}
              onClick={(e) => { e.stopPropagation(); handleSelect("") }}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-[9999] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {clearLabel !== undefined && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect("")}
                  className="w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 italic"
                >
                  {clearLabel}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-slate-400">No matches</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(o.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${o.value === value ? "font-semibold text-blue-600" : "text-slate-700"}`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "— Select —",
}: {
  options: Option[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.filter((o) => value.includes(o.value))
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleOpen() {
    setOpen(true)
    setQuery("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleToggle(val: string) {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val))
    } else {
      onChange([...value, val])
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={handleOpen}
        className="flex min-h-[38px] w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
      >
        {selected.length === 0 && (
          <span className="text-slate-400 text-sm">{placeholder}</span>
        )}
        {selected.map((o) => (
          <span key={o.value} className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {o.label}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== o.value)) }}
              className="rounded-full hover:bg-blue-200 p-0.5"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <ChevronDown size={14} className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute z-[9999] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-slate-400">No matches</li>
            ) : (
              filtered.map((o) => {
                const isSelected = value.includes(o.value)
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => handleToggle(o.value)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 ${isSelected ? "font-semibold text-blue-600" : "text-slate-700"}`}
                    >
                      {o.label}
                      {isSelected && <Check size={14} className="shrink-0 text-blue-600" />}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
