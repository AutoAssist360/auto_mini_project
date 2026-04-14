import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getWarehouses } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'

function AdminWarehousesPage() {
  const [params, setParams] = useSearchParams()
  const page   = Number(params.get('page')) || 1
  const search = params.get('search') || ''
  const city   = params.get('city') || ''
  const state  = params.get('state') || ''

  const [data, setData]       = useState({ warehouses: [], pagination: {} })
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const q = { page, limit: 20 }
    if (search) q.search = search
    if (city) q.city = city
    if (state) q.state = state
    getWarehouses(q).then((r) => setData(r)).catch(() => null).finally(() => setLoading(false))
  }, [page, search, city, state])

  useEffect(() => { load() }, [load])

  const set = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); p.delete('page'); setParams(p) }
  const goPage = (p) => { const sp = new URLSearchParams(params); sp.set('page', p); setParams(sp) }

  const { warehouses = [], pagination: pg = {} } = data

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
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Warehouses</h1>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">View stock locations and warehouse status</p>
          </div>
          <Link to="/admin/dashboard" className="px-6 py-3 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">
            ← Dashboard Hub
          </Link>
        </div>

        {/* glass filters */}
        <div className="mb-8 p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl flex flex-wrap gap-4 items-center flex-wrap">
          <div className="relative min-w-0 flex-grow sm:min-w-[280px]">
            <input
              value={search}
              onChange={(e) => set('search', e.target.value)}
              placeholder="Search terminal ID / location…"
              className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 px-6 py-4 text-xs font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center w-full md:w-auto flex-wrap">
            <input
              value={city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Filter City"
              className="flex-grow md:w-40 rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-4 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            />
            <input
              value={state}
              onChange={(e) => set('state', e.target.value)}
              placeholder="Filter State"
              className="flex-grow md:w-40 rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-4 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {/* main inventory table section */}
        <div className="relative group rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-4 md:p-8 shadow-2xl transition-all duration-500">
          {loading ? <ListSkeleton /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold font-['Outfit'] min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-6 pr-4 whitespace-nowrap">Warehouse</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Location</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Vendor</th>
                    <th className="pb-6 pr-4 text-center whitespace-nowrap">Status</th>
                    <th className="pb-6 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  {warehouses.map((w) => (
                    <tr key={w.warehouse_id} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 text-xs font-black shadow-inner">
                            {w.name[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">{w.name}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">UID: {w.warehouse_id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <p className="text-slate-900 dark:text-slate-200 uppercase tracking-wider">{w.city || '--'}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{w.state || '--'}</p>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-indigo-600/10 flex items-center justify-center text-[10px] text-indigo-600">
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          </div>
                          <p className="text-slate-900 dark:text-slate-300 font-bold uppercase">{w.vendor?.user?.full_name || '--'}</p>
                        </div>
                      </td>
                      <td className="py-6 pr-4 text-center whitespace-nowrap">
                        {w.is_active ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-[9px] font-black uppercase tracking-widest border border-green-500/20">
                            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div> Functional
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-500/20">
                            Maintenance
                          </span>
                        )}
                      </td>
                      <td className="py-6 text-right whitespace-nowrap">
                        <Link to={`/admin/warehouses/${w.warehouse_id}`} className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md dark:shadow-none">
                          View warehouse
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {warehouses.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-24 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-2xl tracking-tighter shadow-inner uppercase">! TERM</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No warehouses match your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination section */}
          {pg.totalPages > 1 && (
            <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-8 dark:border-slate-800/50 md:flex-row md:items-center md:justify-between flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600 text-center md:text-left">
                Page <span className="text-blue-600 dark:text-blue-400">{page}</span> of <span className="text-slate-900 dark:text-white">{pg.totalPages}</span>
              </span>
              <div className="flex gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  className="px-6 py-3 rounded-full border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pg.totalPages}
                  onClick={() => goPage(page + 1)}
                  className="px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl dark:shadow-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminWarehousesPage
