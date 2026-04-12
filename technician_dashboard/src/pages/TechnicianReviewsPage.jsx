import { useEffect, useState } from 'react'
import { getMyReviews } from '../lib/api'

function TechnicianReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const data = await getMyReviews()
      setReviews(data.reviews || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch reviews')
    } finally {
      setLoading(false)
    }
  }

  // Calculate Average Rating
  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
    : 0

  return (
    <div className="min-h-screen bg-slate-50 p-4 transition-colors duration-500 dark:bg-[#030712] sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            My Reviews
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            See what customers are saying about your service.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
           <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#0B1120]">
             <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Average Rating</h2>
             <div className="flex items-center gap-2">
                 <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{avgRating}</p>
                 <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                     <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                 </svg>
             </div>
           </div>
           <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#0B1120]">
             <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Total Reviews</h2>
             <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{reviews.length}</p>
           </div>
        </section>

        <section>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                You don't have any reviews yet. Complete more jobs to gather feedback.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <article
                  key={rev.review_id}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800/50 dark:bg-[#0B1120]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          {rev.rating} / 5
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                           {rev.job?.request?.issue_type?.replace(/_/g, ' ') || 'Job'}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium text-sm mt-2">
                          {rev.comment || <span className="italic text-slate-400">No comment provided.</span>}
                      </p>
                    </div>
                    
                    <div className="text-left sm:text-right">
                       <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                           {rev.user?.full_name || 'Customer'}
                       </p>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {new Date(rev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

export default TechnicianReviewsPage
