import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getJobById, updateJobStatus } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import { formatLabel } from '../lib/displayText'

const ADMIN_TRANSITIONS = {
  assigned: ['cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified'],
}

function AdminJobDetailPage() {
  const { jobId } = useParams()
  const [job, setJob]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [reason, setReason]   = useState('')

  const loadJob = useCallback(() => {
    setLoading(true)
    getJobById(jobId).then((r) => setJob(r.job || r)).catch(() => null).finally(() => setLoading(false))
  }, [jobId])

  useEffect(() => { loadJob() }, [loadJob])

  const handleStatusChange = async (status) => {
    if (status === 'cancelled' && !reason.trim()) {
      setActionMsg('Please provide a reason for cancellation')
      return
    }
    setActing(true); setActionMsg('')
    try {
      const res = await updateJobStatus(jobId, status, reason.trim() || undefined)
      setActionMsg(res?.message || `Job ${status}!`)
      setReason('')
      loadJob()
    } catch (err) {
      setActionMsg(err?.message || 'Failed to update job status')
    } finally {
      setActing(false)
    }
  }

  if (loading) return <DetailSkeleton />
  if (!job) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Job not found</p></div>

  const statusColor = (s) => {
    const m = { assigned: 'bg-amber-100 text-amber-800', in_progress: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800', verified: 'bg-blue-100 text-blue-800' }
    return m[s] || 'bg-slate-100 text-slate-700'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'OPERATIONAL HUB', to: '/admin/jobs' }, { label: `JOB-${job.job_id.slice(0, 8)}`.toUpperCase() }]} />
        </div>

        {/* glass hero header */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-500/30 transform -rotate-3 hover:rotate-0 transition-transform">
                JOB
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400 mb-1 leading-none">Job details</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Task #{job.job_id.slice(0, 8)}</h1>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColor(job.status)} border shadow-sm`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' || job.status === 'verified' ? 'bg-green-500' : 'bg-current animate-pulse'}`}></div>
                    {formatLabel(job.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-2 leading-none text-right">Operational Status</p>
              <div className="inline-block px-6 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 text-slate-900 dark:text-white font-black text-lg shadow-inner uppercase tracking-widest">
                {job.status === 'verified' ? 'COMPLETED' : job.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* operational nodes grid */}
        <div className="grid gap-6 sm:grid-cols-2 mb-8">
          {/* technician node */}
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-blue-500/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Assigned Technician</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Technician</p>
              </div>
            </div>
            <div className="space-y-4">
               <div>
                  <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{job.technician?.user?.full_name || '--'}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{job.technician?.user?.email}</p>
               </div>
               <Link to={`/admin/technicians/${job.technician_id}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                 Trace Node Profile →
               </Link>
            </div>
          </div>

          {/* request node */}
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-indigo-500/50">
             <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Source Request</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Issue type</p>
              </div>
            </div>
            <div className="space-y-4">
                <div>
                   <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                     {formatLabel(job.request?.issue_type) || '--'} 
                   </p>
                   <p className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">User: {job.request?.user?.full_name || '--'}</p>
                </div>
                {job.request?.vehicle && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Target Vehicle</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {job.request.vehicle.registration_number}
                    </p>
                  </div>
                )}
                <Link to={`/admin/requests/${job.request_id}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                  Trace Request Log →
                </Link>
            </div>
          </div>
        </div>

        {/* accepted offer grid */}
        {job.offer && (
           <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 mb-6">Accepted Transaction Metadata</h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Repair Mode', formatLabel(job.offer.repair_mode)],
                    ['Est. Settlement', `₹${job.offer.estimated_cost}`],
                    ['Est. Duration', `${job.offer.estimated_time} MIN`],
                    ['Offer Status', formatLabel(job.offer.status)],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">{l}</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">{v}</p>
                    </div>
                  ))}
              </div>
              {job.offer.message && (
                <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 italic text-xs font-medium text-slate-500 quotes">
                  "{job.offer.message}"
                </div>
              )}
           </div>
        )}

        {/* timeline and actions */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start mb-8">
           <div className="space-y-6">
              {/* timeline panel */}
              <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-8">Timeline</h3>
                 <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                    <div className="relative pl-10">
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-4 ${job.started_at ? 'bg-blue-600 border-blue-500/30' : 'bg-slate-100 border-white dark:bg-slate-800 dark:border-slate-900'}`}></div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deployment Start</p>
                       <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{job.started_at ? new Date(job.started_at).toLocaleString().toUpperCase() : 'Not started yet'}</p>
                    </div>
                    <div className="relative pl-10">
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-4 ${job.completed_at ? 'bg-green-600 border-green-500/30' : 'bg-slate-100 border-white dark:bg-slate-800 dark:border-slate-900'}`}></div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service Completion</p>
                       <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{job.completed_at ? new Date(job.completed_at).toLocaleString().toUpperCase() : 'In progress'}</p>
                    </div>
                 </div>
              </div>

              {/* parts panel */}
              {job.request?.parts?.length > 0 && (
                <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6">Bill of Materials</h3>
                   <div className="grid gap-3">
                      {job.request.parts.map((p) => (
                        <div key={p.request_part_id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 group/part hover:border-blue-500/30 transition-all">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover/part:scale-110 transition-transform font-black">×</div>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{p.part?.part_name || `Part #${p.part_id}`}</p>
                           </div>
                           <p className="text-xs font-black text-blue-600 uppercase tracking-widest leading-none">QTY: {p.quantity}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
           </div>

           {/* admin actions panel */}
           <aside className="space-y-6">
              {ADMIN_TRANSITIONS[job.status] && (
                <div className="group relative overflow-hidden rounded-[40px] border-2 border-indigo-600/30 dark:border-indigo-500/20 bg-white dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-2xl">
                   <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Integrity Controls</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Admin action</p>
                      </div>
                   </div>

                   {actionMsg && (
                      <div className={`mb-6 p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${actionMsg.includes('!') || actionMsg.includes('Job') ? 'bg-blue-600 text-white border-blue-500' : 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-500/20'}`}>
                        {actionMsg}
                      </div>
                   )}

                   <div className="space-y-4">
                      {ADMIN_TRANSITIONS[job.status].includes('verified') && (
                        <button onClick={() => handleStatusChange('verified')} disabled={acting} className="w-full flex items-center justify-center gap-2 rounded-[20px] bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           {acting ? 'Saving...' : 'Verify job'}
                        </button>
                      )}
                      {ADMIN_TRANSITIONS[job.status].includes('completed') && (
                        <button onClick={() => handleStatusChange('completed')} disabled={acting} className="w-full flex items-center justify-center gap-2 rounded-[20px] bg-indigo-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50">
                           {acting ? 'Processing...' : 'Force close job'}
                        </button>
                      )}
                      {ADMIN_TRANSITIONS[job.status].includes('cancelled') && (
                        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Forensic Cancellation Reason</p>
                           <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-red-500 px-5 py-4 text-xs font-bold outline-none transition-all placeholder:text-slate-400 shadow-inner" placeholder="Enter a reason" />
                           <button onClick={() => handleStatusChange('cancelled')} disabled={acting || !reason.trim()} className="w-full rounded-[20px] bg-red-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all active:scale-[0.98] disabled:opacity-30">
                              Close job
                           </button>
                        </div>
                      )}
                   </div>
                </div>
              )}
           </aside>
        </div>

        {/* fiscal audit panel */}
        {job.invoice && (
          <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all mb-8">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM17 13v-3M7 13v-3M12 18v2m0-12V4" /></svg>
                   </div>
                   <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Payment summary</h2>
                </div>
                <Link to={`/admin/invoices/${job.invoice.invoice_id}`} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 italic text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                  Full Ledger Entry →
                </Link>
             </div>

             <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {[
                  ['Gross Subtotal', `₹${job.invoice.subtotal}`],
                  ['System Tax Prot.', `₹${job.invoice.tax}`],
                  ['Final Settlement', `₹${job.invoice.total}`],
                  ['Payment Status', formatLabel(job.invoice.payment_status)],
                ].map(([l, v]) => (
                  <div key={l} className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">{l}</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase truncate">{v}</p>
                  </div>
                ))}
             </div>

             {job.invoice.items?.length > 0 && (
               <div className="overflow-x-auto rounded-[20px] border border-slate-100 dark:border-slate-800">
                 <table className="w-full text-left text-[10px] font-bold min-w-[800px]">
                   <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                      <tr className="uppercase tracking-widest text-slate-400">
                        <th className="px-4 py-3 whitespace-nowrap">Classification</th>
                        <th className="px-4 py-3 whitespace-nowrap">Item Description</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">Qty Vol</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">Settlement (₹)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 uppercase">
                     {job.invoice.items.map((i) => (
                       <tr key={i.item_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                         <td className="px-4 py-3 text-slate-500 font-black whitespace-nowrap">{formatLabel(i.item_type)}</td>
                         <td className="px-4 py-3 text-slate-900 dark:text-white font-black whitespace-nowrap">{i.description}</td>
                         <td className="px-4 py-3 text-center text-slate-900 dark:text-white whitespace-nowrap">{i.quantity}</td>
                         <td className="px-4 py-3 text-right text-slate-900 dark:text-white whitespace-nowrap">₹{Number(i.total_price).toLocaleString()}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </section>
        )}

        <div className="mt-12 flex items-center justify-center">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400/60 transition-colors dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm">
            Operational Audit Index: {job.job_id.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminJobDetailPage
