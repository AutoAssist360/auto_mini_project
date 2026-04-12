import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTechnicianById, verifyTechnician, suspendTechnician, unsuspendTechnician, getTechnicianJobs } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'

function AdminTechnicianDetailPage() {
  const { techId } = useParams()
  const [tech, setTech]     = useState(null)
  const [jobs, setJobs]     = useState([])
  const [jobPag, setJobPag] = useState({})
  const [jobPage, setJobPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false)

  const load = useCallback(() => {
    getTechnicianById(techId).then((r) => setTech(r.technician || r)).catch(() => null).finally(() => setLoading(false))
  }, [techId])
  useEffect(() => { load() }, [load])

  const loadJobs = useCallback(() => {
    getTechnicianJobs(techId, { page: jobPage, limit: 10 }).then((r) => { setJobs(r.jobs || []); setJobPag(r.pagination || {}) }).catch(() => null)
  }, [techId, jobPage])
  useEffect(() => { loadJobs() }, [loadJobs])

  const act = async (fn) => { setBusy(true); try { await fn(techId); load() } catch { /* */ } setBusy(false) }

  if (loading) return <DetailSkeleton />
  if (!tech) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Technician not found</p></div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'TECHNICIAN HUB', to: '/admin/technicians' }, { label: (tech.user?.full_name || 'TECHNICIAN').toUpperCase() }]} />
        </div>

        {/* glass hero header */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-blue-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-transform">
                {tech.user?.full_name[0] || 'T'}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400 mb-1 leading-none">Technician details</p>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">{tech.user?.full_name || 'Unknown Tech'}</h1>
                <p className="mt-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-5 gap-y-2 uppercase tracking-widest leading-none">
                  <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {tech.user?.email}</span>
                  <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {tech.user?.phone_number || 'NO SECURE LINE'}</span>
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">{tech.technician_type} PROTOCOL</span>
                  {tech.is_verified ? (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 text-[9px] font-black uppercase tracking-widest border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Verified Fleet Member
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Pending Certification
                    </span>
                  )}
                  {tech.is_online ? (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/20 animate-pulse-subtle">
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 border border-slate-200/50 dark:border-slate-700/50 shadow-sm opacity-60">
                      Offline
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {!tech.is_verified && (
                <button disabled={busy} onClick={() => act(verifyTechnician)} className="w-full md:w-52 px-6 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">Verify technician</button>
              )}
              {tech.user?.is_active
                ? <button disabled={busy} onClick={() => setShowSuspendConfirm(true)} className="w-full md:w-52 px-6 py-4 rounded-2xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50">Suspend account</button>
                : <button disabled={busy} onClick={() => act(unsuspendTechnician)} className="w-full md:w-52 px-6 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">Restore account</button>
              }
            </div>
          </div>
        </div>

        {/* Operation Lock Modal */}
        {showSuspendConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm transition-all duration-300">
             <div className="absolute inset-0 bg-slate-950/40" onClick={() => setShowSuspendConfirm(false)}></div>
             <div className="relative group max-w-sm w-full rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white dark:bg-[#0B1120] p-10 shadow-2xl dark:shadow-blue-500/5 transition-all animate-in fade-in zoom-in duration-300">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-500/10 text-amber-500 mb-8 border border-amber-500/20 shadow-inner">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-center">Operation Lock</h2>
                <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-widest leading-loose">
                  Executing technician suspension will terminate all active broadcast signals and pending offers for this professional node.
                </p>
                <div className="mt-10 flex flex-col gap-3">
                  <button 
                    disabled={busy} 
                    onClick={() => { setShowSuspendConfirm(false); act(suspendTechnician) }} 
                    className="w-full px-6 py-4 rounded-[20px] bg-amber-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    Commit Suspension
                  </button>
                  <button 
                    onClick={() => setShowSuspendConfirm(false)} 
                    className="w-full px-6 py-4 rounded-[20px] border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
             </div>
          </div>
        )}

        {/* static profile info grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {[
            ['Registered Business', tech.business_name || '--'],
            ['Deployment Zone', tech.location],
            ['Service Radius', `${tech.service_radius} KM`],
            ['Efficiency Score', `${tech.rating ?? '--'} / 5.0 (${tech.total_reviews} SESSIONS)`],
            ['Coordinate Logic', `${tech.latitude}, ${tech.longitude}`],
            ['Activity Volume', `${tech._count?.offers ?? '--'} OFFERS / ${tech._count?.jobs ?? '--'} JOBS`],
          ].map(([l, v]) => (
            <div key={l} className="group p-8 rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl transition-all hover:scale-[1.02] hover:-translate-y-1 flex flex-col justify-between min-h-[160px]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-blue-500 transition-colors mb-4">{l}</p>
                <p className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase line-clamp-2">{v}</p>
              </div>
              <div className="mt-6 h-1 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ width: '40%' }}></div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* competencies stack */}
          <div className="space-y-8">
            {/* certifications */}
            {tech.certifications?.length > 0 && (
              <section className="relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040L3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622l-.382-3.040z" /></svg>
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Verified Credentials</h2>
                </div>
                <div className="space-y-4">
                  {tech.certifications.map((c) => (
                    <div key={c.certification_id} className="group p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-blue-500/30 transition-all font-bold uppercase tracking-widest text-[10px]">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <span className="text-slate-900 dark:text-white font-black">{c.certification}</span>
                        <span className="text-blue-600 bg-blue-600/10 px-2 py-0.5 rounded-lg border border-blue-600/20">{new Date(c.issue_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-500 font-bold">
                        <span>ISSUED BY: {c.issued_by}</span>
                        {c.expiry_date && <span>EXP: {new Date(c.expiry_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* competencies combined */}
            <div className="grid gap-8 sm:grid-cols-2">
              {/* car supports */}
              {tech.carSupports?.length > 0 && (
                <section className="relative overflow-hidden rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-6 shadow-xl transition-all h-full">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5">Asset Competency</h2>
                  <div className="flex flex-wrap gap-2">
                    {tech.carSupports.map((cs) => (
                      <span key={cs.support_id} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">{cs.company?.company_name || 'GENERIC'}{cs.variant ? ` / ${cs.variant.variant_name}` : ''}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* part skills */}
              {tech.partSkills?.length > 0 && (
                <section className="relative overflow-hidden rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-6 shadow-xl transition-all h-full">
                   <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5">Specialization</h2>
                  <div className="flex flex-wrap gap-2">
                    {tech.partSkills.map((ps) => (
                      <span key={ps.skill_id} className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20 shadow-sm">{ps.part?.part_name || `PART [${ps.part_id}]`}</span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* resources */}
            {tech.resources?.length > 0 && (
              <section className="relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> Logistics & Deployment Gear
                 </h2>
                 <div className="grid gap-3">
                   {tech.resources.map((r) => (
                     <div key={r.resource_id} className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/50 shadow-inner">
                        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-black shadow-sm text-blue-600">{r.resource_type[0]}</div>
                        <div>
                          <p className="text-[10px] font-black tracking-widest text-slate-900 dark:text-white uppercase">{r.resource_type}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">{r.description}</p>
                        </div>
                     </div>
                   ))}
                 </div>
              </section>
            )}
          </div>

          {/* operational archive */}
          <section className="relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all h-fit">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Deployment Ledger</h2>
              </div>
              {jobs.length > 0 && (
                <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">{jobPag.total || jobs.length} TOTAL OPS</span>
              )}
            </div>

            {jobs.length === 0 ? (
              <div className="py-20 text-center">
                 <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-xl tracking-tighter uppercase">! OPS</div>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">No service history found for this technician</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-bold min-w-[800px]">
                    <thead>
                      <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="pb-4 pr-3 whitespace-nowrap">Issue type</th>
                        <th className="pb-4 pr-3 whitespace-nowrap">Status</th>
                        <th className="pb-4 whitespace-nowrap">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {jobs.map((j) => (
                        <tr key={j.job_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                          <td className="py-5 pr-3 whitespace-nowrap">
                            <Link to={`/admin/jobs/${j.job_id}`} className="group-hover:text-blue-600 transition-colors uppercase tracking-tight font-black block">
                              {j.request?.issue_type?.replace(/_/g, ' ') || 'SYSTEM ERROR'}
                              <p className="text-[8px] text-slate-400 opacity-60 uppercase tracking-widest mt-0.5">ID: {j.job_id.slice(0, 8)}</p>
                            </Link>
                          </td>
                          <td className="py-5 pr-3 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                              {j.status}
                            </span>
                          </td>
                          <td className="py-5 whitespace-nowrap text-slate-400 font-medium tracking-tighter text-[10px]">
                            {j.started_at ? new Date(j.started_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* mini pagination */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pg {jobPag.page || 1} / {jobPag.totalPages || 1}</span>
                  <div className="flex gap-2">
                    <button disabled={jobPage <= 1} onClick={() => setJobPage((p) => p - 1)} className="px-5 py-2 rounded-full border border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-30">Prev</button>
                    <button disabled={jobPage >= (jobPag.totalPages || 1)} onClick={() => setJobPage((p) => p + 1)} className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30">Next</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-12 flex items-center justify-center">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400/60 transition-colors dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm">
            Operational Node Protocol Hash: {tech.technician_id.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminTechnicianDetailPage
