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
  request_created: '📋', offer_received: '📨', offer_accepted: '✅', offer_rejected: '❌',
  job_assigned: '🔧', job_started: '⚙️', job_completed: '🏁',
  invoice_created: '🧾', payment_received: '💳', payment_failed: '⚠️',
  message_received: '💬', location_update: '📍', order_update: '📦', system: '🔔',
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
  const requestId = d.requestId || d.request_id
  const jobId = d.jobId || d.job_id
  const invoiceId = d.invoiceId || d.invoice_id
  const orderId = d.orderId || d.order_id

  if (requestId) return `/admin/requests/${requestId}`
  if (jobId) return `/admin/jobs/${jobId}`
  if (invoiceId) return `/admin/invoices/${invoiceId}`
  if (orderId) return `/admin/orders/${orderId}`
  return null
}

export default function AdminNotificationsPage({ theme, onToggleTheme }) {
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
      off?.('notification:new', reload)
      off?.('notification:changed', reload)
    }
  }, [load, off, on])

  const handleMarkRead = async (id) => { await markNotificationRead(id); setItems(i => i.map(n => n.notification_id === id ? { ...n, is_read: true } : n)) }
  const handleMarkAll = async () => { await markAllNotificationsRead(); setItems(i => i.map(n => ({ ...n, is_read: true }))) }
  const handleDelete = async (id) => { await deleteNotification(id); setItems(i => i.filter(n => n.notification_id !== id)); setTotal(t => t - 1) }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <header className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/50 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between flex-wrap">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/admin/dashboard" className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all shadow-inner">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase leading-none">Notifications</h1>
              {total > 0 && <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{total} notifications</p>}
            </div>
          </div>
          <div className="flex items-center gap-4 self-end sm:self-auto">
            {items.some(n => !n.is_read) && (
              <button 
                onClick={handleMarkAll} 
                className="px-6 py-2.5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-blue-600/10 shadow-lg"
              >
                Mark all read
              </button>
            )}
            <button 
              onClick={onToggleTheme} 
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-blue-600/10 hover:text-blue-500 transition-all"
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-[32px] bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 h-24 shadow-sm" />
            ))
          ) : items.length === 0 ? (
            <div className="py-24 text-center rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/20 backdrop-blur-xl">
              <div className="mx-auto w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl mb-6 shadow-inner tracking-tighter opacity-50">🔔</div>
              <h3 className="text-sm font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No notifications yet</h3>
              <p className="mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Important updates will show up here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(n => {
                const href = linkFor(n)
                const W = href ? Link : 'div'
                return (
                  <div 
                    key={n.notification_id} 
                    className={`group relative rounded-[32px] border transition-all duration-500 p-8 ${
                      n.is_read 
                      ? 'bg-white/40 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 hover:bg-white/70 dark:hover:bg-slate-900/50' 
                      : 'bg-white/80 dark:bg-slate-800/60 border-blue-200 dark:border-blue-900/40 shadow-xl shadow-blue-500/5 scale-[1.01]'
                    } backdrop-blur-xl`}
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                         n.is_read ? 'bg-slate-100 dark:bg-slate-900' : 'bg-blue-600 text-white'
                       }`}>
                         {TYPE_ICONS[n.type] || '🔔'}
                       </div>
                       
                       <W {...(href ? { to: href } : {})} className="flex-1 min-w-0">
                         <div className="flex items-center gap-3 mb-2">
                           <p className="text-sm font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">{n.title}</p>
                           {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>}
                         </div>
                         <p className={`text-xs font-bold leading-relaxed mb-4 uppercase tracking-wide ${n.is_read ? 'text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                           {n.message}
                         </p>
                         <div className="flex items-center gap-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                               {relativeTime(n.created_at)}
                            </p>
                            {href && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 group-hover:underline">Open details</span>
                            )}
                         </div>
                       </W>

                       <div className="flex gap-2 self-end sm:self-auto">
                          {!n.is_read && (
                            <button 
                              onClick={() => handleMarkRead(n.notification_id)} 
                              className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              title="Mark Read"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(n.notification_id)} 
                            className="w-10 h-10 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            title="Delete notification"
                          >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="pt-10 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50 mt-10">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Page {page} <span className="text-slate-200 dark:text-slate-800 select-none mx-2">/</span> {totalPages}</p>
              <div className="flex gap-4">
                <button 
                   disabled={page <= 1} 
                   onClick={() => load(page - 1)} 
                   className="px-8 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-900 transition-all disabled:opacity-30"
                >
                  Previous
                </button>
                <button 
                   disabled={page >= totalPages} 
                   onClick={() => load(page + 1)} 
                   className="px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-20 flex flex-col items-center justify-center gap-4 py-16 border-t border-slate-100 dark:border-slate-800/30">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300 dark:text-slate-700">Notifications</p>
          <div className="flex gap-4 mt-4">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-600/30"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-blue-600/30"></div>
          </div>
        </div>
      </main>
    </div>
  )
}
