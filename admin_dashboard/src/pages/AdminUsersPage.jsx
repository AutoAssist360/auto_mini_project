import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getUsers, blockUser, unblockUser, deleteUser } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'

function AdminUsersPage() {
  const [users, setUsers]         = useState([])
  const [pagination, setPagination] = useState({})
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(null)

  const load = useCallback(() => {
    getUsers({ page, limit: 20, search: search || undefined, role: roleFilter || undefined, is_active: activeFilter || undefined })
      .then((r) => { setUsers(r.users || []); setPagination(r.pagination || {}) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [page, search, roleFilter, activeFilter])

  useEffect(() => { load() }, [load])

  const act = async (fn, userId) => {
    setBusy(userId)
    try { await fn(userId); load() } catch { /* */ }
    setBusy(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Users</h1>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">View and manage customer accounts</p>
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
              placeholder="Search identity / credentials…"
              className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 px-5 py-3.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-xs font-black uppercase tracking-widest outline-none transition-all shadow-inner"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="technician">Technician</option>
            <option value="vendor">Vendor</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
            className="rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-5 py-3.5 text-xs font-black uppercase tracking-widest outline-none transition-all shadow-inner"
          >
            <option value="">All account statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Blocked Only</option>
          </select>
        </div>

        {loading && <ListSkeleton />}

        {!loading && (
          <div className="relative group rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-4 md:p-8 shadow-2xl transition-all duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold font-['Outfit'] min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-6 pr-4 whitespace-nowrap">User</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Email</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Role</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Status</th>
                    <th className="pb-6 pr-4 whitespace-nowrap">Joined</th>
                    <th className="pb-6 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  {users.map((u) => (
                    <tr key={u.user_id} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <Link to={`/admin/users/${u.user_id}`} className="flex items-center gap-3 group">
                          <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 text-xs font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner uppercase">
                            {u.full_name[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">{u.full_name}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{u.phone_number || '--'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-5 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{u.email}</td>
                      <td className="py-5 pr-4 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-5 pr-4 whitespace-nowrap">
                        {u.is_active ? (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-green-600 dark:text-green-500">ACTIVE</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500">BLOCKED</span>
                          </div>
                        )}
                      </td>
                      <td className="py-5 pr-4 text-slate-400 font-medium uppercase tracking-tighter whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          {u.role !== 'admin' && (
                            <>
                              {u.is_active
                                ? <button disabled={busy === u.user_id} onClick={() => act(blockUser, u.user_id)} className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-amber-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">Revoke Access</button>
                                : <button disabled={busy === u.user_id} onClick={() => act(unblockUser, u.user_id)} className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-blue-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">Restore Access</button>
                              }
                              <button disabled={busy === u.user_id} onClick={() => { if (confirm('Permanently delete this identity?')) act(deleteUser, u.user_id) }} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-red-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900 mb-4 font-black text-slate-300">!</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No users match your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination portal */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Page <span className="text-blue-600 dark:text-blue-400">{pagination.page || 1}</span> of <span className="text-slate-900 dark:text-white">{pagination.totalPages || 1}</span> 
                <span className="mx-3 opacity-20">|</span> 
                Total users: <span className="text-slate-900 dark:text-white">{pagination.total || 0}</span>
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-6 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Previous
                </button>
                <button
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100"
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

export default AdminUsersPage
