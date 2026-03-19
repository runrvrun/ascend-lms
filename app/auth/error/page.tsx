"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function ErrorContent() {
  const params = useSearchParams()
  const error = params.get("error")
  const isUserNotFound = error === "UserNotFound"

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <section
        className="relative overflow-hidden text-white px-8 py-14 flex flex-col justify-between gap-8 md:px-16"
        style={{
          background:
            "radial-gradient(circle at 30% 50%, #3D6AAE 0%, #194693 25%, #03368C 45%, #092656 70%, #092656 100%)",
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
        </div>

        <p className="hidden lg:block text-xs text-blue-300">
          © {new Date().getFullYear()} YCP · All rights reserved
        </p>
      </section>

      <section className="flex items-center justify-center p-8 md:p-16 bg-slate-100">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-slate-200">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>

          {isUserNotFound ? (
            <>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Account not found</h3>
              <p className="text-sm text-slate-600 mb-6">
                Your Ascend LMS account has not been created yet. Please contact HR to request
                access.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sign in failed</h3>
              <p className="text-sm text-slate-600 mb-6">
                An error occurred while signing in. Please try again or contact HR if the problem
                persists.
              </p>
            </>
          )}

          <a
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            Back to sign in
          </a>
        </div>
      </section>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
