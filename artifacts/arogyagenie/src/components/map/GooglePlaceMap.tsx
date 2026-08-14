import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { divIcon, type LatLngExpression } from "leaflet";
import { Star, Navigation, ExternalLink, Info, Layers, Plus, Minus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

// ─── Google Red Marker Pin ───────────────────────────────────────────────────
function makeGooglePin() {
  return divIcon({
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        <div style="
          width: 32px; height: 32px;
          background: #EA4335;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 4px 14px rgba(234,67,53,0.45);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto;
        ">
          <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
        </div>
      </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function MapFly({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? 15, { duration: 1 });
  }, [lat, lng, zoom, map]);
  return null;
}

export interface GooglePlaceMapProps {
  title: string;
  address: string;
  rating?: number | string;
  reviewCount?: number;
  latitude: number;
  longitude: number;
  phone?: string;
  className?: string;
  height?: string;
}

export function GooglePlaceMap({
  title,
  address,
  rating = 4.4,
  reviewCount = 445,
  latitude,
  longitude,
  phone,
  className = "",
  height = "450px",
}: GooglePlaceMapProps) {
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");

  const center: LatLngExpression = [latitude, longitude];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const shareUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 font-sans ${className}`}
      style={{ height }}
    >
      {/* ── Leaflet Map Engine ──────────────────────────────────────────────── */}
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={
            mapType === "standard"
              ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          }
        />

        <MapFly lat={latitude} lng={longitude} zoom={15} />

        <Marker position={center} icon={makeGooglePin()}>
          <Popup>
            <div className="p-1 min-w-[160px]">
              <strong className="text-slate-900 text-sm block font-bold">{title}</strong>
              <span className="text-xs text-slate-500 block mt-1">{address}</span>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* ── Top-Left Floating Google Place Card ──────────────────────────────── */}
      <div className="absolute top-3 left-3 z-[1000] bg-white rounded-xl shadow-xl border border-slate-200/90 p-3.5 max-w-[320px] w-full space-y-2 pointer-events-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight truncate" title={title}>
              {title}
            </h3>
            <p className="text-xs text-slate-500 truncate mt-0.5" title={address}>
              {address}
            </p>
          </div>

          {/* Action Buttons: Share & Directions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-blue-600 flex items-center justify-center transition-all border border-slate-200/60"
              title="Open in Maps"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105"
              title="Get Directions"
            >
              <Navigation className="h-4 w-4 fill-white text-white" />
            </a>
          </div>
        </div>

        {/* Rating & Info Bar */}
        <div className="flex items-center gap-1.5 text-xs pt-0.5 border-t border-slate-100">
          <span className="font-bold text-slate-800">{rating}</span>
          <div className="flex text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          </div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 font-semibold hover:underline"
          >
            ({reviewCount})
          </a>
          <Info className="h-3.5 w-3.5 text-slate-400 ml-auto cursor-pointer hover:text-slate-600" />
        </div>
      </div>

      {/* ── Bottom-Left Satellite Layer Toggle ───────────────────────────────── */}
      <button
        onClick={() => setMapType((t) => (t === "standard" ? "satellite" : "standard"))}
        className="absolute bottom-3 left-3 z-[1000] h-10 w-10 rounded-xl bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all pointer-events-auto"
        title={mapType === "standard" ? "Switch to Satellite" : "Switch to Standard"}
      >
        <Layers className="h-5 w-5 text-slate-700" />
      </button>

      {/* ── Bottom-Right Navigation Compass & Zoom Controller ────────────────── */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 flex flex-col items-center gap-2 pointer-events-auto">
        {/* Navigation D-Pad */}
        <div className="relative h-14 w-14 bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center">
          <ChevronUp className="absolute top-0.5 h-3.5 w-3.5 text-slate-500 cursor-pointer hover:text-slate-800" />
          <ChevronDown className="absolute bottom-0.5 h-3.5 w-3.5 text-slate-500 cursor-pointer hover:text-slate-800" />
          <ChevronLeft className="absolute left-0.5 h-3.5 w-3.5 text-slate-500 cursor-pointer hover:text-slate-800" />
          <ChevronRight className="absolute right-0.5 h-3.5 w-3.5 text-slate-500 cursor-pointer hover:text-slate-800" />
          <div className="h-2 w-2 rounded-full bg-slate-400" />
        </div>

        <div className="w-10 h-[1px] bg-slate-200" />

        {/* Directions Link */}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          title="Open Directions"
        >
          <Maximize2 className="h-4 w-4" />
        </a>
      </div>

      {/* Google Attribution watermark */}
      <div className="absolute bottom-1 right-24 z-[999] text-[10px] font-bold text-slate-600 bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-2xs">
        <span className="text-blue-600">G</span>
        <span className="text-red-500">o</span>
        <span className="text-amber-500">o</span>
        <span className="text-blue-600">g</span>
        <span className="text-green-600">l</span>
        <span className="text-red-500">e</span> Maps Style
      </div>
    </div>
  );
}
