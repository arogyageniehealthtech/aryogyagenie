import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, getGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import { Star, Navigation, ExternalLink, Info, Layers, Loader2, MapPin } from "lucide-react";

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
  rating = 4.8,
  reviewCount = 12,
  latitude,
  longitude,
  phone,
  className = "",
  height = "450px",
}: GooglePlaceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [hasApiKey, setHasApiKey] = useState(true);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const shareUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  useEffect(() => {
    let isMounted = true;
    const apiKey = getGoogleMapsApiKey();

    if (!apiKey) {
      setHasApiKey(false);
      setIsLoading(false);
      return;
    }

    setHasApiKey(true);
    setIsLoading(true);

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!isMounted || !containerRef.current) return;

        const pos = new maps.LatLng(latitude, longitude);

        if (!mapInstanceRef.current) {
          const map = new maps.Map(containerRef.current, {
            center: pos,
            zoom: 15,
            mapTypeId: mapType,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          });

          const marker = new maps.Marker({
            position: pos,
            map,
            title,
            animation: maps.Animation.DROP,
          });

          const infoWindow = new maps.InfoWindow({
            content: `
              <div style="font-family: inherit; padding: 4px;">
                <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">${title}</div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${address}</div>
                <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #2563eb; font-weight: 700; text-decoration: none;">Get Directions ↗</a>
              </div>
            `,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });

          mapInstanceRef.current = map;
          markerRef.current = marker;
        } else {
          mapInstanceRef.current.setCenter(pos);
          markerRef.current?.setPosition(pos);
        }

        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, title, address, directionsUrl, mapType]);

  const toggleMapType = () => {
    const nextType = mapType === "roadmap" ? "satellite" : "roadmap";
    setMapType(nextType);
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setMapTypeId(nextType);
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 font-sans ${className}`}
      style={{ height }}
    >
      {/* ── Map Container ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-100 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading map...</span>
        </div>
      )}

      {/* ── Fallback banner if API key is missing ─────────────────────────── */}
      {!hasApiKey && (
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mb-2">
            <MapPin className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-100 mb-1">{title}</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">{address}</p>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-transform hover:scale-105"
          >
            <Navigation className="w-3.5 h-3.5 fill-white text-white" />
            Get Directions in Google Maps
          </a>
        </div>
      )}

      {/* ── Top-Left Floating Google Place Card ──────────────────────────────── */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200/90 p-3 max-w-[300px] w-full space-y-2 pointer-events-auto">
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
              title="Open in Google Maps"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm transition-transform hover:scale-105"
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
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 font-semibold hover:underline text-[11px]"
          >
            ({reviewCount} reviews)
          </a>
        </div>
      </div>

      {/* ── Bottom-Left Satellite Layer Toggle ───────────────────────────────── */}
      <button
        type="button"
        onClick={toggleMapType}
        className="absolute bottom-3 left-3 z-[1000] h-9 w-9 rounded-xl bg-white/95 backdrop-blur-sm shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white transition-all pointer-events-auto"
        title={mapType === "roadmap" ? "Switch to Satellite" : "Switch to Map"}
      >
        <Layers className="h-4 w-4 text-slate-700" />
      </button>
    </div>
  );
}
