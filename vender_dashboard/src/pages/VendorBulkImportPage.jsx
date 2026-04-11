import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  bulkUpsertInventory,
  getApiErrorMessage,
  getWarehouses,
  searchCatalogParts,
} from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'
import MobileNav from '../components/MobileNav'
import { useToast } from '../components/toastContext'
import RequiredAsterisk from '../components/RequiredAsterisk'

const emptyRow = {
  part_id: '',
  quantity_available: '',
  unit_cost: '',
  reorder_level: '0',
}

async function loadAllCatalogParts() {
  const allParts = []
  let page = 1
  let total = Infinity

  while (allParts.length < total) {
    const response = await searchCatalogParts('', page, 100)
    const pageParts = response?.parts || []
    total = response?.total ?? pageParts.length

    if (pageParts.length === 0) {
      break
    }

    allParts.push(...pageParts)
    page += 1
  }

  return allParts
}

export default function VendorBulkImportPage({ theme, onToggleTheme }) {
  const { warehouseId: paramWarehouseId } = useParams()
  const { toast } = useToast()

  const [warehouses, setWarehouses] = useState([])
  const [partsCatalog, setPartsCatalog] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState(paramWarehouseId || '')
  const [rows, setRows] = useState([{ ...emptyRow }])
  const [submitting, setSubmitting] = useState(false)
  const [loadingResources, setLoadingResources] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [results, setResults] = useState(null)

  useEffect(() => {
    let active = true

    const loadResources = async () => {
      setLoadingResources(true)
      setLoadError('')

      try {
        const [warehouseResponse, partList] = await Promise.all([
          getWarehouses(1, 100),
          loadAllCatalogParts(),
        ])

        if (!active) return

        const warehouseList = warehouseResponse?.warehouses || []
        setWarehouses(warehouseList)
        setPartsCatalog(partList)

        setSelectedWarehouse((currentWarehouse) => {
          if (paramWarehouseId) return paramWarehouseId
          if (currentWarehouse) return currentWarehouse
          return warehouseList[0]?.warehouse_id || ''
        })
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof ApiError ? getApiErrorMessage(error, 'Failed to load bulk import data') : 'Failed to load bulk import data')
      } finally {
        if (active) {
          setLoadingResources(false)
        }
      }
    }

    loadResources()

    return () => {
      active = false
    }
  }, [paramWarehouseId])

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { ...emptyRow }])
  }

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
  }

  const parseRows = () => {
    const filledRows = rows
      .map((row, index) => ({ ...row, index }))
      .filter((row) => row.part_id || row.quantity_available !== '' || row.unit_cost !== '')

    if (filledRows.length === 0) {
      throw new Error('Add at least one stock row')
    }

    const items = filledRows.map((row) => ({
      rowNumber: row.index + 1,
      part_id: Number(row.part_id),
      quantity_available: Number(row.quantity_available),
      unit_cost: Number(row.unit_cost),
      reorder_level: Number(row.reorder_level || 0),
    }))

    const selectedPartIds = new Set()

    for (const item of items) {
      if (!item.part_id || item.part_id <= 0) {
        throw new Error(`Row ${item.rowNumber}: please select a part`)
      }

      if (selectedPartIds.has(item.part_id)) {
        throw new Error(`Row ${item.rowNumber}: the same part cannot be imported twice`)
      }
      selectedPartIds.add(item.part_id)

      if (!Number.isInteger(item.quantity_available) || item.quantity_available < 0) {
        throw new Error(`Row ${item.rowNumber}: quantity must be a whole number 0 or higher`)
      }

      if (!Number.isFinite(item.unit_cost) || item.unit_cost <= 0) {
        throw new Error(`Row ${item.rowNumber}: unit cost must be greater than 0`)
      }

      if (!Number.isInteger(item.reorder_level) || item.reorder_level < 0) {
        throw new Error(`Row ${item.rowNumber}: reorder level must be a whole number 0 or higher`)
      }
    }

    return items.map((item) => ({
      part_id: item.part_id,
      quantity_available: item.quantity_available,
      unit_cost: item.unit_cost,
      reorder_level: item.reorder_level,
    }))
  }

  const handleSubmit = async () => {
    if (!selectedWarehouse) {
      toast.error('Choose a location first')
      return
    }

    let items
    try {
      items = parseRows()
    } catch (error) {
      toast.error(error.message)
      return
    }

    setSubmitting(true)
    setResults(null)

    try {
      const response = await bulkUpsertInventory(selectedWarehouse, items)
      setResults(response)
      setRows([{ ...emptyRow }])
      toast.success(`${items.length} item(s) imported successfully`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Bulk import failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPartIds = new Set(rows.map((row) => Number(row.part_id)).filter(Boolean))
  const cardClass = 'rounded-[32px] border border-slate-200/60 bg-white/60 p-6 sm:p-8 shadow-xl backdrop-blur-md dark:border-slate-800/60 dark:bg-[#0B1120]/60 relative z-10'
  const inputClass = 'w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0F172A]/70 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner placeholder:font-normal placeholder:text-slate-400'
  const selectClass = 'w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0F172A]/70 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner text-slate-900 dark:text-slate-100'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <Link to="/warehouses" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200/50 dark:border-slate-700/50" title="Back to Locations">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
               </svg>
             </Link>
             <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center gap-2">
               <span className="text-blue-500 text-2xl">📥</span> Add Many Items
             </h1>
          </div>
          <MobileNav>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/dashboard"
                className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={onToggleTheme}
                className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95"
              >
                {theme === 'dark' ? '☀ Light' : '☾ Dark'}
              </button>
            </div>
          </MobileNav>
        </header>

        <div className="mb-6 ml-2 animate-in fade-in">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Locations', to: '/warehouses' },
              { label: 'Add Many Items' },
            ]}
          />
        </div>

        <main className="mt-8 space-y-6">
          <section className={`${cardClass} animate-in slide-in-from-bottom-4 duration-500`}>
            <div className="flex flex-wrap items-end gap-6 mb-6">
              <div className="min-w-0 flex-1 sm:min-w-[280px]">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Choose location<RequiredAsterisk /></label>
                <select
                  value={selectedWarehouse}
                  onChange={(event) => setSelectedWarehouse(event.target.value)}
                  className={`${selectClass} w-full shadow-lg shadow-blue-500/5 cursor-pointer`}
                  disabled={loadingResources || warehouses.length === 0}
                >
                  {warehouses.length === 0 ? (
                    <option value="">No locations available</option>
                  ) : (
                    warehouses.map((warehouse) => (
                      <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                        {warehouse.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="rounded-[24px] border border-blue-200/60 bg-blue-50/50 p-6 shadow-inner dark:border-blue-900/40 dark:bg-blue-900/10 mb-8">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                Add rows below and choose each part from the list so you can update stock quickly without strict file formatting.
              </p>
            </div>

            {loadError && (
              <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
                <span className="text-xl">❌</span> {loadError}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-[24px] border border-slate-200/50 bg-white/40 dark:border-slate-800/50 dark:bg-slate-900/40 p-2 shadow-inner">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-slate-700/50">
                    <th className="px-4 py-4 w-12 text-center">#</th>
                    <th className="min-w-[220px] px-4 py-4 sm:min-w-[280px]">Select Catalog Part<RequiredAsterisk /></th>
                    <th className="px-4 py-4 w-32">Qty Added<RequiredAsterisk /></th>
                    <th className="px-4 py-4 w-36">Unit Cost (₹)<RequiredAsterisk /></th>
                    <th className="px-4 py-4 w-32">Reorder Lvl</th>
                    <th className="px-4 py-4 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="group border-b border-slate-100 dark:border-slate-800/50 transition-colors hover:bg-white/60 dark:hover:bg-slate-800/40 last:border-0">
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.part_id}
                          onChange={(event) => updateRow(index, 'part_id', event.target.value)}
                          className={selectClass}
                          disabled={loadingResources || partsCatalog.length === 0}
                        >
                          <option value="">
                            {loadingResources ? 'Loading parts...' : 'Choose a part...'}
                          </option>
                          {partsCatalog.map((part) => {
                            const isUsedByAnotherRow = selectedPartIds.has(part.part_id) && Number(row.part_id) !== part.part_id

                            return (
                              <option key={part.part_id} value={part.part_id} disabled={isUsedByAnotherRow}>
                                {part.part_name} ({part.part_id})
                              </option>
                            )
                          })}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity_available}
                          onChange={(event) => updateRow(index, 'quantity_available', event.target.value)}
                          className={inputClass}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={row.unit_cost}
                          onChange={(event) => updateRow(index, 'unit_cost', event.target.value)}
                          className={inputClass}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.reorder_level}
                          onChange={(event) => updateRow(index, 'reorder_level', event.target.value)}
                          className={inputClass}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white transition-all mx-auto active:scale-90"
                            title="Remove row"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-6">
              <button
                type="button"
                onClick={addRow}
                className="w-full sm:w-auto rounded-2xl border-2 border-dashed border-blue-300 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:border-blue-600 dark:hover:bg-blue-900/30 transition-all active:scale-95"
              >
                + ADD ANOTHER ROW
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loadingResources || !selectedWarehouse || partsCatalog.length === 0}
                className="w-full sm:w-auto rounded-2xl bg-blue-600 px-10 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
              >
                {submitting ? 'IMPORTING SECURELY...' : 'SUBMIT BATCH IMPORT'}
              </button>
            </div>
          </section>

          {results && (
            <section className={`${cardClass} animate-in zoom-in-95 duration-500`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-100 dark:border-blue-900/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-xl shadow-inner border border-green-500/20">✅</span>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Batch Results</h2>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    {results.message || 'Import successfully executed.'}
                  </p>
                </div>
              </div>

              {results.inventory?.length > 0 && (
                <div className="mt-3 overflow-x-auto rounded-[24px] border border-slate-200/50 bg-white/40 dark:border-slate-800/50 dark:bg-slate-900/40 p-2 shadow-inner">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-slate-700/50">
                      <tr>
                        <th className="px-4 py-4">Linked Part</th>
                        <th className="px-4 py-4 text-center">Qty Logged</th>
                        <th className="px-4 py-4 text-right">Unit Cost</th>
                        <th className="px-4 py-4 text-center">Alert Lvl</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                      {results.inventory.map((inventoryItem) => (
                        <tr key={inventoryItem.inventory_id} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {inventoryItem.part?.part_name || `Catalog ID: ${inventoryItem.part_id}`}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">{inventoryItem.quantity_available}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-600 dark:text-slate-300">₹{Number(inventoryItem.unit_cost).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center font-bold text-amber-500 dark:text-amber-400">{inventoryItem.reorder_level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
