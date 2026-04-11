import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fix Leaflet default marker icon (Vite strips asset paths) ──
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Nagpur center
const DEFAULT_CENTER = [21.1458, 79.0882];
const DEFAULT_ZOOM = 12;

/* ── Reverse geocode via Nominatim (free, no key) ── */
function buildLocationPayload(lat, lng, data = {}) {
  const address = data.address || {};
  return {
    latitude: lat,
    longitude: lng,
    address:
      data.display_name ||
      `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
    city:
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      "",
    state: address.state || address.state_district || "",
    postal_code: address.postcode || "",
    country: address.country || "",
  };
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return buildLocationPayload(lat, lng, data);
  } catch {
    return buildLocationPayload(lat, lng);
  }
}

/* ── Forward geocode (search) via Nominatim ── */
async function forwardGeocode(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&viewbox=78.8,21.3,79.3,21.0&bounded=1`,
      { headers: { "Accept-Language": "en" } }
    );
    return await res.json();
  } catch {
    return [];
  }
}

/* ── Internal: click handler on map ── */
function ClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const location = await reverseGeocode(lat, lng);
      onLocationSelect(location);
    },
  });
  return null;
}

/* ── Internal: fly to position when marker changes ── */
function FlyToMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

/**
 * LocationPicker — a production-grade location picker using Leaflet + OpenStreetMap.
 *
 * Props:
 *  - latitude  (number | null)   — current lat value
 *  - longitude (number | null)   — current lng value
 *  - onChange  ({ latitude, longitude, address }) — callback on location change
 *  - label     (string)          — field label (default: "Location")
 *  - required  (boolean)         — mark as required
 *  - disabled  (boolean)         — disable interactions
 *  - className (string)          — extra wrapper classes
 */
export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  label = "Location",
  required = false,
  disabled = false,
  className = "",
}) {
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const searchTimeout = useRef(null);

  const hasPosition = latitude != null && longitude != null && latitude !== "" && longitude !== "";
  const markerPos = hasPosition ? [Number(latitude), Number(longitude)] : null;

  // Reverse-geocode when coords change externally
  useEffect(() => {
    if (hasPosition) {
      reverseGeocode(Number(latitude), Number(longitude)).then((location) => {
        setAddress(location.address);
      });
    }
  }, [latitude, longitude, hasPosition]);

  const handleLocationSelect = useCallback(
    (location) => {
      if (disabled) return;
      setAddress(location.address);
      setSearchResults([]);
      setSearchQuery("");
      onChange(location);
    },
    [disabled, onChange]
  );

  // ── GPS: Use current location ──
  const handleUseMyLocation = useCallback(() => {
    if (disabled || !navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const location = await reverseGeocode(lat, lng);
        handleLocationSelect(location);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        alert("Unable to access your location. Please allow location access in your browser.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [disabled, handleLocationSelect]);

  // ── Search with debounce ──
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const results = await forwardGeocode(q);
      setSearchResults(results);
      setSearching(false);
    }, 400);
  };

  const handleResultClick = (result) => {
    handleLocationSelect({
      ...buildLocationPayload(
        parseFloat(result.lat),
        parseFloat(result.lon),
        result
      ),
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Search + GPS row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search for a place in Nagpur..."
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
          {searching && (
            <div className="absolute right-3 top-2.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          )}
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <ul className="absolute z-1000 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {searchResults.map((r, i) => (
                <li
                  key={i}
                  onClick={() => handleResultClick(r)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0 dark:text-slate-100 dark:hover:bg-slate-700 dark:border-slate-700"
                >
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={disabled || gpsLoading}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:h-auto sm:w-auto sm:shrink-0"
        >
          {gpsLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          )}
          GPS
        </button>
      </div>

      {/* Map */}
      <div className="h-64 w-full overflow-hidden rounded-lg border border-gray-300 dark:border-slate-700">
        <MapContainer
          center={markerPos || DEFAULT_CENTER}
          zoom={markerPos ? 15 : DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom={!disabled}
          dragging={!disabled}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!disabled && <ClickHandler onLocationSelect={handleLocationSelect} />}
          {markerPos && (
            <>
              <Marker position={markerPos} />
              <FlyToMarker position={markerPos} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Selected address display */}
      {address && (
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          📍 {address}
        </p>
      )}

      {/* Hidden-ish coordinate display for transparency */}
      {hasPosition && (
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Coordinates: {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
        </p>
      )}
    </div>
  );
}
