import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, getServiceRequests, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import { useSocket } from '../lib/useSocket'
import { formatLabel } from '../lib/displayText'

const VISIBLE_REQUEST_STATUSES = 'created,pending_offers,rejected,offer_accepted'

const STATUS_COLORS = {
  created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pending_offers: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  offer_accepted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function getAssignmentDeadlineMs(request) {
  if (request?.status !== 'offer_accepted' || request?.job?.status !== 'assigned') return null

  const expiresAt = request?.job?.assignment_expires_at
  const parsed = expiresAt ? Date.parse(expiresAt) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function formatCountdown(ms) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function UserRequestsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const limit = 10
  const { on, off } = useSocket(null)

  const loadRequests = useCallback(async (signal) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await getServiceRequests({ page, limit, status: VISIBLE_REQUEST_STATUSES })
      if (signal?.aborted) return
      setRequests(response?.requests || [])
      setTotal(response?.total || 0)
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof ApiError ? err.message : 'Unable to load requests.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    const abortController = new AbortController()
    loadRequests(abortController.signal)
    return () => abortController.abort()
  }, [loadRequests])

  useEffect(() => {
    if (!requests.some((request) => getAssignmentDeadlineMs(request) != null)) return undefined

    setNow(Date.now())
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [requests])

  useEffect(() => {
    const reload = () => { loadRequests().catch(() => null) }
    const handleVisibility = () => { if (document.visibilityState === 'visible') reload() }
    on('notification:new', reload)
    on('user:requests_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      off('notification:new', reload)
      off('user:requests_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadRequests, off, on])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Premium Floating Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6">
           <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div className="flex-1 min-w-[200px]">
                 <span className="text-[10px] md:text-xs font-black tracking-widest text-slate-400 uppercase">HELP REQUESTS</span>
                 <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">My Help Requests</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
             <button onClick={onToggleTheme} className="shrink-0 w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-slate-400">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={() => navigate('/dashboard')} className="whitespace-nowrap px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] md:text-xs font-black tracking-widest uppercase hover:border-blue-500 transition-all">
                DASHBOARD
             </button>
             <button onClick={handleLogout} className="whitespace-nowrap px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-xs font-black tracking-widest uppercase active:scale-95 transition-all shadow-lg">
                LOGOUT
             </button>
           </div>
        </header>

        {/* Filters & Action Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-md">
           <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300 w-full sm:w-auto text-center justify-center">
                 <span className="shrink-0 h-2 w-2 rounded-full bg-amber-500"></span>
                 <span>Open and recently closed requests</span>
              </div>
           </div>
           <Link to="/requests/new" className="whitespace-nowrap w-full sm:w-auto text-center px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
              ASK FOR HELP
           </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in">
            ⚠️ {error}
          </div>
        )}

        {/* Data Section */}
        <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 shadow-2xl overflow-hidden relative">
           {isLoading ? (
             <div className="p-10"><ListSkeleton rows={5} /></div>
           ) : requests.length === 0 ? (
             <div className="py-20 text-center">
                <div className="text-4xl mb-4 opacity-20">📂</div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No requests found</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium">When a technician accepts your request, it moves to My Jobs. Older unfinished requests may close automatically.</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50 whitespace-nowrap">
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">REQUEST ID</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">PROBLEM</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Status</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Technician Timer</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Offers</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">OPEN</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {requests.map((request) => {
                        const badgeColor = STATUS_COLORS[request.status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        const assignmentDeadlineMs = getAssignmentDeadlineMs(request)
                        const assignmentRemainingMs = assignmentDeadlineMs != null ? assignmentDeadlineMs - now : null
                        const assignmentExpired = assignmentRemainingMs != null && assignmentRemainingMs <= 0
                        return (
                          <tr key={request.request_id} className="group hover:bg-slate-50/50 dark:hover:bg-blue-500/5 transition-all whitespace-nowrap">
                             <td className="px-8 py-6">
                                <span className="text-[11px] font-black text-slate-900 dark:text-white font-mono opacity-80 group-hover:opacity-100 transition-all">#{request.request_id.slice(0, 8)}</span>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-tight">{formatLabel(request.issue_type)}</span>
                             </td>
                             <td className="px-8 py-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${badgeColor}`}>
                                   <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 mr-2"></span>
                                   {formatLabel(request.status)}
                                </span>
                             </td>
                             <td className="px-8 py-6">
                                {assignmentDeadlineMs == null ? (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Not waiting</span>
                                ) : assignmentExpired ? (
                                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-300">
                                    Action needed
                                  </span>
                                ) : (
                                  <div className="inline-flex flex-col rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Waiting</span>
                                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{formatCountdown(assignmentRemainingMs)}</span>
                                  </div>
                                )}
                             </td>
                             <td className="px-8 py-6 text-center">
                                <div className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-xl text-[10px] font-black ${request.offers?.length > 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                   {request.offers?.length || 0}
                                </div>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <Link to={`/requests/${request.request_id}`} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-all group/btn">
                                   VIEW
                                   <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </Link>
                             </td>
                          </tr>
                        )
                      })}
                   </tbody>
                </table>
             </div>
           )}

           {/* Modern Pagination Area */}
           <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-3 w-full md:w-auto">
                 <div className="shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                 <p className="whitespace-nowrap text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">
                    Showing <span className="text-slate-900 dark:text-white font-black">{requests.length}</span> of <span className="text-slate-900 dark:text-white font-black">{total}</span> requests
                 </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                 <button 
                   disabled={page <= 1} 
                   onClick={() => setPage((p) => p - 1)} 
                   className="whitespace-nowrap h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-widest disabled:opacity-20 hover:border-blue-500 transition-all"
                 >
                    PREV
                 </button>
                 <div className="whitespace-nowrap h-10 px-4 flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] md:text-xs font-black">
                    PAGE {page} / {totalPages}
                 </div>
                 <button 
                   disabled={page >= totalPages} 
                   onClick={() => setPage((p) => p + 1)} 
                   className="whitespace-nowrap h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-widest disabled:opacity-20 hover:border-blue-500 transition-all"
                 >
                    NEXT
                 </button>
              </div>
           </div>
        </section>
      </div>
    </div>
  )
}

export default UserRequestsPage
