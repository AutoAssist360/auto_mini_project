import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getInventory,
  addInventory,
  updateInventory,
  deleteInventory,
  searchCatalogParts,
  ApiError,
} from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'
import RequiredAsterisk from '../components/RequiredAsterisk'

function PartSearchPicker({ value, onSelect, required = false }) {
  const [query, setQuery] = useState(value?.part_name || '')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [searchError, setSearchError] = useState('')
  const searchTimer = useRef(null)

  const doSearch = useCallback(async (q = '') => {
    setSearching(true)
    setSearchError('')
    try {
      const data = await searchCatalogParts(q, 1, 50)
      setResults(data.parts || [])
      setOpen(true)
    } catch (err) {
      setResults([])
      setSearchError(err?.message || 'Failed to search parts')
    } finally {
      setSearching(false)
    }
  }, [])

  // Trigger empty search on mount to load initial list
  useEffect(() => {
    doSearch('')
  }, [doSearch])

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    setSearchError('')
    if (value) onSelect(null) // clear selection when typing
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(q), 350)
  }

  const handlePick = (part) => {
    setQuery(part.part_name)
    setOpen(false)
    // keep results to allow changing mind easily? or keep them
    onSelect(part)
  }

  return (
    <div className="relative">
      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
        Part Name
        {required && <RequiredAsterisk />}
      </label>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => {
          setOpen(true)
          if (results.length === 0 && !searching) {
            doSearch('')
          }
        }}
        placeholder="Search parts by name or browse..."
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-500 transition-all backdrop-blur-sm shadow-inner"
        autoComplete="off"
      />
      {searching && (
        <span className="absolute right-4 top-[42px] text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Searching…</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-800/90 py-2">
          {results.map(p => (
            <li
              key={p.part_id}
              onClick={() => handlePick(p)}
              className="cursor-pointer px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-between"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200">{p.part_name}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">#{p.part_id}</span>
            </li>
          ))}
        </ul>
      )}
      {searchError && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1"><span className="text-sm">⚠️</span> {searchError}</p>
      )}
      {!searchError && !open && value && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1"><span>✅</span> Selected: {value.part_name} (ID: {value.part_id})</p>
      )}
      {!searchError && !open && !value && query.trim() && !searching && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1"><span>⚠️</span> Please select a part from the dropdown</p>
      )}
    </div>
  )
}

function VendorInventoryPage({ theme, onToggleTheme }) {
  const { warehouseId } = useParams()
  const [inventory, setInventory] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const emptyForm = { selectedPart: null, quantity_available: '', unit_cost: '', reorder_level: '0' }
  const [form, setForm] = useState(emptyForm)

  const limit = 20

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getInventory(warehouseId, page, limit, lowStockOnly)
      setInventory(res?.inventory ?? [])
      setTotal(res?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [warehouseId, page, lowStockOnly])

  useEffect(() => { loadInventory() }, [loadInventory])

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setActionMsg('') }
  const openEdit = (item) => {
    setEditId(item.inventory_id)
    setForm({
      selectedPart: item.part ? { part_id: item.part_id, part_name: item.part.part_name } : null,
      quantity_available: item.quantity_available?.toString() || '',
      unit_cost: Number(item.unit_cost).toFixed(2),
      reorder_level: item.reorder_level?.toString() || '0',
    })
    setShowForm(true)
    setActionMsg('')
  }
  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm) }

  const formValid = editId
    ? (form.quantity_available !== '' && form.unit_cost !== '')
    : (form.selectedPart && form.quantity_available !== '' && form.unit_cost !== '')

  const handleSave = async () => {
    if (!formValid) return
    setSaving(true)
    setActionMsg('')
    try {
      if (editId) {
        await updateInventory(editId, {
          quantity_available: Number(form.quantity_available),
          unit_cost: Number(form.unit_cost),
          reorder_level: Number(form.reorder_level),
        })
        setActionMsg('✓ Stock updated!')
      } else {
        await addInventory(warehouseId, {
          part_id: form.selectedPart.part_id,
          quantity_available: Number(form.quantity_available),
          unit_cost: Number(form.unit_cost),
          reorder_level: Number(form.reorder_level),
        })
        setActionMsg('✓ Stock item added!')
      }
      cancelForm()
      await loadInventory()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to save inventory')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (inventoryId) => {
    if (!window.confirm('Delete this inventory item? This cannot be undone.')) return
    setActionMsg('')
    try {
      await deleteInventory(inventoryId)
      setActionMsg('✓ Stock item deleted')
      await loadInventory()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to delete')
    }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-0 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md pl-4 pr-1 sm:px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-4 mr-10 sm:mr-0 relative z-[40]">
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <Link to="/warehouses" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200/50 dark:border-slate-700/50" title="Back to Locations">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
               </svg>
             </Link>
             <div>
               <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center gap-2">
                 Stock Management
               </h1>
               <p className="mt-0.5 ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Location ID: <span className="text-indigo-500">{warehouseId?.slice(0, 8)}…</span></p>
             </div>
          </div>
          <MobileNav>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1) }}
                className={`rounded-full border px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                  lowStockOnly
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-400 shadow-amber-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {lowStockOnly ? '⚠ Low Stock Filtered' : 'Filter Low Stock'}
              </button>
              <Link
                to={`/warehouses/${warehouseId}/bulk-import`}
                className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm text-slate-600 dark:text-slate-300 active:scale-95"
              >
                📥 Add Many Items
              </Link>
              <button
                type="button"
                onClick={openCreate}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                + Add Part
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95"
              >
                {theme === 'dark' ? '☀ Light' : '☾ Dark'}
              </button>
            </div>
          </MobileNav>
        </header>

        <div className="mb-8 mt-6 ml-2">
          <Breadcrumbs items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Locations', to: '/warehouses' },
            { label: 'Stock' },
          ]} />
        </div>

        {actionMsg && (
          <div className={`mb-6 flex items-center gap-3 rounded-[24px] border px-5 py-4 text-sm font-bold shadow-sm animate-in fade-in ${
            actionMsg.startsWith('✓')
              ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
            <span className="text-xl">{actionMsg.startsWith('✓') ? '✅' : '❌'}</span> {actionMsg}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
            <span className="text-xl">❌</span> {error}
          </div>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <section className="mt-8 rounded-[24px] border border-blue-200/60 dark:border-blue-800/60 bg-blue-50/60 dark:bg-[#0B1120]/80 p-6 shadow-xl backdrop-blur-md relative z-10 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-100 dark:border-blue-800/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xl shadow-inner">
                {editId ? '✏️' : '➕'}
              </div>
              <h2 className="text-base font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">
                {editId ? 'Edit stock item' : 'Add a part to stock'}
              </h2>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              {!editId && (
                <div className="sm:col-span-2">
                  <PartSearchPicker
                    value={form.selectedPart}
                    onSelect={(part) => setForm(prev => ({ ...prev, selectedPart: part }))}
                    required
                  />
                </div>
              )}
              {editId && form.selectedPart && (
                <div className="sm:col-span-2 rounded-2xl bg-white/50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-800 backdrop-blur-sm shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Currently Editing</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {form.selectedPart.part_name}
                  </p>
                </div>
              )}
              
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Quantity in Stock<RequiredAsterisk /></label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity_available}
                  onChange={handleChange('quantity_available')}
                  placeholder="e.g. 50"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Your Selling Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_cost}
                  onChange={handleChange('unit_cost')}
                  placeholder="e.g. 499.00"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner"
                />
                <div className="mt-2 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>Required</span>
                  <RequiredAsterisk />
                </div>
              </div>
              <div className="sm:col-span-2 group">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Reorder Alert Level</label>
                <input
                  type="number"
                  min="0"
                  value={form.reorder_level}
                  onChange={handleChange('reorder_level')}
                  placeholder="e.g. 5"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner"
                />
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-600 opacity-80 group-focus-within:opacity-100 transition-opacity flex items-center gap-1"><span className="text-sm">🔔</span> You'll see a warning when stock drops to this level.</p>
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-blue-100 dark:border-blue-800/30">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formValid}
                className="rounded-xl bg-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 transition-all w-full sm:w-auto"
              >
                {saving ? 'Saving…' : editId ? 'Update Stock' : 'Add to Stock'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all w-full sm:w-auto"
              >
                Cancel
              </button>
              {!editId && !form.selectedPart && (
                <p className="w-full mt-2 text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50"><span className="text-sm">⚠️</span> Please select a part from the dropdown above before saving.</p>
              )}
            </div>
          </section>
        )}

        {/* Inventory Table */}
        {loading ? (
          <div className="mt-8 relative z-10"><ListSkeleton /></div>
        ) : inventory.length === 0 ? (
          <div className="mt-10 rounded-[32px] border border-dashed border-slate-300/60 bg-white/40 p-16 text-center dark:border-slate-700/60 dark:bg-slate-900/40 backdrop-blur-md relative z-10 shadow-sm animate-in zoom-in-95 duration-700">
            <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-[32px] bg-white/80 dark:bg-slate-800/80 text-5xl shadow-xl shadow-slate-200/20 dark:shadow-none mb-6 border border-slate-100 dark:border-slate-800">
               📦
            </div>
            <p className="mt-4 text-lg font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
              {lowStockOnly ? 'No low-stock items' : 'No parts added yet'}
            </p>
            {!lowStockOnly && (
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Click <span className="text-blue-600 dark:text-blue-400 font-black">+ Add Part</span> to start building your inventory right now.
              </p>
            )}
          </div>
        ) : (
          <div className="relative z-10 animate-in slide-in-from-bottom-4 duration-700 mt-8">
            <div className="overflow-x-auto rounded-[32px] border border-slate-200/60 bg-white/60 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 p-2">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-slate-800/50">
                    <th className="px-6 py-4">Part Name</th>
                    <th className="px-6 py-4 text-right">In Stock</th>
                    <th className="px-6 py-4 text-right">Reserved</th>
                    <th className="px-6 py-4 text-right">Price (₹)</th>
                    <th className="px-6 py-4 text-right">Reorder At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => {
                    const isLow = item.reorder_level > 0 && item.quantity_available <= item.reorder_level
                    return (
                      <tr
                        key={item.inventory_id}
                        className={`group border-b border-slate-100/50 dark:border-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-800/40 transition-all ${
                          isLow ? 'bg-amber-50/40 hover:bg-amber-50/80 dark:bg-amber-900/10 dark:hover:bg-amber-900/20' : ''
                        } last:border-0`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{item.part?.part_name || `Part #${item.part_id}`}</span>
                            {isLow && (
                              <span className="mt-1 self-start rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-black tracking-widest text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                                ⚠️ LOW STOCK
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-6 py-5 text-right font-mono font-bold text-base ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {item.quantity_available}
                        </td>
                        <td className="px-6 py-5 text-right font-mono font-medium text-slate-400">{item.quantity_reserved}</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{Number(item.unit_cost).toFixed(2)}</td>
                        <td className="px-6 py-5 text-right font-mono text-slate-500">{item.reorder_level}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm active:scale-95 transition-all"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.inventory_id)}
                              className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm active:scale-95 transition-all"
                            >
                              🗑️ Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4 relative z-10">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95">
                  ← Prev
                </button>
                <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm">
                  Page {page} <span className="opacity-50 mx-1">/</span> {totalPages} <span className="opacity-50 ml-2">({total} items)</span>
                </div>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95">
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VendorInventoryPage
