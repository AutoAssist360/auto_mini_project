import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPendingAssignments, acceptAssignment, rejectAssignment, ApiError } from '../lib/api'
import { useSocket } from '../lib/useSocket'
import { ListSkeleton } from '../components/Skeleton'
import { formatLabel } from '../lib/displayText'

const ISSUE_LABELS = {
  mechanical_failure: 'Mechanical Failure',
  electrical_issue: 'Electrical Issue',
  tire_related: 'Tire Related',
  battery_issue: 'Battery Issue',
  engine_problem: 'Engine Problem',
  brake_issue: 'Brake Issue',
  other: 'Other',
}

function getAssignmentDeadlineMs(assignment) {
  const expiresAt = assignment?.assignment_expires_at
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

function TechnicianAssignmentsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [acting, setActing] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const { on, off } = useSocket(null)

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPendingAssignments()
      setAssignments(res?.assignments ?? [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  useEffect(() => {
    if (!assignments.some((assignment) => getAssignmentDeadlineMs(assignment) != null)) return undefined

    setNow(Date.now())
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [assignments])

  useEffect(() => {
    const reload = () => { loadAssignments().catch(() => null) }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload()
      }
    }
    on('notification:new', reload)
    on('technician:assignments_refresh', reload)
    on('technician:dashboard_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      off('notification:new', reload)
      off('technician:assignments_refresh', reload)
      off('technician:dashboard_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadAssignments, off, on])

  const handleAccept = async (jobId) => {
    setActing(jobId)
    setActionMsg('')
    try {
      const response = await acceptAssignment(jobId)
      setActionMsg('Assignment accepted! Opening job...')
      await loadAssignments()
      navigate(`/jobs/${response?.job?.job_id || jobId}`)
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to accept')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (jobId) => {
    if (!confirm('Are you sure you want to reject this assignment?')) return
    setActing(jobId)
    setActionMsg('')
    try {
      await rejectAssignment(jobId)
      setActionMsg('Assignment rejected')
      await loadAssignments()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to reject')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-24`}>
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-[32px] sm:rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex flex-wrap gap-4 items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Assignments</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">{assignments.length} active assignments</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={loadAssignments} disabled={loading} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
               <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
               {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        {actionMsg && (
          <div className={`mb-8 rounded-2xl border px-6 py-4 text-xs font-black uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-4 ${actionMsg.includes('accepted') || actionMsg.includes('rejected') ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'}`}>
            {actionMsg}
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 text-center animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12"><ListSkeleton /></div>
        ) : assignments.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
             <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-4xl opacity-50 grayscale">📌</div>
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">No assignments right now</h2>
             <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">You are all caught up. We will notify you as soon as a new assignment is available.</p>
             <button onClick={() => navigate('/dashboard')} className="mt-8 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Back to dashboard</button>
          </div>
        ) : (
          <section className="space-y-6">
            {assignments.map((a, idx) => {
              const assignmentDeadlineMs = getAssignmentDeadlineMs(a)
              const assignmentRemainingMs = assignmentDeadlineMs != null ? assignmentDeadlineMs - now : null
              const assignmentExpired = assignmentRemainingMs != null && assignmentRemainingMs <= 0

              return (
              <div 
                key={a.job_id} 
                className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-8 overflow-hidden"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-600/10 transition-colors"></div>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className="px-3 py-1 rounded-full bg-blue-600 text-[9px] font-black uppercase tracking-widest text-white">New assignment</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID: {a.job_id.slice(-8)}</span>
                      {assignmentDeadlineMs != null && (
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${assignmentExpired ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'}`}>
                          {assignmentExpired ? 'Expired' : `Accept within ${formatCountdown(assignmentRemainingMs)}`}
                        </span>
                      )}
                    </div>

                    <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2">Issue details</h3>
                    <p className="text-lg font-bold text-slate-800 dark:text-white leading-tight mb-2">
                       {ISSUE_LABELS[a.request?.issue_type] || a.request?.issue_type}
                    </p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 max-w-2xl">
                       {a.request?.issue_description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Location type</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{formatLabel(a.request?.service_location_type)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estimated earnings</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">₹{Number(a.offer?.estimated_cost ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Service type</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{formatLabel(a.offer?.repair_mode)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ETA</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{a.offer?.estimated_time} MIN</span>
                      </div>
                      {a.request?.breakdown_latitude && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">GPS coordinates</span>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{a.request.breakdown_latitude.toFixed(4)}, {a.request.breakdown_longitude?.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:min-w-[180px] lg:flex-col">
                    <button 
                      type="button" 
                      onClick={() => handleAccept(a.job_id)} 
                      disabled={acting === a.job_id || assignmentExpired} 
                      className="group/btn relative h-14 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden flex items-center justify-center disabled:opacity-60"
                    >
                       <span className="relative z-10 flex items-center gap-2">
                         {acting === a.job_id ? (
                           <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         ) : assignmentExpired ? 'Expired' : 'Open job'}
                       </span>
                       <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleReject(a.job_id)} 
                      disabled={acting === a.job_id} 
                      className="h-14 rounded-2xl border border-slate-200 dark:border-slate-800 bg-transparent text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/10 transition-all flex items-center justify-center disabled:opacity-60"
                    >
                      Reject assignment
                    </button>
                  </div>
                </div>
              </div>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}

export default TechnicianAssignmentsPage
