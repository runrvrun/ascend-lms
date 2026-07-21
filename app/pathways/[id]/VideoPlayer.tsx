"use client"

import { useEffect, useRef, useState } from "react"
import VimeoPlayer from "@vimeo/player"
import { checkPopQuizAnswer } from "../actions"

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

// ─── Pop quiz types ───────────────────────────────────────────────────────────
type PopQuizOption = { id: string; text: string }
type PopQuiz = { id: string; time: number; question: string; options: PopQuizOption[] }

// ─── Component ────────────────────────────────────────────────────────────────
export function VideoPlayer({
  url,
  duration,
  popQuizzes,
  onProgress,
}: {
  url: string
  /** Video duration in seconds — used for SharePoint/iframe progress tracking. */
  duration?: number
  /** YouTube-only: questions that pause playback once reached. */
  popQuizzes?: PopQuiz[]
  /** Called with fraction 0–1 of video timeline covered (accounts for playback speed). */
  onProgress: (fraction: number) => void
}) {
  const type = videoType(url)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const maxFractionRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playerRef = useRef<any>(null)
  const answeredQuizIdsRef = useRef<Set<string>>(new Set())
  const sortedQuizzes = (popQuizzes ?? []).slice().sort((a, b) => a.time - b.time)

  const [activeQuiz, setActiveQuiz] = useState<PopQuiz | null>(null)
  const [wrongOptionId, setWrongOptionId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const activeQuizRef = useRef<PopQuiz | null>(null)
  useEffect(() => { activeQuizRef.current = activeQuiz }, [activeQuiz])

  async function handleAnswer(optionId: string) {
    if (!activeQuiz || checking) return
    setChecking(true)
    const correct = await checkPopQuizAnswer(activeQuiz.id, optionId)
    setChecking(false)
    if (correct) {
      answeredQuizIdsRef.current.add(activeQuiz.id)
      setActiveQuiz(null)
      setWrongOptionId(null)
      playerRef.current?.playVideo?.()
    } else {
      setWrongOptionId(optionId)
    }
  }

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
            playerRef.current = player
            pollRef.current = setInterval(() => {
              if (!player) return
              const state = player.getPlayerState?.()
              // 1 = playing

              // A pop quiz is on screen — keep the player paused even if the
              // learner hits play on the native YouTube controls.
              if (activeQuizRef.current) {
                if (state === 1) player.pauseVideo?.()
                return
              }

              if (state === 1) {
                const duration = player.getDuration?.() ?? 0
                const current = player.getCurrentTime?.() ?? 0
                if (duration > 0) report(current / duration)

                const dueQuiz = sortedQuizzes.find(
                  (q) => !answeredQuizIdsRef.current.has(q.id) && current >= q.time
                )
                if (dueQuiz) {
                  player.pauseVideo?.()
                  setWrongOptionId(null)
                  setActiveQuiz(dueQuiz)
                }
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
      playerRef.current = null
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
        {activeQuiz && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">Pop Quiz</p>
              <p className="mb-4 text-sm font-medium text-slate-900">{activeQuiz.question}</p>
              <div className="flex flex-col gap-2">
                {activeQuiz.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={checking}
                    onClick={() => handleAnswer(o.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                      wrongOptionId === o.id
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    {o.text}
                  </button>
                ))}
              </div>
              {wrongOptionId && <p className="mt-3 text-xs text-red-500">Not quite — try again.</p>}
              <p className="mt-3 text-xs text-slate-400">Answer correctly to continue watching.</p>
            </div>
          </div>
        )}
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
