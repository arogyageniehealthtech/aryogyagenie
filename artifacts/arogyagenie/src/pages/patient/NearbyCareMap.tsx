import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import {
  MapPin, Stethoscope, Pill, TestTube, Locate, AlertCircle,
  Navigation, ExternalLink, Phone, Star, Search, X,
  ChevronUp, ChevronDown, Loader2, Calendar, Edit3, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, useMap,
  Polyline,
} from "react-leaflet";
import { divIcon, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
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

type FilterType = "all" | "doctor" | "pharmacy" | "diagnostic_center";
type SheetState = "collapsed" | "half" | "full";

// ─── Constants ────────────────────────────────────────────────────────────────
const RADIUS_STEPS = [2, 4, 6, 8, 10, 12, 14, 16]; // km

const TYPE_CONFIG = {
  doctor: {
    label: "Doctor",
    emoji: "🩺",
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.3)",
    icon: Stethoscope,
  },
  pharmacy: {
    label: "Pharmacy",
    emoji: "💊",
    color: "#059669",
    bg: "rgba(5,150,105,0.12)",
    border: "rgba(5,150,105,0.3)",
    icon: Pill,
  },
  diagnostic_center: {
    label: "Diagnostic Lab",
    emoji: "🔬",
    color: "#D97706",
    bg: "rgba(217,119,6,0.12)",
    border: "rgba(217,119,6,0.3)",
    icon: TestTube,
  },
} as const;

// ─── Custom Map Markers ───────────────────────────────────────────────────────
function makeProviderPin(
  type: "doctor" | "pharmacy" | "diagnostic_center",
  selected = false,
) {
  const cfg = TYPE_CONFIG[type];
  const sz = selected ? 48 : 38;
  return divIcon({
    html: `
      <div style="
        position:relative;
        width:${sz}px; height:${sz}px;
        background:white;
        border:3px solid ${cfg.color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 ${selected ? 8 : 4}px ${selected ? 24 : 12}px rgba(0,0,0,${selected ? 0.35 : 0.2});
        display:flex; align-items:center; justify-content:center;
        transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
        ${selected ? `animation: pinBounce 0.4s cubic-bezier(.34,1.56,.64,1);` : ""}
      ">
        <span style="transform:rotate(45deg); font-size:${selected ? 22 : 17}px; line-height:1;">
          ${cfg.emoji}
        </span>
      </div>
      <style>
        @keyframes pinBounce {
          0% { transform: rotate(-45deg) scale(0.6); }
          70% { transform: rotate(-45deg) scale(1.15); }
          100% { transform: rotate(-45deg) scale(1); }
        }
      </style>`,
    className: "",
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz],
    popupAnchor: [0, -sz],
  });
}

