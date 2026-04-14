import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  userLogout
} from '../lib/api'
import { emitNotificationUnreadSync } from '../lib/notificationEvents'
import { clearAuth } from '../store/authSlice'
import MobileNav from '../components/MobileNav'
import { useSocket } from '../lib/useSocket'

const TYPE_CONFIG = {
  request_created: { icon: '📋', color: 'blue' },
  offer_received: { icon: '📨', color: 'indigo' },
  offer_accepted: { icon: '✅', color: 'emerald' },
  offer_rejected: { icon: '❌', color: 'red' },
  job_assigned: { icon: '🔧', color: 'blue' },
  job_started: { icon: '⚙️', color: 'amber' },
  job_completed: { icon: '🏁', color: 'emerald' },
  invoice_created: { icon: '🧾', color: 'emerald' },
  payment_received: { icon: '💳', color: 'emerald' },
  payment_failed: { icon: '⚠️', color: 'red' },
  message_received: { icon: '💬', color: 'blue' },
  location_update: { icon: '📍', color: 'slate' },
  order_update: { icon: '📦', color: 'amber' },
  system: { icon: '🔔', color: 'slate' },
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

function linkFor(n) {
  const d = n.data || {}
  const requestId = d.requestId || d.request_id
  const jobId = d.jobId || d.job_id
  const invoiceId = d.invoiceId || d.invoice_id
  const orderId = d.orderId || d.order_id

  if (n.type === 'message_received' && requestId) return `/requests/${requestId}/messages`
  if (jobId) return `/jobs/${jobId}`
  if (requestId) return `/requests/${requestId}`
  if (invoiceId) return `/invoices/${invoiceId}`
  if (orderId) return `/orders/${orderId}`
  return null
}

export default function UserNotificationsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const { on, off } = useSocket(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await getNotifications({ page: p, limit: 20 })
      setItems(res.notifications || [])
      setTotal(res.total || 0)
      setUnreadCount(res.unreadCount || 0)
      setPage(p)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    const loadInitialId = window.setTimeout(() => {
      load(1).catch(() => {})
    }, 0)
    const reload = () => { load(1).catch(() => {}) }

    on('notification:new', reload)
    on('notification:changed', reload)

    return () => {
      window.clearTimeout(loadInitialId)
      off?.('notification:new', reload)
      off?.('notification:changed', reload)
    }
  }, [load, off, on])

  const handleMarkRead = async (id) => {
    const target = items.find((n) => n.notification_id === id)
    if (!target || target.is_read) return

    await markNotificationRead(id)
    setItems((prev) => prev.map((n) => n.notification_id === id ? { ...n, is_read: true } : n))
    setUnreadCount((current) => Math.max(0, current - 1))
    emitNotificationUnreadSync({ unreadDelta: -1 })
  }

  const handleMarkAll = async () => {
    if (unreadCount <= 0) return

    await markAllNotificationsRead()
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    emitNotificationUnreadSync({ unreadCount: 0 })
  }

  const handleDelete = async (id) => {
    const target = items.find((n) => n.notification_id === id)
    await deleteNotification(id)
    setItems((prev) => prev.filter((n) => n.notification_id !== id))
    setTotal((current) => Math.max(0, current - 1))
    if (target && !target.is_read) {
      setUnreadCount((current) => Math.max(0, current - 1))
      emitNotificationUnreadSync({ unreadDelta: -1 })
    }
  }

  const handleOpenNotification = async (event, notification, href) => {
    if (!href || notification.is_read) return

    event.preventDefault()

    try {
      await handleMarkRead(notification.notification_id)
    } catch {
      // Navigate anyway so the user can still open the related page.
    }

    navigate(href)
  }

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500">
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[5%] -left-[5%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[130px] rounded-full"></div>
        <div className="absolute bottom-[5%] -right-[5%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[130px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Sticky Header */}
        <header className="sticky top-4 z-40 mb-8 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl flex flex-wrap items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <button onClick={() => navigate('/dashboard')} className="group w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-500/50 transition-all shadow-sm">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
             </button>
             <div>
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Activity Feed</span>
                <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mt-0.5">Notifications</h1>
             </div>
          </div>
          
          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
             <MobileNav>
                <div className="flex items-center justify-start gap-2 sm:pr-2 sm:border-r border-slate-200 dark:border-slate-800 sm:mr-2">
                   <button onClick={onToggleTheme} className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs transition-all">{theme === 'dark' ? '🌞' : '🌙'}</button>
                </div>
                {items.some((n) => !n.is_read) && (
                  <button onClick={handleMarkAll} className="whitespace-nowrap w-full sm:w-auto px-4 py-2 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all text-left sm:text-center">
                    Mark All Read
                  </button>
                )}
                <button onClick={handleLogout} className="whitespace-nowrap w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg sm:ml-1 text-left sm:text-center">
                   LOGOUT
                </button>
             </MobileNav>
          </div>
        </header>

        <main className="space-y-4">
          <div className="flex items-center justify-between px-4 mb-2">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest updates</span>
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{total} notifications</span>
          </div>

          {loading ? (
            <div className="space-y-4">
               {Array.from({ length: 5 }).map((_, i) => (
                 <div key={i} className="animate-pulse rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0B1120]/50 h-24" />
               ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-24 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-[#0F172A] flex items-center justify-center text-4xl mb-6 shadow-xl shadow-slate-200/50 dark:shadow-none transition-transform hover:scale-110">📭</div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No notifications yet</p>
              <p className="text-sm font-medium text-slate-400 mt-2">You do not have any updates right now.</p>
              <button onClick={() => navigate('/dashboard')} className="mt-8 px-8 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">Back to dashboard</button>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {items.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                const href = linkFor(n)
                const Wrapper = href ? Link : 'div'
                return (
                  <article
                    key={n.notification_id}
                    className={`group relative rounded-[32px] border transition-all duration-300 overflow-hidden ${
                      n.is_read
                        ? 'bg-white/40 dark:bg-[#0B1120]/30 border-slate-200 dark:border-slate-800'
                        : 'bg-white dark:bg-[#0F172A] border-blue-500/30 dark:border-blue-400/40 shadow-xl shadow-blue-500/5'
                    }`}
                  >
                    {!n.is_read && <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>}
                    
                    <div className="p-5 sm:p-6 flex items-start gap-4 sm:gap-6">
                      <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl border transition-colors ${
                        n.is_read 
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50' 
                        : 'bg-blue-600/10 dark:bg-blue-400/10 border-blue-500/30 dark:border-blue-400/30 scale-105 shadow-inner'
                      }`}>
                        {config.icon}
                      </div>

                      <Wrapper
                        {...(href ? { to: href } : {})}
                        onClick={(event) => handleOpenNotification(event, n, href)}
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`text-[9px] font-black uppercase tracking-widest ${n.is_read ? 'text-slate-400' : 'text-blue-600 dark:text-blue-400'}`}>
                             {n.type?.replace(/_/g, ' ')}
                           </span>
                           <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{relativeTime(n.created_at)}</span>
                        </div>
                        <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight leading-none mb-1.5 ${n.is_read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                           {n.title}
                        </h3>
                        <p className={`text-[12px] sm:text-sm font-medium leading-relaxed line-clamp-2 ${n.is_read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
                           {n.message}
                        </p>
                      </Wrapper>

                      <div className="flex flex-col sm:flex-row items-center gap-1.5 self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                        {!n.is_read && (
                          <button 
                            onClick={(e) => { e.preventDefault(); handleMarkRead(n.notification_id) }} 
                            className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all active:scale-95" 
                            title="Mark as Read"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                        <button 
                           onClick={(e) => { e.preventDefault(); handleDelete(n.notification_id) }} 
                           className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95" 
                           title="Dismiss"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-4 pt-8">
              <button 
                disabled={page <= 1} 
                onClick={() => load(page - 1)}
                className="whitespace-nowrap h-10 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:border-blue-500 transition-all flex items-center gap-2 bg-white dark:bg-[#0B1120]"
              >
                <svg className="shrink-0 w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Prev
              </button>
              <div className="whitespace-nowrap h-10 px-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-xs font-black uppercase flex items-center tracking-tighter shadow-lg">
                PAGE {page} / {totalPages}
              </div>
              <button 
                 disabled={page >= totalPages} 
                 onClick={() => load(page + 1)}
                 className="whitespace-nowrap h-10 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:border-blue-500 transition-all flex items-center gap-2 bg-white dark:bg-[#0B1120]"
              >
                Next
                <svg className="shrink-0 w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
