"use client"

import { useState, useTransition, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react"
import { activateAccount } from "./actions"

export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateForm />
    </Suspense>
  )
}

function ActivateForm() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("Passwords do not match."); return }
    startTransition(async () => {
      const res = await activateAccount(token, password)
      if (res.error) {
        setError(res.error)
      } else {
        setDone(true)
        setTimeout(() => router.push("/"), 2500)
      }
    })
  }

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
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3">
            <img src="/logo-ycp-white.svg" alt="YCP Logo" className="h-9 w-auto" />
            <span className="text-sm uppercase tracking-widest text-blue-200">Training Platform</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight">Ascend</h1>
        </div>
        <p className="hidden lg:block text-xs text-blue-300">© {new Date().getFullYear()} YCP · All rights reserved</p>
      </section>

      <section className="flex items-center justify-center p-8 md:p-16 bg-slate-100">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-slate-200">
          {!token ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-sm text-slate-600">Invalid activation link. Please use the link from your email.</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 size={40} className="text-green-500" />
              <h2 className="text-lg font-bold text-slate-900">Password set successfully!</h2>
              <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <p className="mb-1 text-xs text-slate-500 uppercase tracking-wide">Account activation</p>
              <h2 className="mb-6 text-xl font-bold text-slate-900">Set your password</h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Confirm password</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  {pending ? "Setting password…" : "Activate account"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
