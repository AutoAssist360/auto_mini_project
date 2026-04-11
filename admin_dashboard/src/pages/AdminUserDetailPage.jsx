import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getUserById, blockUser, unblockUser, deleteUser } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'

function AdminUserDetailPage() {
  const { userId } = useParams()
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)

  const load = useCallback(() => {
    getUserById(userId).then((r) => setUser(r.user || r)).catch(() => null).finally(() => setLoading(false))
  }, [userId])
  useEffect(() => { load() }, [load])

  const act = async (fn) => { setBusy(true); try { await fn(userId); load() } catch { /* */ } setBusy(false) }

  if (loading) return <DetailSkeleton />
  if (!user) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">User not found</p></div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'USER DIRECTORY', to: '/admin/users' }, { label: user.full_name.toUpperCase() }]} />
        </div>

        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-blue-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-transform">
                {user.full_name[0]}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400 mb-1">Identity Profile</p>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">{user.full_name}</h1>
                <p className="mt-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5 uppercase tracking-widest"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {user.email}</span>
                  <span className="flex items-center gap-1.5 uppercase tracking-widest"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {user.phone_number || 'NO SECURE LINE'}</span>
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                    Role: {user.role}
                  </span>
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${user.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    {user.is_active ? 'Access Verified' : 'Access Revoked'}
                  </span>
                  {user.deleted_at && (
                    <span className="inline-block px-4 py-1.5 rounded-full bg-red-600 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20">
                      Deleted: {new Date(user.deleted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {user.role !== 'admin' && (
              <div className="flex flex-col gap-3 w-full md:w-auto">
                {user.is_active
                  ? <button disabled={busy} onClick={() => act(blockUser)} className="w-full md:w-48 px-6 py-3.5 rounded-2xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50">Revoke Access</button>
                  : <button disabled={busy} onClick={() => act(unblockUser)} className="w-full md:w-48 px-6 py-3.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">Restore Access</button>
                }
                <button disabled={busy} onClick={() => { if (confirm('Delete this user? This cannot be undone.')) act(deleteUser) }} className="w-full md:w-48 px-6 py-3.5 rounded-2xl border-2 border-red-500/20 text-red-600 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50">Delete user</button>
              </div>
            )}
          </div>
        </div>

        {/* counts metrics */}
        {user._count && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(user._count).map(([k, v]) => (
              <div key={k} className="group p-6 rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl transition-all hover:scale-105 hover:-translate-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-blue-500 transition-colors">{k.replace(/([A-Z])/g, ' $1')}</p>
                <p className="mt-4 text-4xl font-black tracking-tighter text-slate-900 dark:text-white">{v}</p>
                <div className="mt-4 h-1 w-12 bg-blue-600/20 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* vehicles index */}
        {user.vehicles?.length > 0 && (
          <section className="mt-8 relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all">
             <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Registered Assets</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-bold">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="pb-4 pr-3">Request ID</th>
                    <th className="pb-4 pr-3">VIN Signature</th>
                    <th className="pb-4">Build Variant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {user.vehicles.map((v) => (
                    <tr key={v.vehicle_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="py-4 pr-3 text-slate-900 dark:text-white font-black tracking-widest uppercase">{v.registration_number}</td>
                      <td className="py-4 pr-3 text-slate-500 dark:text-slate-400 font-mono tracking-tighter">{v.vin_number}</td>
                      <td className="py-4 font-black uppercase text-blue-600 dark:text-blue-500">{v.variant?.variant_name || 'GENERIC'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* technician link */}
        {user.technicianProfile && (
          <section className="mt-8 relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all">
            <div className="flex items-center justify-between gap-4 mb-8">
               <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040L3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622l-.382-3.040z" /></svg>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Certified Profile Attachment</h2>
              </div>
              <Link to={`/admin/technicians/${user.technicianProfile.technician_id}`} className="px-5 py-2.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-600/20">
                View Credentials
              </Link>
            </div>
            
            <div className="grid gap-6 text-[11px] font-black uppercase tracking-widest sm:grid-cols-2 lg:grid-cols-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
                <p className="text-[9px] text-slate-400 mb-1">Business Name</p>
                <p>{user.technicianProfile.business_name || 'PRIVATE AGENT'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
                <p className="text-[9px] text-slate-400 mb-1">Service types</p>
                <p>{user.technicianProfile.technician_type}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
                <p className="text-[9px] text-slate-400 mb-1">Deployment Zone</p>
                <p>{user.technicianProfile.location}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
                <p className="text-[9px] text-slate-400 mb-1">Operational Radius</p>
                <p>{user.technicianProfile.service_radius} KM</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
                <p className="text-[9px] text-slate-400 mb-1">Network Rating</p>
                <p className="text-indigo-600">{user.technicianProfile.rating || 'N/A'} <span className="text-slate-400 opacity-50">({user.technicianProfile.total_reviews} REVIEWS)</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
                <p className="text-[9px] text-slate-400 mb-1">Verification Status</p>
                <p className={user.technicianProfile.is_verified ? 'text-green-600' : 'text-amber-500'}>
                  {user.technicianProfile.is_verified ? 'SECURE' : 'PENDING'}
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400/60 transition-colors dark:text-slate-600">
            Node Registry Hash: {user.user_id.slice(0, 12).toUpperCase()}...
          </p>
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Deployment Date: {new Date(user.created_at).toLocaleString().toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminUserDetailPage
