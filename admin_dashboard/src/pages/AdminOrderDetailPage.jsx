import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getOrderById, refundOrder, markOrderPaid } from '../lib/api'
import { DetailSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { formatLabel } from '../lib/displayText'

function AdminOrderDetailPage() {
  const { orderId } = useParams()
  const [order, setOrder]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')
  const [refundReason, setRefundReason] = useState('')

  const load = useCallback(() => {
    getOrderById(orderId).then((r) => setOrder(r.order || r)).catch(() => null).finally(() => setLoading(false))
  }, [orderId])
  useEffect(() => { load() }, [load])

  const handleRefund = async () => {
    if (!refundReason.trim()) return setErr('Refund reason is required')
    setBusy(true); setErr('')
    try { await refundOrder(orderId, refundReason); setRefundReason(''); load() } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleMarkPaid = async () => {
    setBusy(true); setErr('')
    try { await markOrderPaid(orderId); load() } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (loading) return <DetailSkeleton />
  if (!order) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><p className="text-slate-500">Order not found</p></div>

  const canRefund = order.payment_status === 'completed' && order.order_status !== 'cancelled'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'DASHBOARD', to: '/admin/dashboard' }, { label: 'PROCUREMENT HUB', to: '/admin/orders' }, { label: `ORD-${order.order_number || order.order_id.slice(0, 8)}`.toUpperCase() }]} />
        </div>

        {err && (
          <div className="mb-6 p-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 border border-red-500 animate-pulse">
            {err}
          </div>
        )}

        {/* glass hero header */}
        <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-500 mb-8 font-['Outfit']">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[32px] bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-500/30 transform -rotate-3 hover:rotate-0 transition-transform font-['Outfit']">
                ORD
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400 mb-1 leading-none">Order details</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Order #{order.order_number || order.order_id.slice(0, 8)}</h1>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    {formatLabel(order.order_status)}
                  </span>
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-500/20`}>
                    Payment: {formatLabel(order.payment_status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-2 leading-none text-right">Settlement Amount</p>
              <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none group-hover:scale-105 transition-transform origin-right">₹{Number(order.total).toLocaleString()}</p>
              <p className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Base ₹{order.subtotal} + Tax ₹{order.tax}</p>
              {order.payment_status !== 'completed' && order.payment_status !== 'refunded' && (
                <button 
                  disabled={busy} 
                  onClick={handleMarkPaid} 
                  className="mt-6 px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {busy ? 'SYNCHRONIZING...' : 'Mark as Paid'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* refund protocol */}
        {canRefund && (
          <div className="group relative overflow-hidden rounded-[40px] border-2 border-red-600/30 dark:border-red-500/20 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-2xl mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-600/20 animate-pulse">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Refund Authorization</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-none">Refund status</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Forensic Justification<RequiredAsterisk /></label>
                <input 
                  value={refundReason} 
                  onChange={(e) => setRefundReason(e.target.value)} 
                  placeholder="REQUIRED_METADATA..." 
                  className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-red-500 px-6 py-4 text-xs font-bold outline-none transition-all shadow-inner" 
                />
              </div>
              <button 
                disabled={busy || !refundReason.trim()} 
                onClick={handleRefund} 
                className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all active:scale-95 disabled:opacity-30"
              >
                {busy ? 'REVERSING...' : 'Execute Refund'}
              </button>
            </div>
          </div>
        )}

        {/* procurement nodes grid */}
        <div className="grid gap-6 sm:grid-cols-2 mb-8 font-['Outfit']">
          {/* buyer node */}
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-blue-500/50">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 leading-none">Customer</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-xl border border-blue-500/20 shadow-inner">
                {order.user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{order.user?.full_name || '--'}</p>
                <p className="text-xs font-bold text-slate-500 mt-2 tracking-wide font-['Inter']">{order.user?.email}</p>
              </div>
            </div>
          </div>

          {/* supply node */}
          <div className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl transition-all hover:border-indigo-500/50 font-['Outfit']">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 leading-none">Warehouse</h3>
            <div className="mb-6">
              <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{order.warehouse?.name || '--'}</p>
              <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">{order.warehouse?.city || 'UNKNOWN_LOC'}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Vendor: {order.warehouse?.vendor?.full_name || '--'}</p>
            </div>
            <Link to={`/admin/warehouses/${order.warehouse_id}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
              Trace Terminal Map →
            </Link>
          </div>
        </div>

        {/* bill of materials */}
        {order.items?.length > 0 && (
          <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-2xl p-8 shadow-2xl transition-all mb-8 font-['Outfit']">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-xs font-black">#</div>
              Bill of Materials ({order.items.length})
            </h2>
            <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-[11px] font-bold uppercase tracking-tight">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Part Specification</th>
                    <th className="px-6 py-4 text-center">Volume</th>
                    <th className="px-6 py-4 text-right">Unit settlement</th>
                    <th className="px-6 py-4 text-right">Gross Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {order.items.map((i) => (
                    <tr key={i.order_item_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group/row">
                      <td className="px-6 py-6 border-transparent">
                        <p className="text-slate-900 dark:text-white font-black">{i.part?.part_name || `PART_NODE_${i.part_id}`}</p>
                        <p className="text-[8px] text-slate-400 tracking-[0.2em] mt-1 italic">INV_SPEC_IDX</p>
                      </td>
                      <td className="px-6 py-6 text-center border-transparent">
                        <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/50 text-slate-900 dark:text-white font-black">{i.quantity}</span>
                      </td>
                      <td className="px-6 py-6 text-right text-slate-500 font-black border-transparent">₹{Number(i.unit_price).toLocaleString()}</td>
                      <td className="px-6 py-6 text-right text-slate-900 dark:text-white font-black border-transparent">₹{Number(i.total_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* fulfillments and logistics */}
        <div className="grid gap-6 lg:grid-cols-2 items-start mb-8 font-['Outfit']">
           {/* fulfillment panel */}
           {order.fulfillments?.length > 0 && (
              <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
                 <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 leading-none">Delivery tracking</h2>
                 <div className="space-y-6">
                    {order.fulfillments.map((f) => (
                      <div key={f.fulfillment_id} className="rounded-3xl border border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-900/30 hover:border-blue-500/30 transition-all">
                        <div className="flex flex-wrap gap-3 mb-6">
                           <span className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">{formatLabel(f.status)}</span>
                           <span className="px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">{f.carrier || 'Carrier pending'}</span>
                        </div>
                        <div className="grid gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                           {f.tracking_number && (
                             <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900/50 shadow-inner">
                               <span>Waybill / Tracking</span>
                               <span className="text-blue-600 dark:text-blue-400 tabular-nums">{f.tracking_number}</span>
                             </div>
                           )}
                           {f.estimated_delivery && (
                             <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900/50 shadow-inner">
                               <span>Est Deployment Date</span>
                               <span className="text-slate-900 dark:text-white">{new Date(f.estimated_delivery).toLocaleDateString().toUpperCase()}</span>
                             </div>
                           )}
                        </div>
                        {f.notes && <p className="mt-6 p-4 rounded-xl bg-white dark:bg-slate-900/20 border-l-4 border-blue-500 text-[10px] font-medium text-slate-500 italic">"{f.notes}"</p>}
                      </div>
                    ))}
                 </div>
              </section>
           )}

           {/* inventory allocation */}
           {order.reservations?.length > 0 && (
              <section className="group relative overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-xl">
                 <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 leading-none">Inventory Reservation Block</h2>
                 <div className="space-y-4">
                    {order.reservations.map((r) => (
                      <div key={r.reservation_id} className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 group/res hover:border-indigo-500/30 transition-all">
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{r.quantity} <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">UNITS</span></span>
                            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-widest border border-indigo-500/20">{formatLabel(r.status)}</span>
                         </div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Expiration: {new Date(r.expires_at).toLocaleString().toUpperCase()}</p>
                      </div>
                    ))}
                 </div>
              </section>
           )}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600 bg-white/50 dark:bg-[#0B1120]/50 px-6 py-2 rounded-full border border-white/20 dark:border-slate-800/50 shadow-sm leading-none">
            Procurement Audit Index: ORD-{order.order_number || order.order_id.slice(0, 8)}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Created Sequence: {new Date(order.created_at).toLocaleString().toUpperCase()}</p>
        </div>
      </div>
    </div>
  )
}

export default AdminOrderDetailPage
