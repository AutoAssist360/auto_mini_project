import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
const ROUTING_BASE_URL = (import.meta.env.VITE_ROUTING_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, '')

function hasCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
}

function haversineDistanceKm(fromLat, fromLng, toLat, toLng) {
  const earthRadiusKm = 6371
  const deltaLat = ((toLat - fromLat) * Math.PI) / 180
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(deltaLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function formatDistance(distanceKm) {
  if (distanceKm == null) return null
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`
}

function formatEta(minutes) {
  if (minutes == null) return null
  if (minutes < 60) return `~${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `~${hours} hr ${remainingMinutes} min` : `~${hours} hr`
}

function getTrackingEndedMessage(reason, trackingType) {
  if (!reason) return ''

  if (reason === 'delivery_paused') {
    return 'Vendor paused live delivery tracking.'
  }

  if (reason === 'return_pickup_paused') {
    return 'Vendor paused live return pickup tracking.'
  }

  if (reason === 'delivered') {
    return 'Tracking stopped because the order was marked delivered.'
  }

  if (reason === 'returned') {
    return 'Tracking stopped because the return flow was completed.'
  }

  if (reason === 'cancelled') {
    return 'Tracking stopped because the order was cancelled.'
  }

  if (reason === 'rejected') {
    return 'Tracking stopped because the return request was rejected.'
  }

  if (trackingType === 'return_pickup') {
    return `Tracking stopped because the return moved to ${reason.replace(/_/g, ' ')}.`
  }

  return `Tracking stopped because the order moved to ${reason.replace(/_/g, ' ')}.`
}

export default function OrderLiveTracker({
  orderId,
  vendorName,
  initialLat,
  initialLng,
  destinationLat,
  destinationLng,
  trackingType = 'delivery',
  dark,
}) {
  const [vendorLocation, setVendorLocation] = useState(() => ({
    lat: Number.isFinite(initialLat) ? initialLat : null,
    lng: Number.isFinite(initialLng) ? initialLng : null,
  }))
  const [lastUpdateIso, setLastUpdateIso] = useState(null)
  const [connectionState, setConnectionState] = useState('connecting')
  const [endedReason, setEndedReason] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [routeMetrics, setRouteMetrics] = useState(null)
  const [routeError, setRouteError] = useState(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!orderId) return undefined

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socket.on('connect', () => {
      setConnectionState('live')
      setEndedReason('')
      socket.emit('order_tracking:join', orderId)
    })

    socket.on('disconnect', () => {
      setConnectionState('offline')
    })

    socket.on('connect_error', () => {
      setConnectionState('error')
    })

    socket.on('order_tracking:location', (data) => {
      if (data?.orderId !== orderId) return

      setVendorLocation({
        lat: data.latitude,
        lng: data.longitude,
      })
      setLastUpdateIso(data.timestamp || new Date().toISOString())
      setConnectionState('live')
      setEndedReason('')
    })

    socket.on('order_tracking:ended', (data) => {
      if (data?.orderId !== orderId) return
      setConnectionState('ended')
      setEndedReason(data.reason || '')
    })

    return () => {
      socket.emit('order_tracking:leave', orderId)
      socket.disconnect()
    }
  }, [orderId])

  const fallbackDistance = useMemo(() => {
    if (!hasCoordinates(destinationLat, destinationLng) || !hasCoordinates(vendorLocation.lat, vendorLocation.lng)) {
      return null
    }

    return haversineDistanceKm(vendorLocation.lat, vendorLocation.lng, destinationLat, destinationLng)
  }, [destinationLat, destinationLng, vendorLocation.lat, vendorLocation.lng])

  const canRoute = hasCoordinates(destinationLat, destinationLng) && hasCoordinates(vendorLocation.lat, vendorLocation.lng)

  useEffect(() => {
    if (!canRoute) {
      return undefined
    }

    const abortController = new AbortController()
    const routeUrl = `${ROUTING_BASE_URL}/route/v1/driving/${vendorLocation.lng},${vendorLocation.lat};${destinationLng},${destinationLat}?overview=false&alternatives=false&steps=false`

    fetch(routeUrl, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Routing request failed')
        }
        return response.json()
      })
      .then((payload) => {
        const route = payload?.routes?.[0]
        if (!route?.distance || !route?.duration) {
          throw new Error('Routing data missing')
        }

        setRouteMetrics({
          distanceKm: route.distance / 1000,
          etaMinutes: Math.max(1, Math.round(route.duration / 60)),
        })
        setRouteError(false)
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setRouteMetrics(null)
          setRouteError(true)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [canRoute, destinationLat, destinationLng, vendorLocation.lat, vendorLocation.lng])

  const fallbackEtaMinutes = useMemo(() => {
    if (fallbackDistance == null) return null

    const assumedAverageSpeedKmph = fallbackDistance > 3 ? 32 : 20
    return Math.max(1, Math.round((fallbackDistance / assumedAverageSpeedKmph) * 60))
  }, [fallbackDistance])

  const displayedDistance = canRoute ? (routeMetrics?.distanceKm ?? fallbackDistance) : null
  const displayedEtaMinutes = canRoute ? (routeMetrics?.etaMinutes ?? fallbackEtaMinutes) : null
  const isStale = useMemo(() => {
    if (!lastUpdateIso) return false
    return nowMs - new Date(lastUpdateIso).getTime() > 90000
  }, [lastUpdateIso, nowMs])

  const mapsUrl = hasCoordinates(vendorLocation.lat, vendorLocation.lng)
    ? `https://www.google.com/maps/search/?api=1&query=${vendorLocation.lat},${vendorLocation.lng}`
    : null

  const isReturnPickup = trackingType === 'return_pickup'
  const heading = isReturnPickup ? 'Live Return Pickup' : 'Live Delivery Tracking'
  const subtitle = isReturnPickup
    ? `${vendorName || 'Vendor'} is sharing the pickup route for your return.`
    : `${vendorName || 'Vendor'} is sharing the delivery route to you in real time.`
  const routingLabel = !canRoute
    ? 'Waiting for live location...'
    : routeMetrics
      ? 'Driving route estimate'
      : routeError
        ? 'Fallback straight-line estimate'
        : 'Calculating road ETA...'
  const endedLabel = isReturnPickup ? 'Pickup finished' : 'Delivery finished'

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{heading}</h3>
          <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            {subtitle}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
            connectionState === 'live'
              ? 'bg-blue-500/20 text-blue-400'
              : connectionState === 'ended'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-500/20 text-slate-400'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connectionState === 'live'
                ? 'bg-blue-400'
                : connectionState === 'ended'
                  ? 'bg-blue-400'
                  : 'bg-slate-400'
            }`}
          />
          {connectionState === 'live'
            ? (isStale ? 'Waiting for next update' : 'Live')
            : connectionState === 'ended'
              ? endedLabel
              : 'Connecting'}
        </span>
      </div>

      <div className={`rounded-xl p-4 sm:p-6 ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-600 text-lg text-white">V</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{vendorName || 'Vendor dispatch'}</p>
            <p className={`break-all text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              {hasCoordinates(vendorLocation.lat, vendorLocation.lng)
                ? `${vendorLocation.lat.toFixed(5)}, ${vendorLocation.lng.toFixed(5)}`
                : 'Waiting for first location update'}
            </p>
          </div>
        </div>

        <div className={`mb-3 rounded-lg p-3 text-xs ${dark ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600'}`}>
          {routingLabel}
        </div>

        {displayedDistance != null && (
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ${dark ? 'bg-slate-700' : 'bg-white'}`}>
            <span className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              {routeMetrics ? 'Road Distance' : 'Estimated Distance'}
            </span>
            <span className="whitespace-nowrap font-bold text-blue-500">{formatDistance(displayedDistance)}</span>
          </div>
        )}

        {displayedEtaMinutes != null && (
          <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ${dark ? 'bg-slate-700' : 'bg-white'}`}>
            <span className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              {routeMetrics ? 'Driving ETA' : 'Estimated Arrival'}
            </span>
            <span className="whitespace-nowrap font-bold text-blue-500">{formatEta(displayedEtaMinutes)}</span>
          </div>
        )}

        {displayedDistance == null && (
          <div className={`rounded-lg p-3 text-sm ${dark ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600'}`}>
            ETA will appear as soon as the vendor starts sharing location.
          </div>
        )}

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex whitespace-nowrap rounded-lg border border-blue-500 px-3 py-2 text-xs font-semibold text-blue-500 hover:bg-blue-500/10"
          >
            Open map pin
          </a>
        )}

        {endedReason && (
          <p className={`mt-3 text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            {getTrackingEndedMessage(endedReason, trackingType)}
          </p>
        )}

        {lastUpdateIso && (
          <p className={`mt-3 text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            Last updated: {new Date(lastUpdateIso).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
