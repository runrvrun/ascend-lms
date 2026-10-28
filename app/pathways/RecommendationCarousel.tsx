"use client"

import { Children, useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const AUTO_SCROLL_MS = 5000

// Horizontal scroll-snap track: one card per view on phones, two from sm up.
// Swiping is native scrolling; auto-advances one card every 5s (wrapping to the
// start) unless hovered, focused, touched, or the user prefers reduced motion.
export function RecommendationCarousel({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children)
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [overflowing, setOverflowing] = useState(false)
  // Number of distinct scroll positions (items minus cards per view, plus one)
  const [positions, setPositions] = useState(items.length)
  const [paused, setPaused] = useState(false)

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setOverflowing(track.scrollWidth > track.clientWidth + 1)
    const slides = Array.from(track.children) as HTMLElement[]
    if (slides.length === 0) return
    const perView = Math.max(1, Math.round(track.clientWidth / slides[0].offsetWidth))
    setPositions(Math.max(1, slides.length - perView + 1))
    let nearest = 0
    slides.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - track.scrollLeft) < Math.abs(slides[nearest].offsetLeft - track.scrollLeft)) nearest = i
    })
    setActive(nearest)
  }, [])

  const scrollToIndex = useCallback((i: number) => {
    const track = trackRef.current
    const slide = track?.children[i] as HTMLElement | undefined
    if (track && slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" })
  }, [])

  const atEnd = () => {
    const track = trackRef.current
    return !track || track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
  }

  const next = useCallback(() => {
    if (atEnd()) scrollToIndex(0)
    else scrollToIndex(active + 1)
  }, [active, scrollToIndex])

  const prev = () => {
    if (active === 0) scrollToIndex(positions - 1)
    else scrollToIndex(active - 1)
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    if (paused || !overflowing) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(next, AUTO_SCROLL_MS)
    return () => clearInterval(timer)
  }, [paused, overflowing, next])

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
      }}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        onScroll={measure}
        className="relative -my-2 flex snap-x snap-mandatory gap-4 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex w-full shrink-0 snap-start flex-col sm:w-[calc(50%-0.5rem)] [&>div:first-child]:flex-1"
          >
            {item}
          </div>
        ))}
      </div>

      {overflowing && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous recommendation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: positions }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Go to recommendation ${i + 1}`}
                aria-current={i === active}
                className={`h-2 rounded-full transition-all ${i === active ? "w-5 bg-amber-500" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="Next recommendation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
