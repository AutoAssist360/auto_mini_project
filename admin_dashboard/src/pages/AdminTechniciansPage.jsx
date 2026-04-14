import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getTechnicians, verifyTechnician, suspendTechnician, unsuspendTechnician } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'

function AdminTechniciansPage() {
  const [techs, setTechs]         = useState([])
  const [pagination, setPagination] = useState({})
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [verified, setVerified]   = useState('')
  const [online, setOnline]       = useState('')
  const [techType, setTechType]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(null)
  const [confirmSuspendId, setConfirmSuspendId] = useState(null)

  const load = useCallback(() => {
    getTechnicians({ page, limit: 20, search: search || undefined, is_verified: verified || undefined, is_online: online || undefined, technician_type: techType || undefined })
      .then((r) => { setTechs(r.technicians || []); setPagination(r.pagination || {}) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [page, search, verified, online, techType])

  useEffect(() => { load() }, [load])

  const act = async (fn, id) => { setBusy(id); try { await fn(id); load() } catch { /* */ } setBusy(null) }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Technicians</h1>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Manage technician accounts and approval status</p>
          </div>
          <Link to="/admin/dashboard" className="px-5 py-2.5 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">
            ← Dashboard
          </Link>
        </div>

        {/* glass filters */}
        <div className="mb-8 p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl flex flex-wrap gap-4 items-center flex-wrap">
          <div className="relative min-w-0 flex-grow sm:min-w-[280px]">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search technician identity / business…"
              className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 px-5 py-3.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
            />
          </div>
          <div className="flex flex-wrap gap-4 items-center flex-wrap">
            <select
              value={verified}
              onChange={(e) => { setVerified(e.target.value); setPage(1) }}
              className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            >
              <option value="">All verification statuses</option>
              <option value="true">Verified</option>
              <option value="false">Pending verification</option>
            </select>
            <select
              value={online}
              onChange={(e) => { setOnline(e.target.value); setPage(1) }}
              className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            >
              <option value="">All online statuses</option>
              <option value="true">Online</option>
              <option value="false">Offline</option>
            </select>
            <select
              value={techType}
              onChange={(e) => { setTechType(e.target.value); setPage(1) }}
              className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            >
              <option value="">All technician types</option>
              <option value="individual">Individual</option>
              <option value="garage">Garage</option>
            </select>
          </div>
        </div>

        {loading && <ListSkeleton />}

        {!loading && (
          <div className="relative group rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-4 md:p-8 shadow-2xl transition-all duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold font-['Outfit'] min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-6 pr-4 whitespace-nowrap">Technician</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Business</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Rating</th>
                    <th className="pb-6 pr-4 text-center whitespace-nowrap">Status</th>
                    <th className="pb-6 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  {techs.map((t) => (
                    <tr key={t.technician_id} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <Link to={`/admin/technicians/${t.technician_id}`} className="flex items-center gap-3 group">
                          <div className="w-12 h-12 rounded-[18px] bg-blue-600/10 flex items-center justify-center text-blue-600 text-sm font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner uppercase">
                            {t.user?.full_name[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">{t.user?.full_name || '--'}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{t.technician_type}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-6 pr-4 capitalize whitespace-nowrap">
                        <p className="text-slate-900 dark:text-slate-200 uppercase tracking-wider">{t.business_name || '--'}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-tighter mt-0.5">ID: {t.technician_id.slice(0, 12).toUpperCase()}...</p>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                           <div className="flex items-center gap-0.5 text-blue-600">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            <span className="text-[11px] font-black">{t.rating ?? '--'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">({t.total_reviews} feedback)</span>
                        </div>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <div className="flex items-center justify-center flex-wrap gap-2">
                          {t.is_verified ? (
                            <span className="inline-block px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-[9px] font-black uppercase tracking-widest border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">VERIFIED</span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 border border-transparent">PENDING</span>
                          )}
                          {t.is_online ? (
                            <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-500/20 animate-pulse-subtle">ONLINE</span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">OFFLINE</span>
                          )}
                          {!t.user?.is_active && (
                            <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-[9px] font-black uppercase tracking-widest text-white shadow-xl shadow-red-500/20">SUSPENDED</span>
                          )}
                        </div>
                      </td>
                      <td className="py-6 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                           {!t.is_verified && (
                             <button disabled={busy === t.technician_id} onClick={() => act(verifyTechnician, t.technician_id)} className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:scale-105 transition-all active:scale-95 disabled:opacity-50">Verify</button>
                           )}
                           {t.user?.is_active
                             ? <button disabled={busy === t.technician_id} onClick={() => setConfirmSuspendId(t.technician_id)} className="px-5 py-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-amber-600 hover:text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm">Suspend account</button>
                             : <button disabled={busy === t.technician_id} onClick={() => act(unsuspendTechnician, t.technician_id)} className="px-5 py-2.5 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm">Lift Suspension</button>
                           }
                        </div>
                      </td>
                    </tr>
                  ))}
                  {techs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                         <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-2xl tracking-tighter shadow-inner uppercase">! NODE</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No technicians match your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Segment */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
                Page <span className="text-blue-600 dark:text-blue-400">{pagination.page || 1}</span> of <span className="text-slate-900 dark:text-white">{pagination.totalPages || 1}</span> 
                <span className="mx-4 opacity-20">|</span> 
                Total technicians: <span className="text-slate-900 dark:text-white">{pagination.total || 0}</span>
              </span>
              <div className="flex gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-6 py-3 rounded-full border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Previous
                </button>
                <button
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-xl dark:shadow-none"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* glass suspend confirmation modal */}
        {confirmSuspendId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm transition-all duration-300">
             <div className="absolute inset-0 bg-slate-950/40" onClick={() => setConfirmSuspendId(null)}></div>
             <div className="relative group max-w-sm w-full rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white dark:bg-[#0B1120] p-10 shadow-2xl dark:shadow-blue-500/5 transition-all animate-in fade-in zoom-in duration-300">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-500/10 text-amber-500 mb-8 border border-amber-500/20 shadow-inner">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-center">Suspend technician</h2>
                <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-widest leading-loose">
                  Suspending this technician will stop active availability and pending offers for this account.
                </p>
                <div className="mt-10 flex flex-col gap-3">
                  <button 
                    disabled={busy === confirmSuspendId} 
                    onClick={() => { const id = confirmSuspendId; setConfirmSuspendId(null); act(suspendTechnician, id) }} 
                    className="w-full px-6 py-4 rounded-[20px] bg-amber-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    Confirm suspension
                  </button>
                  <button 
                    onClick={() => setConfirmSuspendId(null)} 
                    className="w-full px-6 py-4 rounded-[20px] border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTechniciansPage
