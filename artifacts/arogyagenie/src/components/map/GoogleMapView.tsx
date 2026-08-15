import React, { useEffect, useRef, useState, useCallback } from "react";
import { loadGoogleMaps, getGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import { Loader2, MapPin, Navigation, AlertTriangle, Key, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapProviderItem {
  id: number;
  type: "doctor" | "pharmacy" | "diagnostic_center";
  name: string;
  specialty?: string;
  address?: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  rating?: number;
  latitude: number;
  longitude: number;
  distanceKm: number;
  matchedMedicine?: {
    medicineName: string;
    price?: number | null;
    inStock: boolean;
  } | null;
}

interface GoogleMapViewProps {
  userLoc: { lat: number; lng: number };
  radiusKm: number;
  providers: MapProviderItem[];
  selectedId: number | null;
  onSelectProvider: (provider: MapProviderItem | null) => void;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const TYPE_COLORS = {
  doctor: {
    pinBg: "#7C3AED", // Violet
    emoji: "🩺",
    label: "Doctor",
  },
  diagnostic_center: {
    pinBg: "#0284C7", // Sky blue
    emoji: "🔬",
    label: "Diagnostic Lab",
  },
  pharmacy: {
    pinBg: "#059669", // Emerald
    emoji: "💊",
    label: "Pharmacy",
  },
};

export function GoogleMapView({
  userLoc,
  radiusKm,
  providers,
  selectedId,
  onSelectProvider,
  onMapClick,
  className = "w-full h-full min-h-[400px]",
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const radiusCircleRef = useRef<google.maps.Circle | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const providerMarkersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  // Initialize Google Maps
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
    setLoadError(null);

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!isMounted || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          const map = new maps.Map(mapContainerRef.current, {
            center: { lat: userLoc.lat, lng: userLoc.lng },
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: "poi.medical",
                elementType: "geometry",
                stylers: [{ color: "#fbe8e8" }],
              },
              {
                featureType: "poi.medical",
                elementType: "labels.icon",
                stylers: [{ visibility: "on" }],
              },
            ],
          });

          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng && onMapClick) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          });

          mapInstanceRef.current = map;
        }

        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err.message || "Failed to load Google Maps");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userLoc.lat, userLoc.lng, onMapClick]);

  // Update User Marker & Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    const userPos = new google.maps.LatLng(userLoc.lat, userLoc.lng);

    // 1. User pin
    if (!userMarkerRef.current) {
      const userMarker = new google.maps.Marker({
        position: userPos,
        map,
        title: "Your Location",
        zIndex: 9999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#2563EB",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 3,
        },
      });
      userMarkerRef.current = userMarker;
    } else {
      userMarkerRef.current.setPosition(userPos);
    }

    // 2. Radius Circle
    const radiusMeters = radiusKm * 1000;
    if (!radiusCircleRef.current) {
      const circle = new google.maps.Circle({
        map,
        center: userPos,
        radius: radiusMeters,
        strokeColor: "#7C3AED",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#7C3AED",
        fillOpacity: 0.08,
        clickable: false,
      });
      radiusCircleRef.current = circle;
    } else {
      radiusCircleRef.current.setCenter(userPos);
      radiusCircleRef.current.setRadius(radiusMeters);
    }
  }, [userLoc, radiusKm]);

  // Update Provider Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    // Clear old markers that no longer exist
    const currentMarkerIds = new Set(providers.map((p) => p.id));
    providerMarkersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.setMap(null);
        providerMarkersRef.current.delete(id);
      }
    });

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    // Add or update markers
    providers.forEach((p) => {
      if (!p.latitude || !p.longitude) return;

      const pos = new google.maps.LatLng(p.latitude, p.longitude);
      const isSelected = p.id === selectedId;
      const typeCfg = TYPE_COLORS[p.type] || TYPE_COLORS.doctor;

      let marker = providerMarkersRef.current.get(p.id);

      // Create SVG pin icon
      const pinColor = isSelected ? "#F59E0B" : typeCfg.pinBg;
      const scale = isSelected ? 12 : 9;

      const iconConfig: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale,
        fillColor: pinColor,
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2.5,
      };

      if (!marker) {
        marker = new google.maps.Marker({
          position: pos,
          map,
          title: p.name,
          icon: iconConfig,
          zIndex: isSelected ? 1000 : 100,
        });

        marker.addListener("click", () => {
          onSelectProvider(p);
        });

        providerMarkersRef.current.set(p.id, marker);
      } else {
        marker.setPosition(pos);
        marker.setIcon(iconConfig);
        marker.setZIndex(isSelected ? 1000 : 100);
      }
    });
  }, [providers, selectedId, onSelectProvider]);

  // Handle selected provider pan & info window
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps || selectedId === null) return;

    const selectedProvider = providers.find((p) => p.id === selectedId);
    if (!selectedProvider) return;

    const pos = new google.maps.LatLng(selectedProvider.latitude, selectedProvider.longitude);
    map.panTo(pos);

    const typeCfg = TYPE_COLORS[selectedProvider.type] || TYPE_COLORS.doctor;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${selectedProvider.latitude},${selectedProvider.longitude}`;

    const infoContent = `
      <div style="font-family: inherit; padding: 4px; max-width: 240px;">
        <div style="font-size: 11px; font-weight: 700; color: ${typeCfg.pinBg}; text-transform: uppercase; margin-bottom: 2px;">
          ${typeCfg.emoji} ${typeCfg.label}
        </div>
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
          ${selectedProvider.name}
        </div>
        ${
          selectedProvider.specialty
            ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${selectedProvider.specialty}</div>`
            : ""
        }
        ${
          selectedProvider.matchedMedicine
            ? `<div style="font-size: 11px; background: #ecfdf5; color: #065f46; padding: 3px 6px; border-radius: 4px; margin-bottom: 6px; font-weight: 600;">
                ✓ Stocked: ${selectedProvider.matchedMedicine.medicineName} ${
                selectedProvider.matchedMedicine.price ? `(₹${selectedProvider.matchedMedicine.price})` : ""
              }
              </div>`
            : ""
        }
        <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
          📍 ${selectedProvider.distanceKm} km away • ${selectedProvider.address || "Verified Location"}
        </div>
        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
           style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #2563eb; text-decoration: none; padding: 4px 8px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
          Get Directions ↗
        </a>
      </div>
    `;

    if (infoWindowRef.current) {
      const marker = providerMarkersRef.current.get(selectedProvider.id);
      infoWindowRef.current.setContent(infoContent);
      infoWindowRef.current.open({
        map,
        anchor: marker,
        shouldFocus: false,
      });
    }
  }, [selectedId, providers, userLoc]);

  // If no API key is configured in .env, display a helpful configuration banner with fallback directions
  if (!hasApiKey) {
    return (
      <div className={`relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-6 text-center text-white ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
          <Key className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-100 mb-1">
          Google Maps API Key Required
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
          To display the interactive Google Maps view, set <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in your environment.
        </p>

        <div className="bg-slate-800/80 rounded-xl p-3 max-w-md w-full text-left text-xs text-slate-300 border border-slate-700/60 mb-4 space-y-1.5">
          <div className="font-semibold text-slate-200">Required Configuration:</div>
          <div>1. Add to <code className="text-violet-300 font-mono">.env</code>: <code className="text-emerald-300 font-mono">VITE_GOOGLE_MAPS_API_KEY="your_key"</code></div>
          <div>2. Enable <strong>Maps JavaScript API</strong> in Google Cloud Console</div>
        </div>

        {providers.length > 0 && (
          <div className="text-xs text-slate-400">
            ✅ {providers.length} nearby provider{providers.length === 1 ? "" : "s"} discovered via PostgreSQL/PostGIS. Select any card below to navigate.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-slate-600 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading Google Maps...</span>
        </div>
      )}

      {loadError && (
        <div className="absolute top-3 left-3 right-3 z-20 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <div className="font-semibold">Google Maps Error</div>
            <div>{loadError}</div>
          </div>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />

      {/* Floating Center on Patient Button */}
      <div className="absolute bottom-4 right-4 z-10">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            if (mapInstanceRef.current && window.google?.maps) {
              mapInstanceRef.current.panTo(new google.maps.LatLng(userLoc.lat, userLoc.lng));
              mapInstanceRef.current.setZoom(14);
            }
          }}
          className="bg-white/95 backdrop-blur-sm shadow-md hover:bg-white text-xs font-semibold gap-1.5 border border-slate-200"
        >
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Center on Me
        </Button>
      </div>
    </div>
  );
}
