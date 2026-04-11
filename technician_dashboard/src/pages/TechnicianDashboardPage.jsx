import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { clearAuth, setAuthUser } from '../store/authSlice'
import { useSocket } from '../lib/useSocket'
import {
  technicianLogout,
  getTechnicianProfile,
  updateAvailability,
  getPendingAssignments,
  getJobs,
  getEarnings,
} from '../lib/api'
import { CardSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'

function TechnicianDashboardPage({ theme, onToggleTheme }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const auth = useSelector((state) => state.auth)
  const profile = auth.user

  const [isOnline, setIsOnline] = useState(profile?.is_online ?? false)
  const [togglingOnline, setTogglingOnline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [activeJobsCount, setActiveJobsCount] = useState(0)
  const [earningsSummary, setEarningsSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const { on, off } = useSocket(auth.token)

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, assignRes, jobsRes, earningsRes] = await Promise.allSettled([
        getTechnicianProfile(),
        getPendingAssignments(),
        getJobs(1, 1, 'in_progress'),
        getEarnings(),
      ])

      if (profileRes.status === 'fulfilled' && profileRes.value?.profile) {
        dispatch(setAuthUser(profileRes.value.profile))
        setIsOnline(profileRes.value.profile.is_online ?? false)
      }
      if (assignRes.status === 'fulfilled') {
        setPendingCount(assignRes.value?.assignments?.length ?? 0)
      }
      if (jobsRes.status === 'fulfilled') {
        setActiveJobsCount(jobsRes.value?.total ?? 0)
      }
      if (earningsRes.status === 'fulfilled') {
        setEarningsSummary(earningsRes.value?.summary ?? null)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    const reload = () => { loadDashboardData().catch(() => null) }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload()
      }
    }
    on('notification:new', reload)
    on('technician:dashboard_refresh', reload)
    on('technician:assignments_refresh', reload)
    on('technician:jobs_refresh', reload)
    on('technician:discover_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      off('notification:new', reload)
      off('technician:dashboard_refresh', reload)
      off('technician:assignments_refresh', reload)
      off('technician:jobs_refresh', reload)
      off('technician:discover_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadDashboardData, off, on])

  const handleToggleOnline = async () => {
    setTogglingOnline(true)
    try {
      const res = await updateAvailability(!isOnline)
      setIsOnline(res?.availability?.is_online ?? !isOnline)
    } catch {
      /* silent */
    } finally {
      setTogglingOnline(false)
    }
  }

  const handleLogout = async () => {
    await technicianLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/technician/signin')
  }

  const techName = profile?.user?.full_name || 'Technician'
  const isVerified = profile?.is_verified ?? false
  const userInitials = techName.split(' ').map((n) => n[0]).join('').toUpperCase()

  const QUICK_ACTIONS = [
    {
      title: 'Step 1: Find Requests',
      desc: 'Browse open customer requests and send your offer.',
      path: '/discover',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      primary: true,
    },
    {
      title: 'Step 2: My Offers',
      desc: 'Check the offers you have already sent to customers.',
      path: '/offers',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Step 3: New Assignments',
      desc: `${pendingCount > 0 ? `${pendingCount} waiting` : 'No pending'} assignment${pendingCount !== 1 ? 's' : ''}.`,
      path: '/assignments',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      highlight: pendingCount > 0,
    },
    {
      title: 'Step 4: Active Jobs',
      desc: 'Manage ongoing repairs, updates, and customer work.',
      path: '/jobs',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: 'Step 5: Earnings',
      desc: 'Track your earnings, payouts, and completed work.',
      path: '/earnings',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-effect::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.08), transparent);
          animation: shimmer 2s infinite;
        }
        .card-glow:hover {
          box-shadow: 0 0 30px rgba(59,130,246,0.15);
        }
      `}</style>

      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between transition-all">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase sm:text-xl">Technician Dashboard</span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            </div>

          <div className="flex items-center gap-3">
            <Link to="/profile" className="hidden sm:flex w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center text-xs font-bold hover:border-blue-500 transition-colors">
              {userInitials}
            </Link>

            <MobileNav>
              <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                {theme === 'dark' ? '🌞' : '🌙'}
              </button>

              <button onClick={handleLogout} className="ml-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black px-5 py-2.5 rounded-full transition-all active:scale-95 shadow-lg shadow-blue-600/20">
                LOGOUT
              </button>
            </MobileNav>
          </div>
        </header>

        <section className="mb-8 rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gradient-to-br dark:from-[#0B1120] dark:to-[#040814] p-6 md:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group transition-all duration-700">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 font-black tracking-widest text-[9px] text-blue-600 dark:text-blue-400 uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                Your dashboard
              </div>

              <button
                onClick={handleToggleOnline}
                disabled={togglingOnline}
                className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all font-black text-[9px] uppercase tracking-widest border hover:scale-105 active:scale-95 ${
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                    : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                }`}
              >
                <div className={`w-1.2 h-1.2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                {togglingOnline ? 'Updating...' : isOnline ? 'Available for jobs' : 'Currently offline'}
              </button>

              {isVerified ? (
                <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 font-black tracking-widest text-[9px] text-blue-600 dark:text-blue-400 uppercase">Verified technician</div>
              ) : (
                <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 font-black tracking-widest text-[9px] text-amber-600 dark:text-amber-400 uppercase">Verification pending</div>
              )}
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-4">
              Welcome, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">{techName.split(' ')[0]}</span>
            </h2>

            <p className="max-w-xl text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed mb-6">
              Start with open requests, move to assignments, then manage active jobs and payments from here.
            </p>
          </div>
        </section>

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <CardSkeleton count={6} />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {[
                { label: 'Pending Assignments', value: pendingCount },
                { label: 'Active Jobs', value: activeJobsCount },
                { label: 'Earned This Month', value: `Rs ${Number(earningsSummary?.total_earned ?? 0).toLocaleString()}` },
                { label: 'Success Rate', value: '98%' },
              ].map((stat, idx) => (
                <div key={idx} className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all hover:scale-105 hover:bg-white dark:hover:bg-white/10 hover:border-blue-500/30 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 group cursor-default">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">{stat.label}</span>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mt-1 group-hover:translate-x-1 transition-transform">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mb-5 px-1">
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Suggested workflow</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Follow these steps in order to keep your technician work simple and clear.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((card) => (
                <article
                  key={card.path}
                  className={`group relative rounded-[32px] border transition-all duration-500 overflow-hidden hover:-translate-y-2 flex flex-col h-full bg-white dark:bg-[#0B1120]/50 border-slate-200 dark:border-slate-800 hover:border-blue-500/50 card-glow shadow-lg dark:shadow-xl hover:scale-[1.02] ${card.highlight ? 'ring-2 ring-blue-500/20 shadow-blue-500/10' : ''}`}
                >
                  <div className="absolute inset-0 shimmer-effect opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>

                  <div className="p-8 flex-grow relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner group-hover:scale-110 group-hover:rotate-12 ${
                        card.primary
                          ? 'bg-blue-600 text-white shadow-blue-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-blue-400/80 border border-slate-200/50 dark:border-slate-700/50'
                      }`}>
                        {card.icon}
                      </div>
                      {card.highlight && (
                        <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-black tracking-widest animate-pulse border border-blue-500/20 uppercase">Action Needed</div>
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 group-hover:text-blue-600 tracking-tight transition-all">
                      {card.title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed transition-opacity group-hover:opacity-80">
                      {card.desc}
                    </p>
                  </div>

                  <div className="p-8 pt-0 relative z-10">
                    <button
                      onClick={() => navigate(card.path)}
                      className={`w-full h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-[0.95] relative overflow-hidden group/btn ${
                        card.primary
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="relative z-10">{card.title.replace(/^Step \d+: /, 'Open ')}</span>
                      <div className="absolute inset-0 bg-blue-500/10 translate-y-full group-hover/btn:translate-y-0 transition-transform"></div>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TechnicianDashboardPage
