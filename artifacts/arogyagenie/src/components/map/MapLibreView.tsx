import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Loader2, Navigation, Layers, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Explicitly set Vite-resolved worker URL to avoid strict MIME type error with SPA fallback
if (maplibregl.config) {
  maplibregl.config.WORKER_URL = maplibreWorkerUrl;
}

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

interface MapLibreViewProps {
  userLoc: { lat: number; lng: number };
  radiusKm: number;
  providers: MapProviderItem[];
  selectedId: number | null;
  onSelectProvider: (provider: MapProviderItem | null) => void;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const TYPE_CONFIG = {
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

// OpenFreeMap vector tile style endpoints (100% free, keyless, open vector maps)
const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
};

/**
 * Creates a GeoJSON circle Polygon given center [lng, lat] and radius in kilometers.
 */
function createGeoJsonCircle(center: [number, number], radiusInKm: number, points = 64): any {
  if (radiusInKm <= 0) {
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[]] },
    };
  }

  const coords = {
    latitude: center[1],
    longitude: center[0],
  };

  const km = radiusInKm;
  const ret: number[][] = [];
  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]); // Close polygon

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ret],
    },
  };
}

export function MapLibreView({
  userLoc,
  radiusKm,
  providers,
  selectedId,
  onSelectProvider,
  onMapClick,
  className = "w-full h-full min-h-[400px]",
}: MapLibreViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const providerMarkersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const activePopupRef = useRef<maplibregl.Popup | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [currentStyle, setCurrentStyle] = useState<keyof typeof OPENFREEMAP_STYLES>("liberty");

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_STYLES[currentStyle],
      center: [userLoc.lng, userLoc.lat],
      zoom: 13,
      pitch: 25,
      bearing: 0,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      setIsLoading(false);

      // Add Radius GeoJSON source and layers
      if (!map.getSource("radius-circle")) {
        map.addSource("radius-circle", {
          type: "geojson",
          data: createGeoJsonCircle([userLoc.lng, userLoc.lat], radiusKm),
        });

        // Fill layer
        map.addLayer({
          id: "radius-circle-fill",
          type: "fill",
          source: "radius-circle",
          paint: {
            "fill-color": "#7C3AED",
            "fill-opacity": 0.08,
          },
        });

        // Stroke line layer
        map.addLayer({
          id: "radius-circle-line",
          type: "line",
          source: "radius-circle",
          paint: {
            "line-color": "#7C3AED",
            "line-width": 2,
            "line-dasharray": [2, 2],
            "line-opacity": 0.75,
          },
        });
      }
    });

    map.on("click", (e: maplibregl.MapMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [currentStyle]);

  // Update Patient Marker & Radius Circle on position/radius change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Patient Marker
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "user-location-pin";
      el.innerHTML = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #2563EB; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 16px; height: 16px; border-radius: 50%; background: #2563EB; border: 3px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.35);"></div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([userLoc.lng, userLoc.lat])
        .addTo(map);

      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLngLat([userLoc.lng, userLoc.lat]);
    }

    // 2. Radius Circle Update
    if (map.isStyleLoaded() && map.getSource("radius-circle")) {
      const source = map.getSource("radius-circle") as maplibregl.GeoJSONSource;
      source.setData(createGeoJsonCircle([userLoc.lng, userLoc.lat], radiusKm));
    }
  }, [userLoc, radiusKm]);

  // Update Provider Markers on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove markers that are no longer in providers list
    const currentIds = new Set(providers.map((p) => p.id));
    providerMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        providerMarkersRef.current.delete(id);
      }
    });

    // Add or update provider markers
    providers.forEach((p) => {
      if (!p.latitude || !p.longitude) return;

      const isSelected = p.id === selectedId;
      const typeCfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.doctor;

      let marker = providerMarkersRef.current.get(p.id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = `provider-marker-${p.id}`;
        el.style.cursor = "pointer";
        el.innerHTML = `
          <div style="
            position: relative;
            width: ${isSelected ? "38px" : "32px"};
            height: ${isSelected ? "38px" : "32px"};
            background: ${isSelected ? "#F59E0B" : typeCfg.pinBg};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease-in-out;
          ">
            <span style="transform: rotate(45deg); font-size: ${isSelected ? "18px" : "14px"}; line-height: 1;">
              ${typeCfg.emoji}
            </span>
          </div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectProvider(p);
        });

        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.longitude, p.latitude])
          .addTo(map);

        providerMarkersRef.current.set(p.id, marker);
      } else {
        marker.setLngLat([p.longitude, p.latitude]);
        const el = marker.getElement();
        const pinDiv = el.firstElementChild as HTMLElement;
        if (pinDiv) {
          pinDiv.style.width = isSelected ? "38px" : "32px";
          pinDiv.style.height = isSelected ? "38px" : "32px";
          pinDiv.style.background = isSelected ? "#F59E0B" : typeCfg.pinBg;
          pinDiv.style.zIndex = isSelected ? "1000" : "10";
        }
      }
    });
  }, [providers, selectedId, onSelectProvider]);

  // Handle provider selection (flyTo + popup)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || selectedId === null) return;

    const selectedProvider = providers.find((p) => p.id === selectedId);
    if (!selectedProvider) return;

    map.flyTo({
      center: [selectedProvider.longitude, selectedProvider.latitude],
      zoom: 14.5,
      essential: true,
      duration: 1000,
    });

    // Close existing popup
    if (activePopupRef.current) {
      activePopupRef.current.remove();
    }

    const typeCfg = TYPE_CONFIG[selectedProvider.type] || TYPE_CONFIG.doctor;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${selectedProvider.latitude},${selectedProvider.longitude}`;

    const popupHtml = `
      <div style="font-family: inherit; padding: 4px; max-width: 240px;">
        <div style="font-size: 11px; font-weight: 700; color: ${typeCfg.pinBg}; text-transform: uppercase; margin-bottom: 2px;">
          ${typeCfg.emoji} ${typeCfg.label}
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">
          ${selectedProvider.name}
        </div>
        ${
          selectedProvider.specialty
            ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${selectedProvider.specialty}</div>`
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

    const popup = new maplibregl.Popup({ offset: 25, closeButton: true })
      .setLngLat([selectedProvider.longitude, selectedProvider.latitude])
      .setHTML(popupHtml)
      .addTo(map);

    activePopupRef.current = popup;
  }, [selectedId, providers, userLoc]);

  const cycleMapStyle = () => {
    const styles: (keyof typeof OPENFREEMAP_STYLES)[] = ["liberty", "bright", "positron"];
    const nextIdx = (styles.indexOf(currentStyle) + 1) % styles.length;
    setCurrentStyle(styles[nextIdx]);
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-slate-600 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading OpenFreeMap vector map...</span>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />

      {/* Floating Action Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo({
                center: [userLoc.lng, userLoc.lat],
                zoom: 13,
                pitch: 25,
                bearing: 0,
              });
            }
          }}
          className="bg-white/95 backdrop-blur-sm shadow-md hover:bg-white text-xs font-semibold gap-1.5 border border-slate-200 h-8"
        >
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Center on Me
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={cycleMapStyle}
          className="bg-white/95 backdrop-blur-sm shadow-md hover:bg-white text-xs font-semibold gap-1.5 border border-slate-200 h-8"
          title="Switch OpenFreeMap style (Liberty / Bright / Positron)"
        >
          <Layers className="w-3.5 h-3.5 text-slate-700" />
          Style: {currentStyle}
        </Button>
      </div>

      {/* Attribution Badge */}
      <div className="absolute bottom-1 right-1 z-10 text-[10px] font-semibold text-slate-500 bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded shadow-2xs">
        © <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenFreeMap</a> • <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer" className="hover:underline">MapLibre</a>
      </div>
    </div>
  );
}
