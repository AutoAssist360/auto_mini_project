import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { getReviews, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'

function Stars({ count }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-lg leading-none ${s <= count ? 'text-amber-400' : 'text-slate-200 dark:text-slate-800'}`}>★</span>
      ))}
    </div>
  )
}

function UserReviewsPage({ theme, onToggleTheme }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [reviews, setReviews] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 10

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const fetchData = async () => {
      try {
        const data = await getReviews({ page, limit })
        if (!cancelled) {
          setReviews(data.reviews || [])
          setTotal(data.total || 0)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load reviews')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500">
      {/* Ambient background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-amber-500/5 dark:bg-amber-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[40%] -right-[5%] w-[30%] h-[30%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => navigate('/dashboard')} className="shrink-0 group w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-amber-500/50 transition-all">
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 min-w-[200px]">
              <span className="text-[10px] md:text-xs font-black tracking-widest text-amber-600 dark:text-amber-400 uppercase">Feedback Archive</span>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none break-all">My Reviews</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
            <button onClick={onToggleTheme} className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-500/50 transition-all text-sm">
              {theme === 'dark' ? '🌞' : '🌙'}
            </button>
            <button onClick={handleLogout} className="whitespace-nowrap px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-xs font-black tracking-widest uppercase hover:scale-105 active:scale-95 transition-all shadow-lg">
              LOGOUT
            </button>
          </div>
        </header>

        {/* Stats bar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white text-base font-black">★</div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Reviews</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{total}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <div className="py-12 text-center rounded-3xl border border-red-500/20 bg-red-500/5">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">⚠️ Failed to Load</p>
            <p className="text-sm font-medium text-slate-500 mt-1">{error}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 mx-auto flex items-center justify-center text-slate-300 dark:text-slate-700 text-3xl mb-5">★</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Reviews Submitted</p>
            <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">After a job is completed, you can leave a review from the job detail page.</p>
            <button type="button" onClick={() => navigate('/jobs')} className="mt-6 px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
              View My Jobs
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {reviews.map((r) => (
                <article key={r.review_id} className="group relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-7 shadow-xl hover:border-amber-400/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors"></div>

                  {/* Stars + Score */}
                  <div className="flex items-center justify-between mb-5">
                    <Stars count={r.rating} />
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {r.rating}/5
                    </span>
                  </div>

                  {/* Comment */}
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed min-h-[48px]">
                    {r.comment || <span className="italic opacity-40">No comment provided.</span>}
                  </p>

                  {/* Footer */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Submitted</p>
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button type="button" onClick={() => navigate(`/jobs/${r.job_id}`)} className="h-8 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                      View Job
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="whitespace-nowrap h-10 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[10px] md:text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:border-blue-500 transition-all">
                  ← Prev
                </button>
                <span className="whitespace-nowrap text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Page {page} of {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="whitespace-nowrap h-10 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[10px] md:text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:border-blue-500 transition-all">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default UserReviewsPage
