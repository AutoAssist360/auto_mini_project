import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { getWarehouseById, getWarehouseInventory } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'

function AdminWarehouseDetailPage() {
  const { warehouseId } = useParams()
  const [params, setParams] = useSearchParams()
  const invPage = Number(params.get('page')) || 1

  const [wh, setWh]           = useState(null)
  const [inv, setInv]         = useState({ inventory: [], pagination: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWarehouseById(warehouseId).then((r) => setWh(r.warehouse || r)).catch(() => null).finally(() => setLoading(false))
  }, [warehouseId])

  const loadInv = useCallback(() => {
    getWarehouseInventory(warehouseId, { page: invPage, limit: 20 }).then((r) => setInv(r)).catch(() => null)
  }, [warehouseId, invPage])
  useEffect(loadInv, [loadInv])

  const goPage = (p) => { const sp = new URLSearchParams(params); sp.set('page', p); setParams(sp) }

  if (loading) return <DetailSkeleton />
  if (!wh) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Warehouse not found</p></div>

  const { inventory = [], pagination: pg = {} } = inv

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'SUPPLY TERMINALS', to: '/admin/warehouses' }, { label: wh.name.toUpperCase() }]} />
        </div>

        {/* glass hero header */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-blue-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-transform">
                {wh.name[0]}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400 mb-1 leading-none">Warehouse details</p>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">{wh.name}</h1>
                <p className="mt-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-5 gap-y-2 uppercase tracking-widest leading-none">
                  <span className="flex items-center gap-2 max-w-md"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {[wh.address_line, wh.city, wh.state, wh.zip_code].filter(Boolean).join(', ')}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
               <span className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${wh.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 border border-green-500/20' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border border-red-500/20'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wh.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                {wh.is_active ? 'Active warehouse' : 'Offline'}
              </span>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1 opacity-60">Established {new Date(wh.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* property info grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
           {[
            ['Communication Phone', wh.phone || '--'],
            ['Warehouse email', wh.email || '--'],
            ['Operating Cycle', wh.operating_hours || '--'],
            ['Operational Zone', wh.country || 'Global'],
          ].map(([l, v]) => (
            <div key={l} className="group p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl transition-all hover:-translate-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-blue-500 transition-colors mb-3">{l}</p>
              <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">{v}</p>
            </div>
          ))}
        </div>

        {/* vendor authority */}
        {wh.vendor?.user?.full_name && (
          <Link to={`/admin/vendors/${wh.vendor_id}`} className="block group mb-8 p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl hover:border-indigo-500/50 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 text-lg font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                  {wh.vendor.user.full_name[0]}
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 dark:text-indigo-400 mb-0.5 leading-none">Vendor account</p>
                   <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">{wh.vendor.user.full_name}</p>
                </div>
              </div>
              <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-all">View Branch Profile →</div>
            </div>
          </Link>
        )}

        {/* inventory ledger section */}
        <section className="relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Active Asset Ledger</h2>
            </div>
             {inventory.length > 0 && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">{pg.total || inventory.length} REGISTERED ASSETS</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-bold min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="pb-4 pr-3 whitespace-nowrap">Part</th>
                  <th className="pb-4 pr-3 whitespace-nowrap">Category Classification</th>
                  <th className="pb-4 pr-3 text-center whitespace-nowrap">Stock</th>
                  <th className="pb-4 pr-3 text-center whitespace-nowrap">Safety Reserve</th>
                  <th className="pb-4 text-right whitespace-nowrap">Unit Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {inventory.map((i) => (
                  <tr key={i.inventory_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="py-5 pr-3 whitespace-nowrap">
                      <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">{i.part?.part_name || '--'}</p>
                      <p className="text-[8px] text-slate-400 opacity-60 uppercase tracking-widest mt-0.5">REF: {i.inventory_id.slice(0, 8)}</p>
                    </td>
                    <td className="py-5 pr-3 whitespace-nowrap">
                       <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                        {i.part?.category?.category_name?.replace(/_/g, ' ') || 'UNSPECIFIED'}
                      </span>
                    </td>
                    <td className="py-5 pr-3 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-[13px] font-black ${i.quantity_available < 10 ? 'text-amber-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                          {i.quantity_available ?? '--'}
                        </span>
                        <span className="text-[7px] text-slate-400 uppercase tracking-tighter">Available Nodes</span>
                      </div>
                    </td>
                    <td className="py-5 pr-3 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                         <span className="text-[11px] font-bold text-slate-500 dark:text-slate-500">{i.quantity_reserved ?? '0'}</span>
                         <span className="text-[7px] text-slate-400 uppercase tracking-tighter">Locked Ops</span>
                      </div>
                    </td>
                    <td className="py-5 text-right font-black text-blue-600 dark:text-blue-400 text-sm whitespace-nowrap">
                      ₹{Number(i.unit_cost).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {inventory.length === 0 && (
                   <tr>
                    <td colSpan="5" className="py-24 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-xl tracking-tighter uppercase">! ASSET</div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No inventory found for this warehouse</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination section */}
          {pg.totalPages > 1 && (
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
                Segment <span className="text-blue-600 dark:text-blue-400">{invPage}</span> of <span className="text-slate-900 dark:text-white">{pg.totalPages}</span>
              </span>
              <div className="flex gap-3">
                <button
                  disabled={invPage <= 1}
                  onClick={() => goPage(invPage - 1)}
                  className="px-6 py-3 rounded-full border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
                >
                  Prev Seq
                </button>
                <button
                  disabled={invPage >= pg.totalPages}
                  onClick={() => goPage(invPage + 1)}
                  className="px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl dark:shadow-none"
                >
                  Next Seq
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="mt-12 flex items-center justify-center">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400/60 transition-colors dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm">
            Terminal Protocol Sync Index: {wh.warehouse_id.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminWarehouseDetailPage
