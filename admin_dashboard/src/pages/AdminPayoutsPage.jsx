import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getPayoutSummary, getPayoutHistory, markPayoutPaid } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import RequiredAsterisk from '../components/RequiredAsterisk'

const cardStyle = 'rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl'
function formatCurrency(value) {
  if (value == null) return '₹0'
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function AdminPayoutsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [roleFilter, setRoleFilter] = useState('')

  const [summary, setSummary] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  const [paymentModal, setPaymentModal] = useState({ isOpen: false, payoutId: null, txnId: '', amount: 0, loading: false })

  const handleMarkPaid = async (e) => {
    e.preventDefault()
    setPaymentModal(p => ({ ...p, loading: true }))
    try {
      await markPayoutPaid(paymentModal.payoutId, { transaction_id: paymentModal.txnId })
      setPaymentModal({ isOpen: false, payoutId: null, txnId: '', amount: 0, loading: false })
      loadPayouts()
    } catch (err) {
      alert(err.message || "Failed to mark as paid")
      setPaymentModal(p => ({ ...p, loading: false }))
    }
  }

  const loadSummary = useCallback(async () => {
    try {
      const result = await getPayoutSummary({ month, year })
      setSummary(result)
    } catch { setSummary(null) }
  }, [month, year])

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    try {
      const params = { month, year }
      if (roleFilter) params.recipient_role = roleFilter
      const result = await getPayoutHistory(params)
      setPayouts(result.payouts || [])
    } catch { setPayouts([]) }
    finally { setLoading(false) }
  }, [month, year, roleFilter])

  useEffect(() => { loadSummary(); loadPayouts() }, [loadSummary, loadPayouts])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Payouts' }]} />

        {/* Header */}
        <div className={cardStyle + ' mt-6 p-8'}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Payouts</h1>
              <p className="mt-2 text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                Review technician and vendor payout records for the selected month.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm transition-all focus:border-blue-500">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' }).toUpperCase()}</option>
                ))}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2020} max={2099} className="w-24 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm transition-all focus:border-blue-500" />
            </div>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div 
              className={cardStyle + ' p-8 cursor-pointer transition-all hover:translate-y-[-4px] group ' + (roleFilter === 'technician' ? 'ring-2 ring-blue-500 scale-[1.02]' : '')} 
              onClick={() => setRoleFilter(roleFilter === 'technician' ? '' : 'technician')}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-blue-500 transition-colors">Technician Payouts</p>
              <p className="mt-3 text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{formatCurrency(summary.technician_total)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{summary.technician_count} payout(s)</p>
            </div>
            
            <div 
              className={cardStyle + ' p-8 cursor-pointer transition-all hover:translate-y-[-4px] group ' + (roleFilter === 'vendor' ? 'ring-2 ring-purple-500 scale-[1.02]' : '')} 
              onClick={() => setRoleFilter(roleFilter === 'vendor' ? '' : 'vendor')}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-purple-500 transition-colors">Vendor Payouts</p>
              <p className="mt-3 text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">{formatCurrency(summary.vendor_total)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{summary.vendor_count} payout(s)</p>
            </div>
            
            <div 
              className={cardStyle + ' p-8 cursor-pointer transition-all hover:translate-y-[-4px] group ' + (roleFilter === '' ? 'ring-2 ring-emerald-500 scale-[1.02]' : '')} 
              onClick={() => setRoleFilter('')}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-emerald-500 transition-colors">Total Distributed</p>
              <p className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatCurrency(summary.total_amount)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{summary.total_count} total payout(s)</p>
            </div>
          </div>
        )}

        {/* Transfer ledger */}
        <section className={cardStyle + ' mt-8 p-8 mb-12'}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-black uppercase tracking-[0.3em]">
              Auto-Transfer History — {new Date(2000, month - 1).toLocaleString('default', { month: 'long' }).toUpperCase()} {year}
              {roleFilter && <span className="ml-3 px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-full text-[8px] font-black text-blue-600 uppercase tracking-[0.2em]">{roleFilter}s</span>}
            </h2>
            {roleFilter && (
              <button 
                onClick={() => setRoleFilter('')} 
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500"
              >
                Show all
              </button>
            )}
          </div>

          {loading ? <ListSkeleton /> : payouts.length === 0 ? (
            <p className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No payouts for this period yet.</p>
          ) : (
            <div className="space-y-4">
              {payouts.map((p) => (
                <div key={p.payout_id} className="rounded-3xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 p-6 transition-all hover:shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black uppercase tracking-tight">{p.recipient?.full_name || 'UNKNOWN'}</span>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${p.recipient_role === 'technician' ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20' : 'bg-purple-600/10 text-purple-600 border border-purple-600/20'}`}>
                          {p.recipient_role}
                        </span>
                        {p.status === 'completed' && Number(p.amount) > 0 ? (
                          <span className="px-3 py-1 rounded-full bg-amber-600/10 text-amber-600 border border-amber-600/20 text-[8px] font-black uppercase tracking-widest">
                            Pending Payment
                          </span>
                        ) : p.status === 'settled' ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 text-[8px] font-black uppercase tracking-widest">
                            Settled
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-[8px] font-black uppercase tracking-widest text-slate-500">
                            {p.status || 'UNKNOWN'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">{p.recipient?.email}</p>
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{formatCurrency(p.amount)}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Source: <span className="text-slate-900 dark:text-gray-200">{p.source_type || '—'}</span>
                        &nbsp;&middot;&nbsp;Paid at: {p.paid_at ? new Date(p.paid_at).toLocaleString().toUpperCase() : '—'}
                      </p>
                      {p.transaction_id && (
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Txn ID: <span className="font-mono text-slate-900 dark:text-gray-200 select-all">{p.transaction_id}</span></p>
                      )}
                    </div>
                    
                    <div className="text-right space-y-2 flex flex-col items-end">
                      <div className="space-y-1.5 font-mono text-[10px] text-right">
                        {p.recipient?.upi_id && (
                          <div className="flex items-center gap-3 justify-end">
                            <span className="text-slate-400 text-[8px] font-black uppercase">UPI:</span>
                            <span className="font-black text-blue-600 dark:text-blue-400 select-all">{p.recipient.upi_id}</span>
                          </div>
                        )}
                        {p.recipient?.bank_account_number && (
                          <>
                            <div className="flex items-center gap-3 justify-end">
                              <span className="text-slate-400 text-[8px] font-black uppercase">A/C:</span>
                              <span className="font-black select-all">{p.recipient.bank_account_number}</span>
                            </div>
                            <div className="flex items-center gap-3 justify-end">
                              <span className="text-slate-400 text-[8px] font-black uppercase">IFSC:</span>
                              <span className="font-black select-all uppercase">{p.recipient.bank_ifsc}</span>
                            </div>
                            {p.recipient.bank_holder_name && (
                              <div className="flex items-center gap-3 justify-end">
                                <span className="text-slate-400 text-[8px] font-black uppercase">Name:</span>
                                <span className="font-black uppercase text-[9px]">{p.recipient.bank_holder_name}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      {p.status === 'completed' && Number(p.amount) > 0 && (
                        <div className="mt-4">
                          <button
                            onClick={() => setPaymentModal({ isOpen: true, payoutId: p.payout_id, txnId: '', amount: p.amount, loading: false })}
                            className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 hover:shadow-xl shadow-blue-600/20 shadow-lg transition-all active:scale-95"
                          >
                            Mark as Paid
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Payment Modal */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[40px] border border-white/20 dark:border-slate-800 bg-white dark:bg-[#030712] p-8 shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Mark Payout as Paid</h3>
            <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
              Record the manual transfer of <span className="text-blue-600 dark:text-blue-400">₹{Number(paymentModal.amount).toLocaleString('en-IN')}</span> to the recipient's node.
            </p>
            
            <form onSubmit={handleMarkPaid} className="mt-8 space-y-6 text-left">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1">Transaction ID / UTR<RequiredAsterisk /></label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={paymentModal.txnId}
                  onChange={e => setPaymentModal(p => ({ ...p, txnId: e.target.value }))}
                  className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-6 py-4 text-[11px] font-black uppercase tracking-widest outline-none transition-all shadow-inner"
                  placeholder="e.g. UTR12345678"
                />
              </div>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentModal({ isOpen: false, payoutId: null, txnId: '', amount: 0, loading: false })}
                  className="flex-1 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-['Outfit']"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentModal.loading}
                  className="flex-1 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {paymentModal.loading ? 'Saving...' : 'Confirm Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default AdminPayoutsPage
