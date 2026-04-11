import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  cancelOrder,
  collectCodPayment,
  confirmOrder,
  createFulfillment,
  getOrderById,
  getApiErrorMessage,
  getOrderFulfillments,
  processOrder,
  returnOrder,
  reviewOrderReturn,
  updateFulfillmentStatus,
} from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import { formatLabel } from '../lib/displayText'

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  in_transit: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  returned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  active: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  converted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

const NEXT_FULFILLMENT_STATUS = {
  pending: ['processing', 'failed'],
  processing: ['shipped', 'failed'],
  shipped: ['in_transit', 'delivered', 'failed'],
  in_transit: ['delivered', 'failed'],
}

const QUICK_FULFILLMENT_LABELS = {
  processing: 'Mark Shipment Processing',
  shipped: 'Mark Shipped',
  in_transit: 'Mark In Transit',
  delivered: 'Mark Delivered',
}

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

function formatCurrency(value) {
  return value == null ? 'N/A' : `Rs ${Number(value).toFixed(2)}`
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : 'N/A'
}

function getOrderTrackingMode(order, latestFulfillment) {
  if (order?.return_status === 'requested' && order?.order_status === 'delivered') {
    return {
      type: 'return_pickup',
      title: 'Return Pickup Tracking',
      description: 'Share live location while travelling to collect the return from the customer.',
    }
  }

  if (
    ['processing', 'shipped'].includes(order?.order_status) ||
    ['processing', 'shipped', 'in_transit'].includes(latestFulfillment?.status)
  ) {
    return {
      type: 'delivery',
      title: 'Live Delivery Tracking',
      description: 'Share live location while travelling to deliver this order.',
    }
  }

  return null
}

function getTrackingEndedMessage(reason, trackingModeType) {
  if (!reason) return ''
  if (reason === 'delivery_paused') return 'Live delivery tracking is paused. Start it again when the shipment is moving.'
  if (reason === 'return_pickup_paused') return 'Live return pickup tracking is paused. Start it again when you resume the pickup.'
  if (reason === 'delivered') return 'Live tracking stopped because the order was marked delivered.'
  if (reason === 'returned') return 'Live tracking stopped because the return flow was completed.'
  if (reason === 'cancelled') return 'Live tracking stopped because the order was cancelled.'
  if (reason === 'rejected') return 'Live tracking stopped because the return request was rejected.'
  if (trackingModeType === 'return_pickup') {
    return `Live tracking stopped because the return moved to ${reason.replace(/_/g, ' ')}.`
  }
  return `Live tracking stopped because the order moved to ${reason.replace(/_/g, ' ')}.`
}

function getOrderWorkflowSteps(order, fulfillments, latestFulfillment) {
  const orderStatus = order?.order_status
  const fulfillmentStatus = latestFulfillment?.status
  const hasFulfillment = fulfillments.length > 0

  return [
    {
      key: 'confirmed',
      label: 'Confirmed',
      description: 'Vendor accepts the paid order.',
      state: orderStatus === 'pending'
        ? 'current'
        : ['confirmed', 'processing', 'shipped', 'delivered', 'returned'].includes(orderStatus)
          ? 'completed'
          : 'upcoming',
    },
    {
      key: 'processing',
      label: 'Processing',
      description: 'Parts are packed and getting ready to go out.',
      state: ['processing', 'shipped', 'delivered', 'returned'].includes(orderStatus)
        ? 'completed'
        : orderStatus === 'confirmed'
          ? 'current'
          : 'upcoming',
    },
    {
      key: 'fulfillment',
      label: 'Delivery Update',
      description: 'Add the delivery partner, tracking number, and expected time.',
      state: hasFulfillment
        ? 'completed'
        : orderStatus === 'processing'
          ? 'current'
          : 'upcoming',
    },
    {
      key: 'dispatch',
      label: 'Shipping',
      description: 'Move the delivery to shipped or in transit.',
      state: ['shipped', 'in_transit', 'delivered'].includes(fulfillmentStatus) || ['shipped', 'delivered', 'returned'].includes(orderStatus)
        ? 'completed'
        : hasFulfillment
          ? 'current'
          : 'upcoming',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      description: 'Mark delivered once the customer receives it.',
      state: ['delivered', 'returned'].includes(orderStatus) || fulfillmentStatus === 'delivered'
        ? 'completed'
        : ['shipped'].includes(orderStatus) || ['shipped', 'in_transit'].includes(fulfillmentStatus)
          ? 'current'
          : 'upcoming',
    },
  ]
}

