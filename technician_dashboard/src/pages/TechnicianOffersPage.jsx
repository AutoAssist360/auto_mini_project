import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getOffers, ApiError } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import { formatLabel } from '../lib/displayText'

const ISSUE_LABELS = {
  mechanical_failure: 'Mechanical Failure',
  electrical_issue: 'Electrical Issue',
  tire_related: 'Tire Related',
  battery_issue: 'Battery Issue',
  engine_problem: 'Engine Problem',
  brake_issue: 'Brake Issue',
  other: 'Other',
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending review',
    classes: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  accepted: {
    label: 'Accepted',
    classes: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  expired: {
    label: 'Expired',
    classes: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500',
  },
}

function TechnicianOffersPage({ theme, onToggleTheme }) {
  const [offers, setOffers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const loadOffers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getOffers(page, 12)
      setOffers(res?.offers ?? [])
      setTotal(res?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load offers')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    loadOffers()
  }, [loadOffers])

  const totalPages = Math.ceil(total / 12) || 1

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-24`}>
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-[32px] sm:rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex flex-wrap gap-4 items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Offer history</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">{total} offers sent</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={loadOffers} disabled={loading} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
               <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
               {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 text-center animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12"><ListSkeleton /></div>
        ) : offers.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
             <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-4xl opacity-50 grayscale">📤</div>
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">No offers yet</h2>
             <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">You have not sent any offers yet. Browse open requests to start sending offers.</p>
             <button onClick={() => navigate('/discover')} className="mt-8 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Browse requests</button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer, idx) => {
                const status = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending
                return (
                  <div 
                    key={offer.offer_id} 
                    className="group relative flex flex-col justify-between rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 overflow-hidden"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-600/10 transition-colors"></div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-6">
                         <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest leading-none flex items-center gap-1.5 ${status.classes}`}>
                            <span className={`w-1 h-1 rounded-full ${status.dot}`}></span>
                            {status.label}
                         </span>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{timeAgo(offer.created_at)}</span>
                      </div>

                      <div className="mb-6">
                         <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2">Issue details</h3>
                         <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-2">
                           {ISSUE_LABELS[offer.request?.issue_type] || offer.request?.issue_type}: {offer.request?.issue_description}
                         </p>
                      </div>

                      <div className="space-y-3 mb-8">
                         <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estimated cost</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">Rs {Number(offer.estimated_cost).toLocaleString()}</span>
                         </div>
                         <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arrival time</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{offer.estimated_time} MIN</span>
                         </div>
                         <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Service type</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{formatLabel(offer.repair_mode)}</span>
                         </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link 
                        to={`/discover`} 
                        className="flex-1 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center relative overflow-hidden group/btn"
                      >
                         <span className="relative z-10">Browse requests</span>
                         <div className="absolute inset-0 bg-blue-600 dark:bg-blue-400 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page <= 1} 
                  className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-lg shadow-black/5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Page {page} of {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page >= totalPages} 
                  className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 shadow-lg shadow-black/5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TechnicianOffersPage

