import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { Star, Navigation, ExternalLink, Loader2, MapPin } from "lucide-react";

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

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const shareUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((maps) => {
        if (!isMounted || !containerRef.current) return;

        const pos = { lat: latitude, lng: longitude };

        const map = new maps.Map(containerRef.current, {
          center: pos,
          zoom: 15,
          mapTypeId: "roadmap",
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
        });

        const marker = new maps.Marker({
          position: pos,
          map,
          title,
          animation: maps.Animation.DROP,
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 font-sans ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-100 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading Google Map...</span>
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
              title="Open in Google Maps"
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
    </div>
  );
}
