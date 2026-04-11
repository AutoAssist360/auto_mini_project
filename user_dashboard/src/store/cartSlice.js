import { createSlice } from '@reduxjs/toolkit'

const loadCartFromStorage = () => {
  try {
    const stored = localStorage.getItem('user_cart')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const initialState = {
  items: loadCartFromStorage(),
  isOpen: false, // Controls the cart drawer
}

const getCartItemKey = ({ part_id, warehouse_id, inventory_id }) =>
  `${part_id}::${warehouse_id ?? ''}::${inventory_id ?? ''}`

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    toggleCart: (state) => {
      state.isOpen = !state.isOpen
    },
    openCart: (state) => {
      state.isOpen = true
    },
    closeCart: (state) => {
      state.isOpen = false
    },
    addToCart: (state, action) => {
      // payload expects: { part_id, part_name, category_name, unit_cost, quantity, warehouse_id, warehouse_name, inventory_id }
      const newItem = action.payload
      const existingItemIndex = state.items.findIndex(
        (item) => item.part_id === newItem.part_id && item.warehouse_id === newItem.warehouse_id
      )

      if (existingItemIndex !== -1) {
        state.items[existingItemIndex].quantity += (newItem.quantity || 1)
      } else {
        state.items.push({ ...newItem, quantity: newItem.quantity || 1 })
      }
      localStorage.setItem('user_cart', JSON.stringify(state.items))
    },
    removeFromCart: (state, action) => {
      const { part_id, warehouse_id } = action.payload
      state.items = state.items.filter(
        (item) => !(item.part_id === part_id && item.warehouse_id === warehouse_id)
      )
      localStorage.setItem('user_cart', JSON.stringify(state.items))
    },
    updateQuantity: (state, action) => {
      const { part_id, warehouse_id, quantity } = action.payload
      const item = state.items.find(
        (item) => item.part_id === part_id && item.warehouse_id === warehouse_id
      )
      if (item && quantity > 0) {
        item.quantity = quantity
      } else if (item && quantity === 0) {
        // Remove if 0
        state.items = state.items.filter(
          (item) => !(item.part_id === part_id && item.warehouse_id === warehouse_id)
        )
      }
      localStorage.setItem('user_cart', JSON.stringify(state.items))
    },
    clearCart: (state) => {
      state.items = []
      localStorage.removeItem('user_cart')
    },
    removeOrderedItems: (state, action) => {
      const orderedKeys = new Set((action.payload || []).map(getCartItemKey))
      state.items = state.items.filter((item) => !orderedKeys.has(getCartItemKey(item)))
      localStorage.setItem('user_cart', JSON.stringify(state.items))
    },
  },
})

export const {
  toggleCart,
  openCart,
  closeCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  removeOrderedItems,
} = cartSlice.actions

export const selectCartItems = (state) => state.cart.items
export const selectCartTotal = (state) =>
  state.cart.items.reduce((total, item) => total + Number(item.unit_cost) * item.quantity, 0)
export const selectCartItemCount = (state) =>
  state.cart.items.reduce((count, item) => count + item.quantity, 0)
export const selectIsCartOpen = (state) => state.cart.isOpen

// Group cart items by warehouse_id
export const selectCartGroupedByWarehouse = (state) => {
  return state.cart.items.reduce((acc, item) => {
    const groupKey = item.warehouse_id || item.warehouse_name || item.inventory_id || `part-${item.part_id}`
    if (!acc[groupKey]) {
      acc[groupKey] = {
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse_name,
        items: [],
        subtotal: 0,
      }
    }
    acc[groupKey].items.push(item)
    acc[groupKey].subtotal += Number(item.unit_cost) * item.quantity
    return acc
  }, {})
}

export default cartSlice.reducer
