import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  ApiError,
  adminLogout,
  getAdminSocketToken,
  getApiErrorMessage,
  getDashboard,
  getProfile,
  getUnreadCount,
  updateProfile,
} from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { useSocket } from '../lib/useSocket'
import { CardSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import { useToast } from '../components/toastContext'
import { createEmptyErrors, PHONE_REGEX, sanitizeDigits, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

const profileFieldOrder = ['full_name', 'phone_number']

function AdminDashboardPage({ theme, onToggleTheme }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { registerField, focusFirst } = useFirstErrorFocus(profileFieldOrder)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showWelcome, setShowWelcome] = useState(true)
  const [unread, setUnread] = useState(0)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileForm, setProfileForm] = useState({ full_name: '', phone_number: '' })
  const [profileErrors, setProfileErrors] = useState(createEmptyErrors(profileFieldOrder))

  const refreshTimerRef = useRef(null)
  const socketToken = getAdminSocketToken()
  const { on, off } = useSocket(socketToken)

  const loadDashboard = useCallback(async ({ showSkeleton = false } = {}) => {
    if (showSkeleton) setLoading(true)

    try {
      const [dashboardRes, unreadRes] = await Promise.all([
        getDashboard(),
        getUnreadCount(),
      ])

      setData(dashboardRes || null)
      setUnread(unreadRes?.unreadCount ?? unreadRes?.count ?? 0)
    } catch {
      // Keep the last known dashboard state during transient refresh issues.
    } finally {
      if (showSkeleton) setLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)

    try {
      const response = await getProfile()
      const user = response?.user || null

      setProfile(user)
      setProfileForm({
        full_name: user?.full_name || '',
        phone_number: user?.phone_number || '',
      })
      setProfileErrors(createEmptyErrors(profileFieldOrder))
      setProfileSuccess('')
    } catch {
      // Keep the dashboard usable even if the profile request fails.
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      loadDashboard()
    }, 150)
  }, [loadDashboard])

  useEffect(() => {
    loadDashboard({ showSkeleton: true })
    loadProfile()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [loadDashboard, loadProfile])

  useEffect(() => {
    const handleAdminRefresh = () => queueRefresh()
    const handleNotification = (payload = {}) => {
      if (typeof payload.unreadCount === 'number') {
        setUnread(Math.max(0, payload.unreadCount))
      }
      queueRefresh()
    }
    const handleNotificationChanged = (payload = {}) => {
      if (typeof payload.unreadCount === 'number') {
        setUnread(Math.max(0, payload.unreadCount))
        return
      }

      queueRefresh()
    }

    on('admin:dashboard_refresh', handleAdminRefresh)
    on('notification:new', handleNotification)
    on('notification:changed', handleNotificationChanged)

    return () => {
      off('admin:dashboard_refresh', handleAdminRefresh)
      off('notification:new', handleNotification)
      off('notification:changed', handleNotificationChanged)
    }
  }, [off, on, queueRefresh])

  const handleLogout = async () => {
    await adminLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/admin/login')
  }

  const handleProfileChange = useCallback((field) => (event) => {
    const rawValue = event.target.value
    const nextValue = field === 'phone_number' ? sanitizeDigits(rawValue, 10) : rawValue

    setProfileForm((prev) => ({ ...prev, [field]: nextValue }))
    setProfileErrors((prev) => ({ ...prev, [field]: '', form: '' }))
    setProfileSuccess('')
  }, [])

  const validateProfileForm = useCallback((values = profileForm) => {
    const nextErrors = createEmptyErrors(profileFieldOrder)

    if (!values.full_name.trim()) nextErrors.full_name = 'Full name is required'
    if (values.phone_number && !PHONE_REGEX.test(values.phone_number)) {
      nextErrors.phone_number = 'Phone number must be exactly 10 digits'
    }

    setProfileErrors(nextErrors)

    const isValid = !Object.values(nextErrors).some(Boolean)
    if (!isValid) focusFirst(nextErrors)
    return isValid
  }, [focusFirst, profileForm])

  const handleProfileSubmit = useCallback(async (event) => {
    event.preventDefault()
    if (!validateProfileForm()) return

    setProfileSaving(true)
    setProfileErrors((prev) => ({ ...prev, form: '' }))
    setProfileSuccess('')

    try {
      const payload = {
        full_name: profileForm.full_name.trim(),
        ...(profileForm.phone_number ? { phone_number: profileForm.phone_number } : {}),
      }

      const response = await updateProfile(payload)
      const user = response?.user || null

      setProfile(user)
      setProfileForm({
        full_name: user?.full_name || '',
        phone_number: user?.phone_number || '',
      })
      setProfileSuccess('Profile updated successfully.')
      toast.success('Profile updated successfully')
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to update profile')
      setProfileErrors((prev) => ({
        ...prev,
        form: error instanceof ApiError ? message : 'Failed to update profile. Please try again.',
      }))
      toast.error(message)
    } finally {
      setProfileSaving(false)
    }
  }, [profileForm, toast, validateProfileForm])

  const s = data || {}
  const hasProfileChanges = !!profile && (
    profileForm.full_name.trim() !== (profile.full_name || '') ||
    profileForm.phone_number !== (profile.phone_number || '')
  )
  const isProfileSubmitDisabled = profileLoading || profileSaving || !hasProfileChanges

  const profileMeta = useMemo(() => {
    if (!profile) {
      return {
        joined: '--',
        status: 'Unavailable',
      }
    }

    return {
      joined: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '--',
      status: profile.is_active ? 'Active admin' : 'Inactive admin',
    }
  }, [profile])

  const adminInitials = profileForm.full_name
    ? profileForm.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'A'

  const quickStartCards = [
    ['Step 1', 'Review Requests', 'Check new requests first so active issues never get missed.', '/admin/requests'],
    ['Step 2', 'Monitor Jobs', 'Follow ongoing jobs and look for stalled or failed progress.', '/admin/jobs'],
    ['Step 3', 'Manage People', 'Verify technicians, support users, and review vendor accounts.', '/admin/technicians'],
    ['Step 4', 'Payouts & Analytics', 'Finish with payouts, invoices, and overall platform performance.', '/admin/payouts'],
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
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
          box-shadow: 0 0 30px rgba(59,130,246,0.15);
        }
      `}</style>

      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Capsule Header */}
        <header className="relative z-50 mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl transition-all">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase sm:text-xl">Admin Dashboard</span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold hover:border-blue-500 transition-colors text-slate-700 dark:text-slate-300 shadow-inner">
                {adminInitials}
              </div>

              <MobileNav>
                <Link to="/admin/notifications" className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 md:h-10 md:w-10 md:rounded-full">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unread > 0 && <span className="absolute top-0 right-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0B1120] transform translate-x-[70%] -translate-y-[40%] whitespace-nowrap leading-none">{unread}</span>}
                  </div>
                </Link>

                <button
                  onClick={onToggleTheme}
                  className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 transition-all hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 md:h-10 md:w-10 md:rounded-full"
                >
                  {theme === 'dark' ? (
                    <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleLogout}
                  data-mobile-span="full"
                  className="w-full whitespace-nowrap rounded-2xl bg-red-600 px-5 py-3 text-[10px] font-black text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 active:scale-95 md:ml-2 md:w-auto md:rounded-full md:py-2.5"
                >
                  Logout
                </button>
              </MobileNav>
            </div>
          </div>
        </header>

        {loading && <CardSkeleton count={6} />}

        {!loading && (
          <>
            {/* Hero Section */}
            {showWelcome && (
              <section className="mb-8 rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gradient-to-br dark:from-[#0B1120] dark:to-[#040814] p-8 md:p-12 shadow-xl dark:shadow-2xl relative overflow-hidden group hover:border-blue-500 transition-all duration-700">
                <button
                  type="button"
                  onClick={() => setShowWelcome(false)}
                  className="absolute top-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100/50 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.02),transparent)] pointer-events-none"></div>
                <div className="absolute inset-0 bg-blue-600/[0.02] dark:bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6 font-black tracking-widest text-[9px] text-blue-600 dark:text-blue-400 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    Admin access
                  </div>

                  <h2 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-6 group-hover:translate-x-2 transition-transform duration-700 uppercase">
                  Welcome back, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent">{profileForm.full_name?.split(' ')[0] || 'Admin'}</span>
                </h2>

                <p className="max-w-2xl text-slate-600 dark:text-slate-400 text-lg md:text-xl font-medium leading-relaxed mb-10 transition-opacity group-hover:opacity-80">
                  Start with new requests, then check jobs, manage people, and finish with payouts and analytics.
                </p>

                <div className="flex flex-wrap gap-4">
                  <div className="hover:scale-105 transition-transform flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"></div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Dashboard ready</span>
                  </div>
                  <div className="hover:scale-105 transition-transform flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Live updates on</span>
                  </div>
                </div>
              </div>
            </section>
            )}

            <section className="mb-8">
              <div className="mb-5 px-1">
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Suggested workflow</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">These steps keep daily admin work easy to follow for anyone using the dashboard.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {quickStartCards.map(([step, title, desc, to]) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => navigate(to)}
                    className="rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-xl dark:border-slate-800 dark:bg-[#0B1120]/50"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">{step}</p>
                    <h4 className="mt-3 text-xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h4>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
                  </button>
                ))}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <div className="space-y-6">
                {/* Key Metrics Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Users', s.users?.total, 'bg-blue-100 text-blue-600 dark:bg-blue-900/30', s.users?.active ?? 0],
                    ['Technicians', s.technicians?.total, 'bg-amber-100 text-amber-600 dark:bg-amber-900/30', s.technicians?.online ?? 0],
                    ['Vendors', s.vendors?.total, 'bg-purple-100 text-purple-600 dark:bg-purple-900/30', 'Partners'],
                    ['Warehouses', s.warehouses?.active, 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30', 'Active'],
                    ['Invoices', s.invoices?.total, 'bg-green-100 text-green-600 dark:bg-green-900/30', 'Total'],
                  ].map(([label, value, color, sub]) => (
                    <article key={label} className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-6 shadow-lg hover:shadow-xl transition-all group">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                      <p className="text-3xl font-black tracking-tight mb-3 group-hover:scale-110 transition-transform origin-left">{value ?? '--'}</p>
                      {sub && <span className={`inline-block rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider ${color}`}>{sub}</span>}
                    </article>
                  ))}
                </div>

                {/* Request status breakdown */}
                <section className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-8 shadow-xl">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6">Request status overview</h2>
                  <div className="flex flex-wrap gap-3">
                    {s.requests && Object.entries(s.requests).map(([key, value]) => (
                      <div key={key} className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 flex items-center gap-3 group hover:border-blue-500/50 transition-all">
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-500">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Supporting summary panels */}
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    ['Jobs', s.jobs],
                    ['Orders', s.orders],
                    ['Invoices', s.invoices]
                  ].map(([title, metrics]) => (
                    <div key={title} className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0B1120]/30 p-6 backdrop-blur-sm">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500 mb-4">{title}</h3>
                      <div className="space-y-3">
                        {metrics && Object.entries(metrics).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-xs font-bold font-['Outfit'] border-b border-slate-100 dark:border-slate-800/50 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="text-slate-900 dark:text-white">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent request activity */}
                {s.recentRequests?.length > 0 && (
                  <section className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-6 shadow-xl overflow-hidden sm:p-8">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6">Recent requests</h2>
                    <div className="space-y-4 md:hidden">
                      {s.recentRequests.map((request) => (
                        <article key={request.request_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white">{request.user?.full_name || '--'}</p>
                              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{request.issue_type?.replace(/_/g, ' ')}</p>
                            </div>
                            <span className="inline-block rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                              {request.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Created {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </article>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block w-full">
                      <table className="w-full min-w-[600px] text-left text-[11px] font-bold">
                        <thead>
                          <tr className="border-b-2 border-slate-100 dark:border-slate-800 uppercase tracking-widest text-slate-400">
                            <th className="pb-4 pr-4">User</th>
                            <th className="pb-4 pr-4">Issue</th>
                            <th className="pb-4 pr-4 text-center">Status</th>
                            <th className="pb-4 text-right">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                          {s.recentRequests.map((request) => (
                            <tr key={request.request_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="py-4 pr-4 text-slate-900 dark:text-white uppercase tracking-tight whitespace-nowrap">{request.user?.full_name || '--'}</td>
                              <td className="py-4 pr-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{request.issue_type?.replace(/_/g, ' ')}</td>
                              <td className="py-4 pr-4 text-center whitespace-nowrap">
                                <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                  {request.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-4 text-right text-slate-400 font-medium whitespace-nowrap">{new Date(request.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>

              {/* Sidebar: Profile & Controls */}
              <aside className="space-y-6">
                {/* Profile settings */}
                <section className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="text-lg font-black tracking-tight uppercase">Admin profile</h2>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Keep your contact details current</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 shadow-inner">
                      {profile?.role ? profile.role.replace(/_/g, ' ') : 'Admin'}
                    </span>
                  </div>

                  {profileLoading ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 text-center animate-pulse">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading profile...</span>
                    </div>
                  ) : (
                    <form className="grid gap-6" onSubmit={handleProfileSubmit} noValidate>
                      <div className="space-y-2">
                        <label htmlFor="dashboard_full_name" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Full Name<RequiredAsterisk /></label>
                        <input
                          id="dashboard_full_name"
                          ref={registerField('full_name')}
                          type="text"
                          value={profileForm.full_name}
                          onChange={handleProfileChange('full_name')}
                          className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-3.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
                          placeholder="Admin name"
                        />
                        {profileErrors.full_name && <p className="px-1 text-[9px] font-bold text-red-500 uppercase tracking-wider">{profileErrors.full_name}</p>}
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="dashboard_phone_number" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Phone number</label>
                        <input
                          id="dashboard_phone_number"
                          ref={registerField('phone_number')}
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={profileForm.phone_number}
                          onChange={handleProfileChange('phone_number')}
                          className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-3.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
                          placeholder="10-digit phone number"
                        />
                        {profileErrors.phone_number && <p className="px-1 text-[9px] font-bold text-red-500 uppercase tracking-wider">{profileErrors.phone_number}</p>}
                      </div>

                      <div className="grid gap-3 grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/50 shadow-inner border border-slate-200 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Joined</p>
                          <p className="text-xs font-black tracking-tight">{profileMeta.joined}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/50 shadow-inner border border-slate-200 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Account status</p>
                          <p className="text-xs font-black tracking-tight text-green-600 dark:text-green-500">VERIFIED</p>
                        </div>
                      </div>

                      {profileErrors.form && (
                        <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-[9px] font-bold text-red-600 uppercase tracking-widest dark:border-red-900/30 dark:bg-red-900/10">
                          {profileErrors.form}
                        </div>
                      )}
                      {profileSuccess && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-[9px] font-bold text-blue-600 uppercase tracking-widest dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-400">
                          {profileSuccess}
                        </div>
                      )}

                      <div className="flex flex-col gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isProfileSubmitDisabled}
                          className="w-full flex items-center justify-center gap-2 rounded-[20px] bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-40 transition-all active:scale-[0.98]"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {profileSaving ? 'Saving...' : 'Save profile'}
                        </button>
                        <Link
                          to="/admin/change-password"
                          className="w-full flex items-center justify-center gap-2 rounded-[20px] border-2 border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-transparent px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all shadow-sm"
                        >
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          Change password
                        </Link>
                      </div>
                    </form>
                  )}
                </section>

                {/* Admin navigation list */}
                <section className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-6 shadow-xl space-y-3">
                  <h2 className="px-2 pb-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">Admin sections</h2>
                  {[
                    ['/admin/users', 'Users', 'Open customer accounts and profile details'],
                    ['/admin/technicians', 'Technicians', 'Review technician accounts and approvals'],
                    ['/admin/vendors', 'Vendors', 'Manage vendor partners and supply accounts'],
                    ['/admin/warehouses', 'Warehouses', 'Check stock locations and availability'],
                    ['/admin/invoices', 'Invoices', 'Review billing records and payment status'],
                    ['/admin/orders', 'Orders', 'Track part orders and delivery progress'],
                    ['/admin/requests', 'Requests', 'See incoming customer requests'],
                    ['/admin/jobs', 'Jobs', 'Follow assigned and completed work'],
                    ['/admin/payouts', 'Payouts', 'Handle technician and vendor payouts'],
                    ['/admin/analytics', 'Analytics', 'Review platform performance and trends'],
                    ['/admin/audit-logs', 'Audit Logs', 'See important admin activity history'],
                    ['/admin/car-catalog', 'Car Catalog', 'Manage supported vehicle data'],
                  ].map(([to, label, description]) => (
                    <Link key={to} to={to} className="group flex items-center gap-4 p-4 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent transition-all hover:border-blue-500/30">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform">{label}</p>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{description}</p>
                      </div>
                    </Link>
                  ))}
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminDashboardPage
