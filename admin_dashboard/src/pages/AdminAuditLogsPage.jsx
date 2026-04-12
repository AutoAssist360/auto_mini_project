import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminDateInput from '../components/AdminDateInput'
import { getAuditLogs } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'

function AdminAuditLogsPage() {
  const [params, setParams] = useSearchParams()
  const page        = Number(params.get('page')) || 1
  const entityType  = params.get('entity_type') || ''
  const action      = params.get('action') || ''
  const performedBy = params.get('performed_by') || ''
  const from        = params.get('from') || ''
  const to          = params.get('to') || ''

  const [data, setData]       = useState({ logs: [], pagination: {} })
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const q = { page, limit: 20 }
    if (entityType) q.entity_type = entityType
    if (action) q.action = action
    if (performedBy) q.performed_by = performedBy
    if (from) q.from = from
    if (to) q.to = to
    getAuditLogs(q).then((r) => setData(r)).catch(() => null).finally(() => setLoading(false))
  }, [page, entityType, action, performedBy, from, to])

  useEffect(() => { load() }, [load])

  const set = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); p.delete('page'); setParams(p) }
  const goPage = (p) => { const sp = new URLSearchParams(params); sp.set('page', p); setParams(sp) }

  const { logs = [], pagination: pg = {} } = data

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 text-center md:text-left">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-[24px] bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-2xl font-black shadow-2xl">
               AUD
             </div>
             <div>
               <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Audit Logs</h1>
               <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] leading-none">Review important admin actions and account changes</p>
             </div>
          </div>
          <Link to="/admin/dashboard" className="px-6 py-3 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">
            ← Dashboard Hub
          </Link>
        </div>

        {/* glass filters */}
        <div className="mb-8 p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Filter logs</p>
           </div>
           
           <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-0 sm:min-w-[180px]">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Record type</label>
                <div className="relative">
                  <select 
                    value={entityType} 
                    onChange={(e) => set('entity_type', e.target.value)} 
                    className="w-full appearance-none rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none transition-all shadow-inner cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-[#0B1120]">All types</option>
                    <option value="user" className="bg-white dark:bg-[#0B1120]">User</option>
                    <option value="technician" className="bg-white dark:bg-[#0B1120]">Technician</option>
                    <option value="vendor" className="bg-white dark:bg-[#0B1120]">Vendor</option>
                    <option value="warehouse" className="bg-white dark:bg-[#0B1120]">Warehouse</option>
                    <option value="service_request" className="bg-white dark:bg-[#0B1120]">Request</option>
                    <option value="job" className="bg-white dark:bg-[#0B1120]">Job</option>
                    <option value="order" className="bg-white dark:bg-[#0B1120]">Order</option>
                    <option value="invoice" className="bg-white dark:bg-[#0B1120]">Invoice</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 sm:min-w-[180px]">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Action</label>
                <div className="relative">
                  <select 
                    value={action} 
                    onChange={(e) => set('action', e.target.value)} 
                    className="w-full appearance-none rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none transition-all shadow-inner cursor-pointer"
                  >
                    {['', 'create', 'update', 'delete', 'block', 'unblock', 'suspend', 'unsuspend', 'verify', 'refund', 'mark_paid', 'force_assign', 'cancel'].map(a => (
                       <option key={a} value={a} className="bg-white dark:bg-[#0B1120]">{a ? a.replace(/_/g, ' ').toUpperCase() : 'ALL ACTIONS'}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 sm:min-w-[220px]">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Admin ID</label>
                <input 
                  value={performedBy} 
                  onChange={(e) => set('performed_by', e.target.value)} 
                  placeholder="Enter admin ID" 
                  className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-emerald-500 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">From date</label>
                  <AdminDateInput value={from} onChange={(e) => set('from', e.target.value)} className="!w-48 rounded-2xl bg-slate-50 dark:bg-slate-900/50" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">To date</label>
                  <AdminDateInput value={to} onChange={(e) => set('to', e.target.value)} className="!w-48 rounded-2xl bg-slate-50 dark:bg-slate-900/50" />
                </div>
              </div>
           </div>
        </div>

        {/* main table section */}
        <div className="relative group rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-4 md:p-8 shadow-2xl transition-all duration-500">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-1.5 h-6 bg-slate-900 dark:bg-white rounded-full"></div>
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Activity list</h3>
          </div>

          {loading ? <ListSkeleton /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-bold uppercase tracking-tight min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-6 pr-4 whitespace-nowrap">Time</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Type</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Record ID</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Action</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Done by</th>
                    <th className="pb-6 text-right whitespace-nowrap">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/20 font-['Outfit']">
                  {logs.map((l) => (
                    <tr key={l.log_id} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <p className="text-slate-900 dark:text-white font-black">{new Date(l.created_at).toLocaleDateString()}</p>
                        <p className="text-[8px] text-slate-400 tracking-widest mt-1 font-['Inter'] font-black">{new Date(l.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[8px] font-black text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {l.entity_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <p className="text-slate-900 dark:text-slate-200 font-black tabular-nums font-mono text-[10px]">#{l.entity_id?.slice(0, 8)}</p>
                      </td>
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                           <div className={`w-1.5 h-1.5 rounded-full ${l.action === 'delete' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                           <p className="text-slate-900 dark:text-slate-200 font-black tracking-tight">{l.action?.replace(/_/g, ' ')}</p>
                        </div>
                      </td>
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <p className="text-slate-900 dark:text-slate-200 font-bold tracking-tight">{l.performer?.full_name || '--'}</p>
                        <p className="text-[8px] text-slate-400 tracking-widest mt-1 font-['Inter'] font-black">{l.performed_by?.slice(0, 8) || 'SYSTEM'}</p>
                      </td>
                      <td className="py-5 text-right font-['Inter'] whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                           {l.old_values && (
                             <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] font-black border border-red-500/20 cursor-help" title={JSON.stringify(l.old_values)}>OLD_VALUES</span>
                           )}
                           {l.new_values && (
                             <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black border border-emerald-500/20 cursor-help" title={JSON.stringify(l.new_values)}>NEW_VALUES</span>
                           )}
                           {!l.old_values && !l.new_values && <span className="text-[9px] text-slate-300 dark:text-slate-700 font-black tracking-widest italic">NO DETAILS</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-24 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-2xl tracking-tighter shadow-inner uppercase">! LOG</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No activity matches these filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination section */}
          {pg.totalPages > 1 && (
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
                Page <span className="text-blue-600 dark:text-blue-400">{page}</span> OF <span className="text-slate-900 dark:text-white">{pg.totalPages}</span>
              </span>
              <div className="flex gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  className="px-6 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pg.totalPages}
                  onClick={() => goPage(page + 1)}
                  className="px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 py-10 border-t border-slate-100 dark:border-slate-800/30">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 dark:text-slate-700">Audit logs</p>
          <div className="flex gap-4">
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
          </div>
        </div>
      </div>
    </div>
  )

}

export default AdminAuditLogsPage
