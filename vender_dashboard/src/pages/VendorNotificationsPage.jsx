import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../lib/api'
import { useSocket } from '../lib/useSocket'

const TYPE_ICONS = {
  order_update: (
    <div className="flex-shrink-0 w-12 h-12 rounded-[18px] bg-blue-500/10 text-blue-500 flex items-center justify-center text-xl">📦</div>
  ),
  payment_received: (
    <div className="flex-shrink-0 w-12 h-12 rounded-[18px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl">💳</div>
  ),
  payment_failed: (
    <div className="flex-shrink-0 w-12 h-12 rounded-[18px] bg-red-500/10 text-red-500 flex items-center justify-center text-xl">⚠️</div>
  ),
  invoice_created: (
    <div className="flex-shrink-0 w-12 h-12 rounded-[18px] bg-purple-500/10 text-purple-500 flex items-center justify-center text-xl">🧾</div>
  ),
  message_received: (
    <div className="flex-shrink-0 w-12 h-12 rounded-[18px] bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-xl">💬</div>
  ),
  system: (
    <div className="flex-shrink-0 w-12 h-12 rounded-[18px] bg-slate-500/10 text-slate-500 flex items-center justify-center text-xl">🔔</div>
  ),
}

function relativeTime(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function linkFor(n) {
  const d = n.data || {}
  const orderId = d.orderId || d.order_id
  if (orderId) return `/orders/${orderId}`
  return null
}

export default function VendorNotificationsPage({ theme, onToggleTheme }) {
  const dark = theme === 'dark'
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const { on, off } = useSocket(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await getNotifications({ page: p, limit: 20 })
      setItems(res.notifications || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    load(1)
    const reload = () => { load(1).catch(() => {}) }

    on('notification:new', reload)
    on('notification:changed', reload)

    return () => {
      off('notification:new', reload)
      off('notification:changed', reload)
    }
  }, [load, off, on])

  const handleMarkRead = async (id, e) => {
    if (e) e.preventDefault();
    await markNotificationRead(id);
    setItems(i => i.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
  }

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems(i => i.map(n => ({ ...n, is_read: true })))
  }

  const handleDelete = async (id, e) => {
    if (e) e.preventDefault();
    await deleteNotification(id);
    setItems(i => i.filter(n => n.notification_id !== id));
    setTotal(t => t - 1)
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-hidden">
      {/* Background Ambient Blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[40%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between transition-all">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-xl font-black tracking-tighter uppercase">Alerts Hub</h1>
          </div>

          <div className="flex items-center gap-3">
            {items.some(n => !n.is_read) && (
              <button
                onClick={handleMarkAll}
                className="hidden sm:flex px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/10 text-[10px] font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
              >
                Mark All Read
              </button>
            )}
            <button
              onClick={onToggleTheme}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-400"
            >
              {dark ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        <main className="space-y-4 relative">
          {items.some(n => !n.is_read) && (
            <div className="sm:hidden mb-6 flex justify-end">
              <button
                onClick={handleMarkAll}
                className="px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/10 text-[10px] font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
              >
                Mark All Read
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-[24px] bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 h-24 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-32 rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-[#0B1120]/50 backdrop-blur-md shadow-xl flex flex-col items-center justify-center">
              <div className="w-24 h-24 mb-6 rounded-full bg-blue-500/5 flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-xl font-black uppercase tracking-widest text-slate-800 dark:text-white mb-2">No Notifications</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">You're all caught up on alerts.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map(n => {
                const href = linkFor(n)
                const isUnread = !n.is_read
                const W = href ? Link : 'div'

                return (
                  <div key={n.notification_id} className={`group relative rounded-[28px] border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isUnread ? 'bg-white dark:bg-[#0F172A] shadow-lg border-blue-500/30' : 'bg-white/50 dark:bg-[#0B1120]/50 border-slate-200 dark:border-slate-800 backdrop-blur-sm'}`}>
                    <W {...(href ? { to: href } : {})} className="flex flex-col sm:flex-row items-start gap-5">
                      {TYPE_ICONS[n.type] || TYPE_ICONS.system}

                      <div className="flex-1 min-w-0 w-full pt-1">
                        <div className="flex items-center gap-3 mb-1.5">
                          {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></span>}
                          <p className={`font-black text-[15px] uppercase tracking-wider ${isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {n.title}
                          </p>
                        </div>
                        <p className={`text-sm leading-relaxed ${isUnread ? 'text-slate-700 dark:text-slate-400 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
                          {n.message}
                        </p>
                        <p className={`text-[10px] uppercase font-bold tracking-widest mt-3 flex items-center gap-1.5 ${isUnread ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'}`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {relativeTime(n.created_at)}
                        </p>
                      </div>

                      <div className="flex sm:flex-col lg:flex-row items-center justify-end gap-2 mt-4 sm:mt-0 w-full sm:w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {isUnread && (
                          <button
                            onClick={(e) => handleMarkRead(n.notification_id, e)}
                            className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors tooltip"
                            title="Mark Read"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(n.notification_id, e)}
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors tooltip"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </W>
                  </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-10 pb-10">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-500 transition-all disabled:opacity-50 disabled:hover:text-inherit shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black tracking-widest uppercase shadow-sm">
                {page} <span className="text-slate-400">OF</span> {totalPages}
              </div>

              <button
                disabled={page >= totalPages}
                onClick={() => load(page + 1)}
                className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-500 transition-all disabled:opacity-50 disabled:hover:text-inherit shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
