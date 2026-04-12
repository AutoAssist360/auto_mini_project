import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { clearAuth, setAuthUser } from '../store/authSlice'
import {
  getVendorProfile,
  vendorLogout,
  getWarehouses,
  getRevenueAnalytics,
  getOrderAnalytics,
  getInventoryAnalytics,
  ApiError,
} from '../lib/api'
import { CardSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import { useSocket } from '../lib/useSocket'

function VendorDashboardPage({ theme, onToggleTheme }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const auth = useSelector((state) => state.auth)
  const [vendorProfile, setVendorProfile] = useState(auth.user || null)

  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(null)
  const [orderStats, setOrderStats] = useState(null)
  const [inventoryStats, setInventoryStats] = useState(null)
  const [warehouseCount, setWarehouseCount] = useState(0)
  const [error, setError] = useState('')
  const [showHero, setShowHero] = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('qa-vendor-socket-token') : null
  const { on, off } = useSocket(token)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    setRevenue(null)
    setOrderStats(null)
    setInventoryStats(null)
    setWarehouseCount(0)
    try {
      const profileRes = await getVendorProfile()
      const vendor = profileRes?.vendor || null

      if (vendor) {
        setVendorProfile(vendor)
        dispatch(setAuthUser(vendor))
      }

      if (!vendor?.is_verified) {
        return
      }

      const results = await Promise.allSettled([
        getRevenueAnalytics(),
        getOrderAnalytics(),
        getInventoryAnalytics(),
        getWarehouses(1, 1),
      ])
      if (results[0].status === 'fulfilled') setRevenue(results[0].value)
      if (results[1].status === 'fulfilled') setOrderStats(results[1].value)
      if (results[2].status === 'fulfilled') setInventoryStats(results[2].value)
      if (results[3].status === 'fulfilled') setWarehouseCount(results[3].value?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    const reload = () => { loadDashboard().catch(() => null) }
    const handleInventoryUpdate = () => {
      getInventoryAnalytics().then((response) => setInventoryStats(response)).catch(() => {})
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload()
      }
    }
    on('notification:new', reload)
    on('vendor:orders_refresh', reload)
    on('vendor:dashboard_refresh', reload)
    on('inventory:updated', handleInventoryUpdate)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      off('notification:new', reload)
      off('vendor:orders_refresh', reload)
      off('vendor:dashboard_refresh', reload)
      off('inventory:updated', handleInventoryUpdate)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadDashboard, off, on])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleLogout = async () => {
    await vendorLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/vendor/signin')
  }

  const currentVendor = vendorProfile || auth.user
  const isVerified = currentVendor?.is_verified ?? false
  const vendorInitials = currentVendor?.full_name
    ? currentVendor.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'V'

  const statCards = [
    { label: 'Total Revenue', value: revenue ? `₹${Number(revenue.total_revenue).toLocaleString()}` : '-', color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Total Orders', value: revenue?.total_orders ?? '-', color: 'text-slate-900 dark:text-white' },
    { label: 'Avg Order Value', value: revenue ? `₹${Number(revenue.avg_order_value).toFixed(0)}` : '-', color: 'text-slate-900 dark:text-white' },
    { label: 'Locations', value: warehouseCount, color: 'text-slate-900 dark:text-white' },
    { label: 'Stock Items', value: inventoryStats?.total_items ?? '-', color: 'text-slate-900 dark:text-white' },
    { label: 'Low Stock', value: inventoryStats?.low_stock_count ?? '-', color: inventoryStats?.low_stock_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white' },
  ]

  const quickLinks = [
    {
      label: 'Step 1: Profile',
      to: '/profile',
      desc: 'Set up your business details and keep your UPI payment information current.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A10.954 10.954 0 0112 15c2.508 0 4.82.838 6.879 2.243M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      )
    },
    {
      label: 'Step 2: Locations',
      to: '/warehouses',
      desc: 'Add and manage the places you store and ship parts from.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      label: 'Step 3: Orders',
      to: '/orders',
      desc: 'Review incoming orders and fulfill them on time.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      )
    },
    {
      label: 'Step 4: Analytics',
      to: '/analytics',
      desc: 'Check sales, stock movement, and order performance.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      label: 'Step 5: Payments',
      to: '/ledger',
      desc: 'Track earnings, dues, and completed payments.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        </svg>
      )
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500 relative">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-effect::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.05), transparent);
          animation: shimmer 2s infinite;
        }
        .card-glow:hover {
          box-shadow: 0 0 20px rgba(59,130,246,0.1);
        }
      `}</style>

      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-purple-600/5 dark:bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md pl-4 pr-1 sm:px-6 py-3 shadow-xl dark:shadow-2xl transition-all flex items-center justify-between gap-2 mr-10 sm:mr-0 relative z-[40]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase truncate">Vendor Dashboard</span>
            <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-blue-500 animate-pulse"></div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <MobileNav>
              <Link to="/profile" className="hidden sm:flex w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center text-xs font-bold hover:border-blue-500 transition-colors text-slate-700 dark:text-slate-300">
                {vendorInitials}
              </Link>
              <button
                onClick={onToggleTheme}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                {theme === 'dark' ? '🌞' : '🌙'}
              </button>
              
              <a href={import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5173'} className="hidden md:flex ml-2 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-400" title="Go to Landing">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </a>

              <button
                onClick={handleLogout}
                className="whitespace-nowrap ml-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2.5 rounded-full transition-all active:scale-95 shadow-lg shadow-blue-600/20 uppercase"
              >
                Logout
              </button>
            </MobileNav>
          </div>
        </header>

        {error && <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 shadow-sm">{error}</div>}

        {/* Hero Section */}
        {showHero && (
        <section className="mb-8 rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gradient-to-br dark:from-[#0B1120] dark:to-[#040814] p-8 md:p-12 shadow-xl dark:shadow-2xl relative overflow-hidden group hover:border-blue-500 transition-all duration-700 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>
          <div className="absolute inset-0 bg-blue-600/[0.01] dark:bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setShowHero(false)}
            className="absolute top-4 right-4 z-[60] flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90"
            aria-label="Dismiss greeting"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative z-10 flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 font-black tracking-widest text-[9px] text-blue-600 dark:text-blue-400 uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                Vendor dashboard
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-black tracking-widest text-[9px] uppercase ${isVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                {isVerified ? 'Verified vendor' : 'Verification pending'}
              </div>
            </div>

            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-4 group-hover:translate-x-2 transition-transform duration-700">
              HELLO, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">{currentVendor?.full_name?.split(' ')[0].toUpperCase() || 'VENDOR'}</span> 🏬
            </h2>

            <p className="max-w-2xl text-slate-600 dark:text-slate-400 text-lg leading-relaxed transition-opacity group-hover:opacity-80">
              {isVerified
                ? 'Start with your profile, then add your locations, manage orders, and review sales and payments.'
                : 'Your account is under admin review. Once approved, you can manage warehouses, inventory, orders, and payments.'}
            </p>
          </div>

          <div className="relative z-10 w-full md:w-80 rounded-[28px] border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-6 shadow-sm flex flex-col gap-4">
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{isVerified ? 'Quick start' : 'Review status'}</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mt-1">{isVerified ? 'Keep payments ready' : 'Waiting for admin approval'}</h3>
             </div>
             <p className="text-sm text-slate-600 dark:text-slate-300">
                {isVerified
                  ? 'Update your profile first so customer payments and business details stay correct.'
                  : 'Please complete your profile and wait for admin verification before accessing vendor tools.'}
             </p>
             <Link to="/profile" className="mt-auto h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                Open profile
             </Link>
          </div>
        </section>
        )}

        {loading ? (
          <div className="py-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
             <CardSkeleton count={6} />
          </div>
        ) : !isVerified ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[40px] border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-8 shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400 mb-3">Verification pending</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Your vendor account is waiting for admin approval</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                You can keep your profile ready, but warehouses, inventory, orders, and analytics will unlock only after the admin verifies your account.
              </p>
            </div>
            <div className="rounded-[40px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/70 p-8 shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">What happens next</p>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li>1. Complete your profile with business and payment details.</li>
                <li>2. Wait for the admin to verify your vendor account.</li>
                <li>3. Once approved, your dashboard tools will open automatically.</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-6 md:grid-cols-3">
               {statCards.map((stat, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0B1120]/50 backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-white dark:hover:bg-[#0F172A] hover:border-blue-500/30 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 group">
                     <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors block mb-1">{stat.label}</span>
                     <div className={`text-xl font-black tracking-tighter transition-transform group-hover:scale-105 ${stat.color}`}>{stat.value}</div>
                  </div>
               ))}
            </div>

            {/* Orders By Status (If Available) */}
            {orderStats?.by_status && Object.keys(orderStats.by_status).length > 0 && (
               <section className="mb-10">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Orders by status
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(orderStats.by_status).map(([status, count]) => (
                      <div key={status} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] p-4 text-center hover:border-indigo-500/50 transition-colors shadow-sm">
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{count}</div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 mt-1">{status.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
               </section>
            )}

            {/* Quick Links Grid */}
            <div className="mb-10">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Suggested steps
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {quickLinks.map((card) => (
                  <article
                    key={card.to}
                    className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-6 transition-all hover:bg-slate-50 dark:hover:bg-[#0F172A] hover:border-blue-500/30 dark:hover:border-blue-500/50 hover:-translate-y-2 card-glow shadow-lg dark:shadow-xl overflow-hidden hover:scale-[1.02] duration-300 flex flex-col h-full"
                  >
                    <div className="absolute inset-0 shimmer-effect opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-black text-blue-600 dark:text-blue-500 tracking-widest uppercase transition-transform group-hover:translate-x-1">{card.label}</h3>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 group-hover:scale-110 transition-all duration-300">
                          {card.icon}
                        </div>
                      </div>

                      <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed mb-6 flex-grow">
                        {card.desc}
                      </p>

                      <button
                        onClick={() => navigate(card.to)}
                        className="w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] relative overflow-hidden group/btn bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <span className="relative z-10">{card.label.replace(/^Step \d+: /, 'Open ')}</span>
                        <div className="absolute inset-0 bg-blue-500/10 translate-y-full group-hover/btn:translate-y-0 transition-transform"></div>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VendorDashboardPage
