import { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  selectIsCartOpen,
  closeCart,
  selectCartGroupedByWarehouse,
  selectCartTotal,
  updateQuantity,
  removeFromCart,
} from '../store/cartSlice'

export default function CartDrawer() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const isOpen = useSelector(selectIsCartOpen)
  const groupedCart = useSelector(selectCartGroupedByWarehouse)
  const cartTotal = useSelector(selectCartTotal)
  const drawerRef = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        dispatch(closeCart())
      }
    }
    // Timeout prevents immediate trigger if the open toggle was also a click event.
    setTimeout(() => document.addEventListener('pointerdown', handler), 10)
    return () => document.removeEventListener('pointerdown', handler)
  }, [isOpen, dispatch])

  if (!isOpen) return null

  const handleCheckout = () => {
    dispatch(closeCart())
    navigate('/checkout')
  }

  const formatPrice = (price) => {
    return `₹${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const warehouseIds = Object.keys(groupedCart)

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm transition-opacity" />
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Shopping Cart</h2>
          <button
            onClick={() => dispatch(closeCart())}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {warehouseIds.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="text-6xl mb-4">🛒</span>
              <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Your cart is empty</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Looks like you haven't added any parts yet.</p>
              <button
                onClick={() => { dispatch(closeCart()); navigate('/parts'); }}
                className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Browse Parts
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {warehouseIds.map((wId) => {
                const group = groupedCart[wId]
                return (
                  <div key={wId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700">
                      📦 {group.warehouse_name}
                    </h3>
                    <div className="space-y-4">
                      {group.items.map((item) => (
                        <div key={item.part_id} className="flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                                {item.part_name}
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mt-1">
                                {item.category_name}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">
                              {formatPrice(item.unit_cost)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                              <button
                                onClick={() => dispatch(updateQuantity({ part_id: item.part_id, warehouse_id: wId, quantity: item.quantity - 1 }))}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                              <button
                                onClick={() => dispatch(updateQuantity({ part_id: item.part_id, warehouse_id: wId, quantity: item.quantity + 1 }))}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => dispatch(removeFromCart({ part_id: item.part_id, warehouse_id: wId }))}
                              className="text-xs text-red-600 hover:text-red-500 font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {warehouseIds.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between font-bold text-lg text-slate-900 dark:text-white">
              <span>Subtotal:</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-center text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
