import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getUnreadCount } from '../lib/api'
import { useSocket } from '../lib/useSocket'

export default function GlobalNotificationBell() {
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const { on, off } = useSocket(null)

  const reloadUnread = useCallback(() => {
    getUnreadCount()
      .then((response) => setUnread(response.unreadCount ?? response.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    reloadUnread()
  }, [location.pathname, reloadUnread])

  useEffect(() => {
    reloadUnread()
    const handleNotificationUpdate = (payload = {}) => {
      if (typeof payload.unreadCount === 'number') {
        setUnread(Math.max(0, payload.unreadCount))
        return
      }

      reloadUnread()
    }

    on('notification:new', handleNotificationUpdate)
    on('notification:changed', handleNotificationUpdate)

    return () => {
      off('notification:new', handleNotificationUpdate)
      off('notification:changed', handleNotificationUpdate)
    }
  }, [off, on, reloadUnread])

  if (location.pathname === '/notifications') {
    return null
  }

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `${unread} unread notifications` : 'Open notifications'}
      className="fixed right-4 top-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-xl backdrop-blur transition hover:scale-105 hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:text-blue-400 sm:right-6 sm:top-6"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>

      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
