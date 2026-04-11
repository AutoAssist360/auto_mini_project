import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJobs, ApiError } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import { useSocket } from '../lib/useSocket'
import { formatLabel } from '../lib/displayText'

const STATUS_CONFIG = {
  assigned: {
    label: 'Waiting to start',
    classes: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'In progress',
    classes: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
 completed: {
    label: 'Completed',
    classes: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  verified: {
    label: 'Verified',
    classes: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
}

const STATUS_OPTIONS = [
  { value: '', label: 'All jobs' },
  { value: 'assigned', label: 'Waiting' },
  { value: 'in_progress', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

function TechnicianJobsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { on, off } = useSocket(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getJobs(page, 20, statusFilter)
      setJobs(res?.jobs ?? [])
      setTotal(res?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { loadJobs() }, [loadJobs])

  useEffect(() => {
    const reload = () => { loadJobs().catch(() => null) }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload()
      }
    }
    on('notification:new', reload)
    on('technician:jobs_refresh', reload)
    on('technician:dashboard_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      off('notification:new', reload)
      off('technician:jobs_refresh', reload)
      off('technician:dashboard_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadJobs, off, on])

  const totalPages = Math.ceil(total / 20) || 1

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-24`}>
       {/* Background Blurs */}
       <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">My Jobs</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">{total} jobs found</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={loadJobs} disabled={loading} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
               <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
               {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        {/* Filter */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setStatusFilter(opt.value); setPage(1) }}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
                statusFilter === opt.value
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg scale-105'
                  : 'bg-white/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 text-center animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12"><ListSkeleton /></div>
        ) : jobs.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
             <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-4xl opacity-50 grayscale">📂</div>
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">No jobs found</h2>
             <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">No jobs match this filter yet. Try another status or check back soon.</p>
             <button onClick={() => { setStatusFilter(''); setPage(1) }} className="mt-8 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Clear filters</button>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              {jobs.map((job, idx) => {
                 const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.assigned
                 return (
                  <Link 
                    key={job.job_id} 
                    to={`/jobs/${job.job_id}`} 
                    className="group relative block rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 overflow-hidden"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-600/10 transition-colors"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                           <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest leading-none flex items-center gap-1.5 ${status.classes}`}>
                              <span className={`w-1 h-1 rounded-full ${status.dot}`}></span>
                              {status.label}
                           </span>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Job ref {job.job_id.slice(-8)}</span>
                        </div>
                        
                        <p className="text-base font-bold text-slate-800 dark:text-white leading-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {formatLabel(job.request?.issue_type)} — {job.request?.issue_description?.slice(0, 100)}
                        </p>
                        
                        <div className="flex flex-wrap gap-4 mt-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Service type</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{job.offer?.repair_mode === 'onsite' ? 'On-site visit' : 'Tow to workshop'}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estimate</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">₹{Number(job.offer?.estimated_cost ?? 0).toLocaleString()}</span>
                          </div>
                          {job.started_at && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Started</span>
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{new Date(job.started_at).toLocaleDateString()}</span>
                            </div>
                          )}
                          {job.invoice && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Payment</span>
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">{formatLabel(job.invoice.payment_status)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </Link>
                 )
              })}
            </section>

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page <= 1} 
                  className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-lg shadow-black/5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Page {page} of {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page >= totalPages} 
                  className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-lg shadow-black/5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TechnicianJobsPage
