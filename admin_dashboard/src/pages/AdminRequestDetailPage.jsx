import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRequestById, cancelRequest, forceAssignTechnician } from '../lib/api'
import RequestStepper from '../components/RequestStepper'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { formatLabel } from '../lib/displayText'

function AdminRequestDetailPage() {
  const { requestId } = useParams()
  const [req, setReq]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  // force-assign form
  const [showAssign, setShowAssign] = useState(false)
  const [assignForm, setAssignForm] = useState({ technician_id: '', repair_mode: 'onsite', estimated_cost: '', estimated_time: '' })

  const load = useCallback(() => {
    getRequestById(requestId).then((r) => setReq(r.request || r)).catch(() => null).finally(() => setLoading(false))
  }, [requestId])
  useEffect(() => { load() }, [load])

  const handleCancel = async () => {
    if (!confirm('Force-cancel this request?')) return
    setBusy(true); setErr('')
    try { await cancelRequest(requestId); load() } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleAssign = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await forceAssignTechnician(requestId, {
        technician_id: assignForm.technician_id,
        repair_mode: assignForm.repair_mode,
        estimated_cost: Number(assignForm.estimated_cost),
        estimated_time: Number(assignForm.estimated_time),
      })
      setShowAssign(false)
      load()
    } catch (ex) { setErr(ex.message) }
    setBusy(false)
  }

  if (loading) return <DetailSkeleton />
  if (!req) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Request not found</p></div>

  const canCancel = ['created', 'pending_offers', 'offer_accepted', 'in_progress'].includes(req.status)
  const canAssign = ['created', 'pending_offers'].includes(req.status)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'INCIDENT COMMAND', to: '/admin/requests' }, { label: `REQ-${req.request_id.slice(0, 8)}`.toUpperCase() }]} />
        </div>

        {err && (
          <div className="mb-6 p-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 border border-red-500 animate-pulse">
            {err}
          </div>
        )}

        <div className="mb-8 overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-[#0B1120]/40 backdrop-blur-xl p-2 shadow-2xl">
          <RequestStepper status={req.status} jobStatus={req.job?.status || null} />
        </div>

        {/* incident hero */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-indigo-500/30 transform -rotate-3 hover:rotate-0 transition-transform font-['Outfit']">
                REQ
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 dark:text-indigo-400 mb-1 leading-none">Request details</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Request #{req.request_id.slice(0, 8)}</h1>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    {formatLabel(req.status)}
                  </span>
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-500/20`}>
                    Type: {formatLabel(req.issue_type)}
                  </span>
                  {req.requires_towing && (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20">
                      Towing required
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {canCancel && (
                <button 
                  disabled={busy} 
                  onClick={handleCancel} 
                  className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {busy ? 'SYNCHRONIZING...' : 'Force Cancel'}
                </button>
              )}
              {canAssign && (
                <button 
                  onClick={() => setShowAssign(!showAssign)} 
                  className={`px-6 py-3 rounded-2xl ${showAssign ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'} text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95`}
                >
                  {showAssign ? 'Clear assignment' : 'Assign technician'}
                </button>
              )}
            </div>
          </div>
          <div className="mt-8 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 italic">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter']">"{req.issue_description}"</p>
          </div>
        </div>

        {/* force-assign terminal */}
        {showAssign && (
          <form onSubmit={handleAssign} className="group relative overflow-hidden rounded-[40px] border-2 border-indigo-600/30 dark:border-indigo-500/20 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-2xl mb-8 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Administrative Override</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-none">Manual technician assignment</p>
              </div>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Technician ID<RequiredAsterisk /></label>
                <input required value={assignForm.technician_id} onChange={(e) => setAssignForm((p) => ({ ...p, technician_id: e.target.value }))} className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 px-6 py-4 text-xs font-bold outline-none transition-all shadow-inner" placeholder="Enter technician ID" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Repair Mode</label>
                <select value={assignForm.repair_mode} onChange={(e) => setAssignForm((p) => ({ ...p, repair_mode: e.target.value }))} className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none transition-all shadow-inner cursor-pointer appearance-none">
                  <option value="onsite" className="bg-white dark:bg-[#0B1120]">On-site visit</option>
                  <option value="tow_to_garage" className="bg-white dark:bg-[#0B1120]">Tow to workshop</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Est settlement (₹)<RequiredAsterisk /></label>
                <input required type="number" min="0" step="0.01" value={assignForm.estimated_cost} onChange={(e) => setAssignForm((p) => ({ ...p, estimated_cost: e.target.value }))} className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 px-6 py-4 text-xs font-bold outline-none transition-all shadow-inner" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Est Deployment Time (Min)<RequiredAsterisk /></label>
                <input required type="number" min="1" value={assignForm.estimated_time} onChange={(e) => setAssignForm((p) => ({ ...p, estimated_time: e.target.value }))} className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 px-6 py-4 text-xs font-bold outline-none transition-all shadow-inner" placeholder="60" />
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button type="submit" disabled={busy} className="px-10 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95">
                {busy ? 'DEPLOYING...' : 'Authorize Forced Assignment'}
              </button>
            </div>
          </form>
        )}

        {/* entity nodes grid */}
        <div className="grid gap-6 sm:grid-cols-2 mb-8 font-['Outfit']">
          {/* user node */}
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-blue-500/50">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 leading-none">Customer</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-xl border border-blue-500/20 shadow-inner">
                {req.user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{req.user?.full_name || '--'}</p>
                <p className="text-xs font-bold text-slate-500 mt-2 tracking-wide font-['Inter']">{req.user?.email}</p>
              </div>
            </div>
          </div>

          {/* vehicle node */}
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-amber-500/50 font-['Outfit']">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 leading-none">Vehicle</h3>
            <div>
              <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none tabular-nums">{req.vehicle?.registration_number || '--'}</p>
              <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">
                {req.vehicle?.variant?.variant_name ? `${req.vehicle.variant.model?.company?.company_name} ${req.vehicle.variant.model?.model_name}` : 'UNDEFINED_VARIANT'}
              </p>
              <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest italic">{req.vehicle?.variant?.variant_name || 'GENERIC_SPEC'}</p>
            </div>
          </div>
        </div>

        {/* sections grid */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8 font-['Outfit']">
          {/* parts section */}
          {req.parts?.length > 0 && (
            <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 leading-none">Parts needed</h2>
              <div className="space-y-4">
                {req.parts.map((p) => (
                  <div key={p.request_part_id} className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{p.part?.part_name || `PART_NODE_${p.part_id}`}</p>
                      <p className="text-[8px] text-slate-400 uppercase tracking-[0.2em] mt-1 font-['Inter'] font-black">INV_SPEC_IDX</p>
                    </div>
                    <span className="px-4 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black border border-slate-200 dark:border-slate-700 shadow-sm">
                      × {p.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* media section */}
          {req.media?.length > 0 && (
            <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 leading-none">Forensic Evidence Ledger ({req.media.length})</h2>
              <div className="grid grid-cols-2 gap-3">
                {req.media.map((m) => (
                  <a key={m.media_id} href={m.media_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent hover:border-blue-500 hover:bg-blue-500/5 transition-all group/media">
                    <span className="text-[9px] font-black uppercase text-slate-500 group-hover/media:text-blue-500 transition-colors">{m.media_type}</span>
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* bidding terminal */}
        {req.offers?.length > 0 && (
          <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all mb-8 font-['Outfit']">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-xs font-black">#</div>
              Technician offers ({req.offers.length})
            </h2>
            <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-[11px] font-bold uppercase tracking-tight">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Technician</th>
                    <th className="px-6 py-4">Deployment</th>
                    <th className="px-6 py-4 text-right">Settlement (₹)</th>
                    <th className="px-6 py-4 text-center">Cycle Time</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {req.offers.map((o) => (
                    <tr key={o.offer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group/row">
                      <td className="px-6 py-6 font-['Outfit']">
                        <Link to={`/admin/technicians/${o.technician_id}`} className="text-slate-900 dark:text-white font-black hover:text-blue-500 transition-colors uppercase">
                          {o.technician?.user?.full_name || o.technician_id.slice(0, 8)}
                        </Link>
                        <p className="text-[8px] text-slate-400 tracking-widest mt-1 font-['Inter'] font-black">TECH_NODE_IDX</p>
                      </td>
                      <td className="px-6 py-6 text-slate-500 font-black">{formatLabel(o.repair_mode)}</td>
                      <td className="px-6 py-6 text-right text-slate-900 dark:text-white font-black">₹{Number(o.estimated_cost).toLocaleString()}</td>
                      <td className="px-6 py-6 text-center text-slate-500 font-black tabular-nums">{o.estimated_time} MIN</td>
                      <td className="px-6 py-6 text-right">
                        <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800 text-[8px] font-black uppercase tracking-widest">
                          {formatLabel(o.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* job & messages grid */}
        <div className="grid gap-6 lg:grid-cols-2 items-start mb-8 font-['Outfit']">
          {/* job status */}
          {req.job && (
            <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 leading-none">Active Deployment Metrics</h2>
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Status</span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">{formatLabel(req.job.status)}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Technician</span>
                  <Link to={`/admin/technicians/${req.job.technician_id}`} className="text-xs font-black text-slate-900 dark:text-white hover:text-blue-500 transition-all uppercase tracking-tight">
                    {req.job.technician?.user?.full_name || '--'}
                  </Link>
                </div>
                <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Timestamp</span>
                  <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {req.job.started_at ? new Date(req.job.started_at).toLocaleString().toUpperCase() : 'PENDING'}
                  </span>
                </div>
                <Link to={`/admin/jobs/${req.job.job_id}`} className="mt-4 inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all">
                  Inspect Detailed Job Ledger →
                </Link>
              </div>
            </section>
          )}

          {/* messages feed */}
          {req.messages?.length > 0 && (
            <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 leading-none">Messages</h2>
              <div className="max-h-[400px] overflow-y-auto pr-4 space-y-4 font-['Inter']">
                {req.messages.map((m) => (
                  <div key={m.message_id} className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{m.sender?.full_name || 'Unknown user'}</span>
                       <span className="text-[9px] font-bold text-slate-400 tabular-nums uppercase">{new Date(m.sent_at).toLocaleTimeString().toUpperCase()}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">"{m.message}"</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm leading-none">
            Incident Hash: {req.request_id}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Registry Sequence Initiated: {new Date(req.created_at).toLocaleString().toUpperCase()}</p>
        </div>
      </div>
    </div>
  )

}

export default AdminRequestDetailPage
