import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getInvoiceById, markInvoicePaid } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import generateInvoicePDF from '../lib/generateInvoicePDF'
import Breadcrumbs from '../components/Breadcrumbs'
import { formatLabel } from '../lib/displayText'

function AdminInvoiceDetailPage() {
  const { invoiceId } = useParams()
  const [inv, setInv]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)

  const load = useCallback(() => {
    getInvoiceById(invoiceId).then((r) => setInv(r.invoice || r)).catch(() => null).finally(() => setLoading(false))
  }, [invoiceId])
  useEffect(() => { load() }, [load])

  const handleMarkPaid = async () => { setBusy(true); try { await markInvoicePaid(invoiceId); load() } catch { /* */ } setBusy(false) }

  const payColor = (s) => {
    const m = { pending: 'bg-amber-100 text-amber-800', completed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800', refunded: 'bg-purple-100 text-purple-800' }
    return m[s] || 'bg-slate-100 text-slate-700'
  }

  if (loading) return <DetailSkeleton />
  if (!inv) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Invoice not found</p></div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'FISCAL LEDGER', to: '/admin/invoices' }, { label: `INV-${inv.invoice_id.slice(0, 8)}`.toUpperCase() }]} />
        </div>

        {/* glass hero header */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-indigo-500/30 transform rotate-3 hover:rotate-0 transition-transform">
                INV
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 dark:text-indigo-400 mb-1 leading-none">Invoice details</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Invoice #{inv.invoice_id.slice(0, 8)}</h1>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${payColor(inv.payment_status)} border shadow-sm`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${inv.payment_status === 'completed' ? 'bg-green-500' : 'bg-current animate-pulse'}`}></div>
                    {formatLabel(inv.payment_status)}
                  </span>
                  {inv.payment_method && (
                    <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                      {formatLabel(inv.payment_method)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">₹{Number(inv.total).toLocaleString()}</p>
              <p className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Subtotal ₹{inv.subtotal} + Tax ₹{inv.tax}</p>
              <div className="mt-6 flex justify-end gap-3">
                {inv.payment_status !== 'completed' && inv.payment_status !== 'refunded' && (
                  <button disabled={busy} onClick={handleMarkPaid} className="px-6 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">Mark as Paid</button>
                )}
                <button
                  onClick={() => generateInvoicePDF(inv, {
                    customerName: inv.job?.request?.user?.full_name,
                    technicianName: inv.job?.technician?.user?.full_name,
                    issueType: inv.job?.request?.issue_type,
                  })}
                  className="px-6 py-4 rounded-2xl border-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all active:scale-[0.98] flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* related job cross-link */}
        {inv.job && (
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-indigo-500/50 mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-6">Related job</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Job Reference</p>
                  <Link to={`/admin/jobs/${inv.job.job_id}`} className="text-sm font-black text-slate-900 dark:text-white hover:text-indigo-500 transition-colors uppercase tracking-tight">#{inv.job.job_id.slice(0, 8)}</Link>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Principal User</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{inv.job.request?.user?.full_name || '--'}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Assigned Technician</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{inv.job.technician?.user?.full_name || '--'}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Incident Context</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{formatLabel(inv.job.request?.issue_type)}</p>
               </div>
            </div>
          </div>
        )}

        {/* line items ledger */}
        {inv.items?.length > 0 && (
          <section className="relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all mb-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Line Item Ledger</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-bold">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="pb-4 pr-3">Classification</th>
                    <th className="pb-4 pr-3">Item Description</th>
                    <th className="pb-4 pr-3 text-center">Qty Vol</th>
                    <th className="pb-4 pr-3 text-center">Unit Price</th>
                    <th className="pb-4 text-right">Settlement Vol (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {inv.items.map((i) => (
                    <tr key={i.item_id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="py-5 pr-3">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                          {formatLabel(i.item_type)}
                        </span>
                      </td>
                      <td className="py-5 pr-3">
                        <p className="text-slate-900 dark:text-white uppercase tracking-tight font-black">{i.description}</p>
                      </td>
                      <td className="py-5 pr-3 text-center">
                        <span className="text-slate-900 dark:text-white font-black">{i.quantity}</span>
                      </td>
                      <td className="py-5 pr-3 text-center font-bold text-slate-500">₹{Number(i.unit_price).toLocaleString()}</td>
                      <td className="py-5 text-right font-black text-slate-900 dark:text-white text-sm">
                        ₹{Number(i.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* temporal registry */}
        <div className="rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6 uppercase">Timeline</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Issued Timestamp', new Date(inv.issued_at).toLocaleString().toUpperCase()],
              ['Settlement Timestamp', inv.paid_at ? new Date(inv.paid_at).toLocaleString().toUpperCase() : 'PENDING_CLEARANCE'],
              ['Transaction Audit ID', inv.transaction_id || 'NULL_IDX'],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">{l}</p>
                <p className="text-[11px] font-black text-slate-900 dark:text-white tracking-widest uppercase truncate">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400/60 transition-colors dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm">
            Fiscal Audit Index: {inv.invoice_id.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminInvoiceDetailPage
