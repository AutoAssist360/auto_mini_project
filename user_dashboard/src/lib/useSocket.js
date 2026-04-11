import { useEffect, useRef, useCallback, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

/**
 * React hook that manages a Socket.io connection.
 *
 * @param {string|null} token Optional JWT access token. If omitted, cookies are used.
 * @returns {{ getSocket: () => import('socket.io-client').Socket | null, isConnected: boolean, on: Function, off: Function, emit: Function }}
 */
export function useSocket(token) {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const socket = io(SOCKET_URL.replace(/\/+$/, ''), {
      ...(token ? { auth: { token } } : {}),
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [token])

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  const getSocket = useCallback(() => socketRef.current, [])

  return { getSocket, isConnected, on, off, emit }
}
