"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { useState, useTransition, useEffect } from "react"
import { Eye, EyeOff, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

function EmailPasswordForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (res?.error) {
        setError("Incorrect email or password.")
      } else {
        router.push("/dashboard")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:-translate-y-[1px] hover:shadow-md transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-4 w-4 shrink-0">
          <rect x="0" y="0" width="47.5" height="47.5" fill="#F25022" />
          <rect x="52.5" y="0" width="47.5" height="47.5" fill="#7FBA00" />
          <rect x="0" y="52.5" width="47.5" height="47.5" fill="#00A4EF" />
          <rect x="52.5" y="52.5" width="47.5" height="47.5" fill="#FFB900" />
        </svg>
        Sign in with YCP Microsoft Account
      </button>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        or
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  )
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard")
  }, [status, router])

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <section
        className="relative overflow-hidden text-white px-8 py-14 flex flex-col justify-between gap-8 md:px-16"
        style={{
          background: "radial-gradient(circle at 30% 50%, #3D6AAE 0%, #194693 25%, #03368C 45%, #092656 70%, #092656 100%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            opacity: 0.25,
          }}
        />
        <div className="space-y-6 lg:space-y-8 max-w-lg">
          <div className="inline-flex items-center gap-3">
            <img src="/logo-ycp-white.svg" alt="YCP Logo" className="h-9 w-auto" />
            <span className="text-sm uppercase tracking-widest text-blue-200">
              Training Platform
            </span>
          </div>

          <div>
            <h1 className="text-6xl leading-tight font-black tracking-tight">Ascend</h1>
            <h2 className="text-4xl leading-tight font-extrabold text-blue-200 mt-1">
              Where Leaders Are Made
            </h2>
          </div>

          <p className="hidden lg:block text-base text-blue-100 max-w-xl">
            A structured development journey designed to build high-performing consultants through guided learning, real-world application, and continuous feedback.
          </p>

          <ul className="hidden lg:block space-y-3 text-sm text-blue-100">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-white" />
              Structured learning pathways tailored to your role
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-white" />
              Track your progress and earn recognition
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-white" />
              Manager sign-offs and real-time feedback
            </li>
          </ul>
        </div>

        <p className="hidden lg:block text-xs text-blue-300">© {new Date().getFullYear()} YCP · All rights reserved</p>
      </section>

      <section className="flex items-center justify-center p-8 md:p-16 bg-slate-100">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-slate-200">
          {session ? (
            <>
              <p className="mb-6 text-sm text-slate-600">Signed in as</p>
              <p className="mb-4 text-lg font-semibold text-slate-900">{session.user?.name || session.user?.email}</p>
              <button
                onClick={() => signOut()}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500 uppercase tracking-wide">Welcome back</p>
              <h2 className="mb-6 text-xl font-bold text-slate-900">Sign in to Ascend</h2>
              <EmailPasswordForm />
            </>
          )}
        </div>
      </section>
    </main>
  )
}
