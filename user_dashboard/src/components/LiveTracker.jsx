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

/**
 * Shows real-time technician location and route-based ETA to the user.
 */
export default function LiveTracker({
  jobId,
  technicianName,
  initialLat,
  initialLng,
  userLat,
  userLng,
  dark,
}) {
  const [techLocation, setTechLocation] = useState(() => ({
    lat: Number.isFinite(initialLat) ? initialLat : null,
    lng: Number.isFinite(initialLng) ? initialLng : null,
  }))
  const [lastUpdateIso, setLastUpdateIso] = useState(null)
  const [connectionState, setConnectionState] = useState('connecting')
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
    if (!jobId) return undefined

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socket.on('connect', () => {
      setConnectionState('live')
      socket.emit('tracking:join', jobId)
    })

    socket.on('disconnect', () => {
      setConnectionState('offline')
    })

    socket.on('connect_error', () => {
      setConnectionState('error')
    })

    socket.on('tracking:location', (data) => {
      if (data?.jobId !== jobId) return

      setTechLocation({
        lat: data.latitude,
        lng: data.longitude,
      })
      setLastUpdateIso(data.timestamp || new Date().toISOString())
      setConnectionState('live')
    })

    socket.on('job:status_update', (data) => {
      if (data?.jobId === jobId && data?.status === 'completed') {
        setConnectionState('ended')
        socket.disconnect()
      }
    })

    socket.on('tracking:ended', (data) => {
      if (data?.jobId !== jobId) return
      setConnectionState('ended')
    })

    return () => {
      socket.emit('tracking:leave', jobId)
      socket.disconnect()
    }
  }, [jobId])

  const fallbackDistance = useMemo(() => {
    if (!hasCoordinates(userLat, userLng) || !hasCoordinates(techLocation.lat, techLocation.lng)) {
      return null
    }

    return haversineDistanceKm(techLocation.lat, techLocation.lng, userLat, userLng)
  }, [techLocation.lat, techLocation.lng, userLat, userLng])

  const canRoute = hasCoordinates(userLat, userLng) && hasCoordinates(techLocation.lat, techLocation.lng)

  useEffect(() => {
    if (!canRoute) {
      return undefined
    }

    const abortController = new AbortController()
    const routeUrl = `${ROUTING_BASE_URL}/route/v1/driving/${techLocation.lng},${techLocation.lat};${userLng},${userLat}?overview=false&alternatives=false&steps=false`

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
  }, [canRoute, techLocation.lat, techLocation.lng, userLat, userLng])

  const fallbackEtaMinutes = useMemo(() => {
    if (fallbackDistance == null) return null

    const assumedAverageSpeedKmph = fallbackDistance > 3 ? 35 : 22
    return Math.max(1, Math.round((fallbackDistance / assumedAverageSpeedKmph) * 60))
  }, [fallbackDistance])

  const displayedDistance = canRoute ? (routeMetrics?.distanceKm ?? fallbackDistance) : null
  const displayedEtaMinutes = canRoute ? (routeMetrics?.etaMinutes ?? fallbackEtaMinutes) : null
  const isStale = useMemo(() => {
    if (!lastUpdateIso) return false
    return nowMs - new Date(lastUpdateIso).getTime() > 90000
  }, [lastUpdateIso, nowMs])

  const mapsUrl = hasCoordinates(techLocation.lat, techLocation.lng)
    ? `https://www.google.com/maps/search/?api=1&query=${techLocation.lat},${techLocation.lng}`
    : null

  const routingLabel = !canRoute
    ? 'Waiting for location...'
    : routeMetrics
    ? 'Driving route estimate'
    : routeError
      ? 'Fallback straight-line estimate'
      : 'Calculating road ETA...'

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">Live Tracking</h3>
          <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            {technicianName || 'Technician'} is sharing their route to you in real time.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
            connectionState === 'live'
              ? 'bg-blue-500/20 text-blue-400'
              : connectionState === 'ended'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connectionState === 'live'
                ? 'bg-blue-400'
                : connectionState === 'ended'
                  ? 'bg-blue-400'
                  : 'bg-gray-400'
            }`}
          />
          {connectionState === 'live'
            ? (isStale ? 'Waiting for next update' : 'Live')
            : connectionState === 'ended'
              ? 'Arrived / finished'
              : 'Connecting'}
        </span>
      </div>

      <div className={`rounded-xl p-4 sm:p-6 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg text-white">T</div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{technicianName || 'Technician'}</p>
            <p className={`break-all text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {hasCoordinates(techLocation.lat, techLocation.lng)
                ? `${techLocation.lat.toFixed(5)}, ${techLocation.lng.toFixed(5)}`
                : 'Waiting for first location update'}
            </p>
          </div>
        </div>

        <div className={`mb-3 rounded-lg p-3 text-xs ${dark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600'}`}>
          {routingLabel}
        </div>

        {displayedDistance != null && (
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ${dark ? 'bg-gray-700' : 'bg-white'}`}>
            <span className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              {routeMetrics ? 'Road Distance' : 'Estimated Distance'}
            </span>
            <span className="whitespace-nowrap font-bold text-blue-500">{formatDistance(displayedDistance)}</span>
          </div>
        )}

        {displayedEtaMinutes != null && (
          <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ${dark ? 'bg-gray-700' : 'bg-white'}`}>
            <span className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              {routeMetrics ? 'Driving ETA' : 'Estimated Arrival'}
            </span>
            <span className="whitespace-nowrap font-bold text-blue-500">{formatEta(displayedEtaMinutes)}</span>
          </div>
        )}

        {displayedDistance == null && (
          <div className={`rounded-lg p-3 text-sm ${dark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600'}`}>
            Arrival time will appear as soon as the technician starts sharing location.
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

        {lastUpdateIso && (
          <p className={`mt-3 text-center text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            Last updated: {new Date(lastUpdateIso).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
