import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getEarnings, payDues, confirmTechnicianCommissionPayment, ApiError } from '../lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { CardSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import { formatLabel } from '../lib/displayText'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
const PAYMENT_COLORS = {
  pending: 'text-amber-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
}
const cardClass = 'rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:shadow-2xl'

function formatCurrency(value) {
  return `Rs ${Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function RupeeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {formatCurrency(item.value)}
        </p>
      ))}
    </div>
  )
}

function PaymentModal({
  paymentQr,
  qrPreviewFailed,
  copied,
  confirming,
  transactionId,
  onChangeTransactionId,
  onClose,
  onConfirm,
  onCopy,
  onQrPreviewFail,
}) {
  if (!paymentQr) return null

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(paymentQr.upi_url)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h2 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2">Payment summary</h2>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Admin fee</h3>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
               Pay today’s 5% admin fee with the UPI details below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all text-3xl font-light"
          >
            &times;
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[28px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative rounded-[24px] border border-blue-200 bg-white p-6 dark:border-blue-900/40 dark:bg-slate-900 shadow-xl">
              {!qrPreviewFailed ? (
                <img
                  src={qrImageUrl}
                  alt="Admin UPI QR"
                  className="mx-auto rounded-xl bg-white shadow-inner p-2"
                  width="240"
                  height="240"
                  onError={onQrPreviewFail}
                />
              ) : (
                <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                  Preview unavailable
                </div>
              )}
              <div className="mt-6 flex flex-col items-center gap-2">
                 <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse [animation-delay:0.4s]"></span>
                 </div>
                 <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center leading-relaxed">
                   Scan this code with any UPI app.
                 </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-[24px] bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/10 backdrop-blur-md">
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">Amount to pay</span>
              <p className="text-4xl font-black text-slate-900 dark:text-blue-400 tracking-tighter leading-none">
                {formatCurrency(paymentQr.amount)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">UPI ID</span>
                <div className="flex items-center gap-2 justify-between">
                   <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">{paymentQr.upi_id}</p>
                    <button
                     type="button"
                     onClick={onCopy}
                     aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}
                     title={copied ? 'UPI ID copied' : 'Copy UPI ID'}
                     className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                   >
                     {copied ? (
                       <span className="text-[8px] font-black uppercase tracking-widest">COPIED</span>
                     ) : (
                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                     )}
                   </button>
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reference ID</span>
                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">{paymentQr.reference}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">PAY TO</span>
                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200">{paymentQr.upi_name}</p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payment note</span>
                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">{paymentQr.note}</p>
              </div>
            </div>

            <div className="p-6 rounded-[24px] border border-blue-500/30 bg-blue-600/5">
              <label htmlFor="technician-commission-transaction-id" className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-3">
                Transaction ID
              </label>
              <input
                id="technician-commission-transaction-id"
                type="text"
                value={transactionId}
                onChange={(event) => onChangeTransactionId(event.target.value)}
                placeholder="Enter transaction ID"
                className="w-full h-12 rounded-xl border border-blue-600/20 bg-white dark:bg-slate-900 px-4 text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a
                href={paymentQr.upi_url}
                className="flex-1 h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Open UPI app
              </a>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                className="flex-1 h-14 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {confirming ? 'Confirming...' : 'Confirm payment'}
              </button>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TechnicianEarningsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [paymentQr, setPaymentQr] = useState(null)
  const [transactionId, setTransactionId] = useState('')
  const [copied, setCopied] = useState(false)
  const [qrPreviewFailed, setQrPreviewFailed] = useState(false)

  const loadEarnings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getEarnings()
      setSummary(response?.summary ?? null)
      setJobs(response?.jobs ?? [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEarnings()
  }, [loadEarnings])

  const handlePayCommission = async () => {
    setPaymentLoading(true)
    setPaymentError('')
    setSuccessMessage('')
    setCopied(false)
    setQrPreviewFailed(false)
    setTransactionId('')

    try {
      const response = await payDues()
      setPaymentQr(response)
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Failed to open the payment QR')
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleConfirmPayment = async () => {
    setConfirmingPayment(true)
    setPaymentError('')

    try {
      const response = await confirmTechnicianCommissionPayment({
        transaction_id: transactionId.trim() || undefined,
      })
      setSuccessMessage(response?.message || 'Commission marked as paid.')
      setPaymentQr(null)
      setTransactionId('')
      await loadEarnings()
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Failed to save payment confirmation')
    } finally {
      setConfirmingPayment(false)
    }
  }

  const handleCopyUpiId = async () => {
    if (!paymentQr?.upi_id || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(paymentQr.upi_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const earningsBarData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Total Earned', value: Number(summary.total_earned) || 0 },
      { name: 'Pending Payouts', value: Number(summary.pending_credits) || 0 },
      { name: 'Today 5%', value: Number(summary.today_commission_due) || 0 },
    ]
  }, [summary])

  const invoicePieData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Paid', value: Number(summary.paid_count) || 0 },
      { name: 'Pending', value: Number(summary.pending_count) || 0 },
    ].filter((item) => item.value > 0)
  }, [summary])

  const earningsByType = useMemo(() => {
    if (!jobs.length) return []

    const grouped = {}
    jobs.forEach((job) => {
      const type = (job.request?.issue_type || 'other').replace(/_/g, ' ')
      if (!grouped[type]) grouped[type] = 0
      grouped[type] += Number(job.invoice?.total ?? 0)
    })

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
  }, [jobs])

  const resetTimeLabel = useMemo(() => {
    if (!summary?.today_reset_at) return 'today at 11:59 PM'

    return new Date(summary.today_reset_at).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [summary?.today_reset_at])

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-24`}>
       {/* Background Blurs */}
       <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-[32px] sm:rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex flex-wrap gap-4 items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Earnings</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">Earnings overview</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={loadEarnings} disabled={loading} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
               <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-lg">
               {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        <div className="mb-8 opacity-60 hover:opacity-100 transition-opacity">
           <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Earnings' }]} />
        </div>

        {(error || paymentError || successMessage) && (
          <div className="mb-8 space-y-3">
             {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 animate-in slide-in-from-top-4">{error}</div>}
             {paymentError && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 animate-in slide-in-from-top-4">{paymentError}</div>}
             {successMessage && <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 animate-in slide-in-from-top-4">{successMessage}</div>}
          </div>
        )}

        {loading ? (
          <CardSkeleton count={4} />
        ) : (
          <>
            <section className="relative group rounded-[40px] border border-blue-500/30 bg-blue-600/5 dark:bg-white/5 backdrop-blur-xl p-8 sm:p-10 shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-blue-500/10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-600/20 transition-all duration-700"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
              
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-6">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                     <h2 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">Today’s admin fee</h2>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today’s admin fee</span>
                     <p className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                       {formatCurrency(summary?.today_commission_due ?? 0)}
                     </p>
                  </div>
                  
                  <p className="mt-6 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    A standard 5% admin fee is charged on today’s collected payments. 
                    This resets at <span className="text-blue-600 dark:text-blue-400 font-black">{resetTimeLabel.toUpperCase()}</span>.
                  </p>
                  
                  <div className="mt-8 flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Completed jobs</span>
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{summary?.today_commission_jobs ?? 0} jobs</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pending credits</span>
                      <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">{formatCurrency(summary?.pending_credits ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 sm:min-w-[280px]">
                  <button
                    type="button"
                    onClick={handlePayCommission}
                    disabled={paymentLoading || Number(summary?.today_commission_due ?? 0) <= 0}
                    className="h-16 rounded-[24px] bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_-12px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 group/btn"
                  >
                    <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    {paymentLoading ? 'Opening payment...' : "Pay admin fee"}
                  </button>
                  <div className="p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-white/5 backdrop-blur-md">
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estimated payout</span>
                     <p className="text-xl font-bold text-slate-800 dark:text-white leading-none">{formatCurrency(summary?.pending_credits ?? 0)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cardClass}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Total earned</span>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                   {formatCurrency(summary?.total_earned ?? 0)}
                </p>
              </div>
              <div className={cardClass}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Pending payout</span>
                <p className="text-3xl font-black text-amber-500 tracking-tighter">
                   {formatCurrency(summary?.pending_credits ?? 0)}
                </p>
              </div>
              <div className={cardClass}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Paid invoices</span>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                   {summary?.paid_count ?? 0}
                </p>
              </div>
              <div className={cardClass}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Total jobs</span>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                   {summary?.total_jobs ?? 0}
                </p>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Earnings distribution</h2>
                   <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full">Bar chart</span>
                </div>
                {earningsBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={earningsBarData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<RupeeTooltip />} cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" name="Amount" radius={[12, 12, 0, 0]}>
                        {earningsBarData.map((_, index) => (
                           <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
                     <span className="text-4xl mb-2">📊</span>
                     <p className="text-[10px] font-black uppercase tracking-widest">No earnings data yet</p>
                  </div>
                )}
              </div>

              <div className={cardClass}>
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Invoice status breakdown</h2>
                   <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full">Pie chart</span>
                </div>
                {invoicePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={invoicePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {invoicePieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend 
                        verticalAlign="bottom" 
                        formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{value}</span>}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
                     <span className="text-4xl mb-2">🍰</span>
                     <p className="text-[10px] font-black uppercase tracking-widest">No invoice data yet</p>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8">
              <div className={`${cardClass} overflow-hidden`}>
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Revenue by issue type</h2>
                </div>
                {earningsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(240, earningsByType.length * 50)}>
                    <BarChart data={earningsByType} layout="vertical" barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} width={140} axisLine={false} tickLine={false} />
                      <Tooltip content={<RupeeTooltip />} />
                      <Bar dataKey="value" name="Earnings" radius={[0, 8, 8, 0]}>
                        {earningsByType.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
                     <span className="text-4xl mb-2">🗺️</span>
                     <p className="text-[10px] font-black uppercase tracking-widest">No issue data yet</p>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-12">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Payment history</h2>
                <div className="flex gap-1">
                   <span className="w-1 h-1 rounded-full bg-blue-500/40"></span>
                   <span className="w-1 h-1 rounded-full bg-blue-500/40"></span>
                   <span className="w-1 h-1 rounded-full bg-blue-500/40"></span>
                </div>
              </div>
              
              {jobs.length === 0 ? (
                <div className={`${cardClass} py-12 flex flex-col items-center justify-center text-center opacity-40`}>
                   <div className="text-4xl mb-4">📑</div>
                   <p className="text-[10px] font-black uppercase tracking-widest">No payment history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <Link
                      key={job.job_id}
                      to={`/jobs/${job.job_id}`}
                      className="group block relative rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-blue-500/50 hover:scale-[1.01]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-600/10 px-2 py-0.5 rounded-full">ID_{job.job_id.slice(-6).toUpperCase()}</span>
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{new Date(job.completed_at || job.updated_at).toLocaleDateString()}</span>
                          </div>
                          
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">
                             {job.request?.issue_type?.replace(/_/g, ' ')}
                          </h4>
                          
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
                            {job.request?.issue_description || 'No description provided'}
                          </p>
                          
                          <div className="mt-4 flex flex-wrap gap-4 items-center">
                             <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">METHOD:</span>
                                <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{job.invoice?.payment_method?.replace(/_/g, ' ') || 'UNSET'}</span>
                             </div>
                             {job.commission_due_today && (
                                <div className="flex items-center gap-1.5">
                                   <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                                   <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Commission: {formatCurrency(job.commission_amount)}</span>
                                </div>
                             )}
                          </div>
                        </div>

                        <div className="flex flex-row items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:min-w-[140px] sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:pt-0 sm:pl-8 sm:items-end">
                          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{formatCurrency(job.invoice?.total ?? 0)}</p>
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${job.invoice?.payment_status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                             {formatLabel(job.invoice?.payment_status) || 'Estimate'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block">
                         <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" /></svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <PaymentModal
        paymentQr={paymentQr}
        qrPreviewFailed={qrPreviewFailed}
        copied={copied}
        confirming={confirmingPayment}
        transactionId={transactionId}
        onClose={() => setPaymentQr(null)}
        onChangeTransactionId={setTransactionId}
        onConfirm={handleConfirmPayment}
        onCopy={handleCopyUpiId}
        onQrPreviewFail={() => setQrPreviewFailed(true)}
      />
    </div>
  )
}

export default TechnicianEarningsPage
