import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getVendorById, verifyVendor, suspendVendor, unsuspendVendor, getVendorWarehouses } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'

function AdminVendorDetailPage() {
  const { vendorId } = useParams()
  const [vendor, setVendor]     = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [whPag, setWhPag]       = useState({})
  const [whPage, setWhPage]     = useState(1)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)

  const load = useCallback(() => {
    getVendorById(vendorId).then((r) => setVendor(r.vendor || r)).catch(() => null).finally(() => setLoading(false))
  }, [vendorId])
  useEffect(() => { load() }, [load])

  const loadWh = useCallback(() => {
    getVendorWarehouses(vendorId, { page: whPage, limit: 10 }).then((r) => { setWarehouses(r.warehouses || []); setWhPag(r.pagination || {}) }).catch(() => null)
  }, [vendorId, whPage])
  useEffect(() => { loadWh() }, [loadWh])

  const act = async (fn) => { setBusy(true); try { await fn(vendorId); load() } catch { /* */ } setBusy(false) }

  if (loading) return <DetailSkeleton />
  if (!vendor) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Vendor not found</p></div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'VENDOR NETWORK', to: '/admin/vendors' }, { label: vendor.full_name.toUpperCase() }]} />
        </div>

        {/* glass hero header */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-indigo-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-indigo-500/30 transform rotate-3 hover:rotate-0 transition-transform">
                {vendor.full_name[0]}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 dark:text-indigo-400 mb-1 leading-none">Vendor details</p>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">{vendor.full_name}</h1>
                <p className="mt-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-5 gap-y-2 uppercase tracking-widest leading-none">
                  <span className="flex items-center gap-2 font-mono lowercase tracking-normal"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {vendor.email}</span>
                  <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {vendor.phone_number || 'NO SECURE LINE'}</span>
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {vendor.is_verified ? (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Verified vendor
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-500/20 shadow-sm">
                      Pending review
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${vendor.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 border border-green-500/20' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border border-red-500/20'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${vendor.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    {vendor.is_active ? 'Active account' : 'Suspended account'}
                  </span>
                  <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">ESTB. {new Date(vendor.created_at).getFullYear()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {!vendor.is_verified && (
                <button disabled={busy} onClick={() => act(verifyVendor)} className="w-full md:w-52 px-6 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">Verify vendor</button>
              )}
              {vendor.is_active
                ? <button disabled={busy} onClick={() => act(suspendVendor)} className="w-full md:w-52 px-6 py-4 rounded-2xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50">Lock Account</button>
                : <button disabled={busy} onClick={() => act(unsuspendVendor)} className="w-full md:w-52 px-6 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">Restore account</button>
              }
            </div>
          </div>
        </div>

        {/* metric cards */}
        <div className="grid gap-6 sm:grid-cols-2 mb-8">
           <div className="group p-8 rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl transition-all hover:scale-[1.02] hover:-translate-y-1 flex flex-col justify-between min-h-[140px]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-indigo-500 transition-colors mb-4 text-center sm:text-left">Distribution Points</p>
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">{vendor._count?.warehouses ?? vendor.warehouses?.length ?? '--'}</p>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Warehouses</span>
                </div>
              </div>
              <div className="mt-6 h-1 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.4)]" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div className="group p-8 rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl transition-all hover:scale-[1.02] hover:-translate-y-1 flex flex-col justify-between min-h-[140px]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-blue-500 transition-colors mb-4 text-center sm:text-left">Operational Flow</p>
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">{vendor._count?.orders ?? '--'}</p>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders Processed</span>
                </div>
              </div>
              <div className="mt-6 h-1 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ width: '45%' }}></div>
              </div>
            </div>
        </div>

        {/* warehouse ledger */}
        <section className="relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Active warehouses</h2>
            </div>
             {warehouses.length > 0 && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">{whPag.total || warehouses.length} LISTED NODES</span>
            )}
          </div>

          {warehouses.length === 0 ? (
            <div className="py-20 text-center">
               <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-xl tracking-tighter uppercase">! WH</div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No active distribution centers registered to this node</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-bold min-w-[800px]">
                  <thead>
                    <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="pb-4 pr-3 text-center w-12 whitespace-nowrap">#</th>
                      <th className="pb-4 pr-3 whitespace-nowrap">Warehouse</th>
                      <th className="pb-4 pr-3 whitespace-nowrap">Locale Intelligence</th>
                      <th className="pb-4 pr-3 whitespace-nowrap">Status</th>
                      <th className="pb-4 text-right whitespace-nowrap">Inventory Vol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {warehouses.map((w, idx) => (
                      <tr key={w.warehouse_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="py-5 pr-3 text-center text-slate-400 font-black whitespace-nowrap">{(whPage - 1) * 10 + idx + 1}</td>
                        <td className="py-5 pr-3 whitespace-nowrap">
                          <Link to={`/admin/warehouses/${w.warehouse_id}`} className="group-hover:text-indigo-600 transition-colors uppercase tracking-tight font-black block">
                            {w.name}
                            <p className="text-[8px] text-slate-400 opacity-60 uppercase tracking-widest mt-0.5">UID: {w.warehouse_id.slice(0, 8)}</p>
                          </Link>
                        </td>
                        <td className="py-5 pr-3 whitespace-nowrap">
                          <p className="text-slate-900 dark:text-white uppercase tracking-wider">{w.city}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest">{w.state}</p>
                        </td>
                        <td className="py-5 pr-3 whitespace-nowrap">
                          {w.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-green-600 uppercase tracking-widest text-[10px]">
                              <div className="w-1 h-1 rounded-full bg-green-500"></div> Functional
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-red-500 uppercase tracking-widest text-[10px]">
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="py-5 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm whitespace-nowrap">
                          {w._count?.inventories ?? '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registry Page {whPag.page || 1} / {whPag.totalPages || 1}</span>
                <div className="flex gap-2">
                  <button disabled={whPage <= 1} onClick={() => setWhPage((p) => p - 1)} className="px-5 py-2 rounded-full border border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-30">Prev</button>
                  <button disabled={whPage >= (whPag.totalPages || 1)} onClick={() => setWhPage((p) => p + 1)} className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30">Next</button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="mt-12 flex items-center justify-center">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400/60 transition-colors dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm">
            Operational Registry Sync Index: {new Date(vendor.created_at).toLocaleString().toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminVendorDetailPage
