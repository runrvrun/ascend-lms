export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="h-7 w-60 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-slate-100 px-6 py-4 last:border-0">
            <div className="h-4 w-52 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  )
}
