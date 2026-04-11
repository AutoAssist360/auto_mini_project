const NOTIFICATION_UNREAD_SYNC_EVENT = 'user-notification-unread-sync'

function isClient() {
  return typeof window !== 'undefined'
}

export function emitNotificationUnreadSync(detail = {}) {
  if (!isClient()) return

  window.dispatchEvent(new CustomEvent(NOTIFICATION_UNREAD_SYNC_EVENT, { detail }))
}

export function subscribeToNotificationUnreadSync(handler) {
  if (!isClient()) return () => {}

  const listener = (event) => {
    handler(event.detail || {})
  }

  window.addEventListener(NOTIFICATION_UNREAD_SYNC_EVENT, listener)
  return () => window.removeEventListener(NOTIFICATION_UNREAD_SYNC_EVENT, listener)
}
