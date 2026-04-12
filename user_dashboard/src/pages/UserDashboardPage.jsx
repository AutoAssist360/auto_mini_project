import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { clearAuth } from '../store/authSlice'
import { userLogout } from '../lib/api'
import MobileNav from '../components/MobileNav'

const NAV_CARDS = [
  {
    step: 'Step 1',
    title: 'Add Vehicles',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" />
      </svg>
    ),
    desc: 'Add, edit, and manage the vehicles you want to request help for.',
    path: '/vehicles',
    action: 'Manage vehicles',
  },
  {
    step: 'Step 2',
    title: 'Request Help',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    desc: 'Tell us what went wrong with your vehicle and ask for help.',
    path: '/requests/new',
    action: 'Request help',
    primary: true,
  },
  {
    step: 'Step 3',
    title: 'Requests',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    desc: 'Follow request updates, offers, and technician replies in one place.',
    path: '/requests',
    action: 'Open requests',
  },
  {
    step: 'Step 4',
    title: 'Jobs',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    desc: 'Check active work, completed repairs, and technician progress.',
    path: '/jobs',
    action: 'View jobs',
  },
  {
    step: 'Step 5',
    title: 'Shop Parts',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    desc: 'Find parts, compare prices, and place an order if you need one.',
    path: '/parts',
    action: 'Shop parts',
  },
  {
    step: 'Step 6',
    title: 'Orders',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    desc: 'Track your part orders, payment status, and deliveries.',
    path: '/orders',
    action: 'View orders',
  },
  {
    step: 'Optional',
    title: 'Payment Options',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    desc: 'Open payment options if you need to buy a part directly.',
    path: '/parts',
    action: 'See payment options',
    isAccent: true,
  },
  {
    step: 'Optional',
    title: 'Reviews',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    desc: 'See the ratings and reviews you have already shared.',
    path: '/reviews',
    action: 'Open reviews',
  },
  {
    step: 'Optional',
    title: 'Feedback',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
    desc: 'Share your suggestions or report issues with the platform.',
    path: '/feedback',
    action: 'Share feedback',
  },
]

function UserDashboardPage({ theme, onToggleTheme }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const auth = useSelector((state) => state.auth)
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.sessionStorage.getItem('user-dashboard-welcome-hidden') !== 'true'
  })

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const dismissWelcome = () => {
    setShowWelcome(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('user-dashboard-welcome-hidden', 'true')
    }
  }

  const userInitials = auth.user?.full_name
    ? auth.user.full_name.split(' ').map((name) => name[0]).join('').toUpperCase()
    : 'U'

  const firstName = auth.user?.full_name?.split(' ')[0] || 'User'

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 font-['Outfit',_sans-serif] text-slate-900 transition-colors duration-500 selection:bg-blue-500/30 dark:bg-[#030712] dark:text-slate-100">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-effect::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.05), transparent);
          animation: shimmer 2s infinite;
        }
        .card-glow:hover {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
        }
      `}</style>

      <div className="pointer-events-none absolute left-0 top-0 h-screen w-full overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-blue-600/5 blur-[120px] dark:bg-blue-600/10" />
        <div className="absolute right-[-5%] top-[20%] h-[30%] w-[30%] rounded-full bg-indigo-600/5 blur-[120px] dark:bg-indigo-600/10" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="relative z-20 mb-6 rounded-[32px] border border-slate-200 bg-white/80 px-4 py-5 shadow-xl backdrop-blur-md transition-all dark:border-slate-800 dark:bg-[#0B1120]/85 dark:shadow-2xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                  Quick Auto Assist
                </span>
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Your Dashboard
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Follow these steps to add your vehicle, ask for help, and track updates.
              </p>
            </div>

            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end lg:justify-end">
              <Link
                to="/profile"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 transition-colors hover:border-blue-500 sm:h-11 sm:w-11 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                aria-label="Open profile"
              >
                {userInitials}
              </Link>

              <MobileNav>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 transition-all hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full whitespace-nowrap rounded-full bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95 sm:w-auto sm:px-5 sm:text-[11px]"
                >
                  Logout
                </button>
              </MobileNav>
            </div>
          </div>
        </header>

        {showWelcome && (
          <section className="relative z-0 mb-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl transition-all duration-700 dark:border-slate-800/50 dark:bg-gradient-to-br dark:from-[#0B1120] dark:to-[#040814] dark:shadow-2xl sm:p-8 md:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.03),transparent)]" />
            <div className="relative z-10">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Welcome
                </div>

                <button
                  type="button"
                  onClick={dismissWelcome}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  aria-label="Close welcome banner"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
                Welcome back, <span className="text-blue-600 dark:text-blue-400">{firstName}</span>
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
                Start by adding your vehicle, then ask for help, and follow progress in My Requests and My Jobs.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                    System online
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                    Requests ready
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mb-5 flex items-center justify-between gap-4 px-1">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Your next steps
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The cards are arranged in the same order most users follow in the app.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_CARDS.map((card) => (
            <article
              key={`${card.path}-${card.title}`}
              className="card-glow group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0B1120]/50 dark:shadow-xl dark:hover:bg-[#0F172A]"
            >
              <div className="shimmer-effect pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-blue-500/5 blur-[60px] transition-colors group-hover:bg-blue-500/10" />

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {card.step}
                    </p>
                    <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600 sm:text-xl dark:text-white dark:group-hover:text-blue-400">
                      {card.title}
                    </h3>
                  </div>

                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 ${
                    card.primary
                      ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : card.isAccent
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}>
                    {card.icon}
                  </div>
                </div>

                <p className="mb-8 flex-grow text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {card.desc}
                </p>

                <button
                  type="button"
                  onClick={() => navigate(card.path)}
                  className={`relative w-full overflow-hidden rounded-2xl py-3.5 text-xs font-black uppercase tracking-[0.16em] whitespace-nowrap transition-all active:scale-[0.98] sm:text-[11px] ${
                    card.primary
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500'
                      : card.isAccent
                        ? 'border border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="relative z-10">{card.action}</span>
                  <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform group-hover:translate-y-0" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

export default UserDashboardPage
