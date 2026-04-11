import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getReservations, getReservationById, getWarehouses, ApiError } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'
import MobileNav from '../components/MobileNav'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/toastContext'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'converted', 'cancelled']

const statusBadge = (s) => {
  const map = {
    active: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    expired: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    converted: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    cancelled: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  }
  const cls = map[s] || 'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400'
  return `inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${cls} backdrop-blur-sm shadow-sm`
}

export default function VendorReservationsPage({ theme, onToggleTheme }) {
  const { warehouseId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  const [warehouses, setWarehouses] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouseId || '')
  const [reservations, setReservations] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // detail modal
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const limit = 20

  // fetch warehouses for dropdown
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getWarehouses(1, 100)
        setWarehouses(res.warehouses || [])
        if (!selectedWarehouse && res.warehouses?.length) {
          setSelectedWarehouse(res.warehouses[0].warehouse_id)
        }
      } catch {
        // ignore – warehouses already loaded elsewhere
      }
    }
    load()
  }, [selectedWarehouse])

  const loadReservations = useCallback(async () => {
    if (!selectedWarehouse) return
    setLoading(true)
    setError('')
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter
      const res = await getReservations(selectedWarehouse, page, limit, status)
      setReservations(res.reservations || [])
      setTotal(res.total || 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load reservations')
      toast.error('Failed to load reservations')
    } finally {
      setLoading(false)
    }
  }, [selectedWarehouse, page, statusFilter, toast])

  useEffect(() => { loadReservations() }, [loadReservations])

  const handleWarehouseChange = (e) => {
    setSelectedWarehouse(e.target.value)
    setPage(1)
  }

  const handleStatusChange = (s) => {
    setStatusFilter(s)
    setPage(1)
    setSearchParams(s === 'all' ? {} : { status: s })
  }

  const openDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await getReservationById(id)
      setDetail(res.reservation || res)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load reservation detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const inputClass = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0F172A]/70 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}
        <header className="mb-6 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <Link to="/warehouses" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200/50 dark:border-slate-700/50" title="Back to Locations">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
               </svg>
             </Link>
             <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center gap-2">
               <span className="text-blue-500 text-2xl">⏳</span> Held Stock
             </h1>
          </div>
          <MobileNav>
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95">
                Dashboard
              </Link>
              <button type="button" onClick={onToggleTheme} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95">
                {theme === 'dark' ? '☀ Light' : '☾ Dark'}
              </button>
            </div>
          </MobileNav>
        </header>

        <div className="mb-8 mt-6 ml-2">
          <Breadcrumbs items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Locations', to: '/warehouses' },
            { label: 'Held Stock' },
          ]} />
        </div>

        {/* FILTERS */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="w-full min-w-0 sm:w-auto sm:min-w-[280px]">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Choose location</label>
            <select value={selectedWarehouse} onChange={handleWarehouseChange} className={`${inputClass} w-full cursor-pointer shadow-lg shadow-blue-500/5`}>
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto rounded-[24px] border border-slate-200/50 bg-white/40 p-1.5 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/40 shadow-inner">
            {STATUS_OPTIONS.map((s) => (
              <button 
                key={s} 
                onClick={() => handleStatusChange(s)} 
                className={`rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  statusFilter === s 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95' 
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        {/* TABLE */}
        <main className="mt-4 relative z-10">
          {loading && (
            <div className="animate-pulse">
              <ListSkeleton />
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
               <span className="text-xl">❌</span> {error}
            </div>
          )}

          {!loading && !error && reservations.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-white/40 py-20 dark:border-slate-800/60 dark:bg-[#0B1120]/40">
              <span className="text-4xl mb-4">📭</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No held stock found for this location.</p>
            </div>
          )}

          {!loading && reservations.length > 0 && (
            <div className="overflow-x-auto rounded-[32px] border border-slate-200/60 bg-white/60 shadow-2xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 animate-in slide-in-from-bottom-4 duration-500">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/60">
                    <th className="px-6 py-5">Hold ID</th>
                    <th className="px-6 py-5 text-center">Qty</th>
                    <th className="px-6 py-5 text-center">Current Status</th>
                    <th className="px-6 py-5">Created / Expires</th>
                    <th className="px-6 py-5">Linked Order</th>
                    <th className="px-6 py-5 text-right w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {reservations.map((r) => (
                    <tr key={r.reservation_id} className="group hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="rounded-lg bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 inline-block font-mono text-[10px] text-slate-500 font-bold border border-slate-200/50 dark:border-slate-700/50">
                          {r.reservation_id.slice(0, 8)}…
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-800 dark:text-white">{r.quantity}</td>
                      <td className="px-6 py-4 text-center">
                        {statusBadge(r.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{new Date(r.reserved_at).toLocaleDateString()}</span>
                          <span className="text-[10px] text-slate-400">Expires: {new Date(r.expires_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {r.order_id ? (
                          <Link to={`/orders/${r.order_id}`} className="group/link flex items-center gap-1.5 text-blue-600 hover:text-blue-500 dark:text-blue-400 font-bold text-xs transition-colors">
                            <span className="rounded-md bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 border border-blue-100 dark:border-blue-800/50 font-mono">{r.order_id.slice(0, 8)}…</span>
                            <span className="opacity-0 group-hover/link:opacity-100 transition-opacity">↗</span>
                          </Link>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Unlinked</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openDetail(r.reservation_id)} 
                          className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition-all shadow-sm active:scale-95"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Page <span className="text-slate-900 dark:text-white">{page}</span> of {totalPages} · <span className="text-blue-500">{total}</span> held items
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page <= 1} 
                  onClick={() => setPage((p) => p - 1)} 
                  className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                >
                  ← Previous
                </button>
                <button 
                  disabled={page >= totalPages} 
                  onClick={() => setPage((p) => p + 1)} 
                  className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </main>

        {/* DETAIL MODAL */}
        {(detail || detailLoading) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => { setDetail(null) }}>
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity" />
            <div className="relative w-full max-w-lg overflow-hidden rounded-[40px] border border-white/20 bg-white/70 shadow-2xl backdrop-blur-2xl dark:bg-[#0B1120]/80 animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200/50 px-8 py-6 dark:border-slate-800/50">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Held Stock Details</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Current stock hold</p>
                </div>
                <button onClick={() => setDetail(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400">✕</button>
              </div>

              <div className="px-8 py-8">
                {detailLoading && (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Loading details…</p>
                  </div>
                )}
                
                {detail && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hold ID</label>
                        <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{detail.reservation_id}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
                        <div className="pt-1">{statusBadge(detail.status)}</div>
                      </div>
                    </div>

                    <div className="rounded-[24px] bg-slate-100/30 p-5 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantity held</label>
                          <p className="text-2xl font-black text-slate-900 dark:text-white">{detail.quantity} units</p>
                        </div>
                        {detail.order_id && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Order</label>
                            <Link to={`/orders/${detail.order_id}`} className="block text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"># {detail.order_id.slice(0, 8)}…</Link>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Created on</span>
                        <span className="font-bold">{new Date(detail.reserved_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Expires on</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{new Date(detail.expires_at).toLocaleString()}</span>
                      </div>
                      {detail.request_id && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Request ID</span>
                          <span className="font-bold text-indigo-500">SR#{detail.request_id.slice(0, 8)}</span>
                        </div>
                      )}
                    </div>

                    {detail.inventory && (
                      <div className="mt-6 border-t border-slate-200/50 pt-6 dark:border-slate-800/50">
                        <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-500">Part</label>
                        <div className="flex items-center gap-4">
                           <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-xl shadow-inner border border-blue-500/20">⚙️</div>
                           <div>
                             <p className="font-black text-slate-800 dark:text-white leading-tight">{detail.inventory?.catalog_part?.part_name || detail.inventory_id}</p>
                             <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Available: {detail.inventory.quantity_available} · Held: {detail.inventory.quantity_reserved}</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-50/50 px-8 py-6 dark:bg-slate-800/20 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-end">
                <button onClick={() => setDetail(null)} className="rounded-2xl bg-slate-900 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xl shadow-slate-900/10">Refresh and close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