function getNextActionHint(order, latestFulfillment) {
  if (!order) return null
  if (order.order_status === 'pending') {
    return {
      title: 'Confirm the order',
      description: 'After you verify the payment, confirm the order so your team can start packing.',
    }
  }
  if (order.order_status === 'confirmed') {
    return {
      title: 'Start packing',
      description: 'Mark it as processing when packing starts. Then add a delivery update.',
    }
  }
  if (order.order_status === 'processing' && !latestFulfillment) {
    return {
      title: 'Add a delivery update',
      description: 'This lets you track shipping, expected delivery, and final delivery.',
    }
  }
  if (latestFulfillment?.status === 'pending') {
    return {
      title: 'Move delivery to packing',
      description: 'Use the delivery controls below, then mark it shipped when it leaves your location.',
    }
  }
  if (latestFulfillment?.status === 'processing') {
    return {
      title: 'Mark as shipped',
      description: 'After handoff to delivery, mark it shipped and start live tracking if needed.',
    }
  }
  if (latestFulfillment?.status === 'shipped') {
    return {
      title: 'Update delivery progress',
      description: 'Mark it in transit or directly delivered when the customer gets the order.',
    }
  }
  if (latestFulfillment?.status === 'in_transit') {
    return {
      title: 'Mark delivered after handoff',
      description: 'As soon as the customer receives the order, mark it delivered so the order closes correctly.',
    }
  }
  if (order.order_status === 'delivered') {
    return {
      title: 'Delivery completed',
      description: order.payment_method === 'cash_on_delivery'
        ? 'Collect COD if it is still pending, otherwise this order is complete.'
        : 'This order is complete unless a return request comes in.',
    }
  }
  if (order.order_status === 'returned') {
    return {
      title: 'Return completed',
      description: 'Inventory and payment handling should now be settled for this order.',
    }
  }
  if (order.order_status === 'cancelled') {
    return {
      title: 'Order cancelled',
      description: 'No more shipping actions are needed for this order.',
    }
  }
  return null
}

const cardClass = 'rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden transition-all duration-300'
const inputClass = 'w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B1120] focus:ring-4 focus:ring-blue-500/10 dark:text-white'

function stepClasses(state) {
  if (state === 'completed') {
    return 'border-blue-200 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 shadow-sm'
  }
  if (state === 'current') {
    return 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/50 dark:bg-cyan-500/20 dark:text-cyan-200 shadow-md ring-2 ring-cyan-500/20 scale-[1.02] transition-transform'
  }
  return 'border-slate-200 bg-white/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-500 opacity-60'
}

function DeliveryCard({ order }) {
  const destinationAddress = [
    order?.delivery_address,
    order?.delivery_city,
    order?.delivery_state,
    order?.delivery_postal_code,
  ].filter(Boolean).join(', ')
  const destinationLat = order?.delivery_latitude ?? order?.request?.breakdown_latitude
  const destinationLng = order?.delivery_longitude ?? order?.request?.breakdown_longitude
  const originLat = order?.warehouse?.latitude
  const originLng = order?.warehouse?.longitude
  const hasDestinationCoords = destinationLat != null && destinationLng != null
  const hasOriginCoords = originLat != null && originLng != null
  const mapsUrl = hasDestinationCoords && hasOriginCoords
    ? `https://www.google.com/maps/dir/${originLat},${originLng}/${destinationLat},${destinationLng}`
    : hasDestinationCoords
      ? `https://www.google.com/maps/search/?api=1&query=${destinationLat},${destinationLng}`
      : destinationAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationAddress)}`
        : null

  return (
    <section className={`${cardClass} lg:col-span-2`}>
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xl shadow-inner">
            📍
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Delivery Details</h2>
            <p className="mt-0.5 text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">Use this saved address for delivery.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95">
              Open in Maps
            </a>
          )}
          {(order?.delivery_phone || order?.user?.phone_number) && (
            <a href={`tel:${order?.delivery_phone || order?.user?.phone_number}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm">
              Call Customer
            </a>
          )}
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-5 text-sm">
          <p><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Contact</span> <span className="font-semibold">{order?.delivery_contact_name || order?.user?.full_name || 'N/A'}</span></p>
          <p className="mt-4"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Phone</span> <span className="font-semibold">{order?.delivery_phone || order?.user?.phone_number || 'N/A'}</span></p>
          <p className="mt-4"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Address</span> <span className="font-medium text-slate-600 dark:text-slate-400">{destinationAddress || 'N/A'}</span></p>
          {order?.delivery_instructions && <p className="mt-4"><span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block mb-1">Instructions</span> {order.delivery_instructions}</p>}
        </div>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-5 text-sm">
          <p><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Location</span> <span className="font-semibold">{order?.warehouse?.name || 'N/A'}</span></p>
          <p className="mt-4"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Location address</span> <span className="font-medium text-slate-600 dark:text-slate-400">{[order?.warehouse?.address, order?.warehouse?.city].filter(Boolean).join(', ') || 'N/A'}</span></p>
          <p className="mt-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Destination Coordinates</span>
            <span className="font-mono text-xs">{hasDestinationCoords
              ? `${destinationLat.toFixed(5)}, ${destinationLng.toFixed(5)}`
              : 'N/A'}</span>
          </p>
        </div>
      </div>
    </section>
  )
}

