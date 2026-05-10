"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Leaflet icon path fix for Next.js (runs once at module level) ─────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ── Map tile config — outside component, created once ────────────────────────
const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Pulse animation CSS — injected once into <head>, NOT per-marker ───────────
if (typeof window !== "undefined") {
  const STYLE_ID = "leaflet-pulse-marker-css";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes leaflet-pulse {
        0%   { transform: scale(0.5); opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      .custom-pulse-marker { background: transparent !important; border: none !important; }
    `;
    document.head.appendChild(style);
  }
}

// ── Icon factory ──────────────────────────────────────────────────────────────
function createPulseIcon(color) {
  return L.divIcon({
    className: "custom-pulse-marker",
    html: `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;width:100%;height:100%;background:${color};border-radius:50%;opacity:0.3;animation:leaflet-pulse 2s infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  });
}

// ── RouteLayer — fetches real road route from OSRM ────────────────────────────
//
// Replaces the straight dashed Polyline with an actual driving route.
// OSRM is free, open-source, and requires no API key.
//
// Throttle logic:
//   • Re-fetches only when tracker moved >~100m OR 60 seconds have passed.
//   • AbortController cancels in-flight requests on re-fetch / unmount.
//   • Falls back to straight line if OSRM is unreachable.
function RouteLayer({ fromLat, fromLng, toLat, toLng }) {
  const [routePoints, setRoutePoints] = useState(null);
  const lastFetchRef = useRef({ toLat: null, toLng: null, time: 0 });

  useEffect(() => {
    if (!fromLat || !fromLng || !toLat || !toLng) return;

    const now  = Date.now();
    const prev = lastFetchRef.current;

    // Skip re-fetch if tracker moved <~100m AND last fetch was recent (<60s)
    const distMoved = Math.hypot(
      toLat - (prev.toLat ?? toLat),
      toLng - (prev.toLng ?? toLng)
    );
    if (distMoved < 0.001 && now - prev.time < 60_000) return;

    const controller = new AbortController();

    const fetchRoute = async () => {
      try {
        // ⚠️  OSRM expects longitude FIRST, latitude second
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${fromLng},${fromLat};${toLng},${toLat}` +
          `?overview=full&geometries=geojson`;

        const res  = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        if (data.routes?.[0]?.geometry?.coordinates) {
          // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
          const points = data.routes[0].geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );
          setRoutePoints(points);
          lastFetchRef.current = { toLat, toLng, time: now };
        }
      } catch (err) {
        if (err.name === "AbortError") return; // intentional cancel — ignore
        // OSRM unreachable → draw a straight line as fallback
        console.warn("OSRM route fetch failed, falling back to straight line:", err.message);
        setRoutePoints([[fromLat, fromLng], [toLat, toLng]]);
      }
    };

    fetchRoute();
    return () => controller.abort();
  }, [fromLat, fromLng, toLat, toLng]);

  if (!routePoints || routePoints.length < 2) return null;

  return (
    <Polyline
      positions={routePoints}
      color="#3b82f6"
      weight={4}
      opacity={0.85}
      // Solid line — looks like Google Maps / Uber, not a guess
    />
  );
}

// ── SmoothMarker — Uber-style interpolated marker movement ────────────────────
//
// Problem: GPS updates every 5 seconds → marker teleports to new position →
// looks like a glitching dot, not a person/vehicle in motion.
//
// Fix: when lat/lng prop changes, animate the Leaflet marker from its current
// screen position to the new GPS coordinate using requestAnimationFrame.
// Ease-out-cubic makes it feel natural — fast start, smooth arrival.
//
// Duration (3500ms) is less than the polling interval (5000ms) so the marker
// always finishes moving before the next update arrives.
function SmoothMarker({ lat, lng, icon }) {
  const markerRef  = useRef(null);
  const animRef    = useRef(null);
  const fromPosRef = useRef({ lat, lng });

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = fromPosRef.current;
    const to   = { lat, lng };

    // Skip animation for GPS micro-jitter (< ~0.5 metre)
    if (Math.hypot(to.lat - from.lat, to.lng - from.lng) < 0.000005) return;

    const DURATION  = 3500;
    const startTime = performance.now();

    const animate = (now) => {
      const t     = Math.min((now - startTime) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

      marker.setLatLng([
        from.lat + (to.lat - from.lat) * eased,
        from.lng + (to.lng - from.lng) * eased,
      ]);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        fromPosRef.current = to; // save final position as new starting point
      }
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [lat, lng]);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={icon}
    />
  );
}

// ── RecenterMap — first-load fitBounds, then gentle pan only ─────────────────
function RecenterMap({ lat, lng, viewerLat, viewerLng }) {
  const map            = useMap();
  const hasInitialized = useRef(false);
  const prevLatRef     = useRef(lat);
  const prevLngRef     = useRef(lng);

  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);

  useEffect(() => {
    if (!lat || !lng) return;

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (viewerLat && viewerLng) {
        const bounds = L.latLngBounds([lat, lng], [viewerLat, viewerLng]);
        map.fitBounds(bounds, { padding: [60, 60], animate: true, maxZoom: 15 });
      } else {
        map.setView([lat, lng], 15, { animate: true });
      }
      prevLatRef.current = lat;
      prevLngRef.current = lng;
      return;
    }

    const moved = Math.hypot(lat - prevLatRef.current, lng - prevLngRef.current) > 0.00005;
    if (moved) {
      map.panTo([lat, lng], { animate: true, duration: 1 });
      prevLatRef.current = lat;
      prevLngRef.current = lng;
    }
  }, [lat, lng, viewerLat, viewerLng, map]);

  return null;
}

// ── LiveMap ───────────────────────────────────────────────────────────────────
export default function LiveMap({
  latitude        = 12.9716,
  longitude       = 77.5946,
  viewerLatitude  = null,
  viewerLongitude = null,
  showMarker      = true,
  showViewer      = false,
  showPath        = false,
  className       = "h-full w-full",
  children,
}) {
  // Stable icon references — prevents Leaflet from re-creating marker DOM on render
  const trackerIcon = useMemo(() => createPulseIcon("#10b981"), []);
  const viewerIcon  = useMemo(() => createPulseIcon("#3b82f6"), []);

  const hasViewerCoords = showViewer && viewerLatitude && viewerLongitude;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className} z-0`}>
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ width: "100%", height: "100%", minHeight: "400px" }}
          zoomControl={false}
        >
          <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />

          {/* Tracker marker — smooth Uber-style animation between GPS updates */}
          {showMarker && (
            <SmoothMarker lat={latitude} lng={longitude} icon={trackerIcon} />
          )}

          {/* Viewer marker — also animated smoothly */}
          {hasViewerCoords && (
            <SmoothMarker lat={viewerLatitude} lng={viewerLongitude} icon={viewerIcon} />
          )}

          {/* Real road route via OSRM — replaces straight dashed line */}
          {showPath && hasViewerCoords && (
            <RouteLayer
              fromLat={viewerLatitude}
              fromLng={viewerLongitude}
              toLat={latitude}
              toLng={longitude}
            />
          )}

          <RecenterMap
            lat={latitude}
            lng={longitude}
            viewerLat={viewerLatitude}
            viewerLng={viewerLongitude}
          />
        </MapContainer>
      </div>

      {children && (
        <div className="absolute inset-0 pointer-events-none z-[1000] flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}