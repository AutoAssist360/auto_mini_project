import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getRevenueAnalytics,
  getOrderAnalytics,
  getInventoryAnalytics,
  ApiError,
} from '../lib/api'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CardSkeleton } from '../components/Skeleton'

const COLORS = ['#3b82f6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function VendorAnalyticsPage({ theme, onToggleTheme }) {
  const [revenue, setRevenue] = useState(null)
  const [orderStats, setOrderStats] = useState(null)
  const [inventoryStats, setInventoryStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Date range
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const results = await Promise.allSettled([
        getRevenueAnalytics(from || undefined, to || undefined),
        getOrderAnalytics(from || undefined, to || undefined),
        getInventoryAnalytics(),
      ])
      if (results[0].status === 'fulfilled') setRevenue(results[0].value)
      if (results[1].status === 'fulfilled') setOrderStats(results[1].value)
      if (results[2].status === 'fulfilled') setInventoryStats(results[2].value)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { loadAnalytics() }, [loadAnalytics])

  /* ── Build chart data ── */
  const revenueBarData = revenue
    ? [
        { name: 'Total Revenue', value: Number(revenue.total_revenue) || 0 },
        { name: 'Avg Order', value: Number(revenue.avg_order_value) || 0 },
      ]
    : []

  const orderStatusData = orderStats
    ? Object.entries(orderStats.by_status || {}).map(([status, count]) => ({
        name: status.replace(/_/g, ' '),
        value: count,
      }))
    : []

  const orderPaymentData = orderStats
    ? Object.entries(orderStats.by_payment || {}).map(([status, count]) => ({
        name: status,
        value: count,
      }))
    : []

  const inventoryBarData = inventoryStats
    ? [
        { name: 'Available', value: inventoryStats.total_available || 0, fill: '#3b82f6' },
        { name: 'Reserved', value: inventoryStats.total_reserved || 0, fill: '#f59e0b' },
        { name: 'Low Stock', value: inventoryStats.low_stock_count || 0, fill: '#ef4444' },
      ]
    : []

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md pl-4 pr-1 sm:px-6 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between gap-3 mt-6 mr-10 sm:mr-0 relative z-[40]">
          <div className="flex items-center gap-2 min-w-0">
             <Link to="/dashboard" className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">← Back</Link>
             <h1 className="text-base sm:text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center gap-2 truncate">
               <span className="text-blue-500 text-xl shrink-0">📈</span> <span className="truncate">Business Overview</span>
             </h1>
          </div>
          <button type="button" onClick={onToggleTheme} className="hidden sm:flex shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95 whitespace-nowrap">
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
             <span className="text-xl">❌</span> {error}
          </div>
        )}

        {/* Date range filter */}
        <div className="mb-8 flex flex-wrap items-end gap-3 rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 animate-in slide-in-from-top-4 duration-500 relative z-10">
          <div className="flex-1 min-w-[130px]">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner cursor-pointer" />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner cursor-pointer" />
          </div>
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(''); setTo('') }} className="whitespace-nowrap rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all h-[46px]">Clear</button>
          )}
        </div>

        {loading ? (
          <CardSkeleton count={4} />
        ) : (
          <>
            {/* ═══ REVENUE ═══ */}
            {revenue && (
              <section className="mt-8 animate-in slide-in-from-bottom-4 duration-500 relative z-10">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 ml-2 mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span> Revenue Intelligence
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="group rounded-[32px] border border-blue-200/60 bg-blue-50/60 p-6 shadow-xl backdrop-blur-md dark:border-blue-800/40 dark:bg-gradient-to-br dark:from-[#0B1120]/80 dark:to-slate-900/80 transition-all hover:-translate-y-1 hover:shadow-blue-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Revenue</p>
                    <p className="mt-4 text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter drop-shadow-sm group-hover:scale-105 transition-transform origin-left">
                       ₹{Number(revenue.total_revenue).toLocaleString()}
                    </p>
                  </div>
                  <div className="group rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 transition-all hover:-translate-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Orders</p>
                    <p className="mt-4 text-4xl font-black text-slate-800 dark:text-slate-200 tracking-tighter group-hover:scale-105 transition-transform origin-left">
                       {revenue.total_orders}
                    </p>
                  </div>
                  <div className="group rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 transition-all hover:-translate-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Avg Order Value</p>
                    <p className="mt-4 text-4xl font-black text-slate-800 dark:text-slate-200 tracking-tighter group-hover:scale-105 transition-transform origin-left">
                       ₹{Number(revenue.avg_order_value).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Revenue Bar Chart */}
                <div className="mt-4 rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 ml-2">Revenue KPI Overview</h3>
                  {Number(revenue.total_revenue) > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={revenueBarData} barSize={60}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                        <Tooltip
                          cursor={{ fill: 'transparent' }}
                          contentStyle={{ borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.8)' }}
                          formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Amount']}
                        />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                          {revenueBarData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300/60 bg-white/40 dark:border-slate-700/60 dark:bg-slate-900/40">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No revenue data available for this range</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ═══ ORDER BREAKDOWN ═══ */}
            {orderStats && (
              <section className="mt-8 relative z-10 animate-in slide-in-from-bottom-6 duration-700">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 ml-2 mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span> Order delivery breakdown
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* By Status — Pie Chart */}
                  <div className="rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 transform transition-all hover:shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center justify-center">By Current Status</h3>
                    {orderStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={orderStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelStyle={{ fontSize: '10px', fontWeight: '800', fill: '#64748b' }}
                          >
                            {orderStatusData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} className="drop-shadow-md" />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.8)' }}
                            formatter={(v) => [v, 'Orders']} 
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '800' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300/60 bg-white/40 dark:border-slate-700/60 dark:bg-slate-900/40">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No data</p>
                      </div>
                    )}
                  </div>

                  {/* By Payment — Pie Chart */}
                  <div className="rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 transform transition-all hover:shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center justify-center">By Payment Method</h3>
                    {orderPaymentData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={orderPaymentData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelStyle={{ fontSize: '10px', fontWeight: '800', fill: '#64748b' }}
                          >
                            {orderPaymentData.map((_, i) => (
                              <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} className="drop-shadow-md" />
                            ))}
                          </Pie>
                          <Tooltip 
                             contentStyle={{ borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.8)' }}
                             formatter={(v) => [v, 'Orders']} 
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: '800' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300/60 bg-white/40 dark:border-slate-700/60 dark:bg-slate-900/40">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No data</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ═══ INVENTORY ═══ */}
            {inventoryStats && (
              <section className="mt-8 mb-12 relative z-10 animate-in slide-in-from-bottom-8 duration-700">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-2 mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Stock health
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    { label: 'Total Items', value: inventoryStats.total_items },
                    { label: 'Available', value: inventoryStats.total_available },
                    { label: 'Reserved', value: inventoryStats.total_reserved },
                    { label: 'Estimated value', value: `₹${Number(inventoryStats.total_value).toLocaleString()}` },
                    { label: 'Low Stock', value: inventoryStats.low_stock_count, warn: inventoryStats.low_stock_count > 0 },
                  ].map((s) => (
                    <div key={s.label} className={`group rounded-[24px] border bg-white/60 p-5 shadow-xl backdrop-blur-md dark:bg-slate-900/40 transition-all hover:scale-105 ${s.warn ? 'border-amber-300/50 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-900/10' : 'border-slate-200/60 dark:border-slate-800/60'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${s.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>{s.label}</p>
                      <p className={`mt-3 text-3xl font-black tracking-tighter ${s.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Inventory Bar Chart */}
                <div className="mt-4 rounded-[32px] border border-slate-200/60 bg-white/60 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 ml-2">Stock Distribution</h3>
                  {inventoryBarData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={inventoryBarData} barSize={60} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} opacity={0.5} />
                        <XAxis type="number" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.8)' }}
                            formatter={(v) => [v, 'Units']} 
                        />
                        <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                          {inventoryBarData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} className="drop-shadow-sm" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300/60 bg-white/40 dark:border-slate-700/60 dark:bg-slate-900/40">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No stock data available</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default VendorAnalyticsPage
