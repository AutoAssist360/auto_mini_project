import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRevenueAnalytics, getMatchingAnalytics, getPerformanceAnalytics } from '../lib/api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import AdminDateInput from '../components/AdminDateInput'
import { CardSkeleton } from '../components/Skeleton'

const cardStyle = 'rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl transition-all duration-500'
const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#06b6d4']

function AdminAnalyticsPage() {
  const [range, setRange]   = useState({ from: '', to: '', granularity: 'month' })
  const [revenue, setRev]   = useState(null)
  const [matching, setMatch] = useState(null)
  const [perf, setPerf]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getRevenueAnalytics({ granularity: 'month' }).catch(() => null),
      getMatchingAnalytics({ granularity: 'month' }).catch(() => null),
      getPerformanceAnalytics({ granularity: 'month' }).catch(() => null),
    ]).then(([r, m, p]) => { setRev(r); setMatch(m); setPerf(p) }).finally(() => setLoading(false))
  }, [])

  const toIso = (dateStr, endOfDay = false) => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (endOfDay) {
      d.setHours(23, 59, 59, 999);
    }
    return d.toISOString();
  };

  const handleApply = (e) => {
    e.preventDefault()
    setLoading(true)
    const q = {}
    if (range.from) q.from = toIso(range.from)
    if (range.to) q.to = toIso(range.to, true)
    if (range.granularity) q.granularity = range.granularity
    Promise.all([
      getRevenueAnalytics(q).catch(() => null),
      getMatchingAnalytics(q).catch(() => null),
      getPerformanceAnalytics(q).catch(() => null),
    ]).then(([r, m, p]) => { setRev(r); setMatch(m); setPerf(p) }).finally(() => setLoading(false))
  }

  const statNode = (label, value) => (
    <div key={label} className="rounded-2xl bg-white/50 dark:bg-slate-900/50 p-6 border border-slate-100 dark:border-slate-800/50 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md group">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-blue-500 transition-colors">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value ?? '--'}</p>
    </div>
  )

  const rv = (key, fallbackKey) => revenue?.[key] ?? revenue?.[fallbackKey] ?? null
  const mt = (key, fallbackKey) => matching?.[key] ?? matching?.[fallbackKey] ?? null
  const pf = (key, fallbackKey) => perf?.[key] ?? perf?.[fallbackKey] ?? null

  const revenueChartData = revenue
    ? [
        { name: 'Service', value: Number(rv('serviceRevenue', 'service_revenue')) || 0 },
        { name: 'Orders', value: Number(rv('orderRevenue', 'order_revenue')) || 0 },
      ]
    : []

  const matchingPieData = matching
    ? [
        { name: 'Completed', value: Number(mt('completedRequests', 'completed_requests')) || 0 },
        { name: 'Cancelled', value: Number(mt('cancelledRequests', 'cancelled_requests')) || 0 },
        { name: 'Other', value: Math.max(0, (Number(mt('totalRequests', 'total_requests')) || 0) - (Number(mt('completedRequests', 'completed_requests')) || 0) - (Number(mt('cancelledRequests', 'cancelled_requests')) || 0)) },
      ].filter(d => d.value > 0)
    : []

  const topTechData = (pf('topTechnicians', 'top_technicians') || []).map(t => ({
    name: (t.name || t.full_name || 'Unknown').split(' ')[0],
    jobs: t.completed_jobs || t.completedJobs || 0,
  }))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] right-[-5%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 z-10">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 text-center md:text-left">
           <div>
              <Link to="/admin/dashboard" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors">← Hub Dashboard</Link>
              <h1 className="mt-2 text-4xl font-black tracking-tighter uppercase leading-none">Analytics</h1>
              <p className="mt-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Track revenue, requests, and team performance</p>
           </div>
        </div>

        {/* Analytics filters */}
        <div className={cardStyle + ' p-8 mb-8'}>
           <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Filter analytics</p>
           </div>
           
           <form onSubmit={handleApply} className="flex flex-wrap items-end gap-6">
              <div className="flex-1 min-w-0 sm:min-w-[200px]">
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 px-1 text-slate-400">From date</label>
                <AdminDateInput value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="!w-full rounded-2xl bg-white/50 dark:bg-slate-900/50" />
              </div>
              <div className="flex-1 min-w-0 sm:min-w-[200px]">
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 px-1 text-slate-400">To date</label>
                <AdminDateInput value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="!w-full rounded-2xl bg-white/50 dark:bg-slate-900/50" />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 px-1 text-slate-400">View by</label>
                <select 
                  value={range.granularity} 
                  onChange={(e) => setRange({ ...range, granularity: e.target.value })} 
                  className="rounded-2xl border-2 border-transparent bg-white/50 dark:bg-slate-900/50 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="day" className="bg-white dark:bg-[#0B1120]">Day</option>
                  <option value="week" className="bg-white dark:bg-[#0B1120]">Week</option>
                  <option value="month" className="bg-white dark:bg-[#0B1120]">Month</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="px-8 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                Apply filters
              </button>
           </form>
        </div>

        {loading && (
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
             <CardSkeleton count={2} />
             <CardSkeleton count={2} />
          </div>
        )}

        <div className="grid gap-8">
           {/* ═══ REVENUE SECTION ═══ */}
           {revenue && (
             <section className={cardStyle + ' p-10 relative overflow-hidden group'}>
               <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
               
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    <h2 className="text-sm font-black uppercase tracking-[0.3em]">Revenue summary</h2>
                 </div>
               </div>
               
               <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
                 {statNode('Service Revenue', rv('serviceRevenue', 'service_revenue') != null ? `₹${Number(rv('serviceRevenue', 'service_revenue')).toLocaleString()}` : '--')}
                 {statNode('Order Revenue', rv('orderRevenue', 'order_revenue') != null ? `₹${Number(rv('orderRevenue', 'order_revenue')).toLocaleString()}` : '--')}
                 {statNode('Total Revenue', rv('totalRevenue', 'total_revenue') != null ? `₹${Number(rv('totalRevenue', 'total_revenue')).toLocaleString()}` : '--')}
                 {statNode('Invoices Issued', rv('serviceInvoiceCount', 'invoices_count') ?? '--')}
               </div>

               <div className="mt-12 bg-white/30 dark:bg-black/20 p-8 rounded-[32px] border border-white/10 dark:border-slate-800/50">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-slate-400">Revenue breakdown</h3>
                 {revenueChartData.some(d => d.value > 0) ? (
                   <ResponsiveContainer width="100%" height={320}>
                     <BarChart data={revenueChartData} barSize={80}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                       <XAxis 
                         dataKey="name" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                         dy={10}
                       />
                       <YAxis 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                         tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'K' : v}`}
                       />
                       <Tooltip 
                         cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                         contentStyle={{ 
                           background: 'rgba(15, 23, 42, 0.9)', 
                           borderRadius: '16px', 
                           border: '1px solid rgba(255,255,255,0.1)', 
                           padding: '12px 16px',
                           boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                         }}
                         itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 900 }}
                         labelStyle={{ display: 'none' }}
                         formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'NET_REVENUE']}
                       />
                       <Bar dataKey="value" radius={[20, 20, 0, 0]}>
                         {revenueChartData.map((_, i) => (
                           <Cell key={i} fill={COLORS[i % COLORS.length]} />
                         ))}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="py-20 text-center">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No revenue data found for this time range</p>
                   </div>
                 )}
               </div>
             </section>
           )}

           <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
              {/* ═══ MATCHING SECTION ═══ */}
              {matching && (
                <section className={cardStyle + ' p-10 relative overflow-hidden group'}>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                    <h2 className="text-sm font-black uppercase tracking-[0.3em]">Request results</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {statNode('Total requests', mt('totalRequests', 'total_requests'))}
                    {statNode('Completion Rate', mt('completionRate', 'completion_rate') != null ? `${mt('completionRate', 'completion_rate')}%` : '--')}
                  </div>

                  {matchingPieData.length > 0 ? (
                    <div className="bg-white/30 dark:bg-black/20 p-6 rounded-[32px] border border-white/10 dark:border-slate-800/50">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-slate-400 text-center">Request breakdown</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={matchingPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {matchingPieData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              background: 'rgba(15, 23, 42, 0.9)', 
                              borderRadius: '16px', 
                              border: 'none', 
                              padding: '10px' 
                            }}
                            itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 900 }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            align="center" 
                            iconType="circle"
                            formatter={(v) => <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-20 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No request data found for this time range</p>
                    </div>
                  )}
                </section>
              )}

              {/* ═══ PERFORMANCE SECTION ═══ */}
              {perf && (
                <section className={cardStyle + ' p-10 relative overflow-hidden group'}>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                    <h2 className="text-sm font-black uppercase tracking-[0.3em]">Team performance</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {statNode('Total jobs', pf('totalJobs', 'total_jobs'))}
                    {statNode('Completion rate', pf('completionRate', 'completion_rate') != null ? `${pf('completionRate', 'completion_rate')}%` : '--')}
                  </div>

                  <div className="bg-white/30 dark:bg-black/20 p-8 rounded-[32px] border border-white/10 dark:border-slate-800/50">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-slate-400">Top technicians</h3>
                    {topTechData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={topTechData} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                            width={70}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
                            contentStyle={{ 
                              background: 'rgba(15, 23, 42, 0.9)', 
                              borderRadius: '16px', 
                              border: 'none', 
                              padding: '10px' 
                            }}
                            itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 900 }}
                            formatter={(v) => [v, 'JOBS_RESOLVED']}
                          />
                          <Bar dataKey="jobs" fill="#8b5cf6" radius={[0, 10, 10, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="py-20 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No performance data available</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
           </div>

           {/* Top Technicians Detailed Table */}
           {perf && (pf('topTechnicians', 'top_technicians') || []).length > 0 && (
             <div className={cardStyle + ' p-10'}>
               <div className="flex items-center gap-3 mb-10">
                  <div className="w-1.5 h-6 bg-slate-900 dark:bg-white rounded-full"></div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em]">Top technician list</h3>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left font-['Outfit'] min-w-[800px]">
                    <thead>
                      <tr className="border-b-2 border-slate-100 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <th className="pb-6 pr-6 whitespace-nowrap">Rank</th>
                        <th className="pb-6 pr-6 whitespace-nowrap">Technician</th>
                        <th className="pb-6 text-right whitespace-nowrap">Completed Jobs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/20">
                      {(pf('topTechnicians', 'top_technicians') || []).map((t, i) => (
                        <tr key={i} className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                          <td className="py-6 pr-6 whitespace-nowrap">
                             <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-[10px] font-black shadow-lg">
                               {i + 1}
                             </div>
                          </td>
                          <td className="py-6 pr-6 whitespace-nowrap">
                            <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">{t.name || t.full_name || '--'}</p>
                          </td>
                          <td className="py-6 text-right whitespace-nowrap">
                             <p className="text-lg font-black text-blue-600 dark:text-blue-400">{t.completed_jobs ?? t.completedJobs ?? '--'}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
             </div>
           )}
        </div>

        <div className="mt-20 flex flex-col items-center justify-center gap-4 py-16 border-t border-slate-100 dark:border-slate-800/30">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300 dark:text-slate-700 underline underline-offset-8">Analytics</p>
          <div className="flex gap-4 mt-4">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-600/30"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-600/30"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-blue-600/30"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminAnalyticsPage
