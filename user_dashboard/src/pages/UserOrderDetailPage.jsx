import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { io } from 'socket.io-client'
import { QRCodeSVG } from 'qrcode.react'
import {
  ApiError,
  cancelOrder,
  getOrderById,
  getOrderFulfillment,
  getOrderQrData,
  payOrder,
  requestOrderReturn,
  userLogout,
  createVendorReview,
} from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'
import OrderLiveTracker from '../components/OrderLiveTracker'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { formatLabel } from '../lib/displayText'

const ORDER_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  returned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const PAYMENT_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
}

const FULFILLMENT_COLORS = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_transit: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

function formatCurrency ( value )
{
  if ( value == null ) return 'N/A'
  return `₹${ Number( value ).toLocaleString( 'en-IN' ) }`
}

function formatDateTime ( value )
{
  if ( !value ) return 'N/A'
  return new Date( value ).toLocaleString()
}

function StatusBadge ( { status, colorMap } )
{
  const color = colorMap?.[ status ] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ color }`}>{formatLabel( status )}</span>
}

function getOrderTrackingMode ( order, latestFulfillment )
{
  if ( order?.return_status === 'requested' && order?.order_status === 'delivered' ) {
    return 'return_pickup'
  }

  if (
    [ 'processing', 'shipped' ].includes( order?.order_status )
    || [ 'processing', 'shipped', 'in_transit' ].includes( latestFulfillment?.status )
  ) {
    return 'delivery'
  }

  return null
}
function UserOrderDetailPage({ theme, onToggleTheme }) {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [order, setOrder] = useState(null)
  const [fulfillments, setFulfillments] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [payment, setPayment] = useState({ payment_method: 'upi', transaction_id: '' })
  const [isPaying, setIsPaying] = useState(false)
  const [message, setMessage] = useState('')
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [liveStatus, setLiveStatus] = useState('connecting')
  
  const [vendorReview, setVendorReview] = useState({ rating: 5, comment: '' })
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  const loadOrder = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [orderResponse, fulfillmentResponse] = await Promise.all([
        getOrderById(orderId),
        getOrderFulfillment(orderId),
      ])
      setOrder(orderResponse?.order || null)
      setFulfillments(fulfillmentResponse?.fulfillments || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load order details.')
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useEffect(() => { loadOrder() }, [loadOrder])

  useEffect(() => {
    if (!orderId) return undefined
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'], reconnection: true })
    socket.on('connect', () => setLiveStatus('live'))
    socket.on('disconnect', () => setLiveStatus('offline'))
    socket.on('connect_error', () => setLiveStatus('offline'))
    socket.on('notification:new', (payload) => {
      if (payload?.data?.order_id !== orderId) return
      setMessage(payload.message || payload.title || 'Order updated in real time.')
      loadOrder().catch(() => null)
    })
    return () => { socket.disconnect() }
  }, [loadOrder, orderId])

  useEffect(() => {
    const loadQr = async () => {
      if (!order || order.payment_status === 'completed' || order.order_status === 'cancelled' || order.payment_method === 'cash_on_delivery') {
        setQrData(null)
        return
      }
      setQrLoading(true)
      try {
        const data = await getOrderQrData(order.order_id)
        setQrData(data)
      } catch {
        setQrData(null)
      } finally {
        setQrLoading(false)
      }
    }
    loadQr()
  }, [order])

  const handlePay = async (e) => {
    e.preventDefault()
    if (!payment.transaction_id.trim()) return
    setIsPaying(true)
    setError(''); setMessage('')
    try {
      await payOrder(orderId, { payment_method: payment.payment_method, transaction_id: payment.transaction_id.trim() })
      setMessage('Order payment successful.')
      setPayment((p) => ({ ...p, transaction_id: '' }))
      await loadOrder()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to complete order payment.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleReturnRequest = async () => {
    if (!returnReason.trim()) return
    setIsSubmittingReturn(true)
    setError(''); setMessage('')
    try {
      const resp = await requestOrderReturn(orderId, { reason: returnReason.trim() })
      setMessage(resp?.message || 'Return request submitted.')
      setReturnReason('')
      await loadOrder()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit return request.')
    } finally {
      setIsSubmittingReturn(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return
    setIsCancelling(true)
    setError(''); setMessage('')
    try {
      const resp = await cancelOrder(orderId)
      setMessage(resp?.message || 'Order cancelled successfully.')
      await loadOrder()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel this order.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const handleVendorReview = async () => {
    if (!vendorReview.comment.trim()) {
      setError('Please provide a comment for your review.')
      return
    }
    setIsSubmittingReview(true)
    setError(''); setMessage('')
    try {
      await createVendorReview({
        order_id: orderId,
        rating: vendorReview.rating,
        comment: vendorReview.comment.trim()
      })
      setMessage('Vendor review submitted successfully.')
      await loadOrder()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit review.')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const latestFulfillment = fulfillments[0] || null
  const canRequestReturn = Boolean(order?.is_return_eligible && !['requested', 'approved'].includes(order?.return_status) && order?.order_status !== 'returned')
  const canCancelOrder = ['pending', 'confirmed', 'processing'].includes(order?.order_status)
  const isCashOnDelivery = order?.payment_method === 'cash_on_delivery'
  const orderTrackingMode = getOrderTrackingMode(order, latestFulfillment)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 pb-20">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6">
           <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <button 
                onClick={() => navigate('/orders')}
                className="shrink-0 w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-all shadow-sm"
              >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex-1 min-w-[200px]">
             <span className="text-[10px] md:text-xs font-black tracking-widest text-slate-400 uppercase">ORDER DETAILS</span>
                 <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight break-all">
                    {order ? (order.order_number || `#${order.order_id.slice(0, 8)}`) : 'Loading...'}
                 </h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
             <button onClick={onToggleTheme} className="shrink-0 w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-slate-400">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={handleLogout} className="whitespace-nowrap px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-xs font-black tracking-widest uppercase active:scale-95 transition-all shadow-lg">
                LOGOUT
             </button>
           </div>
        </header>

        {error && <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">⚠️ {error}</div>}
        {message && <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">ℹ️ {message}</div>}

        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : !order ? (
          <div className="py-24 text-center">
             <div className="text-5xl mb-6 opacity-20">🔎</div>
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Order not found</h3>
             <p className="text-xs text-slate-500 mt-2 font-medium">This order does not exist, or the link is no longer valid.</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="p-6 rounded-[32px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative group transition-all hover:border-blue-500/30">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ORDER STATUS</p>
                  <StatusBadge status={order.order_status} colorMap={ORDER_STATUS_COLORS} />
                  <p className="mt-4 text-[11px] font-bold text-slate-500 uppercase tracking-tight">Updated: {formatDateTime(order.updated_at)}</p>
               </div>
               <div className="p-6 rounded-[32px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative group transition-all hover:border-amber-500/30">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">PAYMENT STATUS</p>
                  <StatusBadge status={order.payment_status} colorMap={PAYMENT_COLORS} />
                  <p className="mt-4 text-[11px] font-bold text-slate-500 uppercase tracking-tight">Method: {formatLabel(order.payment_method) || 'Not selected'}</p>
               </div>
               <div className="p-6 rounded-[32px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xl overflow-hidden relative">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 dark:bg-blue-600/10 blur-3xl rounded-full"></div>
                  <p className="text-[10px] font-black text-white/50 dark:text-slate-500 uppercase tracking-widest mb-2">ORDER TOTAL</p>
                  <h2 className="text-3xl font-black tracking-tighter leading-tight">{formatCurrency(order.total)}</h2>
                  <p className="mt-2 text-[10px] font-black text-blue-400 dark:text-blue-600 uppercase tracking-widest">Including tax</p>
               </div>
            </div>

            {/* Main Details Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               {/* Product Items */}
               <div className="lg:col-span-2 space-y-6">
                  <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 shadow-2xl overflow-hidden">
                     <div className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Order Items</h2>
                        <span className="text-[10px] font-bold text-slate-500">{order.items?.length} Items</span>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                 <th className="px-8 py-4">PART</th>
                                 <th className="px-8 py-4">UNIT PRICE</th>
                                 <th className="px-8 py-4">QTY</th>
                                 <th className="px-8 py-4 text-right">SUBTOTAL</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                              {order.items?.map((item) => (
                                 <tr key={item.order_item_id} className="group hover:bg-blue-500/5 transition-all">
                                    <td className="px-8 py-6">
                                       <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.part?.part_name || 'PART_' + item.part_id}</p>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{item.part?.category?.category_name || 'Generic'}</p>
                                    </td>
                                    <td className="px-8 py-6 text-xs text-slate-500 dark:text-slate-400">{formatCurrency(item.unit_price)}</td>
                                    <td className="px-8 py-6 text-xs font-black text-slate-900 dark:text-white">×{item.quantity}</td>
                                    <td className="px-8 py-6 text-right text-xs font-black text-blue-600 dark:text-blue-400">{formatCurrency(item.total_price)}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </section>

                  {/* Tracking Section */}
                  {orderTrackingMode && (
                     <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 shadow-2xl p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 px-4 pt-4">
                           <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-widest">Live Delivery Tracking</h2>
                           <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className={`w-2 h-2 rounded-full ${liveStatus === 'live' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{liveStatus === 'live' ? 'LIVE' : 'CONNECTING...'}</span>
                           </div>
                        </div>
                        <div className="rounded-[32px] overflow-hidden border border-slate-100 dark:border-slate-800">
                           <OrderLiveTracker
                              orderId={order.order_id}
                              vendorName={order.warehouse?.name || 'Vendor location'}
                              initialLat={order.warehouse?.latitude}
                              initialLng={order.warehouse?.longitude}
                              destinationLat={order.delivery_latitude}
                              destinationLng={order.delivery_longitude}
                              trackingType={orderTrackingMode}
                              dark={theme === 'dark'}
                           />
                        </div>
                     </section>
                  )}
               </div>

               {/* Sidebar Info */}
               <div className="space-y-8">
                  
                  {/* Shipping Address */}
                  <section className="p-8 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
                     <div className="absolute top-0 right-0 p-8 text-blue-500/10">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                     </div>
                     <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Delivery Address</h2>
                     <div className="space-y-4">
                        <div>
                           <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-widest">CONTACT</p>
                           <p className="text-xs font-bold text-slate-900 dark:text-white">{order.delivery_contact_name || 'N/A'}</p>
                           <p className="text-[11px] text-slate-500 font-mono mt-0.5">{order.delivery_phone}</p>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-widest">ADDRESS</p>
                           <p className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">{order.delivery_address || 'Map pin only'}</p>
                           <p className="text-[11px] text-slate-500 font-bold uppercase mt-1">{order.delivery_city}, {order.delivery_state} {order.delivery_postal_code}</p>
                        </div>
                        {order.delivery_latitude != null && (
                           <a
                              href={`https://www.google.com/maps/search/?api=1&query=${order.delivery_latitude},${order.delivery_longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-12 mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-blue-600 dark:text-blue-400"
                           >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              OPEN IN MAPS
                           </a>
                        )}
                     </div>
                  </section>

                  {/* Payment / Action */}
                  {order.payment_status !== 'completed' && order.order_status !== 'cancelled' && !isCashOnDelivery && (
                     <section className="p-8 rounded-[40px] bg-blue-600 shadow-2xl shadow-blue-600/30 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
                        <h2 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6">Payment</h2>
                        
                        {qrLoading ? (
                           <div className="py-10 flex flex-col items-center gap-4">
                              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                              <p className="text-[10px] font-black uppercase tracking-widest">Loading payment QR...</p>
                           </div>
                        ) : qrData ? (
                           <div className="space-y-6">
                              <div className="bg-white p-4 rounded-3xl shadow-xl transition-all group-hover:scale-[1.02]">
                                 <QRCodeSVG value={qrData.upi_url} size={null} className="w-full h-auto" level="H" includeMargin />
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">PAY TO</p>
                                 <p className="text-sm font-black uppercase tracking-tight truncate">{qrData.vendor_name}</p>
                                 <p className="text-[10px] font-mono text-white/70">{qrData.vendor_upi_id}</p>
                              </div>
                              <form onSubmit={handlePay} className="space-y-3">
                                 <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest">
                                    Transaction ID
                                    <RequiredAsterisk className="text-white" />
                                 </label>
                                 <input
                                    type="text"
                                    placeholder="Enter transaction ID"
                                    value={payment.transaction_id}
                                    onChange={(e) => setPayment(p => ({ ...p, transaction_id: e.target.value }))}
                                    className="w-full h-12 bg-white/10 border border-white/20 rounded-2xl px-5 text-[10px] font-black placeholder:text-white/40 uppercase tracking-widest outline-none focus:bg-white/20 transition-all"
                                 />
                                 <button
                                    type="submit"
                                    disabled={isPaying || !payment.transaction_id.trim()}
                                    className="w-full h-12 bg-white text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-xl active:scale-95 transition-all shadow-lg"
                                 >
                                    {isPaying ? 'PROCESSING...' : 'CONFIRM PAYMENT'}
                                 </button>
                                 <a 
                                    href={qrData.upi_url}
                                    className="w-full h-12 inline-flex items-center justify-center rounded-2xl border border-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                 >
                                    OPEN UPI APP
                                 </a>
                              </form>
                           </div>
                        ) : (
                           <p className="text-xs font-black text-white/60 text-center py-6 uppercase tracking-widest">QR not available right now</p>
                        )}
                     </section>
                  )}

                  {/* Shipment Info */}
                  <section className="p-8 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
                     <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Delivery Summary</h2>
                     <div className="space-y-4">
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">CURRENT DELIVERY STATUS</p>
                           {latestFulfillment ? (
                              <StatusBadge status={latestFulfillment.status} colorMap={FULFILLMENT_COLORS} />
                           ) : (
                              <span className="text-[11px] font-bold text-slate-500 uppercase">Waiting for seller</span>
                           )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">DELIVERY PARTNER</p>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">{latestFulfillment?.carrier || 'Not shared yet'}</p>
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">EXPECTED DATE</p>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{latestFulfillment?.estimated_delivery ? new Date(latestFulfillment.estimated_delivery).toLocaleDateString('en-GB') : 'TBD'}</p>
                           </div>
                        </div>
                     </div>
                  </section>
                  
                  {/* Cancel Order */}
                  {canCancelOrder && (
                     <button
                        onClick={handleCancelOrder}
                        disabled={isCancelling}
                        className="whitespace-nowrap w-full h-14 rounded-3xl border border-red-200 dark:border-red-900/30 text-red-500 dark:text-red-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] hover:bg-red-500/5 transition-all active:scale-95 disabled:opacity-30"
                     >
                        {isCancelling ? 'CANCELLING...' : 'CANCEL ORDER'}
                     </button>
                  )}
               </div>
            </div>

            {/* FULFILLMENT TIMELINE */}
            <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-[#0B1120]/30 shadow-2xl p-8">
               <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-8">Order Updates</h2>
               {fulfillments.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">No delivery updates yet.</p>
               ) : (
                  <div className="relative space-y-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                     {fulfillments.map((f) => (
                        <div key={f.fulfillment_id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group select-none`}>
                           <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-all group-hover:scale-110">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                           </div>
                           <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-md group-hover:border-blue-500/20 transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                 <StatusBadge status={f.status} colorMap={FULFILLMENT_COLORS} />
                                 <time className="text-[10px] font-mono text-slate-400">{new Date(f.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                 {f.carrier && <div className="space-y-0.5"><p className="text-slate-400">DELIVERY PARTNER</p><p className="text-slate-900 dark:text-white">{f.carrier}</p></div>}
                                 {f.tracking_number && <div className="space-y-0.5"><p className="text-slate-400">TRACKING ID</p><p className="text-slate-900 dark:text-white font-mono">{f.tracking_number}</p></div>}
                              </div>
                              {f.notes && <p className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 italic">"{f.notes}"</p>}
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </section>

            {/* RETURN SYSTEM */}
            {(order.return_status || canRequestReturn) && (
               <section className="p-10 rounded-[40px] bg-slate-900 text-white shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full"></div>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-8">Returns</h2>
                  
                  {order.return_status ? (
                     <div className="grid md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                           <div className="space-y-1">
                              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">REQUEST STATUS</p>
                              <span className="inline-flex px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                                 {order.return_status.replace(/_/g, ' ')}
                              </span>
                           </div>
                           <div className="space-y-1">
                              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">REASON</p>
                              <p className="text-sm font-bold text-slate-200 leading-relaxed italic">"{order.return_reason || 'N/A'}"</p>
                           </div>
                        </div>
                        <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">INITIATED</p>
                                 <p className="text-[11px] font-black">{formatDateTime(order.return_requested_at)}</p>
                              </div>
                              <div>
                                 <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">REVIEWED</p>
                                 <p className="text-[11px] font-black">{formatDateTime(order.return_reviewed_at)}</p>
                              </div>
                           </div>
                           {order.return_resolution_notes && (
                              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                                 <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">SELLER NOTES</p>
                                 <p className="text-xs font-bold leading-relaxed">{order.return_resolution_notes}</p>
                              </div>
                           )}
                        </div>
                     </div>
                  ) : (
                     <div className="max-w-xl space-y-6">
                        <p className="text-xs text-white/60 font-medium leading-relaxed uppercase tracking-wider">
                           You can request a return until <span className="text-white font-black">{formatDateTime(order.return_deadline_at)}</span>. 
                           Please tell us why you want to return this order.
                        </p>
                        <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest">
                          Return Reason
                          <RequiredAsterisk className="text-white" />
                        </label>
                        <textarea
                           value={returnReason}
                           onChange={(e) => setReturnReason(e.target.value)}
                           placeholder="Tell us what is wrong with the item..."
                           rows={4}
                           className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-xs font-bold placeholder:text-white/20 outline-none focus:border-blue-500 transition-all"
                        />
                        <button
                           onClick={handleReturnRequest}
                           disabled={isSubmittingReturn || !returnReason.trim()}
                           className="h-14 px-10 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-2xl active:scale-95 transition-all shadow-xl"
                        >
                           {isSubmittingReturn ? 'SUBMITTING...' : 'REQUEST RETURN'}
                        </button>
                     </div>
                  )}
               </section>
            )}

            {/* VENDOR REVIEW SYSTEM */}
            {order.order_status === 'delivered' && (
               <section className="p-10 rounded-[40px] bg-white border border-slate-200 dark:bg-[#0B1120]/50 dark:border-slate-800 shadow-2xl overflow-hidden relative">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-8 text-slate-900 dark:text-white">Vendor Review</h2>
                  
                  {order.vendorReview ? (
                     <div className="space-y-6">
                        <div className="flex items-center gap-2">
                           <div className="flex text-amber-400">
                             {[...Array(5)].map((_, i) => (
                               <svg key={i} className={`w-6 h-6 outline-none ${i < order.vendorReview.rating ? 'fill-current' : 'text-slate-200 dark:text-slate-700'}`} viewBox="0 0 24 24" fill="currentColor">
                                 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                               </svg>
                             ))}
                           </div>
                           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{order.vendorReview.rating} OUT OF 5</span>
                        </div>
                        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                           <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed italic">"{order.vendorReview.comment}"</p>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           Submitted on {formatDateTime(order.vendorReview.created_at)}
                        </p>
                     </div>
                  ) : (
                     <div className="max-w-xl space-y-6">
                        <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase tracking-wider">
                           How was your experience ordering parts from <span className="text-slate-900 dark:text-white font-black">{order.warehouse?.name}</span>? Your review helps other mechanics find reliable parts.
                        </p>
                        
                        <div className="space-y-2">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             Rating
                             <RequiredAsterisk />
                           </label>
                           <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                 <button
                                    key={star}
                                    type="button"
                                    onClick={() => setVendorReview(r => ({ ...r, rating: star }))}
                                    className={`p-2 transition-all hover:scale-110 active:scale-95 outline-none`}
                                 >
                                    <svg className={`w-10 h-10 ${star <= vendorReview.rating ? 'text-amber-400 fill-current' : 'text-slate-200 dark:text-slate-800'}`} viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                 </button>
                               ))}
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             Review Description
                             <RequiredAsterisk />
                           </label>
                           <textarea
                              value={vendorReview.comment}
                              onChange={(e) => setVendorReview(r => ({ ...r, comment: e.target.value }))}
                              placeholder="Describe your experience with the seller..."
                              rows={4}
                              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl px-6 py-4 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-all"
                           />
                        </div>

                        <button
                           onClick={handleVendorReview}
                           disabled={isSubmittingReview || !vendorReview.comment.trim()}
                           className="h-14 px-10 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                        >
                           {isSubmittingReview ? 'SUBMITTING...' : 'SUBMIT REVIEW'}
                        </button>
                     </div>
                  )}
               </section>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
    

export default UserOrderDetailPage
