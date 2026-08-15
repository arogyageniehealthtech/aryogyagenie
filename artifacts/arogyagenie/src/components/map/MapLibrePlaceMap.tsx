import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Star, Navigation, ExternalLink, Layers, Loader2, MapPin } from "lucide-react";

// Explicitly configure MapLibre worker URL to prevent SPA fallback MIME type errors
const WORKER_URL = maplibreWorkerUrl || "https://unpkg.com/maplibre-gl@6.3.0/dist/maplibre-gl-worker.mjs";
if (typeof (maplibregl as any).setWorkerUrl === "function") {
  (maplibregl as any).setWorkerUrl(WORKER_URL);
} else if (maplibregl.config) {
  maplibregl.config.WORKER_URL = WORKER_URL;
}

export interface MapLibrePlaceMapProps {
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

const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
};

export function MapLibrePlaceMap({
  title,
  address,
  rating = 4.8,
  reviewCount = 12,
  latitude,
  longitude,
  phone,
  className = "",
  height = "450px",
}: MapLibrePlaceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [currentStyle, setCurrentStyle] = useState<keyof typeof OPENFREEMAP_STYLES>("liberty");

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const shareUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLES[currentStyle],
      center: [longitude, latitude],
      zoom: 15,
      pitch: 20,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      setIsLoading(false);

      const el = document.createElement("div");
      el.className = "place-pin-marker";
      el.innerHTML = `
        <div style="
          width: 36px; height: 36px;
          background: #7C3AED;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 4px 14px rgba(124,58,237,0.45);
          display: flex; align-items: center; justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 16px; line-height: 1;">🏥</span>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([longitude, latitude])
        .addTo(map);

      markerRef.current = marker;
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, currentStyle]);

  const toggleStyle = () => {
    const styles: (keyof typeof OPENFREEMAP_STYLES)[] = ["liberty", "bright", "positron"];
    const nextIdx = (styles.indexOf(currentStyle) + 1) % styles.length;
    setCurrentStyle(styles[nextIdx]);
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 font-sans ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-100 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading vector map...</span>
        </div>
      )}

      {/* ── Top-Left Floating Place Card ─────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200/90 p-3 max-w-[300px] w-full space-y-2 pointer-events-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight truncate" title={title}>
              {title}
            </h3>
            <p className="text-xs text-slate-500 truncate mt-0.5" title={address}>
              {address}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-600 flex items-center justify-center transition-all border border-slate-200/60"
              title="Open Location"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center shadow-sm transition-transform hover:scale-105"
              title="Get Directions"
            >
              <Navigation className="h-3.5 w-3.5 fill-white text-white" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs pt-0.5 border-t border-slate-100">
          <span className="font-bold text-slate-800">{rating}</span>
          <div className="flex text-amber-400">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </div>
          <span className="text-slate-400 text-[11px]">({reviewCount} reviews)</span>
        </div>
      </div>

      {/* ── Bottom-Left Style Toggle ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleStyle}
        className="absolute bottom-3 left-3 z-10 h-8 px-2.5 rounded-xl bg-white/95 backdrop-blur-sm shadow-md border border-slate-200 flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-white transition-all pointer-events-auto"
        title="Switch Style"
      >
        <Layers className="h-3.5 w-3.5 text-slate-700" />
        Style: {currentStyle}
      </button>

      {/* Attribution */}
      <div className="absolute bottom-1 right-1 z-10 text-[10px] font-semibold text-slate-500 bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded shadow-2xs">
        © <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenFreeMap</a>
      </div>
    </div>
  );
}

// Re-export as GooglePlaceMap for backwards compatibility
export { MapLibrePlaceMap as GooglePlaceMap };