function VendorOrderDetailPage({ theme, onToggleTheme }) {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [fulfillments, setFulfillments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [acting, setActing] = useState(false)
  const [showCreateFulfillment, setShowCreateFulfillment] = useState(false)
  const [showManualReturnForm, setShowManualReturnForm] = useState(false)
  const [editFulfillmentId, setEditFulfillmentId] = useState(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnReviewNotes, setReturnReviewNotes] = useState('')
  const [newFulfillment, setNewFulfillment] = useState({ tracking_number: '', carrier: '', estimated_delivery: '', notes: '' })
  const [fulfillForm, setFulfillForm] = useState({ status: '', tracking_number: '', carrier: '', estimated_delivery: '', notes: '' })
  const [liveStatus, setLiveStatus] = useState('connecting')
  const [liveMessage, setLiveMessage] = useState('')
  const [sharingLocation, setSharingLocation] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [lastSharedAt, setLastSharedAt] = useState(null)
  const socketRef = useRef(null)
  const watchIdRef = useRef(null)
  const lastEmitAtRef = useRef(0)

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [orderRes, fulfillmentRes] = await Promise.allSettled([
        getOrderById(orderId),
        getOrderFulfillments(orderId),
      ])

      if (orderRes.status === 'fulfilled') {
        setOrder(orderRes.value?.order ?? null)
      } else {
        setOrder(null)
        setError(getApiErrorMessage(orderRes.reason, 'Failed to load order'))
      }

      if (fulfillmentRes.status === 'fulfilled') {
        setFulfillments(fulfillmentRes.value?.fulfillments ?? [])
      } else {
        setFulfillments([])
        if (orderRes.status === 'fulfilled') {
          setError(getApiErrorMessage(fulfillmentRes.reason, 'Failed to load fulfillments'))
        }
      }
    } catch (err) {
      setOrder(null)
      setFulfillments([])
      setError(getApiErrorMessage(err, 'Failed to load order'))
    } finally {
      setLoading(false)
    }
  }, [orderId])

  const latestFulfillment = useMemo(() => fulfillments[0] || null, [fulfillments])
  const trackingMode = useMemo(() => getOrderTrackingMode(order, latestFulfillment), [order, latestFulfillment])
  const trackingModeType = trackingMode?.type || null
  const workflowSteps = useMemo(() => getOrderWorkflowSteps(order, fulfillments, latestFulfillment), [order, fulfillments, latestFulfillment])
  const nextActionHint = useMemo(() => getNextActionHint(order, latestFulfillment), [order, latestFulfillment])
  const quickFulfillmentStatuses = useMemo(
    () => (NEXT_FULFILLMENT_STATUS[latestFulfillment?.status] || []).filter((status) => status !== 'failed'),
    [latestFulfillment],
  )

  const stopSharingLocation = useCallback(({ notifyServer = true } = {}) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (notifyServer && socketRef.current?.connected && orderId && trackingModeType) {
      socketRef.current.emit('order_tracking:stop', {
        orderId,
        reason: trackingModeType === 'return_pickup' ? 'return_pickup_paused' : 'delivery_paused',
      })
    }

    lastEmitAtRef.current = 0
    setSharingLocation(false)
  }, [orderId, trackingModeType])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (!orderId) return undefined

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socketRef.current = socket

    const reloadOrder = (payload) => {
      const payloadOrderId = payload?.order_id || payload?.data?.order_id
      if (payloadOrderId && payloadOrderId !== orderId) return

      const realtimeMessage = payload?.message || payload?.title
      if (realtimeMessage) {
        setLiveMessage(realtimeMessage)
      }

      loadOrder().catch(() => null)
    }

    socket.on('connect', () => {
      setLiveStatus('live')
      setTrackingError('')
      if (trackingModeType) {
        socket.emit('order_tracking:join', orderId)
      }
    })

    socket.on('disconnect', () => {
      setLiveStatus('offline')
      if (watchIdRef.current !== null) {
        setTrackingError('Connection dropped. Tracking will resume when the socket reconnects.')
      }
    })

    socket.on('connect_error', () => {
      setLiveStatus('offline')
    })

    socket.on('notification:new', (payload) => {
      if (payload?.data?.order_id !== orderId) return
      setLiveMessage(payload.message || payload.title || 'Order updated in real time.')
      loadOrder().catch(() => null)
    })

    socket.on('vendor:orders_refresh', reloadOrder)
    socket.on('vendor:dashboard_refresh', reloadOrder)

    socket.on('order_tracking:error', (payload) => {
      if (payload?.orderId && payload.orderId !== orderId) return
      setTrackingError(payload?.message || 'Unable to share live order tracking right now.')
    })

    socket.on('order_tracking:ended', (payload) => {
      if (payload?.orderId !== orderId) return
      stopSharingLocation({ notifyServer: false })
      setTrackingError(getTrackingEndedMessage(payload?.reason, trackingModeType))
    })

    return () => {
      if (trackingModeType) {
        socket.emit('order_tracking:leave', orderId)
      }
      socket.disconnect()
      socketRef.current = null
    }
  }, [loadOrder, orderId, stopSharingLocation, trackingModeType])

  useEffect(() => {
    if (!trackingModeType) {
      stopSharingLocation({ notifyServer: false })
    }
  }, [stopSharingLocation, trackingModeType])

  useEffect(() => () => {
    stopSharingLocation({ notifyServer: false })
  }, [stopSharingLocation])

  const startSharingLocation = () => {
    if (!navigator.geolocation) {
      setTrackingError('Geolocation is not available in this browser.')
      return
    }

    if (watchIdRef.current !== null) {
      return
    }

    if (!trackingModeType) {
      setTrackingError('Live tracking is not available for the current order stage.')
      return
    }

    if (!socketRef.current?.connected) {
      setTrackingError('Live tracking is still connecting. Please try again in a moment.')
      return
    }

    setTrackingError('')
    setSharingLocation(true)
    socketRef.current.emit('order_tracking:join', orderId)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        const now = Date.now()

        if (socketRef.current?.connected && now - lastEmitAtRef.current >= 5000) {
          socketRef.current.emit('order_tracking:update', {
            orderId,
            latitude,
            longitude,
            trackingType: trackingModeType,
          })
          lastEmitAtRef.current = now
          setLastSharedAt(new Date().toISOString())
        }
      },
      (geoError) => {
        watchIdRef.current = null
        setSharingLocation(false)
        setTrackingError(geoError?.message || 'Location permission was denied.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    )
  }

  const runAction = async (fn, successMessage, afterSuccess) => {
    setActing(true)
    setActionMsg('')
    try {
      await fn()
      if (afterSuccess) afterSuccess()
      setActionMsg(successMessage)
      await loadOrder()
    } catch (err) {
      setActionMsg(getApiErrorMessage(err, 'Failed'))
    } finally {
      setActing(false)
    }
  }

  const handleCreateFulfillment = () => runAction(
    () => createFulfillment(orderId, {
      tracking_number: newFulfillment.tracking_number || undefined,
      carrier: newFulfillment.carrier || undefined,
      estimated_delivery: newFulfillment.estimated_delivery ? new Date(newFulfillment.estimated_delivery).toISOString() : undefined,
      notes: newFulfillment.notes || undefined,
    }),
    'Delivery record created',
    () => {
      setShowCreateFulfillment(false)
      setNewFulfillment({ tracking_number: '', carrier: '', estimated_delivery: '', notes: '' })
    },
  )

  const handleFulfillmentUpdate = () => {
    if (!fulfillForm.status) return
    return runAction(
      () => updateFulfillmentStatus(editFulfillmentId, {
        status: fulfillForm.status,
        tracking_number: fulfillForm.tracking_number || undefined,
        carrier: fulfillForm.carrier || undefined,
        estimated_delivery: fulfillForm.estimated_delivery ? new Date(fulfillForm.estimated_delivery).toISOString() : undefined,
        notes: fulfillForm.notes || undefined,
      }),
      'Delivery record updated',
      () => {
        setEditFulfillmentId(null)
        setFulfillForm({ status: '', tracking_number: '', carrier: '', estimated_delivery: '', notes: '' })
      },
    )
  }

  const handleQuickFulfillmentUpdate = (status) => {
    if (!latestFulfillment) return
    return runAction(
      () => updateFulfillmentStatus(latestFulfillment.fulfillment_id, { status }),
      `Shipment marked ${formatLabel(status)}`,
    )
  }

  const openFulfillmentEdit = (fulfillment) => {
    setEditFulfillmentId(fulfillment.fulfillment_id)
    setFulfillForm({
      status: '',
      tracking_number: fulfillment.tracking_number || '',
      carrier: fulfillment.carrier || '',
      estimated_delivery: fulfillment.estimated_delivery ? new Date(fulfillment.estimated_delivery).toISOString().slice(0, 16) : '',
      notes: fulfillment.notes || '',
    })
  }

  const handleReturnReview = (decision) => runAction(
    () => reviewOrderReturn(orderId, {
      decision,
      resolution_notes: returnReviewNotes.trim() || undefined,
    }),
    decision === 'approved' ? 'Return request approved and inventory restored' : 'Return request rejected',
    () => {
      setReturnReviewNotes('')
    },
  )

  const canConfirm = order?.order_status === 'pending'
  const canProcess = order?.order_status === 'confirmed'
  const canCancel = ['pending', 'confirmed', 'processing'].includes(order?.order_status)
  const canCreateFulfillment = ['confirmed', 'processing'].includes(order?.order_status)
  const canManualReturn = order?.order_status === 'delivered' && !order?.return_status
  const hasPendingReturnRequest = order?.return_status === 'requested'
  const canCollectCod = order?.payment_method === 'cash_on_delivery'
    && order?.payment_status !== 'completed'
    && order?.payment_status !== 'refunded'
    && order?.order_status === 'delivered'
  const showDeliveryCard = ['processing', 'shipped', 'delivered', 'returned'].includes(order?.order_status) || Boolean(order?.return_status)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-0 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase ml-2">Order Details</h1>
          </div>
          <button type="button" onClick={onToggleTheme} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300">
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </header>

        <div className="mb-8 mt-6 ml-2">
          <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Orders', to: '/orders' }, { label: 'Order Details' }]} />
        </div>

        {actionMsg && (
          <div className={`mb-6 flex items-center gap-3 rounded-[24px] border px-5 py-4 text-sm font-bold shadow-sm animate-in fade-in ${/confirmed|processing|created|updated|released|restored|approved|rejected|collected|cancelled|marked/i.test(actionMsg) ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
            <span className="text-xl">✅</span> {actionMsg}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
            <span className="text-xl">❌</span> {error}
          </div>
        )}

        {loading ? (
          <ListSkeleton />
        ) : !order ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800/50 text-4xl shadow-inner mb-4">
              🤷
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white">Order Not Found</h3>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <section className={cardClass}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 px-5 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`relative flex h-3 w-3 ${liveStatus === 'live' ? 'animate-pulse' : ''}`}>
                    {liveStatus === 'live' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>}
                    <span className={`relative inline-flex h-3 w-3 rounded-full ${liveStatus === 'live' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest text-[10px]">
                    {liveStatus === 'live' ? 'Live Connected' : 'Reconnecting'}
                  </span>
                </div>
                {liveMessage && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-medium bg-white dark:bg-slate-900 px-2 py-1 rounded-md">{liveMessage}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">{order.order_number}</h2>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[order.order_status] || ''}`}>{formatLabel(order.order_status)}</span>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</span>
                  <span className="text-sm font-semibold">{order.user?.full_name || order.user?.email}</span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</span>
                  <span className="text-sm font-semibold">{order.warehouse?.name} <span className="opacity-50">({order.warehouse?.city || 'N/A'})</span></span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment</span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold">{formatLabel(order.payment_status)}</span>
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{order.payment_method ? formatLabel(order.payment_method) : 'Not selected'}</span>
                  </span>
                </div>
                
                <div className="pt-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex justify-between text-sm mb-2"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{formatCurrency(order.subtotal)}</span></div>
                  <div className="flex justify-between text-sm mb-3"><span className="text-slate-500">Tax</span><span className="font-semibold">{formatCurrency(order.tax)}</span></div>
                  <div className="flex justify-between text-base border-t border-slate-200 dark:border-slate-700/50 pt-3 mt-1"><span className="font-black uppercase tracking-wider text-slate-900 dark:text-white">Total</span><span className="font-black text-blue-600 dark:text-blue-400">{formatCurrency(order.total)}</span></div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Order created</span>
                    <span className="text-xs font-semibold">{formatDateTime(order.created_at)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current ETA</span>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{formatDateTime(latestFulfillment?.estimated_delivery)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">Actions</h2>
              <div className="flex flex-wrap gap-2 animate-in fade-in duration-500">
                {canConfirm && <button type="button" onClick={() => runAction(() => confirmOrder(orderId), 'Order confirmed')} disabled={acting} className="rounded-xl bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-60 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Confirm Order'}</button>}
                {canProcess && <button type="button" onClick={() => runAction(() => processOrder(orderId), 'Order moved to processing')} disabled={acting} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-500 disabled:opacity-60 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Start Packing'}</button>}
                {canCreateFulfillment && <button type="button" onClick={() => setShowCreateFulfillment((prev) => !prev)} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all">{showCreateFulfillment ? 'Hide Delivery Form' : 'Add Delivery Update'}</button>}
                {canCancel && <button type="button" onClick={() => runAction(() => cancelOrder(orderId), 'Order cancelled and reservations released')} disabled={acting} className="rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500 disabled:opacity-60 shadow-lg shadow-red-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Cancel Order'}</button>}
                {canCollectCod && <button type="button" onClick={() => runAction(() => collectCodPayment(orderId), 'Cash on delivery collected')} disabled={acting} className="rounded-xl bg-amber-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-amber-500 disabled:opacity-60 shadow-lg shadow-amber-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Mark COD Collected'}</button>}
                {canManualReturn && <button type="button" onClick={() => setShowManualReturnForm((prev) => !prev)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all">{showManualReturnForm ? 'Hide Return Form' : 'Handle Return'}</button>}
              </div>

              {nextActionHint && (
                <div className="mt-6 rounded-2xl border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/80 dark:bg-cyan-900/10 p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Suggested next step</p>
                  <p className="mt-2 text-sm font-semibold text-cyan-900 dark:text-cyan-100">{nextActionHint.title}</p>
                  <p className="mt-1 text-xs text-cyan-800 dark:text-cyan-200/80">{nextActionHint.description}</p>
                </div>
              )}

              {latestFulfillment && quickFulfillmentStatuses.length > 0 && (
                <div className="mt-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-blue-100 dark:border-blue-800/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">Latest delivery update</p>
                    <span className="text-xs font-semibold text-blue-900 dark:text-white bg-blue-100 dark:bg-blue-800/50 px-2 py-1 rounded">{formatLabel(latestFulfillment.status)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickFulfillmentStatuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleQuickFulfillmentUpdate(status)}
                        disabled={acting}
                        className="rounded-xl border border-blue-300 dark:border-blue-700/50 bg-white dark:bg-blue-900/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-800/40 disabled:opacity-60 shadow-sm active:scale-95 transition-all"
                      >
                        {acting ? 'Working...' : QUICK_FULFILLMENT_LABELS[status] || formatLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showCreateFulfillment && (
                <div className="mt-6 grid gap-4 rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-6 shadow-sm sm:grid-cols-2 animate-in slide-in-from-top-2 duration-300">
                  <input value={newFulfillment.tracking_number} onChange={(e) => setNewFulfillment((prev) => ({ ...prev, tracking_number: e.target.value }))} placeholder="Tracking number" className={inputClass} />
                  <input value={newFulfillment.carrier} onChange={(e) => setNewFulfillment((prev) => ({ ...prev, carrier: e.target.value }))} placeholder="Delivery partner" className={inputClass} />
                  <input type="datetime-local" value={newFulfillment.estimated_delivery} onChange={(e) => setNewFulfillment((prev) => ({ ...prev, estimated_delivery: e.target.value }))} className={inputClass} />
                  <input value={newFulfillment.notes} onChange={(e) => setNewFulfillment((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Delivery note" className={inputClass} />
                  <button type="button" onClick={handleCreateFulfillment} disabled={acting} className="mt-2 rounded-xl bg-cyan-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-cyan-500 disabled:opacity-60 sm:col-span-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Create Delivery Record'}</button>
                </div>
              )}

              {showManualReturnForm && (
                <div className="mt-6 space-y-4 rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-6 shadow-sm animate-in slide-in-from-top-2 duration-300">
                  <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={3} placeholder="Write the reason for this return..." className={inputClass} />
                  <button type="button" onClick={() => runAction(() => returnOrder(orderId, returnReason.trim()), 'Return processed and stock restored', () => { setReturnReason(''); setShowManualReturnForm(false) })} disabled={acting || !returnReason.trim()} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-60 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Submit Return'}</button>
                </div>
              )}

              {hasPendingReturnRequest && (
                <div className="mt-6 space-y-4 rounded-3xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-900/10 p-6 shadow-sm">
                  <div className="flex justify-between items-start pb-4 border-b border-amber-100 dark:border-amber-800/40">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Return request waiting</p>
                      <p className="mt-2 text-sm font-bold text-amber-900 dark:text-amber-100">{order.return_reason || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Requested</p>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">{formatDateTime(order.return_requested_at)}</p>
                    </div>
                  </div>
                  <textarea value={returnReviewNotes} onChange={(e) => setReturnReviewNotes(e.target.value)} rows={2} placeholder="Add a note..." className={inputClass} />
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => handleReturnReview('approved')} disabled={acting} className="rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-60 shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex-1">{acting ? 'Working...' : 'Approve Return'}</button>
                    <button type="button" onClick={() => handleReturnReview('rejected')} disabled={acting} className="rounded-xl bg-red-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500 disabled:opacity-60 shadow-lg shadow-red-500/20 active:scale-95 transition-all flex-1">{acting ? 'Working...' : 'Reject Return'}</button>
                  </div>
                </div>
              )}
            </section>

            <section className={`${cardClass} lg:col-span-2`}>
              <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Delivery Steps</h2>
                  <p className="mt-0.5 text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">Follow the order from packing to delivery.</p>
                </div>
                {latestFulfillment?.status && (
                  <span className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 shadow-sm`}>
                    Latest step: {formatLabel(latestFulfillment.status)}
                  </span>
                )}
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-5 relative z-10">
                {workflowSteps.map((step) => (
                  <div key={step.key} className={`rounded-3xl border p-5 transition-all duration-300 ${stepClasses(step.state)}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest">{step.label}</p>
                    <p className="mt-3 text-xs opacity-80 font-medium leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {trackingMode && (
              <section className={`${cardClass} lg:col-span-2 !bg-cyan-50/70 dark:!bg-cyan-950/20 !border-cyan-200 dark:!border-cyan-800/50`}>
                <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xl shadow-inner">
                      🛰️
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-cyan-900 dark:text-cyan-300">{trackingMode.title}</h2>
                      <p className="mt-0.5 text-[10px] font-bold tracking-widest text-cyan-700 dark:text-cyan-500 uppercase">
                        {trackingMode.description}
                      </p>
                    </div>
                  </div>
                  {sharingLocation ? (
                    <button
                      type="button"
                      onClick={() => stopSharingLocation()}
                      className="rounded-xl bg-red-500 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-400 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                    >
                      Stop Live Tracking
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startSharingLocation}
                      className="rounded-xl bg-cyan-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                    >
                      Start Live Tracking
                    </button>
                  )}
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 relative z-10">
                  <div className="rounded-3xl border border-cyan-200/50 dark:border-cyan-800/30 bg-white/60 dark:bg-[#0B1120]/60 p-6 text-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Destination</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      {trackingMode.type === 'return_pickup'
                        ? 'Customer return pickup location'
                        : 'Customer delivery location'}
                    </p>
                    {(order?.delivery_latitude != null && order?.delivery_longitude != null) && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">LAT: {order.delivery_latitude.toFixed(5)}</span>
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">LNG: {order.delivery_longitude.toFixed(5)}</span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-3xl border border-cyan-200/50 dark:border-cyan-800/30 bg-white/60 dark:bg-[#0B1120]/60 p-6 text-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Tracking state</p>
                    <div className="flex items-center gap-2">
                      {sharingLocation && <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span></span>}
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {sharingLocation ? 'Sharing location every few seconds' : 'Paused until you start sharing'}
                      </p>
                    </div>
                    {lastSharedAt && (
                      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Last sent: <span className="text-cyan-600 dark:text-cyan-400">{new Date(lastSharedAt).toLocaleTimeString()}</span>
                      </p>
                    )}
                    {latestFulfillment?.status && trackingMode.type === 'delivery' && (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Stage: <span className="text-indigo-600 dark:text-indigo-400">{formatLabel(latestFulfillment.status)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {trackingError && (
                  <div className="mt-6 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm relative z-10 flex items-center gap-3">
                    <span className="text-xl">⚠️</span> {trackingError}
                  </div>
                )}
              </section>
            )}

            {showDeliveryCard && <DeliveryCard order={order} />}

            <section className={`${cardClass} lg:col-span-2`}>
              <div className="flex items-center gap-3 relative z-10 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 text-xl shadow-inner">
                  📦
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Items ({order.items?.length || 0})</h2>
                </div>
              </div>
              <div className="overflow-x-auto relative z-10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="pb-3 pr-4">Part</th>
                      <th className="pb-3 pr-4 text-right">Qty</th>
                      <th className="pb-3 pr-4 text-right">Unit Price</th>
                      <th className="pb-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item) => (
                      <tr key={item.order_item_id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-4 pr-4 font-semibold text-slate-900 dark:text-white">{item.part?.part_name || `Part #${item.part_id}`}</td>
                        <td className="py-4 pr-4 text-right font-mono text-slate-600 dark:text-slate-400">{item.quantity}</td>
                        <td className="py-4 pr-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(item.unit_price)}</td>
                        <td className="py-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={`${cardClass} lg:col-span-2`}>
              <div className="flex items-center gap-3 relative z-10 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xl shadow-inner">
                  🚚
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Delivery updates ({fulfillments.length})</h2>
                </div>
              </div>

              {fulfillments.length === 0 ? (
                <div className="flex justify-center items-center py-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No delivery updates yet.</p>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  {fulfillments.map((fulfillment) => (
                    <div key={fulfillment.fulfillment_id} className="rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-[#0F172A]/50 backdrop-blur p-6 transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm ${STATUS_COLORS[fulfillment.status] || ''}`}>{fulfillment.status?.replace(/_/g, ' ')}</span>
                          {fulfillment.tracking_number && <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold tracking-widest border border-slate-200 dark:border-slate-700">Trk: {fulfillment.tracking_number}</span>}
                        </div>
                        {NEXT_FULFILLMENT_STATUS[fulfillment.status] && <button type="button" onClick={() => openFulfillmentEdit(fulfillment)} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95">Edit</button>}
                      </div>
                      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Created</p><p className="font-semibold">{formatDateTime(fulfillment.created_at)}</p></div>
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Delivery partner</p><p className="font-semibold">{fulfillment.carrier || 'N/A'}</p></div>
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Expected</p><p className="font-semibold text-indigo-600 dark:text-indigo-400">{formatDateTime(fulfillment.estimated_delivery)}</p></div>
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Shipped on</p><p className="font-semibold">{formatDateTime(fulfillment.shipped_at)}</p></div>
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Delivered on</p><p className="font-semibold">{formatDateTime(fulfillment.delivered_at)}</p></div>
                        {fulfillment.notes && <div className="col-span-full mt-2"><p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Note</p><p className="italic">{fulfillment.notes}</p></div>}
                      </div>
                      
                      {editFulfillmentId === fulfillment.fulfillment_id && (
                        <div className="mt-6 grid gap-4 rounded-3xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-6 animate-in slide-in-from-top-2 duration-300 sm:grid-cols-2">
                          <select value={fulfillForm.status} onChange={(e) => setFulfillForm((prev) => ({ ...prev, status: e.target.value }))} className={inputClass}>
                            <option value="">Choose next status</option>
                            {(NEXT_FULFILLMENT_STATUS[fulfillment.status] || []).map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                          </select>
                          <input value={fulfillForm.tracking_number} onChange={(e) => setFulfillForm((prev) => ({ ...prev, tracking_number: e.target.value }))} placeholder="Tracking number" className={inputClass} />
                          <input value={fulfillForm.carrier} onChange={(e) => setFulfillForm((prev) => ({ ...prev, carrier: e.target.value }))} placeholder="Delivery partner" className={inputClass} />
                          <input type="datetime-local" value={fulfillForm.estimated_delivery} onChange={(e) => setFulfillForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} className={inputClass} />
                          <input value={fulfillForm.notes} onChange={(e) => setFulfillForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Status note" className={`${inputClass} sm:col-span-2`} />
                          <div className="flex gap-2 sm:col-span-2 pt-2 border-t border-blue-100 dark:border-blue-900/30">
                            <button type="button" onClick={handleFulfillmentUpdate} disabled={acting || !fulfillForm.status} className="rounded-xl bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-60 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">{acting ? 'Working...' : 'Save changes'}</button>
                            <button type="button" onClick={() => setEditFulfillmentId(null)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {order.reservations?.length > 0 && (
              <section className={`${cardClass} lg:col-span-2`}>
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xl shadow-inner">
                    🔐
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Held stock ({order.reservations.length})</h2>
                  </div>
                </div>
                <div className="space-y-3 relative z-10">
                  {order.reservations.map((reservation) => (
                    <div key={reservation.reservation_id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 dark:border-slate-800/60 bg-white/50 dark:bg-[#0F172A]/50 px-5 py-4 text-sm font-semibold shadow-sm">
                      <span className="text-slate-700 dark:text-slate-300">{reservation.inventory?.part?.part_name || 'Held item'} <span className="text-slate-400 font-mono tracking-widest text-[10px]">x {reservation.quantity}</span></span>
                      <span className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm ${STATUS_COLORS[reservation.status] || ''}`}>{formatLabel(reservation.status)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {order.return_status && (
              <section className={`${cardClass} lg:col-span-2 !bg-amber-50/70 dark:!bg-amber-950/20 !border-amber-200 dark:!border-amber-800/50`}>
                <div className="flex items-center gap-3 relative z-10 mb-6 border-b border-amber-200/50 dark:border-amber-800/50 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xl shadow-inner">
                    ↩️
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-amber-900 dark:text-amber-400">Return Status</h2>
                    <p className="mt-0.5 text-[10px] font-bold tracking-widest text-amber-700 dark:text-amber-500 uppercase">Information logged for return.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 relative z-10">
                  <div className="rounded-3xl border border-amber-200/60 dark:border-amber-800/40 bg-white/60 dark:bg-[#0B1120]/60 p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Status overview</p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-bold text-amber-800 dark:text-amber-300">Status</span>
                      <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">{formatLabel(order.return_status)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reason provided</span>
                      <span className="text-sm font-semibold italic text-slate-700 dark:text-slate-300">{order.return_reason || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-amber-200/60 dark:border-amber-800/40 bg-white/60 dark:bg-[#0B1120]/60 p-6 text-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Timeline</p>
                    <div className="space-y-3">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-500 font-medium">Requested At</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateTime(order.return_requested_at)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-500 font-medium">Reviewed At</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateTime(order.return_reviewed_at)}</span>
                      </div>
                      {order.return_resolution_notes && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl mt-2 border border-slate-100 dark:border-slate-800">
                          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Resolution Notes</span>
                          <span className="font-medium">{order.return_resolution_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VendorOrderDetailPage
