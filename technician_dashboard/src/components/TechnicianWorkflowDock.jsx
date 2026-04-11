import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const WORKFLOW_ITEMS = [
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    hint: 'See today’s technician workflow and workload.',
    to: '/dashboard',
    matches: (pathname) => pathname === '/dashboard',
  },
  {
    label: 'Find requests',
    shortLabel: 'Discover',
    hint: 'Browse open customer requests and send offers.',
    to: '/discover',
    matches: (pathname) => pathname === '/discover',
  },
  {
    label: 'My offers',
    shortLabel: 'Offers',
    hint: 'Follow offers you have already sent to customers.',
    to: '/offers',
    matches: (pathname) => pathname === '/offers',
  },
  {
    label: 'Assignments',
    shortLabel: 'Assignments',
    hint: 'Accept new assignments without losing context.',
    to: '/assignments',
    matches: (pathname) => pathname === '/assignments',
  },
  {
    label: 'Active jobs',
    shortLabel: 'Jobs',
    hint: 'Update repair progress, tracking, and invoices.',
    to: '/jobs',
    matches: (pathname) => pathname === '/jobs' || /^\/jobs\/[^/]+$/.test(pathname) || /^\/messages\/[^/]+$/.test(pathname),
  },
  {
    label: 'Earnings',
    shortLabel: 'Earnings',
    hint: 'Review completed work, payouts, and earnings.',
    to: '/earnings',
    matches: (pathname) => pathname === '/earnings',
  },
]

function getHistoryIndex() {
  if (typeof window === 'undefined') return 0
  return typeof window.history.state?.idx === 'number' ? window.history.state.idx : 0
}

function TechnicianWorkflowDock() {
  const location = useLocation()
  const navigate = useNavigate()
  const dockRef = useRef(null)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 640
  })
  const [isExpanded, setIsExpanded] = useState(false)

  const currentIndex = useMemo(() => (
    WORKFLOW_ITEMS.findIndex((item) => item.matches(location.pathname))
  ), [location.pathname])

  const currentItem = currentIndex >= 0 ? WORKFLOW_ITEMS[currentIndex] : null
  const nextItem = currentIndex >= 0 && currentIndex < WORKFLOW_ITEMS.length - 1
    ? WORKFLOW_ITEMS[currentIndex + 1]
    : null
  const showBack = location.pathname !== '/dashboard'

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const media = window.matchMedia('(max-width: 639px)')
    const handleChange = (event) => {
      setIsMobile(event.matches)
    }

    setIsMobile(media.matches)
    media.addEventListener('change', handleChange)

    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    setIsExpanded(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isExpanded) return undefined

    const handlePointerDown = (event) => {
      if (dockRef.current && !dockRef.current.contains(event.target)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isExpanded])

  useEffect(() => {
    const root = document.documentElement
    const previousPaddingBottom = document.body.style.paddingBottom
    const previousDockClearance = root.style.getPropertyValue('--qa-workflow-dock-clearance')
    const dockClearance = isExpanded
      ? (isMobile ? '18rem' : '13rem')
      : '5.75rem'

    document.body.style.paddingBottom = dockClearance
    root.style.setProperty('--qa-workflow-dock-clearance', dockClearance)

    return () => {
      document.body.style.paddingBottom = previousPaddingBottom
      if (previousDockClearance) {
        root.style.setProperty('--qa-workflow-dock-clearance', previousDockClearance)
      } else {
        root.style.removeProperty('--qa-workflow-dock-clearance')
      }
    }
  }, [isExpanded, isMobile])

  const handleBack = () => {
    if (getHistoryIndex() > 0) {
      navigate(-1)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-3 sm:px-6">
      <div ref={dockRef} className="pointer-events-auto mx-auto max-w-6xl rounded-[28px] border border-slate-200/80 bg-white/92 p-3 shadow-2xl backdrop-blur-xl dark:border-slate-700/70 dark:bg-[#020617]/90">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 rounded-2xl border border-blue-500/10 bg-blue-50/80 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
              Technician flow
            </p>
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {currentItem?.label || 'Quick navigation'}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {currentItem?.hint || 'Move to the next work step without reopening the dashboard.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
            aria-label={isExpanded ? 'Close technician guide' : 'Open technician guide'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3 rounded-[24px] border border-slate-200/80 bg-white/96 p-3 shadow-xl dark:border-slate-700/70 dark:bg-[#020617]/96">
            <div className={`grid gap-2 ${showBack && nextItem ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
              {showBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex h-11 min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                >
                  Back
                </button>
              )}

              {nextItem && (
                <button
                  type="button"
                  onClick={() => navigate(nextItem.to)}
                  className="inline-flex h-11 min-w-0 items-center justify-center rounded-2xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-[0.22em] text-white transition-all hover:bg-blue-600 dark:bg-white dark:text-slate-900 dark:hover:bg-blue-500 dark:hover:text-white"
                >
                  Next: {nextItem.label}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:justify-end">
              {WORKFLOW_ITEMS.map((item) => {
                const isActive = item.matches(location.pathname)

                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className={`min-w-0 rounded-2xl border px-3 py-2.5 text-center text-[10px] font-black uppercase leading-tight tracking-[0.2em] transition-all lg:px-4 ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-400'
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default TechnicianWorkflowDock
