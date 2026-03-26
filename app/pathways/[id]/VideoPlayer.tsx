"use client"

import { useEffect, useRef } from "react"
import VimeoPlayer from "@vimeo/player"

// ─── YouTube IFrame API loader (shared singleton) ────────────────────────────
let ytScriptLoaded = false
let ytReady = false
const ytReadyCallbacks: (() => void)[] = []

function onYouTubeReady(): Promise<void> {
  return new Promise((resolve) => {
    if (ytReady) { resolve(); return }
    ytReadyCallbacks.push(resolve)
    if (!ytScriptLoaded) {
      ytScriptLoaded = true
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(script)
      ;(window as any).onYouTubeIframeAPIReady = () => {
        ytReady = true
        ytReadyCallbacks.forEach((cb) => cb())
        ytReadyCallbacks.length = 0
      }
    }
  })
}

// ─── URL helpers ──────────────────────────────────────────────────────────────
const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const VIMEO_REGEX = /vimeo\.com\/(\d+)/

function videoType(url: string): "youtube" | "vimeo" | "native" | "iframe" {
  if (YT_REGEX.test(url)) return "youtube"
  if (VIMEO_REGEX.test(url)) return "vimeo"
  if (url.includes("sharepoint.com") || url.includes("microsoftstream.com")) return "iframe"
  return "native"
}

function youtubeId(url: string) { return url.match(YT_REGEX)?.[1] ?? "" }
function vimeoId(url: string) { return url.match(VIMEO_REGEX)?.[1] ?? "" }

const POLL_INTERVAL_MS = 1000

// ─── Component ────────────────────────────────────────────────────────────────
export function VideoPlayer({
  url,
  duration,
  onProgress,
}: {
  url: string
  /** Video duration in seconds — used for SharePoint/iframe progress tracking. */
  duration?: number
  /** Called with fraction 0–1 of video timeline covered (accounts for playback speed). */
  onProgress: (fraction: number) => void
}) {
  const type = videoType(url)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const maxFractionRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clamp and emit only increases
  function report(fraction: number) {
    const clamped = Math.min(1, Math.max(0, fraction))
    if (clamped > maxFractionRef.current) {
      maxFractionRef.current = clamped
      onProgress(clamped)
    }
  }

  // ── YouTube ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (type !== "youtube") return
    let player: any
    let cancelled = false

    onYouTubeReady().then(() => {
      if (cancelled || !iframeRef.current) return
      const YT = (window as any).YT
      player = new YT.Player(iframeRef.current, {
        events: {
          onReady() {
            pollRef.current = setInterval(() => {
              if (!player) return
              const state = player.getPlayerState?.()
              // 1 = playing
              if (state === 1) {
                const duration = player.getDuration?.() ?? 0
                const current = player.getCurrentTime?.() ?? 0
                if (duration > 0) report(current / duration)
              }
            }, POLL_INTERVAL_MS)
          },
        },
      })
    })

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
      try { player?.destroy?.() } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // ── Vimeo ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (type !== "vimeo" || !iframeRef.current) return
    const player = new VimeoPlayer(iframeRef.current)
    player.on("timeupdate", (data) => {
      // data.percent is 0–1, advances at playback rate speed
      report(data.percent)
    })
    return () => { player.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // ── Native video ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (type !== "native" || !videoRef.current) return
    const video = videoRef.current
    function handleTimeUpdate() {
      if (video.duration > 0) report(video.currentTime / video.duration)
    }
    video.addEventListener("timeupdate", handleTimeUpdate)
    return () => video.removeEventListener("timeupdate", handleTimeUpdate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // ── iframe (SharePoint/Stream) — timer-based progress when duration provided ─
  useEffect(() => {
    if (type !== "iframe") return
    if (!duration || duration <= 0) {
      onProgress(1)
      return
    }
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += POLL_INTERVAL_MS / 1000
      report(elapsed / duration)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, duration])

  // ─── Render ───────────────────────────────────────────────────────────────
  const aspectBox = "relative w-full rounded-xl overflow-hidden"
  const aspectStyle = { paddingBottom: "56.25%" }
  const absoluteFill = "absolute inset-0 h-full w-full"

  if (type === "youtube") {
    return (
      <div className={aspectBox} style={aspectStyle}>
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${youtubeId(url)}?enablejsapi=1`}
          className={absoluteFill}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        />
      </div>
    )
  }

  if (type === "vimeo") {
    return (
      <div className={aspectBox} style={aspectStyle}>
        <iframe
          ref={iframeRef}
          src={`https://player.vimeo.com/video/${vimeoId(url)}`}
          className={absoluteFill}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
        />
      </div>
    )
  }

  if (type === "iframe") {
    return (
      <div className={aspectBox} style={aspectStyle}>
        <iframe
          src={url}
          className={absoluteFill}
          allowFullScreen
        />
      </div>
    )
  }

  // Native
  return (
    <video
      ref={videoRef}
      src={url}
      controls
      className="w-full rounded-xl bg-black"
    />
  )
}
