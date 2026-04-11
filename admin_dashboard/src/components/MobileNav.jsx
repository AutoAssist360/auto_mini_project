import { Children, isValidElement, useState, useRef, useEffect } from 'react'

/**
 * Responsive navigation wrapper.
 * - `md+` → renders children inline as a flex row
 * - `<md` → collapses children behind a hamburger icon ≡
 *
 * Usage:
 *   <MobileNav>
 *     <button>Theme</button>
 *     <Link to="/dashboard">Dashboard</Link>
 *     <button>Logout</button>
 *   </MobileNav>
 */
export default function MobileNav({ children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const items = Children.toArray(children)

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    if (open) document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      {/* ── Desktop: inline row (hidden below md) ──── */}
      <div className="hidden md:flex md:flex-wrap md:gap-2">
        {children}
      </div>

      {/* ── Mobile: hamburger (visible below md) ───── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white/80 p-2 text-sm font-medium shadow-sm transition-all hover:bg-slate-100 md:hidden dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="absolute inset-x-3 top-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                  Quick menu
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  Admin actions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3" onClick={() => setOpen(false)}>
              {items.map((child, index) => {
                const mobileSpan = isValidElement(child) ? child.props['data-mobile-span'] : undefined
                const spanClass = mobileSpan === 'full' || items.length === 1 ? 'col-span-2' : 'col-span-1'

                return (
                <div key={index} className={`flex min-w-0 items-center justify-center overflow-hidden ${spanClass}`}>
                  {child}
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
