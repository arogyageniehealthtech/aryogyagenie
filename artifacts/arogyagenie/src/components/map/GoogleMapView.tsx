import React, { useEffect, useRef, useState, useCallback } from "react";
import { loadGoogleMaps, getGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import { Loader2, Navigation, AlertCircle, ExternalLink, Key } from "lucide-react";
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

const TYPE_CONFIG = {
  doctor: {
    pinColor: "#7C3AED", // Violet
    emoji: "🩺",
    label: "Doctor",
  },
  diagnostic_center: {
    pinColor: "#0284C7", // Sky blue
    emoji: "🔬",
    label: "Diagnostic Lab",
  },
  pharmacy: {
    pinColor: "#059669", // Emerald
    emoji: "💊",
    label: "Pharmacy",
  },
};

/**
 * Creates custom SVG data URL icon for Google Maps markers.
 */
function createSvgMarkerUrl(color: string, isSelected = false): string {
  const width = isSelected ? 42 : 34;
  const height = isSelected ? 52 : 42;
  const stroke = isSelected ? "#F59E0B" : "#FFFFFF";
  const strokeWidth = isSelected ? 3 : 2;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 42" width="${width}" height="${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 42 17 42 C17 42 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" 
            fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" filter="url(#shadow)"/>
      <circle cx="17" cy="16" r="7" fill="#FFFFFF"/>
      <circle cx="17" cy="16" r="4" fill="${color}"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPatientPinSvg(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="#2563EB" fill-opacity="0.25"/>
      <circle cx="16" cy="16" r="8" fill="#2563EB" stroke="#FFFFFF" stroke-width="3"/>
      <circle cx="16" cy="16" r="3" fill="#FFFFFF"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const providerMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = getGoogleMapsApiKey();

  // Initialize Google Maps Map
  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((maps) => {
        if (!isMounted || !mapContainerRef.current) return;

        const map = new maps.Map(mapContainerRef.current, {
          center: { lat: userLoc.lat, lng: userLoc.lng },
          zoom: 13,
          mapTypeId: "roadmap",
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: maps.ControlPosition?.TOP_RIGHT ?? 3,
          },
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: "poi.medical",
              elementType: "geometry",
              stylers: [{ color: "#ede9fe" }],
            },
            {
              featureType: "poi.business",
              elementType: "geometry",
              stylers: [{ color: "#f8fafc" }],
            },
          ],
        });

        // Click listener for moving patient pin / manual location
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng && onMapClick) {
            onMapClick(e.latLng.lat(), e.latLng.lng());
          }
        });

        // Shared InfoWindow
        const infoWindow = new maps.InfoWindow();
        infoWindow.addListener("closeclick", () => {
          onSelectProvider(null);
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = infoWindow;
        setMapLoaded(true);
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err.message || "Failed to load Google Maps");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update Patient Marker and Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || typeof google === "undefined") return;

    const patientPos = { lat: userLoc.lat, lng: userLoc.lng };
    map.panTo(patientPos);

    // 1. Patient Marker
    if (!userMarkerRef.current) {
      const marker = new google.maps.Marker({
        position: patientPos,
        map,
        title: "Your Location",
        icon: {
          url: createPatientPinSvg(),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16),
        },
        zIndex: 999,
      });
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setPosition(patientPos);
    }

    // 2. Radius Circle (0 km to 18 km)
    const radiusMeters = Math.max(0, radiusKm * 1000);
    if (!circleRef.current) {
      const circle = new google.maps.Circle({
        strokeColor: "#7C3AED",
        strokeOpacity: 0.75,
        strokeWeight: 2,
        fillColor: "#7C3AED",
        fillOpacity: 0.08,
        map,
        center: patientPos,
        radius: radiusMeters,
      });
      circleRef.current = circle;
    } else {
      circleRef.current.setCenter(patientPos);
      circleRef.current.setRadius(radiusMeters);
    }
  }, [mapLoaded, userLoc.lat, userLoc.lng, radiusKm]);

  // Sync Provider Markers on Google Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || typeof google === "undefined") return;

    // Composite keys (type_id) to avoid collision between doctor, pharmacy, and diagnostic center
    const currentKeys = new Set(providers.map((p) => `${p.type || "doctor"}_${p.id}`));
    providerMarkersRef.current.forEach((marker, key) => {
      if (!currentKeys.has(key)) {
        marker.setMap(null);
        providerMarkersRef.current.delete(key);
      }
    });

    // Add or update provider markers
    providers.forEach((p) => {
      const lat = typeof p.latitude === "number" ? p.latitude : parseFloat(String(p.latitude));
      const lng = typeof p.longitude === "number" ? p.longitude : parseFloat(String(p.longitude));
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      const markerKey = `${p.type || "doctor"}_${p.id}`;
      const isSelected = p.id === selectedId;
      const typeCfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.doctor;
      const pos = { lat, lng };

      let marker = providerMarkersRef.current.get(markerKey);

      if (!marker) {
        marker = new google.maps.Marker({
          position: pos,
          map,
          title: `${p.name} (${p.distanceKm} km)`,
          icon: {
            url: createSvgMarkerUrl(typeCfg.pinColor, isSelected),
            scaledSize: isSelected ? new google.maps.Size(42, 52) : new google.maps.Size(34, 42),
            anchor: isSelected ? new google.maps.Point(21, 52) : new google.maps.Point(17, 42),
          },
          zIndex: isSelected ? 1000 : 10,
        });

        marker.addListener("click", () => {
          onSelectProvider(p);
        });

        providerMarkersRef.current.set(markerKey, marker);
      } else {
        marker.setPosition(pos);
        marker.setIcon({
          url: createSvgMarkerUrl(typeCfg.pinColor, isSelected),
          scaledSize: isSelected ? new google.maps.Size(42, 52) : new google.maps.Size(34, 42),
          anchor: isSelected ? new google.maps.Point(21, 52) : new google.maps.Point(17, 42),
        });
        marker.setZIndex(isSelected ? 1000 : 10);
      }
    });
  }, [mapLoaded, providers, selectedId, onSelectProvider]);

  // Auto-Fit Bounds to frame user and all providers within radius
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || typeof google === "undefined") return;

    // Only auto-fit when not explicitly inspecting a single selected provider
    if (selectedId !== null) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(userLoc.lat, userLoc.lng));

    let validCount = 0;
    providers.forEach((p) => {
      const lat = typeof p.latitude === "number" ? p.latitude : parseFloat(String(p.latitude));
      const lng = typeof p.longitude === "number" ? p.longitude : parseFloat(String(p.longitude));
      if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
        bounds.extend(new google.maps.LatLng(lat, lng));
        validCount++;
      }
    });

    if (validCount > 0) {
      map.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50,
      });

      // Prevent over-zooming when patient and doctor are at identical or very close coordinates
      const listener = google.maps.event.addListenerOnce(map, "idle", () => {
        const currentZoom = map.getZoom();
        if (currentZoom !== undefined && currentZoom > 15) {
          map.setZoom(15);
        }
      });
      return () => {
        google.maps.event.removeListener(listener);
      };
    } else {
      map.panTo({ lat: userLoc.lat, lng: userLoc.lng });
      map.setZoom(13);
      return undefined;
    }
  }, [mapLoaded, userLoc.lat, userLoc.lng, providers, selectedId, radiusKm]);


  // Handle Selected Provider (Pan to location & open InfoWindow)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !infoWindow || !mapLoaded || selectedId === null || typeof google === "undefined") return;

    const selectedProvider = providers.find((p) => p.id === selectedId);
    if (!selectedProvider) return;

    const pos = { lat: selectedProvider.latitude, lng: selectedProvider.longitude };
    map.panTo(pos);

    const typeCfg = TYPE_CONFIG[selectedProvider.type] || TYPE_CONFIG.doctor;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${selectedProvider.latitude},${selectedProvider.longitude}`;

    const bookHref =
      selectedProvider.type === "doctor"
        ? `/patient/appointments?doctorId=${selectedProvider.id}`
        : selectedProvider.type === "diagnostic_center"
        ? `/patient/diagnostic-bookings?centerId=${selectedProvider.id}`
        : `/patient/prescriptions`;

    const bookLabel =
      selectedProvider.type === "doctor"
        ? "Book Appointment"
        : selectedProvider.type === "diagnostic_center"
        ? "Book Lab Test"
        : "Order Medicine";

    const contentString = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 280px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 11px; font-weight: 700; color: ${typeCfg.pinColor}; text-transform: uppercase; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
            ${typeCfg.emoji} ${typeCfg.label}
          </span>
          <span style="font-size: 11px; font-weight: 700; color: #475569; background: #f8fafc; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
            ${selectedProvider.distanceKm < 1 ? Math.round(selectedProvider.distanceKm * 1000) + " m" : selectedProvider.distanceKm.toFixed(1) + " km"}
          </span>
        </div>
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">
          ${selectedProvider.name}
        </div>
        ${
          selectedProvider.specialty
            ? `<div style="font-size: 12px; font-weight: 600; color: #6d28d9; margin-bottom: 4px;">${selectedProvider.specialty}</div>`
            : ""
        }
        ${
          selectedProvider.matchedMedicine
            ? `<div style="font-size: 11px; background: #ecfdf5; color: #065f46; padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; font-weight: 600;">
                ✓ In Stock: ${selectedProvider.matchedMedicine.medicineName} ${
                selectedProvider.matchedMedicine.price ? `(₹${selectedProvider.matchedMedicine.price})` : ""
              }
              </div>`
            : ""
        }
        <div style="font-size: 11px; color: #64748b; margin-bottom: 8px; line-height: 1.3;">
          📍 ${selectedProvider.address || "Verified Healthcare Provider"}
        </div>
        <div style="display: flex; align-items: center; gap: 6px; pt-1;">
          <a href="${bookHref}"
             style="display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #ffffff; background: ${typeCfg.pinColor}; text-decoration: none; padding: 6px 10px; border-radius: 6px; flex: 1; text-align: center;">
            ${bookLabel}
          </a>
          <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
             style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #2563eb; text-decoration: none; padding: 5px 8px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
            🧭 Route ↗
          </a>
        </div>
      </div>
    `;

    infoWindow.setContent(contentString);
    infoWindow.setPosition(pos);
    infoWindow.open(map);
  }, [selectedId, providers, userLoc, mapLoaded]);

  // Center on patient location handler
  const handleCenterOnUser = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: userLoc.lat, lng: userLoc.lng });
      mapInstanceRef.current.setZoom(14);
    }
  }, [userLoc]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 ${className}`}>
      {!mapLoaded && !loadError && (
        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-slate-600 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading Google Maps...</span>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 z-10 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Key className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base">Google Maps API Configuration</h3>
          <p className="text-xs text-slate-300 max-w-sm">
            {loadError.includes("API key")
              ? "Please provide a valid Google Maps API Key in VITE_GOOGLE_MAPS_API_KEY."
              : loadError}
          </p>
          <div className="p-3 bg-slate-800 rounded-xl text-[11px] font-mono text-slate-300 text-left w-full max-w-xs">
            VITE_GOOGLE_MAPS_API_KEY="AIzaSy..."
          </div>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />

      {/* Floating Center Button */}
      <div className="absolute bottom-4 left-4 z-10">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleCenterOnUser}
          className="bg-white/95 backdrop-blur-sm shadow-md hover:bg-white text-xs font-semibold gap-1.5 border border-slate-200 h-8 text-slate-700 cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Center on Me
        </Button>
      </div>
    </div>
  );
}
