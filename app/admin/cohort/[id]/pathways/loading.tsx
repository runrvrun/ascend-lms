export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-36 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex gap-8">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-slate-100 px-5 py-4 last:border-0">
            <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
            <div className="ml-auto h-6 w-6 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  )
}
