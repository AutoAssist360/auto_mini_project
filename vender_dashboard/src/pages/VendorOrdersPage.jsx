import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrders, getApiErrorMessage } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import { useSocket } from '../lib/useSocket'
import { formatLabel } from '../lib/displayText'

const ORDER_STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  returned: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'N/A'
}

function getLatestFulfillment(order) {
  return order?.fulfillments?.[0] || null
}

function getShipmentSummary(order) {
  const fulfillment = getLatestFulfillment(order)

  if (order?.order_status === 'delivered') {
    return fulfillment?.delivered_at
      ? `Delivered on ${formatDate(fulfillment.delivered_at)}`
      : 'Delivered to customer'
  }

  if (order?.order_status === 'returned') {
    return 'Return completed'
  }

  if (order?.order_status === 'cancelled') {
    return 'Order cancelled'
  }

  if (!fulfillment) {
    if (order?.order_status === 'pending') return 'Waiting for your confirmation'
    if (order?.order_status === 'confirmed') return 'Ready to start packing'
    if (order?.order_status === 'processing') return 'Add a delivery update to start shipping'
    return 'No delivery update yet'
  }

  const fulfillmentLabel = formatLabel(fulfillment.status)
  if (fulfillment.estimated_delivery) {
    return `Delivery ${fulfillmentLabel} | Expected ${formatDate(fulfillment.estimated_delivery)}`
  }

  return `Delivery ${fulfillmentLabel}`
}

function getNextActionLabel(order) {
  const fulfillment = getLatestFulfillment(order)

  if (order?.order_status === 'pending') return 'Next: confirm order'
  if (order?.order_status === 'confirmed') return 'Next: start packing'
  if (order?.order_status === 'processing' && !fulfillment) return 'Next: add delivery update'
  if (fulfillment?.status === 'pending') return 'Next: mark as packing'
  if (fulfillment?.status === 'processing') return 'Next: mark shipped'
  if (fulfillment?.status === 'shipped') return 'Next: mark in transit or delivered'
  if (fulfillment?.status === 'in_transit') return 'Next: mark delivered'
  if (order?.order_status === 'delivered') return 'Completed'
  if (order?.order_status === 'returned') return 'Returned'
  if (order?.order_status === 'cancelled') return 'Cancelled'
  return 'Open order'
}

function VendorOrdersPage({ theme, onToggleTheme }) {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { on, off } = useSocket(null)

  const limit = 15

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filters = {}
      if (statusFilter !== 'all') filters.order_status = statusFilter
      const res = await getOrders(page, limit, filters)
      setOrders(res?.orders ?? [])
      setTotal(res?.total ?? 0)
    } catch (err) {
      setOrders([])
      setTotal(0)
      setError(getApiErrorMessage(err, 'Failed to load orders'))
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { loadOrders() }, [loadOrders])

  useEffect(() => {
    const reload = () => { loadOrders().catch(() => null) }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload()
      }
    }
    on('notification:new', reload)
    on('vendor:orders_refresh', reload)
    on('vendor:dashboard_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      off('notification:new', reload)
      off('vendor:orders_refresh', reload)
      off('vendor:dashboard_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadOrders, off, on])

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md pl-4 pr-1 sm:px-6 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between gap-3 mr-10 sm:mr-0 relative z-[40]">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/dashboard" className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
              ← Back
            </Link>
            <div className="flex items-center gap-2 ml-1 min-w-0">
              <span className="text-lg sm:text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Orders</span>
              <span className="shrink-0 flex h-6 items-center justify-center rounded-full bg-blue-500/10 px-2.5 text-[11px] font-black text-blue-600 dark:text-blue-400">
                {total}
              </span>
            </div>
          </div>
          <button type="button" onClick={onToggleTheme} className="hidden sm:flex rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
            <span className="text-xl">❌</span> {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`rounded-[16px] border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm ${
                statusFilter === s
                  ? 'border-blue-500 bg-blue-600 text-white shadow-blue-600/20 mix-blend-normal'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {s === 'all' ? 'All Orders' : formatLabel(s)}
            </button>
          ))}
        </div>

        {loading ? (
          <ListSkeleton />
        ) : orders.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800/50 text-4xl shadow-inner mb-4">
              📦
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white">No orders found</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">No orders match this filter. Try a different status.</p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              {orders.map((order) => (
                <Link
                  key={order.order_id}
                  to={`/orders/${order.order_id}`}
                  className="group relative block overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 p-6 shadow-sm backdrop-blur-md transition-all hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-xl dark:shadow-2xl"
                >
                  <div className="absolute inset-0 bg-blue-600/[0.02] dark:bg-blue-600/[0.05] opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${ORDER_STATUS_COLORS[order.order_status] || ''}`}>
                          {formatLabel(order.order_status)}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 opacity-80 border-l-2 border-slate-200 dark:border-slate-700 pl-2 break-words">
                        {order.user?.full_name || order.user?.email} <span className="mx-1">•</span> {order.warehouse?.name}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-lg whitespace-nowrap">
                          <span>📅</span> {formatDate(order.created_at)}
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                          <span>🚚</span> {getShipmentSummary(order)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end w-full sm:w-auto sm:min-w-[8rem] bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                      <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">Rs {Number(order.total).toLocaleString()}</p>
                      <p className={`mt-1 text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${order.payment_status === 'completed' ? 'text-teal-600 dark:text-teal-400' : order.payment_status === 'refunded' ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400'}`}>
                        {formatLabel(order.payment_status)}
                      </p>
                      <div className="mt-auto pt-3 text-[10px] font-black tracking-widest uppercase flex flex-col gap-1 items-end">
                        <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md text-right max-w-full whitespace-nowrap">
                          {getNextActionLabel(order)}
                        </span>
                        <span className="text-slate-400 mt-1 whitespace-nowrap">
                          {order._count?.items ?? 0} items · {order._count?.fulfillments ?? 0} updates
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </section>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4 animate-in fade-in duration-1000">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-[16px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all active:scale-95"
                >
                  Previous
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-black text-blue-700 dark:text-blue-300 shadow-inner">
                  {page}
                </div>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-[16px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all active:scale-95"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default VendorOrdersPage
