export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="mb-4 h-9 animate-pulse rounded-lg bg-slate-100" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-slate-100 px-5 py-4 last:border-0">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
            <div className="ml-auto h-6 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  )
}
