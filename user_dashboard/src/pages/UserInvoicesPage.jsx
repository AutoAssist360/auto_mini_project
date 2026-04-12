import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ApiError, getInvoices, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import { formatLabel } from '../lib/displayText'

const PAYMENT_COLORS = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  refunded: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
}

function UserInvoicesPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const auth = useSelector((state) => state.auth)

  const [invoices, setInvoices] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError('')

    const loadInvoices = async () => {
      try {
        const response = await getInvoices(page, limit, statusFilter || undefined)
        if (!cancelled) {
          setInvoices(response?.invoices || [])
          setTotal(response?.total || 0)
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) setError(err.message)
          else setError('Failed to load invoices')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadInvoices()
    return () => { cancelled = true }
  }, [page, statusFilter])

  const totalPages = Math.ceil(total / limit)

  const handleLogout = async () => {
    try { await userLogout() } catch { /* ignore */ }
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const FILTERS = ['', 'pending', 'completed', 'failed', 'refunded']
  const FILTER_LABELS = { '': 'All', pending: 'Pending', completed: 'Completed', failed: 'Failed', refunded: 'Refunded' }
  const getInvoiceDateLabel = (invoice) => invoice?.issued_at || invoice?.created_at

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500">
      {/* Ambient */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/5 dark:bg-emerald-500/8 blur-[120px] rounded-full"></div>
        <div className="absolute top-[40%] -right-[5%] w-[30%] h-[30%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/70 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-[#0B1120]/80 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="group w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-500/50 transition-all">
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <span className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">PAYMENTS</span>
              <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">My Invoices</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="hidden max-w-[12rem] truncate text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:block">{auth.user?.full_name}</span>
            <button onClick={onToggleTheme} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm hover:border-blue-500/50 transition-all">
              {theme === 'dark' ? '🌞' : '🌙'}
            </button>
            <button onClick={handleLogout} className="whitespace-nowrap px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black tracking-widest uppercase hover:scale-105 active:scale-95 transition-all shadow-lg">
              LOGOUT
            </button>
          </div>
        </header>

        {/* Filters + Count */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-[#0B1120]">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPage(1) }}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <span className="whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-widest">{total} Invoice{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest">
            ⚠️ {error}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <ListSkeleton />
        ) : invoices.length === 0 ? (
            <div className="py-20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 mx-auto flex items-center justify-center text-slate-300 dark:text-slate-700 text-2xl mb-4">🧾</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No invoices found</p>
            </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice ID</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Issue</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Technician</th>
                    <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                  {invoices.map((inv) => (
                    <tr key={inv.invoice_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                      <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">{inv.invoice_id?.slice(0, 8)}…</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">{inv.job?.request?.issue_type?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{inv.job?.technician?.user?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900 dark:text-white">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${PAYMENT_COLORS[inv.payment_status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {formatLabel(inv.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {new Date(getInvoiceDateLabel(inv)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/invoices/${inv.invoice_id}`} className="h-8 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest inline-flex items-center hover:scale-105 active:scale-95 transition-all">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {invoices.map((inv) => (
                <div key={inv.invoice_id} className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 shadow-lg">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500">{inv.invoice_id?.slice(0, 8)}…</span>
                    <span className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${PAYMENT_COLORS[inv.payment_status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {formatLabel(inv.payment_status)}
                    </span>
                  </div>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Issue</p>
                      <p className="text-sm font-semibold capitalize">{inv.job?.request?.issue_type?.replace(/_/g, ' ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">₹{Number(inv.total).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Technician</p>
                      <p className="text-sm font-semibold">{inv.job?.technician?.user?.full_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                      <p className="text-xs font-semibold">{new Date(getInvoiceDateLabel(inv)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <Link to={`/invoices/${inv.invoice_id}`} className="flex h-10 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                    View Invoice
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-10 whitespace-nowrap px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:border-blue-500 transition-all">
                  ← Prev
                </button>
                <span className="whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-widest">{page} / {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-10 whitespace-nowrap px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:border-blue-500 transition-all">
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

export default UserInvoicesPage
