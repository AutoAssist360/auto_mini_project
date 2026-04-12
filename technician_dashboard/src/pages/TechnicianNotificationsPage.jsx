import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'
import { useSocket } from '../lib/useSocket'

const TYPE_ICONS = {
  offer_received: '📨', offer_accepted: '✅', offer_rejected: '❌',
  job_assigned: '🔧', job_started: '⚙️', job_completed: '🏁',
  invoice_created: '🧾', payment_received: '💳', message_received: '💬',
  location_update: '📍', system: '🔔',
}

function relativeTime(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min${m !== 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`
  const dCount = Math.floor(h / 24)
  return `${dCount} day${dCount !== 1 ? 's' : ''} ago`
}

function linkFor(n) {
  const d = n.data || {}
  const requestId = d.requestId || d.request_id
  const jobId = d.jobId || d.job_id

  if (n.type === 'message_received' && requestId) return `/messages/${requestId}`
  if (n.type === 'request_created') return '/discover'
  if (n.type === 'job_assigned') return '/assignments'
  if (jobId) return `/jobs/${jobId}`
  if (requestId) return '/assignments'
  return null
}

export default function TechnicianNotificationsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
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

  const handleMarkRead = async (id) => { 
    await markNotificationRead(id)
    setItems(i => i.map(n => n.notification_id === id ? { ...n, is_read: true } : n)) 
  }
  
  const handleMarkAll = async () => { 
    await markAllNotificationsRead()
    setItems(i => i.map(n => ({ ...n, is_read: true }))) 
  }
  
  const handleDelete = async (id) => { 
    await deleteNotification(id)
    setItems(i => i.filter(n => n.notification_id !== id))
    setTotal(t => t - 1) 
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className={`min-h-screen ${dark ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-24`}>
       {/* Background Blurs */}
       <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex flex-wrap gap-4 items-center justify-between transition-all sticky top-6 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none whitespace-nowrap">Activity Feed</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80 whitespace-nowrap">Notifications</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {items.some(n => !n.is_read) && (
              <button 
                onClick={handleMarkAll} 
                className="h-10 px-5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-600/20 whitespace-nowrap"
              >
                Mark all as read
              </button>
            )}
            <button onClick={onToggleTheme} className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-lg">
               {dark ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        <div className="mb-8 opacity-60 hover:opacity-100 transition-opacity">
           <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'System Updates' }]} />
        </div>

        <main className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-[24px] border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-white/5 h-24" />
            ))
          ) : items.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
               <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-4xl opacity-50 grayscale">🔔</div>
               <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">No Activity</h2>
               <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">You do not have any notifications right now. New updates will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map(n => {
                const href = linkFor(n)
                const W = href ? Link : 'div'
                return (
                  <div 
                    key={n.notification_id} 
                    className={`group relative rounded-[32px] border transition-all duration-300 overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.01] ${n.is_read ? 'border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl' : 'border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 backdrop-blur-2xl ring-1 ring-blue-500/20'}`}
                  >
                    {!n.is_read && <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>}
                    
                    <div className="p-6 flex items-start gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${n.is_read ? 'bg-slate-100 dark:bg-white/5' : 'bg-blue-600/10 text-blue-600'}`}>
                         {TYPE_ICONS[n.type] || '🔔'}
                      </div>
                      
                      <W {...(href ? { to: href } : {})} className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                           <h3 className={`text-sm font-bold tracking-tight uppercase break-words ${n.is_read ? 'text-slate-700 dark:text-slate-200' : 'text-blue-600 dark:text-blue-400'}`}>
                             {n.title.toUpperCase()}
                           </h3>
                           {!n.is_read && (
                             <span className="px-2 py-1 rounded-full bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest leading-none whitespace-nowrap shrink-0 mt-0.5">New Alert</span>
                           )}
                        </div>
                        <p className={`text-[11px] font-medium leading-relaxed max-w-2xl ${n.is_read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-100'}`}>
                          {n.message}
                        </p>
                        <div className="flex items-center mt-3">
                           <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">{relativeTime(n.created_at)}</span>
                        </div>
                      </W>

                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                        {!n.is_read && (
                          <button 
                            onClick={() => handleMarkRead(n.notification_id)} 
                            className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all border border-blue-600/20"
                            title="ACKNOWLEDGE"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(n.notification_id)} 
                          className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-600/20"
                          title="PURGE"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-4 pt-8">
              <button 
                disabled={page <= 1} 
                onClick={() => load(page - 1)} 
                className="h-12 px-8 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-40 whitespace-nowrap"
              >
                Previous
              </button>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page</span>
                 <span className="text-sm font-black text-slate-800 dark:text-white">{page} / {totalPages}</span>
              </div>
              <button 
                disabled={page >= totalPages} 
                onClick={() => load(page + 1)} 
                className="h-12 px-8 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-40 whitespace-nowrap"
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
