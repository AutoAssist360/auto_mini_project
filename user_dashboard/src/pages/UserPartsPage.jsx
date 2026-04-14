import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getParts, getPartCategories, userLogout, ApiError } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import MobileNav from '../components/MobileNav'
import { useDispatch, useSelector } from 'react-redux'
import { clearAuth } from '../store/authSlice'
import { addToCart, openCart, selectCartItemCount } from '../store/cartSlice'

function UserPartsPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const cartItemCount = useSelector(selectCartItemCount)

  const [parts, setParts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [selectedPart, setSelectedPart] = useState(null)
  const [orderWarehouseId, setOrderWarehouseId] = useState('')
  const [orderInventoryId, setOrderInventoryId] = useState('')

  const LIMIT = 20

  const loadCategories = async () => {
    try {
      const res = await getPartCategories()
      setCategories(res?.categories ?? [])
    } catch { /* Silent */ }
  }

  const loadParts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getParts({
        search,
        category_id: selectedCategory || undefined,
        in_stock: inStockOnly || undefined,
        page,
        limit: 20,
      })
      setParts(res?.parts ?? [])
      setTotalPages(res?.totalPages ?? 1)
      setTotal(res?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load parts catalog.')
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory, inStockOnly, page]) // limit is constant (20)

  useEffect(() => { loadCategories() }, [])
  
  // UseEffect for resetting page
  useEffect(() => { setPage(1) }, [search, selectedCategory, inStockOnly])
  
  // UseEffect for loading parts
  useEffect(() => { loadParts() }, [loadParts])

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput) }
  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const handleAddClick = (part, inv) => {
    setSelectedPart(part)
    setOrderWarehouseId(inv.warehouse_id)
    setOrderInventoryId(inv.inventory_id)
  }

  const handleAddToCart = () => {
    const warehouse = selectedPart.warehouses.find(w => w.warehouse_id === orderWarehouseId)
    dispatch(addToCart({
      part_id: selectedPart.part_id,
      part_name: selectedPart.part_name,
      category_name: selectedPart.category?.category_name || 'General',
      unit_cost: warehouse.unit_cost,
      quantity: 1,
      warehouse_id: orderWarehouseId,
      warehouse_name: warehouse.warehouse_name,
      inventory_id: orderInventoryId,
    }))
    setSelectedPart(null)
    dispatch(openCart())
  }

  const formatPrice = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500">
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                 <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">INVENTORY</span>
                 <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Parts Catalog</h1>
              </div>
           </div>

           <div className="flex items-center gap-3">
             <button onClick={onToggleTheme} className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-slate-400">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={() => dispatch(openCart())} className="relative group px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black tracking-widest uppercase hover:border-blue-500 transition-all flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <span>CART</span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                    {cartItemCount}
                  </span>
                )}
             </button>
             <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black tracking-widest uppercase shadow-lg active:scale-95 transition-all">
                LOGOUT
             </button>
           </div>
        </header>

        {/* Modal: Add to Cart */}
        {selectedPart && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/40 animate-in fade-in transition-all" onClick={() => setSelectedPart(null)}>
            <div className="w-full max-w-md rounded-[40px] border border-white/20 bg-white dark:bg-[#0B1120] p-8 shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
               
               <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Choose a seller</h2>
               <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6 uppercase tracking-wider">Pick where you want to buy this part from.</p>

               <div className="rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-6 mb-8 text-center group">
                 <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-widest">{selectedPart.category?.category_name}</p>
                 <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight">{selectedPart.part_name}</p>
               </div>

               <div className="space-y-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">CHOOSE SELLER</label>
                   <div className="relative">
                      <select
                        value={orderWarehouseId}
                        onChange={(e) => {
                          setOrderWarehouseId(e.target.value)
                          const inv = selectedPart.warehouses?.find(w => w.warehouse_id === e.target.value)
                          if (inv) setOrderInventoryId(inv.inventory_id)
                        }}
                        className="w-full h-14 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-xs font-bold font-mono outline-none focus:border-blue-500 transition-all appearance-none"
                      >
                        {selectedPart.warehouses?.map((w) => (
                          <option key={w.warehouse_id} value={w.warehouse_id}>
                            {w.warehouse_name} ({w.city}) — {formatPrice(w.unit_cost)}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                   </div>
                 </div>
               </div>

               <div className="mt-10 flex flex-col gap-3">
                 <button onClick={handleAddToCart} className="h-14 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-600/30 transition-all active:scale-95">
                    ADD TO CART
                 </button>
                 <button onClick={() => setSelectedPart(null)} className="h-14 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    CANCEL
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* Global Search & Filters */}
        <section className="mb-8 p-6 rounded-[32px] bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-xl">
           <form onSubmit={handleSearch} className="grid md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2 space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">QUICK SEARCH</label>
                 <div className="relative group">
                    <input
                      type="text"
                      placeholder="ENTER PART NAME OR SERIAL..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 text-[10px] font-black uppercase tracking-widest rounded-xl outline-none focus:border-blue-500 shadow-sm"
                    />
                    <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </button>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CATEGORY</label>
                 <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 text-[10px] font-black uppercase tracking-widest rounded-xl outline-none focus:border-blue-500 appearance-none shadow-sm cursor-pointer"
                    >
                      <option value="">ALL PARTS</option>
                      {categories.map((cat) => (
                        <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                 </div>
              </div>

              <div className="flex h-12 items-center justify-between gap-4">
                 <label className="flex flex-1 items-center gap-2 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${inStockOnly ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-500'}`}>
                       {inStockOnly && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                       <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="hidden" />
                    </div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">STOCK ONLY</span>
                 </label>
                 
                 <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setSelectedCategory(''); setInStockOnly(false) }} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all shadow-sm">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <button onClick={() => navigate('/orders')} className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-lg">
                       MY ORDERS
                    </button>
                 </div>
              </div>
           </form>
        </section>

        {error && <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">⚠️ {error}</div>}

        <div className="flex items-center justify-between mb-8 px-2">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{total} PARTS FOUND</p>
           </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
             {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-80 rounded-[32px] bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse shadow-sm"></div>)}
          </div>
        ) : parts.length === 0 ? (
          <div className="py-32 text-center rounded-[40px] bg-white/30 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800">
             <div className="text-6xl mb-6 opacity-20">⚙️</div>
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No parts found</h3>
             <p className="text-xs text-slate-500 mt-2 font-medium">Try broader keywords or clear your selection filters.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
            {parts.map((part) => (
              <article key={part.part_id} className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 p-6 shadow-xl hover:border-blue-500/30 transition-all flex flex-col items-start min-h-[380px]">
                <div className="absolute top-6 right-6">
                  {part.in_stock ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase tracking-widest shadow-sm">
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                       IN STOCK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/5 text-red-500 text-[9px] font-black uppercase tracking-widest border border-red-500/10">
                       UNAVAILABLE
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{part.category?.category_name || 'PART'}</span>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight group-hover:text-blue-500 transition-colors">
                    {part.part_name}
                  </h3>
                </div>

                <div className="mt-2 mb-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BEST PRICE</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                       {part.best_price != null ? `₹${Math.floor(part.best_price).toLocaleString('en-IN')}` : '??'}
                    </span>
                    {part.best_price != null && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">STARTING FROM</span>}
                  </div>
                </div>

                <div className="w-full space-y-3 mb-auto">
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/50 flex flex-col gap-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                         TOP SELLERS
                         <span>{part.warehouses?.length || 0} TOTAL</span>
                      </p>
                      {part.warehouses?.slice(0, 2).map((w) => (
                        <div key={w.warehouse_id} className="flex items-center justify-between text-[10px] font-bold">
                           <span className="text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{w.warehouse_name}</span>
                           <span className="text-slate-900 dark:text-white font-black">{formatPrice(w.unit_cost)}</span>
                        </div>
                      ))}
                      {part.warehouses?.length > 2 && <p className="text-[8px] font-black text-blue-500 text-center uppercase tracking-widest mt-1">+{part.warehouses.length - 2} MORE OPTIONS</p>}
                   </div>
                </div>

                <div className="w-full pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/50">
                   {part.in_stock ? (
                     <button
                        onClick={() => handleAddClick(part, part.warehouses[0])}
                        className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white transition-all shadow-xl active:scale-95"
                     >
                        BUY THIS PART
                     </button>
                   ) : (
                     <button disabled className="w-full h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl cursor-not-allowed">
                        NOT AVAILABLE
                     </button>
                   )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Global Pagination Area */}
        {!loading && totalPages > 1 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl z-40 animate-in slide-in-from-bottom-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-10 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] font-black tracking-widest uppercase disabled:opacity-20 hover:border-blue-500 transition-all bg-white dark:bg-slate-900"
            >
              PREV
            </button>
            <div className="px-6 h-10 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
               PAGE {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-10 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] font-black tracking-widest uppercase disabled:opacity-20 hover:border-blue-500 transition-all bg-white dark:bg-slate-900"
            >
              NEXT
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default UserPartsPage
