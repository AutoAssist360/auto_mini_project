import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { getJobs, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import { useSocket } from '../lib/useSocket'
import { formatLabel } from '../lib/displayText'

const STATUS_COLORS = {
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  verified: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

function Badge({ status }) {
  const color = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{formatLabel(status)}</span>
}

function UserJobsPage({ theme, onToggleTheme }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 10
  const { on, off } = useSocket(null)

  const loadJobs = useCallback(async (signal) => {
    setLoading(true)
    try {
      const data = await getJobs({ page, limit })
      if (signal?.aborted) return
      setJobs(data.jobs || [])
      setTotal(data.total || 0)
      setError('')
    } catch (err) {
      if (!signal?.aborted) setError(err.message || 'Failed to load jobs')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [page])

  useEffect(() => {
    const abortController = new AbortController()
    loadJobs(abortController.signal)
    return () => abortController.abort()
  }, [loadJobs])

  useEffect(() => {
    const reload = () => { loadJobs().catch(() => null) }
    const handleVisibility = () => { if (document.visibilityState === 'visible') reload() }
    on('notification:new', reload)
    on('user:jobs_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      off('notification:new', reload)
      off('user:jobs_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadJobs, off, on])

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
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                 <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">REPAIRS</span>
                 <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">My Repair Jobs</h1>
              </div>
           </div>

           <div className="flex items-center gap-3">
             <button onClick={onToggleTheme} className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black tracking-widest uppercase hover:border-blue-500 transition-all">
                DASHBOARD
             </button>
             <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black tracking-widest uppercase shadow-lg">
                LOGOUT
             </button>
           </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in">
            ⚠️ {error}
          </div>
        )}

        {/* Content Section */}
        <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 shadow-2xl overflow-hidden relative min-h-[400px]">
          {loading && (
            <div className="p-10 space-y-4 animate-pulse">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full"></div>
               ))}
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="py-24 text-center">
               <div className="text-5xl mb-6 opacity-20">🛠️</div>
               <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">No jobs yet</h2>
               <p className="text-xs text-slate-500 mt-2 font-medium max-w-xs mx-auto leading-loose">A request appears here after a technician accepts it.</p>
               <button onClick={() => navigate('/requests')} className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                  CHECK REQUESTS
               </button>
            </div>
          )}

          {!loading && !error && jobs.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">JOB ID</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">PROBLEM</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">STATUS</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">TECHNICIAN</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ESTIMATE</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">INVOICE</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {jobs.map((j) => {
                       const badgeColor = STATUS_COLORS[j.status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                       return (
                        <tr key={j.job_id} className="group hover:bg-indigo-500/5 transition-all">
                          <td className="px-8 py-6 font-mono text-[11px] font-black text-slate-900 dark:text-white opacity-80">#{j.job_id.slice(0, 8)}</td>
                          <td className="px-8 py-6 text-xs font-black uppercase text-slate-700 dark:text-slate-200">{formatLabel(j.request?.issue_type) || 'General'}</td>
                          <td className="px-8 py-6">
                             <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${badgeColor}`}>
                                {formatLabel(j.status)}
                             </span>
                          </td>
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase">{j.technician?.user?.full_name?.[0]}</div>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{j.technician?.user?.full_name || 'Assigned'}</span>
                             </div>
                          </td>
                          <td className="px-8 py-6 text-xs font-black text-slate-900 dark:text-white">{j.offer?.estimated_cost != null ? `₹${j.offer.estimated_cost}` : '—'}</td>
                          <td className="px-8 py-6">
                            {j.invoice ? (
                              <button onClick={() => navigate(`/invoices/${j.invoice.invoice_id}`)} className="group/inv flex flex-col items-start translate-y-1">
                                <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 tracking-tighter">₹{j.invoice.total}</span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover/inv:text-blue-500 transition-all uppercase tracking-tighter">{formatLabel(j.invoice.payment_status)}</span>
                              </button>
                            ) : (
                               <span className="text-[10px] font-bold text-slate-300 uppercase italic">PENDING</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => navigate(`/jobs/${j.job_id}`)} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-all group/btn">
                               VIEW JOB
                               <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                          </td>
                        </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Jobs shown: <span className="text-slate-900 dark:text-white font-black">{jobs.length}</span>
                    </p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:border-indigo-500 transition-all">PREV</button>
                    <div className="h-10 px-4 flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black">PAGE {page} / {totalPages}</div>
                    <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:border-indigo-500 transition-all">NEXT</button>
                 </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default UserJobsPage
