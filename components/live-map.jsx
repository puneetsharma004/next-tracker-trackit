"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issues in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// A custom pulsing marker that looks modern (Uber/Blinkit style)
const createPulseIcon = (color = "#3b82f6") => {
  return L.divIcon({
    className: "custom-pulse-marker",
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="position: absolute; width: 100%; height: 100%; background-color: ${color}; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background-color: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .custom-pulse-marker { background: transparent; border: none; }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Component to handle auto-panning when coordinates change
function RecenterMap({ lat, lng, viewerLat, viewerLng }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size on mount to fix gray map issue
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);

  useEffect(() => {
    if (lat && lng) {
      if (viewerLat && viewerLng) {
        // Fit bounds to show both markers
        const bounds = L.latLngBounds([lat, lng], [viewerLat, viewerLng]);
        map.fitBounds(bounds, { padding: [50, 50], animate: true, maxZoom: 15 });
      } else {
        map.setView([lat, lng], map.getZoom(), {
          animate: true,
          pan: { duration: 1 }
        });
      }
    }
  }, [lat, lng, viewerLat, viewerLng, map]);
  return null;
}

export default function LiveMap({ 
  latitude = 12.9716, 
  longitude = 77.5946,
  viewerLatitude = null,
  viewerLongitude = null,
  showMarker = true,
  showViewer = false,
  showPath = false,
  className = "h-full w-full",
  children 
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`bg-secondary/50 flex items-center justify-center ${className}`}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // CartoDB Positron - Light and clean map style
  const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div className={`relative w-full h-full overflow-hidden ${className} z-0`}>
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[latitude, longitude]} 
          zoom={15} 
          scrollWheelZoom={true} 
          className="w-full h-full"
          style={{ width: '100%', height: '100%', minHeight: '400px' }}
          zoomControl={false}
        >
          <TileLayer
            attribution={MAP_ATTRIBUTION}
            url={MAP_TILE_URL}
          />
          {showMarker && (
            <Marker 
              position={[latitude, longitude]} 
              icon={createPulseIcon("#10b981")} // Emerald color for live tracking
            />
          )}
          {showViewer && viewerLatitude && viewerLongitude && (
            <Marker 
              position={[viewerLatitude, viewerLongitude]} 
              icon={createPulseIcon("#3b82f6")} // Blue color for viewer
            />
          )}
          {showPath && viewerLatitude && viewerLongitude && (
            <Polyline 
              positions={[[latitude, longitude], [viewerLatitude, viewerLongitude]]} 
              color="#3b82f6" 
              weight={3} 
              dashArray="5, 10" 
              opacity={0.7}
            />
          )}
          <RecenterMap lat={latitude} lng={longitude} viewerLat={viewerLatitude} viewerLng={viewerLongitude} />
        </MapContainer>
      </div>
      
      {/* UI Overlays */}
      {children && (
        <div className="absolute inset-0 pointer-events-none z-[1000] flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}
