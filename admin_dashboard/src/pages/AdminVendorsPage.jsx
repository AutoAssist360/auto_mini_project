import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getVendors, verifyVendor, suspendVendor, unsuspendVendor } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'

function AdminVendorsPage() {
  const [vendors, setVendors]     = useState([])
  const [pagination, setPagination] = useState({})
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(null)

  const load = useCallback(() => {
    getVendors({ page, limit: 20, search: search || undefined, is_verified: verifiedFilter || undefined, is_active: activeFilter || undefined })
      .then((r) => { setVendors(r.vendors || []); setPagination(r.pagination || {}) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [page, search, verifiedFilter, activeFilter])

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
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Vendors</h1>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Manage supplier accounts and activity</p>
          </div>
          <Link to="/admin/dashboard" className="px-5 py-2.5 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">
            ← Dashboard
          </Link>
        </div>

        {/* glass filters */}
        <div className="mb-8 p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl flex flex-wrap gap-4 items-center flex-wrap">
          <div className="relative min-w-0 flex-grow sm:min-w-[300px]">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search vendor identity / network email…"
              className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 px-5 py-3.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
            />
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <select
              value={verifiedFilter}
              onChange={(e) => { setVerifiedFilter(e.target.value); setPage(1) }}
              className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            >
              <option value="">All verification statuses</option>
              <option value="true">Verified vendors</option>
              <option value="false">Pending verification</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
              className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-[9px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
            >
              <option value="">All account statuses</option>
              <option value="true">Active vendors</option>
              <option value="false">Suspended vendors</option>
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
                      <th className="pb-6 pr-4 whitespace-nowrap">Vendor</th>
                      <th className="pb-6 pr-4 whitespace-nowrap">Contact</th>
                      <th className="pb-6 pr-4 whitespace-nowrap">Overview</th>
                      <th className="pb-6 pr-4 text-center whitespace-nowrap">Account Status</th>
                      <th className="pb-6 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  {vendors.map((v) => (
                    <tr key={v.user_id} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <Link to={`/admin/vendors/${v.user_id}`} className="flex items-center gap-3 group">
                          <div className="w-12 h-12 rounded-[18px] bg-indigo-600/10 flex items-center justify-center text-indigo-600 text-sm font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner uppercase">
                            {v.full_name[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">{v.full_name}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Vendor account</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <p className="text-slate-900 dark:text-slate-200 font-mono tracking-tighter lowercase">{v.email}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{v.phone_number || 'No phone number'}</p>
                      </td>
                      <td className="py-6 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-6">
                           <div>
                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{v._count?.warehouses ?? '--'}</p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-widest">Warehouses</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400">{v._count?.orders ?? '--'}</p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-widest">Orders</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 pr-4 text-center whitespace-nowrap">
                        <div className="flex flex-wrap justify-center gap-2">
                          {v.is_verified ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                              Pending review
                            </span>
                          )}
                          {v.is_active ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-[9px] font-black uppercase tracking-widest border border-green-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-500/20">
                              Suspended
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-6 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          {!v.is_verified && (
                            <button disabled={busy === v.user_id} onClick={() => act(verifyVendor, v.user_id)} className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:scale-105 transition-all active:scale-95 disabled:opacity-50">Verify vendor</button>
                          )}
                          {v.is_active
                            ? <button disabled={busy === v.user_id} onClick={() => act(suspendVendor, v.user_id)} className="px-5 py-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-amber-600 hover:text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm">Suspend account</button>
                            : <button disabled={busy === v.user_id} onClick={() => act(unsuspendVendor, v.user_id)} className="px-5 py-2.5 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm">Restore account</button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                         <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-2xl tracking-tighter shadow-inner uppercase">! NODE</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No vendors match your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Segment */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
                Page <span className="text-indigo-600 dark:text-indigo-400">{pagination.page || 1}</span> of <span className="text-slate-900 dark:text-white">{pagination.totalPages || 1}</span> 
                <span className="mx-4 opacity-20">|</span> 
                Total vendors: <span className="text-slate-900 dark:text-white">{pagination.total || 0}</span>
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
      </div>
    </div>
  )
}

export default AdminVendorsPage
