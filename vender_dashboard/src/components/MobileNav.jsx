import { useState, useRef, useEffect } from 'react'

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

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* ── Desktop: inline row (hidden below md) ──── */}
      <div className="hidden md:flex md:flex-wrap md:gap-2">
        {children}
      </div>

      {/* ── Mobile: hamburger (visible below md) ───── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center rounded-xl border border-slate-300 p-2 text-sm font-medium hover:bg-slate-100 md:hidden dark:border-slate-700 dark:hover:bg-slate-800"
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
        <div
          className="absolute right-0 top-full z-50 mt-2 flex w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg md:hidden dark:border-slate-700 dark:bg-slate-900"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}
