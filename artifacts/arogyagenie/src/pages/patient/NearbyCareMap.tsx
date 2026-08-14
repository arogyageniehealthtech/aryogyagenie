import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { MapPin, Navigation, Search, Stethoscope, Pill, TestTube, X, Phone, Clock, Star, ChevronRight, Locate, AlertCircle, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { divIcon, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NearbyProvider {
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
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  doctor: {
    label: "Doctor",
    color: "#7C3AED",
    bgColor: "rgba(124,58,237,0.1)",
    borderColor: "rgba(124,58,237,0.25)",
    icon: Stethoscope,
    markerColor: "#7C3AED",
  },
  pharmacy: {
    label: "Pharmacy",
    color: "#059669",
    bgColor: "rgba(5,150,105,0.1)",
    borderColor: "rgba(5,150,105,0.25)",
    icon: Pill,
    markerColor: "#059669",
  },
  diagnostic_center: {
    label: "Diagnostic Lab",
    color: "#D97706",
    bgColor: "rgba(217,119,6,0.1)",
    borderColor: "rgba(217,119,6,0.25)",
    icon: TestTube,
    markerColor: "#D97706",
  },
};

const RADIUS_OPTIONS = [2, 5, 10, 25, 50];

// ─── Custom Marker Icon ───────────────────────────────────────────────────────
function createProviderIcon(type: "doctor" | "pharmacy" | "diagnostic_center", isSelected = false) {
  const cfg = TYPE_CONFIG[type];
  const size = isSelected ? 44 : 36;
  const icons = { doctor: "🩺", pharmacy: "💊", diagnostic_center: "🔬" };
  return divIcon({
    html: `
      <div style="
        width: ${size}px; height: ${size}px;
        background: white;
        border: 3px solid ${cfg.markerColor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        display:flex; align-items:center; justify-content:center;
        transition: all 0.2s;
      ">
        <span style="transform: rotate(45deg); font-size: ${isSelected ? 20 : 16}px; line-height:1;">${icons[type]}</span>
      </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function createUserIcon() {
  return divIcon({
    html: `
      <div style="position:relative; width:20px; height:20px;">
        <div style="
          width:20px; height:20px;
          background:#3B82F6; border:3px solid white;
          border-radius:50%; box-shadow: 0 2px 8px rgba(59,130,246,0.6);
        "></div>
        <div style="
          position:absolute; top:-8px; left:-8px;
          width:36px; height:36px;
          background: rgba(59,130,246,0.2);
          border-radius:50%;
          animation: pulse 2s infinite;
        "></div>
      </div>`,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// ─── Map Recenter Helper ──────────────────────────────────────────────────────
function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

// ─── Distance Badge ───────────────────────────────────────────────────────────
function DistanceBadge({ km }: { km: number }) {
  const label = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
      style={{ background: "rgba(59,130,246,0.1)", color: "#2563EB" }}
    >
      {label}
    </span>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────
function ProviderCard({
  provider,
  isSelected,
  onClick,
}: {
  provider: NearbyProvider;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = TYPE_CONFIG[provider.type];
  const Icon = cfg.icon;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${provider.latitude},${provider.longitude}`;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer transition-all border"
      style={{
        background: isSelected ? cfg.bgColor : "white",
        borderColor: isSelected ? cfg.markerColor : "rgba(226,232,240,0.8)",
        boxShadow: isSelected
          ? `0 4px 20px ${cfg.bgColor}`
          : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: cfg.bgColor, border: `1.5px solid ${cfg.borderColor}` }}
        >
          <Icon className="h-5 w-5" style={{ color: cfg.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{provider.name}</h3>
            <DistanceBadge km={provider.distanceKm} />
          </div>

          {provider.specialty && (
            <p className="text-xs text-slate-500 mt-0.5">{provider.specialty}</p>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: cfg.bgColor, color: cfg.color }}
            >
              {cfg.label}
            </span>
            {provider.rating != null && provider.rating > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {provider.rating.toFixed(1)}
              </span>
            )}
            {provider.city && (
              <span className="text-xs text-slate-400">{provider.city}</span>
            )}
          </div>

          {provider.address && (
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
              <MapPin className="h-3 w-3 inline mr-1 -mt-px" />
              {provider.address}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(59,130,246,0.1)", color: "#2563EB" }}
            >
              <Navigation className="h-3.5 w-3.5" />
              Directions
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
            {provider.phone && (
              <a
                href={`tel:${provider.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "rgba(5,150,105,0.1)", color: "#059669" }}
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ radiusKm, onExpandRadius }: { radiusKm: number; onExpandRadius: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <MapPin className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="font-bold text-slate-900 text-base">No providers found nearby</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-xs">
        No active providers found within {radiusKm} km of your location. Try expanding the search radius.
      </p>
      {radiusKm < 50 && (
        <Button
          size="sm"
          className="mt-4"
          style={{ background: "#7C3AED", color: "white" }}
          onClick={onExpandRadius}
        >
          Expand to {radiusKm === 2 ? 5 : radiusKm === 5 ? 10 : radiusKm === 10 ? 25 : 50} km
        </Button>
      )}
      <p className="text-xs text-slate-400 mt-3">
        Providers appear automatically as doctors, pharmacies & labs register and get approved.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function NearbyCareMap() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<NearbyProvider | null>(null);
  const [activeType, setActiveType] = useState<"all" | "doctor" | "pharmacy" | "diagnostic_center">("all");
  const [radiusKm, setRadiusKm] = useState(25);
  const [search, setSearch] = useState("");

  const mapRef = useRef<any>(null);

  // ── Default center (India) ─────────────────────────────────────────────────
  const defaultCenter: LatLngExpression = [20.5937, 78.9629];
  const mapCenter: LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : defaultCenter;

  // ── Fetch nearby providers ──────────────────────────────────────────────────
  const fetchNearby = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          radius: radiusKm.toString(),
          type: activeType,
          ...(search ? { search } : {}),
        });
        const res = await fetch(`/api/nearby?${params}`);
        if (!res.ok) throw new Error("Failed to load providers");
        const data = await res.json();
        setProviders(data.results ?? []);
      } catch (e: any) {
        setFetchError(e.message || "Failed to load nearby providers");
        setProviders([]);
      } finally {
        setLoading(false);
      }
    },
    [radiusKm, activeType, search],
  );

  // ── Get user geolocation ────────────────────────────────────────────────────
  const locate = useCallback(() => {
    setLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        fetchNearby(loc.lat, loc.lng);
        setLocating(false);
      },
      () => {
        setLocationError("Unable to get your location. Please allow location access and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [fetchNearby]);

  // ── Auto-locate on mount ────────────────────────────────────────────────────
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch when filters change ────────────────────────────────────────────
  useEffect(() => {
    if (userLocation) {
      fetchNearby(userLocation.lat, userLocation.lng);
    }
  }, [activeType, radiusKm, fetchNearby, userLocation]);

  // ── Expand radius helper ────────────────────────────────────────────────────
  const expandRadius = () => {
    const idx = RADIUS_OPTIONS.indexOf(radiusKm);
    if (idx < RADIUS_OPTIONS.length - 1) setRadiusKm(RADIUS_OPTIONS[idx + 1]);
  };

  const filteredProviders = providers.filter((p) => {
    if (activeType !== "all" && p.type !== activeType) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        (p.specialty ?? "").toLowerCase().includes(s) ||
        (p.city ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 64px)" }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nearest Healthcare</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Discover doctors, pharmacies & diagnostic labs close to you.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Radius selector */}
              <div className="flex items-center gap-1 bg-slate-50 rounded-xl border border-slate-200 px-1 py-1">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadiusKm(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={
                      radiusKm === r
                        ? { background: "#7C3AED", color: "white" }
                        : { color: "#64748B" }
                    }
                  >
                    {r}km
                  </button>
                ))}
              </div>

              {/* Locate Me */}
              <Button
                size="sm"
                variant="outline"
                onClick={locate}
                disabled={locating}
                className="h-9 gap-1.5 rounded-xl border-slate-200"
              >
                <Locate className="h-4 w-4" />
                {locating ? "Locating…" : "Locate Me"}
              </Button>
            </div>
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
            {(["all", "doctor", "pharmacy", "diagnostic_center"] as const).map((t) => {
              const isAll = t === "all";
              const cfg = isAll ? null : TYPE_CONFIG[t];
              const TypeIcon = cfg?.icon;
              const isActive = activeType === t;
              return (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border"
                  style={
                    isActive
                      ? {
                          background: cfg?.markerColor ?? "#7C3AED",
                          color: "white",
                          borderColor: "transparent",
                        }
                      : { background: "white", color: "#64748B", borderColor: "#E2E8F0" }
                  }
                >
                  {isAll ? (
                    <MapPin className="h-3.5 w-3.5" />
                  ) : TypeIcon ? (
                    <TypeIcon className="h-3.5 w-3.5" />
                  ) : null}
                  {isAll ? "All" : cfg!.label}
                </button>
              );
            })}

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search by name, specialty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl border-slate-200"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-2">
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* Error notices */}
          {locationError && (
            <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {locationError}
            </div>
          )}
        </div>

        {/* ── Main split view ─────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Provider list */}
          <div className="w-[380px] shrink-0 flex flex-col border-r border-slate-100 bg-slate-50 overflow-hidden">
            <div className="shrink-0 px-4 py-2.5 border-b border-slate-100 bg-white">
              <p className="text-xs font-semibold text-slate-500">
                {loading
                  ? "Searching…"
                  : `${filteredProviders.length} provider${filteredProviders.length !== 1 ? "s" : ""} found`}
                {!loading && userLocation && (
                  <span className="text-slate-400 font-normal"> within {radiusKm} km</span>
                )}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-4 animate-pulse border border-slate-100"
                  >
                    <div className="flex gap-3">
                      <div className="h-11 w-11 rounded-xl bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredProviders.length === 0 ? (
                <EmptyState radiusKm={radiusKm} onExpandRadius={expandRadius} />
              ) : (
                filteredProviders.map((p) => (
                  <ProviderCard
                    key={`${p.type}-${p.id}`}
                    provider={p}
                    isSelected={selectedProvider?.id === p.id && selectedProvider?.type === p.type}
                    onClick={() => {
                      setSelectedProvider(p);
                      if (mapRef.current) {
                        mapRef.current.setView([p.latitude, p.longitude], 16, { animate: true });
                      }
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Map */}
          <div className="flex-1 relative">
            {!userLocation && !locating && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                style={{ background: "rgba(248,250,252,0.9)", backdropFilter: "blur(4px)" }}
              >
                <MapPin className="h-12 w-12 text-slate-300 mb-3" />
                <p className="font-bold text-slate-700">Enable location to see providers near you</p>
                <Button
                  className="mt-4 gap-2"
                  style={{ background: "#7C3AED", color: "white" }}
                  onClick={locate}
                >
                  <Locate className="h-4 w-4" />
                  Use My Location
                </Button>
              </div>
            )}

            <MapContainer
              center={mapCenter}
              zoom={userLocation ? 12 : 5}
              style={{ height: "100%", width: "100%" }}
              ref={mapRef}
              zoomControl={true}
            >
              {/* OpenStreetMap tiles — 100% free, no API key */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Recenter when location changes */}
              {userLocation && (
                <MapRecenter lat={userLocation.lat} lng={userLocation.lng} zoom={12} />
              )}

              {/* User location marker */}
              {userLocation && (
                <>
                  <Marker
                    position={[userLocation.lat, userLocation.lng]}
                    icon={createUserIcon()}
                  >
                    <Popup>📍 You are here</Popup>
                  </Marker>
                  <Circle
                    center={[userLocation.lat, userLocation.lng]}
                    radius={radiusKm * 1000}
                    pathOptions={{
                      color: "#7C3AED",
                      fillColor: "#7C3AED",
                      fillOpacity: 0.04,
                      weight: 1.5,
                      dashArray: "6 4",
                    }}
                  />
                </>
              )}

              {/* Provider markers */}
              {filteredProviders.map((p) => {
                const isSelected = selectedProvider?.id === p.id && selectedProvider?.type === p.type;
                const cfg = TYPE_CONFIG[p.type];
                return (
                  <Marker
                    key={`${p.type}-${p.id}`}
                    position={[p.latitude, p.longitude]}
                    icon={createProviderIcon(p.type, isSelected)}
                    eventHandlers={{ click: () => setSelectedProvider(p) }}
                  >
                    <Popup>
                      <div className="min-w-[180px]">
                        <p className="font-bold text-sm">{p.name}</p>
                        {p.specialty && <p className="text-xs text-gray-500">{p.specialty}</p>}
                        <p
                          className="text-xs font-semibold mt-1"
                          style={{ color: cfg.color }}
                        >
                          {cfg.label}
                        </p>
                        <p className="text-xs text-blue-600 font-bold mt-1">
                          {p.distanceKm < 1
                            ? `${Math.round(p.distanceKm * 1000)} m away`
                            : `${p.distanceKm.toFixed(1)} km away`}
                        </p>
                        {p.address && <p className="text-xs text-gray-400 mt-1">{p.address}</p>}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Get Directions →
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legend */}
            <div
              className="absolute bottom-4 right-4 z-[1000] rounded-xl bg-white/90 border border-slate-200 shadow-lg p-3 backdrop-blur-sm"
            >
              <p className="text-xs font-bold text-slate-600 mb-2">Map Legend</p>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={key} className="flex items-center gap-2 mb-1.5">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ background: cfg.bgColor }}
                    >
                      <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                    </div>
                    <span className="text-xs text-slate-600">{cfg.label}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 text-[10px]">●</span>
                </div>
                <span className="text-xs text-slate-600">Your Location</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
