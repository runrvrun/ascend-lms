"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"

export type ActionsMenuItem = {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: "danger"
}

const MENU_WIDTH = 160
const MENU_MARGIN = 4

export function ActionsMenu({ items }: { items: ActionsMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    function reposition() {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      const openUpward = spaceBelow < 240 && r.top > spaceBelow
      setMenuStyle({
        position: "fixed",
        left: Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
        ...(openUpward
          ? { bottom: window.innerHeight - r.top + MENU_MARGIN }
          : { top: r.bottom + MENU_MARGIN }),
      })
    }
    reposition()
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)
    return () => {
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        Actions
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ width: MENU_WIDTH, ...menuStyle }}
          className="z-[9999] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item, i) =>
            item.href ? (
              <a
                key={i}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                {item.icon}
                {item.label}
              </a>
            ) : (
              <button
                key={i}
                onClick={() => { item.onClick?.(); setOpen(false) }}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 ${item.variant === "danger" ? "text-red-600" : "text-slate-700"}`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
