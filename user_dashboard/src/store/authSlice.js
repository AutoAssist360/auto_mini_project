import { createSlice } from '@reduxjs/toolkit'

/**
 * Auth state — tokens are NEVER stored in JS.
 * The backend sets httpOnly cookies for accessToken & refreshToken.
 * We only keep non-sensitive user profile data + session flags in Redux.
 *
 * On page refresh:
 *   App.jsx calls GET /profile (cookie auto-sent) → restores user.
 *   If access token expired the api layer auto-calls POST /auth/refresh.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    isInitializing: true, // true until first session check completes
  },
  reducers: {
    setAuthUser(state, action) {
      state.user = action.payload || null
      state.isAuthenticated = Boolean(action.payload)
      state.isInitializing = false
    },
    clearAuth(state) {
      state.user = null
      state.isAuthenticated = false
      state.isInitializing = false
    },
    setInitializing(state, action) {
      state.isInitializing = Boolean(action.payload)
    },
  },
})

export const { setAuthUser, clearAuth, setInitializing } = authSlice.actions
export default authSlice.reducer
