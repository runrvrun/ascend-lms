export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="mb-4 h-9 animate-pulse rounded-lg bg-slate-100" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex gap-8">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-slate-100 px-5 py-4 last:border-0">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
            <div className="ml-auto h-7 w-20 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  )
}
