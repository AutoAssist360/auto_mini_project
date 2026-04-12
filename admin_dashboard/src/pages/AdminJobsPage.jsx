import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getJobs } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import { formatLabel } from '../lib/displayText'

const STATUS_OPTS = ['', 'assigned', 'in_progress', 'completed', 'verified']

function AdminJobsPage() {
  const [jobs, setJobs]           = useState([])
  const [pagination, setPagination] = useState({})
  const [page, setPage]           = useState(1)
  const [status, setStatus]       = useState('')
  const [loading, setLoading]     = useState(true)

  const load = useCallback(() => {
    getJobs({ page, limit: 15, status: status || undefined })
      .then((r) => { setJobs(r.jobs || []); setPagination(r.pagination || {}) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [page, status])

  useEffect(() => { load() }, [load])

  const statusColor = (s) => {
    const m = { assigned: 'bg-amber-100 text-amber-800', in_progress: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800', verified: 'bg-blue-100 text-blue-800' }
    return m[s] || 'bg-slate-100 text-slate-700'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 text-center md:text-left">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Jobs</h1>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Follow work in progress and completed jobs</p>
          </div>
          <Link to="/admin/dashboard" className="px-6 py-3 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">
            ← Dashboard Hub
          </Link>
        </div>

        {/* glass filters */}
        <div className="mb-8 p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl flex items-center">
            <div className="relative w-full md:w-64">
              <select 
                value={status} 
                onChange={(e) => { setStatus(e.target.value); setPage(1) }} 
                className="w-full appearance-none rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none transition-all shadow-inner cursor-pointer"
              >
                {STATUS_OPTS.map((s) => <option key={s} value={s} className="bg-white dark:bg-[#0B1120]">{s ? formatLabel(s) : 'All job statuses'}</option>)}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
        </div>

        {/* main table section */}
        <div className="relative group rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-4 md:p-8 shadow-2xl transition-all duration-500">
          {loading ? <ListSkeleton /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold font-['Outfit'] min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-6 pr-4 whitespace-nowrap">Job ID</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Issue Type</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Technician</th>
                    <th className="pb-6 pr-4 text-center whitespace-nowrap">Status</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Invoice</th>
                    <th className="pb-6 text-right whitespace-nowrap">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  {jobs.map((j) => (
                    <tr key={j.job_id} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <Link to={`/admin/jobs/${j.job_id}`} className="group-hover/row:text-blue-600 transition-all">
                          <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">#{j.job_id.slice(0, 8)}</p>
                          <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-0.5">Job record</p>
                        </Link>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                          {formatLabel(j.request?.issue_type) || '--'}
                        </span>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <p className="text-slate-900 dark:text-slate-200 font-bold uppercase tracking-tight">{j.technician?.user?.full_name || '--'}</p>
                      </td>
                      <td className="py-6 pr-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColor(j.status)} shadow-sm`}>
                          <div className={`w-1 h-1 rounded-full ${j.status === 'completed' || j.status === 'verified' ? 'bg-green-500' : 'bg-current animate-pulse'}`}></div>
                          {formatLabel(j.status)}
                        </span>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        {j.invoice ? (
                           <div className="flex items-center gap-2">
                             <p className="text-sm font-black text-slate-900 dark:text-white">₹{Number(j.invoice.total).toLocaleString()}</p>
                             <span className="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-900 text-[7px] font-black uppercase border border-slate-200 dark:border-slate-800 text-slate-500">{formatLabel(j.invoice.payment_status)}</span>
                           </div>
                        ) : (
                          <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest leading-none">No invoice yet</p>
                        )}
                      </td>
                      <td className="py-6 text-right whitespace-nowrap">
                        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-1">{j.started_at ? new Date(j.started_at).toLocaleDateString() : 'PENDING'}</p>
                        <Link to={`/admin/jobs/${j.job_id}`} className="text-[9px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest hover:underline transition-all">
                          Trace Sequence →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-24 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-2xl tracking-tighter shadow-inner uppercase">! JOB</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No jobs match these filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination section */}
          <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-8 dark:border-slate-800/50 md:flex-row md:items-center md:justify-between flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600 text-center md:text-left">
              Page <span className="text-blue-600 dark:text-blue-400">{pagination.page || 1}</span> of <span className="text-slate-900 dark:text-white">{pagination.totalPages || 1}</span>
            </span>
            <div className="flex gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-6 py-3 rounded-full border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl dark:shadow-none"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminJobsPage
