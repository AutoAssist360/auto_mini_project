import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  confirmVendorCommissionPayment,
  getVendorCommissionQr,
  getVendorLedger,
} from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function formatCurrency(value) {
  return `Rs ${Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatLedgerDate(value) {
  if (!value) return '-'

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PaymentModal({
  paymentQr,
  copied,
  confirming,
  qrPreviewFailed,
  transactionId,
  onChangeTransactionId,
  onClose,
  onConfirm,
  onCopy,
  onQrPreviewFail,
}) {
  if (!paymentQr) return null

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(paymentQr.upi_url)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-200/50 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-[#0B1120]/90 animate-in zoom-in-95 duration-300 relative"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-200/50 dark:border-slate-700/50 relative z-10">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl text-blue-500">💳</span> Pay today’s admin fee
            </h2>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Pay with the UPI QR below, then confirm.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all transform active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] relative z-10">
          <div className="rounded-[24px] border border-blue-200/60 bg-blue-50/50 p-6 shadow-inner dark:border-blue-900/40 dark:bg-blue-900/10 flex flex-col items-center justify-center">
            {!qrPreviewFailed ? (
              <div className="rounded-[24px] bg-white p-3 shadow-xl transform transition-transform hover:scale-105">
                <img
                  src={qrImageUrl}
                  alt="Admin UPI QR"
                  className="rounded-xl"
                  width="220"
                  height="220"
                  onError={onQrPreviewFail}
                />
              </div>
            ) : (
              <div className="flex h-[240px] flex-col gap-3 items-center justify-center rounded-[24px] border border-dashed border-blue-300 bg-white/50 p-6 text-center text-sm text-slate-500 dark:border-blue-800 dark:bg-slate-950/50 dark:text-slate-400 shadow-inner">
                 <span className="text-3xl opacity-50">📷</span>
                 <span>QR preview could not be loaded. Use the UPI ID below.</span>
              </div>
            )}
            <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">
              Compatible with GPay, PhonePe, Paytm, BHIM, etc.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] bg-gradient-to-br from-slate-100 to-white p-6 shadow-inner border border-slate-200/50 dark:border-slate-800/50 dark:from-slate-800/40 dark:to-slate-900/40 text-center lg:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Amount Due</p>
              <p className="text-4xl font-black text-blue-600 dark:text-blue-400 drop-shadow-sm">
                {formatCurrency(paymentQr.amount)}
              </p>
            </div>

            <div className="rounded-[20px] border border-slate-200/60 bg-white/50 px-5 py-4 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-[#0F172A]/50 flex flex-wrap items-center justify-between gap-3 group">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Admin UPI ID</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono select-all">{paymentQr.upi_id}</p>
              </div>
              <button
                type="button"
                onClick={onCopy}
                className="rounded-xl bg-blue-100 dark:bg-blue-900/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-all active:scale-95 shadow-sm"
              >
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[20px] border border-slate-200/60 bg-white/50 px-5 py-4 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-[#0F172A]/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Receiver</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{paymentQr.upi_name}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200/60 bg-white/50 px-5 py-4 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-[#0F172A]/50 flex flex-col items-end text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Reference</p>
                <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 truncate w-full">{paymentQr.reference}</p>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200/60 bg-white/50 px-5 py-4 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-[#0F172A]/50">
              <label htmlFor="vendor-commission-transaction-id" className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                Transaction ID <span className="text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded text-[8px]">RECOMMENDED</span>
              </label>
              <input
                id="vendor-commission-transaction-id"
                type="text"
                value={transactionId}
                onChange={(event) => onChangeTransactionId(event.target.value)}
                placeholder="Enter UPI transaction ID"
                className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner placeholder:font-sans placeholder:font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all"
              >
                Close
              </button>
              <a
                href={paymentQr.upi_url}
                className="rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-4 text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-center"
              >
                Open App
              </a>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                className="rounded-xl bg-blue-600 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex-1 text-center"
              >
                {confirming ? 'Confirming...' : 'MARK AS PAID'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VendorLedgerPage({ theme, onToggleTheme }) {
  const [ledger, setLedger] = useState([])
  const [summary, setSummary] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
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

  const limit = 20

  const loadLedger = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await getVendorLedger({ page, limit })
      setLedger(response?.ledger || [])
      setSummary(response?.summary ?? null)
      setTotal(response?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load vendor earnings')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  const totalPages = Math.ceil(total / limit) || 1

  const resetTimeLabel = useMemo(() => {
    if (!summary?.today_reset_at) return '11:59 PM today'

    return new Date(summary.today_reset_at).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [summary?.today_reset_at])

  const totalEarned = Number(summary?.total_earned ?? 0)
  const pendingCredits = Number(summary?.pending_credits ?? 0)
  const todayCommissionDue = Number(summary?.today_commission_due ?? 0)

  const handlePayCommission = async () => {
    setPaymentLoading(true)
    setPaymentError('')
    setSuccessMessage('')
    setCopied(false)
    setQrPreviewFailed(false)
    setTransactionId('')

    try {
      const response = await getVendorCommissionQr()
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
      const response = await confirmVendorCommissionPayment({
        transaction_id: transactionId.trim() || undefined,
      })
      setSuccessMessage(response?.message || 'Commission marked as paid.')
      setPaymentQr(null)
      setTransactionId('')
      await loadLedger()
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-0 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase ml-2 flex items-center gap-2">
                <span className="text-blue-500 text-2xl">📓</span> Payments
              </h1>
              <p className="mt-0.5 ml-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Daily 5% admin fee and earnings history
              </p>
            </div>
          </div>
          <MobileNav>
            <div className="flex flex-wrap items-center gap-3">
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
          <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Payments' }]} />
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
             <span className="text-xl">❌</span> {error}
          </div>
        )}

        {paymentError && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
             <span className="text-xl">⚠️</span> {paymentError}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-5 py-4 text-sm font-bold text-blue-700 dark:text-blue-300 shadow-sm animate-in fade-in">
             <span className="text-xl">✅</span> {successMessage}
          </div>
        )}

        <section className="mt-5 rounded-[32px] border border-blue-200/60 bg-white/60 p-8 shadow-xl backdrop-blur-md dark:border-blue-800/40 dark:bg-gradient-to-br dark:from-[#0B1120]/80 dark:to-slate-900/80 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-1000"></div>
          <div className="flex flex-wrap items-center justify-between gap-8 relative z-10">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span> Today’s admin fee
              </p>
              <p className="text-5xl md:text-6xl font-black text-blue-600 dark:text-blue-400 drop-shadow-sm tracking-tighter">
                {formatCurrency(todayCommissionDue)}
              </p>
              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
                This is 5% of today’s vendor earnings from <span className="font-bold text-blue-600 dark:text-blue-400">{summary?.today_commission_orders ?? 0} orders</span>. It resets after <span className="font-bold border-b border-dashed border-slate-400">{resetTimeLabel}</span>.
              </p>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <button
                type="button"
                onClick={handlePayCommission}
                disabled={paymentLoading || todayCommissionDue <= 0}
                className="rounded-2xl bg-blue-600 px-8 py-5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none disabled:shadow-none transition-all"
              >
                {paymentLoading ? 'OPENING...' : 'PAY 5% ADMIN FEE'}
              </button>
              <div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-6 py-4 shadow-inner dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur flex flex-col items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Admin UPI ID</p>
                <p className="mt-1 font-mono font-bold text-sm text-slate-800 dark:text-slate-200">sohamdhakatecse3905@okaxis</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-3">
          <div className="rounded-[24px] border border-blue-200/60 bg-blue-50/60 p-6 shadow-xl backdrop-blur-md dark:border-blue-800/40 dark:bg-blue-900/10 flex flex-col justify-between hover:-translate-y-1 transition-transform">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Total earned</p>
            <p className="mt-4 text-3xl font-black text-blue-700 dark:text-blue-300 tracking-tighter">{formatCurrency(totalEarned)}</p>
          </div>
          <div className="rounded-[24px] border border-amber-200/60 bg-amber-50/60 p-6 shadow-xl backdrop-blur-md dark:border-amber-800/40 dark:bg-amber-900/10 flex flex-col justify-between hover:-translate-y-1 transition-transform">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center justify-between">
               Pending payments <span className="bg-amber-200/50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-lg text-[8px]">DUE</span>
            </p>
            <p className="mt-4 text-3xl font-black text-amber-700 dark:text-amber-400 tracking-tighter">{formatCurrency(pendingCredits)}</p>
          </div>
          <div className="rounded-[24px] border border-emerald-200/60 bg-emerald-50/60 p-6 shadow-xl backdrop-blur-md dark:border-emerald-800/40 dark:bg-emerald-900/10 flex flex-col justify-between hover:-translate-y-1 transition-transform">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Today’s 5% total</p>
            <p className="mt-4 text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tighter">{formatCurrency(todayCommissionDue)}</p>
          </div>
        </section>

        {loading ? (
          <div className="mt-8 relative z-10"><ListSkeleton /></div>
        ) : ledger.length === 0 ? (
          <div className="mt-10 rounded-[32px] border border-dashed border-slate-300/60 bg-white/40 p-16 text-center dark:border-slate-700/60 dark:bg-slate-900/40 backdrop-blur-md relative z-10 shadow-sm animate-in zoom-in-95 duration-700">
            <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-[32px] bg-white/80 dark:bg-slate-800/80 text-5xl shadow-xl shadow-slate-200/20 dark:shadow-none mb-6 border border-slate-100 dark:border-slate-800">
               📇
            </div>
            <p className="mt-4 text-lg font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">No payment entries yet</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your earnings and admin fee history will appear here.
            </p>
          </div>
        ) : (
          <div className="relative z-10 animate-in slide-in-from-bottom-4 duration-700 mt-8">
            <div className="overflow-x-auto rounded-[32px] border border-slate-200/60 bg-white/60 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-slate-800/50">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Reference</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry, index) => {
                    const amount = Number(entry.amount || 0)
                    const amountClass = amount < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'

                    return (
                      <tr key={entry.payout_id || entry.ledger_id || index} className="group border-b border-slate-100/50 dark:border-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-800/40 transition-all last:border-0">
                        <td className="px-6 py-5 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {formatLedgerDate(entry.created_at)}
                        </td>
                        <td className="px-6 py-5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          {String(entry.reference || entry.order_id || entry.payout_id || '-').slice(0, 18)}
                        </td>
                        <td className="px-6 py-5">
                          <span className="capitalize text-xs font-bold text-slate-700 dark:text-slate-300">{String(entry.type || 'payout').replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{entry.warehouse || '-'}</td>
                        <td className={`px-6 py-5 text-right font-mono font-black text-sm ${amountClass}`}>
                          {amount < 0 ? '-' : '+'}
                          {formatCurrency(Math.abs(amount))}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-block rounded-xl border px-3 py-1 text-[9px] font-black tracking-widest uppercase shadow-sm ${STATUS_COLORS[entry.status] || STATUS_COLORS.pending} border-current/20`}>
                            {entry.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                          {entry.notes || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4 relative z-10">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                >
                  Prev
                </button>
                <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm">
                  Page {page} <span className="opacity-50 mx-1">/</span> {totalPages}
                </div>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <PaymentModal
        paymentQr={paymentQr}
        copied={copied}
        confirming={confirmingPayment}
        qrPreviewFailed={qrPreviewFailed}
        transactionId={transactionId}
        onChangeTransactionId={setTransactionId}
        onClose={() => setPaymentQr(null)}
        onConfirm={handleConfirmPayment}
        onCopy={handleCopyUpiId}
        onQrPreviewFail={() => setQrPreviewFailed(true)}
      />
    </div>
  )
}

export default VendorLedgerPage
