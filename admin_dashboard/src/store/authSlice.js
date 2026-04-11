import { createSlice } from '@reduxjs/toolkit'

/**
 * Auth state — tokens are NEVER stored in JS.
 * The backend sets httpOnly cookies for accessToken & refreshToken.
 * We only keep non-sensitive user data, dashboard snapshot, and session flags.
 *
 * On page refresh:
 *   App.jsx calls POST /admin/auth/refresh (cookie auto-sent) → restores session.
 *   Then fetches GET /admin/dashboard to populate dashboard data.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    dashboard: null,
    isAuthenticated: false,
    isInitializing: true, // true until first session check completes
  },
  reducers: {
    setAuthUser(state, action) {
      state.user = action.payload || null
      state.isAuthenticated = Boolean(action.payload)
      state.isInitializing = false
    },
    setDashboardSnapshot(state, action) {
      state.dashboard = action.payload || null
    },
    clearAuth(state) {
      state.user = null
      state.dashboard = null
      state.isAuthenticated = false
      state.isInitializing = false
    },
    setInitializing(state, action) {
      state.isInitializing = Boolean(action.payload)
    },
  },
})

export const { setAuthUser, setDashboardSnapshot, clearAuth, setInitializing } = authSlice.actions
export default authSlice.reducer
