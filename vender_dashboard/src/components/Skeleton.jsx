/* ── Skeleton primitives ─────────────────────────────────── */

export function SkeletonLine({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  )
}

export function SkeletonBlock({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

/* ── Full-page skeleton (Suspense / auth init) ──────────── */
export function PageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-4 px-6">
        <SkeletonLine className="mx-auto h-6 w-40" />
        <SkeletonBlock lines={3} />
        <SkeletonLine className="mx-auto h-4 w-24" />
      </div>
    </div>
  )
}

/* ── List / table skeleton ──────────────────────────────── */
export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl bg-white p-4 shadow dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <SkeletonLine className="h-4 w-1/3" />
            <SkeletonLine className="h-4 w-20" />
          </div>
          <SkeletonLine className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

/* ── Detail page skeleton ───────────────────────────────── */
export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <SkeletonLine className="h-5 w-32" />
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
          <SkeletonLine className="h-6 w-48" />
          <SkeletonBlock lines={4} />
        </div>
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
          <SkeletonLine className="h-5 w-36" />
          <SkeletonBlock lines={3} />
        </div>
      </div>
    </div>
  )
}

/* ── Stat card grid skeleton ────────────────────────────── */
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse space-y-3 rounded-xl bg-white p-5 shadow dark:bg-slate-900"
        >
          <SkeletonLine className="h-5 w-24" />
          <SkeletonLine className="h-8 w-16" />
          <SkeletonLine className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}