function makeUserPin() {
  return divIcon({
    html: `
      <div style="position:relative; width:28px; height:28px;">
        <div style="
          position:absolute; top:50%; left:50%;
          transform: translate(-50%, -50%);
          width:44px; height:44px;
          background: rgba(59,130,246,0.2);
          border-radius: 50%;
          animation: pulseRing 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute; top:50%; left:50%;
          transform: translate(-50%, -50%);
          width:24px; height:24px;
          background: #2563EB;
          border: 3.5px solid white;
          border-radius: 50%;
          box-shadow: 0 3px 12px rgba(37,99,235,0.6);
          display:flex; align-items:center; justify-content:center;
          color:white; font-size:12px; font-weight:bold;
        ">🏠</div>
      </div>
      <style>
        @keyframes pulseRing {
          0% { transform: translate(-50%,-50%) scale(0.6); opacity:0.8; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity:0; }
        }
      </style>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ─── Map helpers ──────────────────────────────────────────────────────────────
function MapFly({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.9 });
  }, [lat, lng, zoom, map]);
  return null;
}

function MapInit({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

// ─── Distance formatter ───────────────────────────────────────────────────────
function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// ─── Provider mini-card (in bottom sheet list) ────────────────────────────────
function ProviderCard({
  p,
  selected,
  onClick,
}: {
  p: NearbyProvider;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = TYPE_CONFIG[p.type];
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all shrink-0 border"
      style={{
        minWidth: 260,
        background: selected ? cfg.bg : "white",
        borderColor: selected ? cfg.color : "rgba(226,232,240,0.8)",
        boxShadow: selected ? `0 4px 20px ${cfg.bg}` : "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
        style={{ background: cfg.bg }}
      >
        {cfg.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm truncate">{p.name}</p>
        {p.specialty && <p className="text-xs text-slate-500 truncate">{p.specialty}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {fmtDist(p.distanceKm)}
          </span>
          {p.rating != null && p.rating > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-amber-600">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {p.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Provider Detail Panel (inside bottom sheet when a provider is selected) ──
function ProviderDetail({
  p,
  onClose,
  onBook,
}: {
  p: NearbyProvider;
  onClose: () => void;
  onBook: () => void;
}) {
  const cfg = TYPE_CONFIG[p.type];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
  return (
    <div className="px-4 pb-4 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl"
          style={{ background: cfg.bg }}
        >
          {cfg.emoji}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">{p.name}</h2>
              {p.specialty && <p className="text-sm text-slate-500">{p.specialty}</p>}
            </div>
            <button onClick={onClose} className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center ml-2 shrink-0">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
            {p.rating != null && p.rating > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {p.rating.toFixed(1)}
              </span>
            )}
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(59,130,246,0.1)", color: "#2563EB" }}
            >
              📍 {fmtDist(p.distanceKm)} away
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 space-y-2">
        {p.address && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <span>{p.address}{p.city ? `, ${p.city}` : ""}</span>
          </div>
        )}
        {p.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="h-4 w-4 text-slate-400 shrink-0" />
            <a href={`tel:${p.phone}`} className="text-blue-600 font-medium">{p.phone}</a>
          </div>
        )}
        {p.openingHours && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Star className="h-4 w-4 text-slate-400 shrink-0" />
            <span>{p.openingHours}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold border-2 transition-all"
          style={{ borderColor: cfg.color, color: cfg.color }}
        >
          <Navigation className="h-4 w-4" />
          Directions
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </a>
        <button
          onClick={onBook}
          className="flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold text-white transition-all shadow-lg active:scale-95"
          style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }}
        >
          <Calendar className="h-4 w-4" />
          Book Now
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function NearbyCareMap() {
  const [, setLocation] = useLocation();

  // User location state
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number }>({ lat: 22.5726, lng: 88.3639 }); // Default Kolkata
  const [locationName, setLocationName] = useState<string>("Current Location");
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressBox, setShowAddressBox] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Providers state
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [radiusIdx, setRadiusIdx] = useState(3); // default 8 km
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NearbyProvider | null>(null);
  const [sheet, setSheet] = useState<SheetState>("half");
  const [showSearch, setShowSearch] = useState(false);

  const mapRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<any>(null);
  const radiusKm = RADIUS_STEPS[radiusIdx];

  // ── Fetch nearby providers for userLoc ─────────────────────────────────────
  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: radiusKm.toString(),
        type: filter,
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/nearby?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProviders(data.results ?? []);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [radiusKm, filter, search]);

  // ── Geocode custom address typed by patient ────────────────────────────────
  const searchAddress = useCallback(async (queryAddress: string) => {
    if (!queryAddress.trim()) return;
    setIsSearchingAddress(true);
    setLocError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryAddress)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "ArogyaGenie/1.0" },
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        const displayName = data[0].display_name.split(",").slice(0, 2).join(",");
        setUserLoc({ lat: newLat, lng: newLng });
        setLocationName(displayName);
        setShowAddressBox(false);
        fetchNearby(newLat, newLng);
        if (mapRef.current) {
          mapRef.current.flyTo([newLat, newLng], 13);
        }
      } else {
        setLocError("Address not found. Please try entering city or area name.");
      }
    } catch {
      setLocError("Failed to locate address.");
    } finally {
      setIsSearchingAddress(false);
    }
  }, [fetchNearby]);

  // ── GPS locate ─────────────────────────────────────────────────────────────
  const locateGPS = useCallback(() => {
    setLocating(true);
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        setLocationName("GPS Location");
        fetchNearby(loc.lat, loc.lng);
        setLocating(false);
        if (mapRef.current) {
          mapRef.current.flyTo([loc.lat, loc.lng], 13);
        }
      },
      () => {
        setLocError("GPS permission denied. You can search your address above!");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [fetchNearby]);

  // Auto-locate GPS on mount
  useEffect(() => { locateGPS(); }, []);

  // Re-fetch when filters or radius change
  useEffect(() => {
    if (userLoc) fetchNearby(userLoc.lat, userLoc.lng);
  }, [radiusKm, filter, fetchNearby]);

  // ── Draggable user pin end event ───────────────────────────────────────────
  const userMarkerDragHandlers = useMemo(
    () => ({
      dragend() {
        const marker = userMarkerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          const newLoc = { lat: latLng.lat, lng: latLng.lng };
          setUserLoc(newLoc);
          setLocationName("Custom Pinned Location");
          fetchNearby(newLoc.lat, newLoc.lng);
        }
      },
    }),
    [fetchNearby],
  );

  const visible = providers.filter((p) => {
    if (filter !== "all" && p.type !== filter) return false;
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

  const selectProvider = useCallback((p: NearbyProvider) => {
    setSelected(p);
    setSheet("full");
    if (mapRef.current) {
      const midLat = (userLoc.lat + p.latitude) / 2;
      const midLng = (userLoc.lng + p.longitude) / 2;
      mapRef.current.flyTo([midLat, midLng], 14, { duration: 0.8 });
    }
  }, [userLoc]);

  const handleBook = useCallback(() => {
    if (!selected) return;
    if (selected.type === "doctor") {
      setLocation(`/patient/appointments?doctorId=${selected.id}`);
    } else if (selected.type === "diagnostic_center") {
      setLocation(`/patient/diagnostic-bookings`);
    } else {
      setLocation(`/patient/appointments`);
    }
  }, [selected, setLocation]);

  const sheetHeights: Record<SheetState, string> = {
    collapsed: "80px",
    half: "240px",
    full: selected ? "420px" : "240px",
  };

  return (
    <DashboardLayout>
      <div className="relative overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* ── Leaflet Map ─────────────────────────────────────────────────── */}
        <MapContainer
          center={[userLoc.lat, userLoc.lng]}
          zoom={13}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapInit onReady={(m) => { mapRef.current = m; }} />

          {/* Draggable Patient Location Marker */}
          <Marker
            draggable={true}
            eventHandlers={userMarkerDragHandlers}
            position={[userLoc.lat, userLoc.lng]}
            icon={makeUserPin()}
            ref={userMarkerRef}
          >
            <Popup>
              <div className="text-xs font-bold text-center">
                🏠 Your Location ({locationName})
                <p className="font-normal text-slate-500 mt-1">Drag me anywhere to update location!</p>
              </div>
            </Popup>
          </Marker>

          {/* Animated radius ring */}
          <Circle
            center={[userLoc.lat, userLoc.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#7C3AED",
              fillColor: "#7C3AED",
              fillOpacity: 0.04,
              weight: 2,
              dashArray: "8 5",
            }}
          />

          {/* Provider markers */}
          {visible.map((p) => {
            const isSelected = selected?.id === p.id && selected?.type === p.type;
            const cfg = TYPE_CONFIG[p.type];
            return (
              <Marker
                key={`${p.type}-${p.id}`}
                position={[p.latitude, p.longitude]}
                icon={makeProviderPin(p.type, isSelected)}
                eventHandlers={{ click: () => selectProvider(p) }}
              >
                <Popup>
                  <div style={{ minWidth: 170 }}>
                    <p className="font-bold text-sm">{p.name}</p>
                    {p.specialty && <p className="text-xs text-gray-500">{p.specialty}</p>}
                    <p className="text-xs font-bold mt-1" style={{ color: cfg.color }}>
                      {cfg.label} · {fmtDist(p.distanceKm)} away
                    </p>
                    <button
                      onClick={() => selectProvider(p)}
                      className="mt-2 text-xs font-bold px-3 py-1 rounded-lg text-white"
                      style={{ background: cfg.color }}
                    >
                      View Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Straight-line route */}
          {selected && (
            <Polyline
              positions={[
                [userLoc.lat, userLoc.lng],
                [selected.latitude, selected.longitude],
              ]}
              pathOptions={{
                color: TYPE_CONFIG[selected.type].color,
                weight: 3,
                opacity: 0.7,
                dashArray: "10 8",
              }}
            />
          )}
        </MapContainer>

        {/* ── Floating top HUD ──────────────────────────────────────────────── */}
        <div className="absolute top-3 left-0 right-0 z-[1000] px-4 flex flex-col gap-2 pointer-events-none">
          {/* Top location bar & action buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Set address button / indicator */}
            <div className="flex-1 bg-white rounded-full shadow-lg border border-slate-200 px-3.5 py-2 flex items-center gap-2 min-w-0">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 truncate">
                {locationName}
              </span>
              <button
                onClick={() => setShowAddressBox((s) => !s)}
                className="text-[11px] font-bold text-violet-600 hover:underline shrink-0 ml-auto flex items-center gap-1"
              >
                <Edit3 className="h-3 w-3" />
                Change
              </button>
            </div>

            {/* Locate GPS */}
            <button
              onClick={locateGPS}
              disabled={locating}
              className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-200 transition-all hover:scale-105 shrink-0"
              title="Use GPS Location"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <Locate className="h-4 w-4 text-blue-500" />
              )}
            </button>
          </div>

          {/* Manual Address Input Dropdown */}
          {showAddressBox && (
            <div className="bg-white rounded-2xl p-3 shadow-2xl border border-slate-200 pointer-events-auto space-y-2">
              <p className="text-xs font-bold text-slate-700">Set your exact location / address:</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder="e.g. Salt Lake Sector V, Kolkata..."
                  value={customAddressInput}
                  onChange={(e) => setCustomAddressInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchAddress(customAddressInput);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs border border-slate-200 outline-none focus:ring-2 focus:ring-violet-400"
                />
                <Button
                  size="sm"
                  onClick={() => searchAddress(customAddressInput)}
                  disabled={isSearchingAddress || !customAddressInput.trim()}
                  className="h-8 text-xs font-bold bg-violet-600 text-white rounded-xl px-3"
                >
                  {isSearchingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set"}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                Tip: You can also <strong>drag the blue 🏠 marker</strong> directly on the map!
              </p>
            </div>
          )}

          {/* Filter pills row */}
          <div className="flex items-center gap-2 pointer-events-auto overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="h-9 w-9 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-200 transition-all shrink-0"
            >
              {showSearch ? <X className="h-3.5 w-3.5 text-slate-600" /> : <Search className="h-3.5 w-3.5 text-slate-600" />}
            </button>

            {(["all", "doctor", "pharmacy", "diagnostic_center"] as const).map((t) => {
              const isAll = t === "all";
              const cfg = isAll ? null : TYPE_CONFIG[t];
              const active = filter === t;
              return (
                <button
                  key={t}
                  onClick={() => { setFilter(t); setSelected(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all border shrink-0 hover:scale-105"
                  style={
                    active
                      ? {
                          background: cfg?.color ?? "#7C3AED",
                          color: "white",
                          borderColor: "transparent",
                        }
                      : { background: "white", color: "#475569", borderColor: "rgba(226,232,240,0.8)" }
                  }
                >
                  {isAll ? "🗺️" : cfg!.emoji}
                  {isAll ? "All" : cfg!.label}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          {showSearch && (
            <div className="relative pointer-events-auto">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                autoFocus
                placeholder="Search doctors, pharmacies, labs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-2xl text-xs shadow-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-violet-300"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Error notice */}
          {locError && (
            <div className="pointer-events-auto flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 shadow-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {locError}
            </div>
          )}
        </div>

        {/* ── Bottom Sheet ──────────────────────────────────────────────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-2xl transition-all duration-400 ease-out"
          style={{ height: sheetHeights[sheet] }}
        >
          {/* Drag handle + toggle */}
          <div
            className="flex flex-col items-center pt-3 pb-2 cursor-pointer"
            onClick={() => {
              if (sheet === "collapsed") setSheet(selected ? "full" : "half");
              else if (sheet === "half") setSheet(selected ? "full" : "collapsed");
              else setSheet("half");
            }}
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 mb-2" />
            <div className="w-full px-5 flex items-center gap-3">
              <span className="text-xs text-slate-400 font-bold shrink-0">2km</span>
              <div className="relative flex-1">
                <input
                  type="range"
                  min={0}
                  max={RADIUS_STEPS.length - 1}
                  step={1}
                  value={radiusIdx}
                  onChange={(e) => {
                    e.stopPropagation();
                    setRadiusIdx(Number(e.target.value));
                    setSelected(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #7C3AED ${(radiusIdx / (RADIUS_STEPS.length - 1)) * 100}%, #E2E8F0 0%)`,
                    accentColor: "#7C3AED",
                  }}
                />
              </div>
              <span className="text-xs text-slate-400 font-bold shrink-0">16km</span>
              <div
                className="px-3 py-1 rounded-full text-xs font-black text-white shrink-0"
                style={{ background: "#7C3AED", minWidth: 52, textAlign: "center" }}
              >
                {radiusKm} km
              </div>
            </div>
          </div>

          {/* Sheet content */}
          {sheet !== "collapsed" && (
            <div className="px-4 overflow-hidden" style={{ height: "calc(100% - 70px)" }}>
              {selected && sheet === "full" ? (
                <ProviderDetail
                  p={selected}
                  onClose={() => { setSelected(null); setSheet("half"); }}
                  onBook={handleBook}
                />
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-800">
                      {loading ? (
                        <span className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                        </span>
                      ) : visible.length === 0 ? (
                        "No providers in this range"
                      ) : (
                        `${visible.length} provider${visible.length !== 1 ? "s" : ""} within ${radiusKm} km`
                      )}
                    </p>
                    {sheet === "half" && visible.length > 0 && (
                      <button
                        onClick={() => setSheet("full")}
                        className="text-xs font-bold text-violet-600 flex items-center gap-1"
                      >
                        See all <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {visible.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none flex-1">
                      {visible.map((p) => (
                        <ProviderCard
                          key={`${p.type}-${p.id}`}
                          p={p}
                          selected={selected?.id === p.id && selected?.type === p.type}
                          onClick={() => selectProvider(p)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                      <div className="text-4xl mb-2">🗺️</div>
                      <p className="text-slate-600 font-semibold text-sm">
                        No providers found within {radiusKm} km
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Try expanding the radius range slider above or search a different area.
                      </p>
                      {radiusKm < 16 && (
                        <button
                          className="mt-3 text-xs font-bold px-4 py-2 rounded-full text-white"
                          style={{ background: "#7C3AED" }}
                          onClick={() => setRadiusIdx((i) => Math.min(i + 1, RADIUS_STEPS.length - 1))}
                        >
                          Expand to {RADIUS_STEPS[Math.min(radiusIdx + 1, RADIUS_STEPS.length - 1)]} km
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {sheet === "collapsed" && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ChevronUp className="h-3.5 w-3.5" />
              {visible.length} provider{visible.length !== 1 ? "s" : ""} · {radiusKm} km radius
            </div>
          )}
        </div>

        {/* Provider count badge */}
        {!loading && visible.length > 0 && (
          <div
            className="absolute top-24 right-4 z-[999] px-3 py-1.5 rounded-full text-xs font-black text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}
          >
            {visible.length} nearby
          </div>
        )}
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7C3AED;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(124,58,237,0.45);
          cursor: pointer;
          transition: transform 0.15s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </DashboardLayout>
  );
}
