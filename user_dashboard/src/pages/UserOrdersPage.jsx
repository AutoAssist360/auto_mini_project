import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ApiError, getOrders, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import { useSocket } from '../lib/useSocket'

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  returned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const PAYMENT_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

function UserOrdersPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10
  const { on, off } = useSocket(null)

  const loadOrders = useCallback(async (signal) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await getOrders({ page, limit, status: statusFilter || undefined })
      if (signal?.aborted) return
      setOrders(response?.orders || [])
      setTotal(response?.total || 0)
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof ApiError ? err.message : 'Unable to load orders.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    const abortController = new AbortController()
    loadOrders(abortController.signal)
    return () => abortController.abort()
  }, [loadOrders])

  useEffect(() => {
    const reload = () => { loadOrders().catch(() => null) }
    const handleVisibility = () => { if (document.visibilityState === 'visible') reload() }
    on('notification:new', reload)
    on('user:orders_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      off('notification:new', reload)
      off('user:orders_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadOrders, off, on])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const handleFilterChange = (e) => { setStatusFilter(e.target.value); setPage(1) }
  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <div>
                 <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">PART ORDERS</span>
                 <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">My Orders</h1>
              </div>
           </div>

           <div className="flex items-center gap-3">
             <button onClick={onToggleTheme} className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-slate-400">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black tracking-widest uppercase hover:border-blue-500 transition-all">
                DASHBOARD
             </button>
             <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black tracking-widest uppercase active:scale-95 transition-all shadow-lg">
                LOGOUT
             </button>
           </div>
        </header>

        {/* Global Filter Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-md">
           <div className="flex items-center gap-4">
              <div className="relative">
                 <select 
                   value={statusFilter} 
                   onChange={handleFilterChange} 
                   className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 transition-all cursor-pointer pr-10"
                 >
                    <option value="">ALL ORDERS</option>
                    <option value="pending">PENDING</option>
                    <option value="confirmed">CONFIRMED</option>
                    <option value="processing">PROCESSING</option>
                    <option value="shipped">SHIPPED</option>
                    <option value="delivered">DELIVERED</option>
                    <option value="cancelled">CANCELLED</option>
                    <option value="returned">RETURNED</option>
                 </select>
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                 </div>
              </div>
           </div>
           <button onClick={() => navigate('/parts')} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
              BROWSE PARTS
           </button>
        </div>

        {error && <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in transition-all">⚠️ {error}</div>}

        {/* Orders Table Container */}
        <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 shadow-2xl overflow-hidden relative min-h-[400px]">
           {isLoading ? (
             <div className="p-10"><ListSkeleton rows={5} /></div>
           ) : orders.length === 0 ? (
             <div className="py-24 text-center">
                <div className="text-5xl mb-6 opacity-20">📦</div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No orders found</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium">No orders match the filter you selected.</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50">
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ORDER</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">STATUS</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">PAYMENT</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">TOTAL</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ESTIMATED DELIVERY</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">ACTION</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {orders.map((order) => {
                        const orderBadge = STATUS_COLORS[order.order_status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        const payBadge = PAYMENT_COLORS[order.payment_status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        return (
                          <tr key={order.order_id} className="group hover:bg-amber-500/5 transition-all">
                             <td className="px-8 py-6">
                                <span className="text-[11px] font-black text-slate-900 dark:text-white font-mono opacity-80 group-hover:opacity-100">
                                   {order.order_number || `#${order.order_id.slice(0, 8)}`}
                                </span>
                             </td>
                             <td className="px-8 py-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${orderBadge}`}>
                                   {order.order_status?.replace(/_/g, ' ')}
                                </span>
                             </td>
                             <td className="px-8 py-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${payBadge}`}>
                                   {order.payment_status?.replace(/_/g, ' ')}
                                </span>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(order.total)}</span>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                                   {order.fulfillments?.[0]?.estimated_delivery
                                     ? new Date(order.fulfillments[0].estimated_delivery).toLocaleDateString('en-GB')
                                     : 'Not available yet'}
                                </span>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button onClick={() => navigate(`/orders/${order.order_id}`)} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-all group/btn">
                                   VIEW ORDER
                                   <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </button>
                             </td>
                          </tr>
                        )
                      })}
                   </tbody>
                </table>
             </div>
           )}

           {/* Global Pagination Area */}
           <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                 <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Showing <span className="text-slate-900 dark:text-white">{orders.length}</span> orders
                 </p>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   disabled={page <= 1} 
                   onClick={() => setPage((p) => p - 1)} 
                   className="h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:border-amber-500 transition-all"
                 >
                    PREV
                 </button>
                 <div className="h-10 px-4 flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black">
                    PAGE {page} / {totalPages}
                 </div>
                 <button 
                   disabled={page >= totalPages} 
                   onClick={() => setPage((p) => p + 1)} 
                   className="h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:border-amber-500 transition-all"
                 >
                    NEXT
                 </button>
              </div>
           </div>
        </section>
      </div>
    </div>
  )
}

export default UserOrdersPage
