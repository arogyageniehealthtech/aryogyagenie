import {
  useState, useEffect, useCallback, useRef,
} from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import {
  MapPin, Stethoscope, Pill, TestTube, Locate, AlertCircle,
  Navigation, ExternalLink, Phone, Star, Search, X,
  ChevronUp, ChevronDown, Loader2, Calendar,
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
      <div style="position:relative; width:24px; height:24px;">
        <div style="
          position:absolute; top:50%; left:50%;
          transform: translate(-50%, -50%);
          width:40px; height:40px;
          background: rgba(59,130,246,0.18);
          border-radius: 50%;
          animation: pulseRing 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute; top:50%; left:50%;
          transform: translate(-50%, -50%);
          width:20px; height:20px;
          background: #3B82F6;
          border: 3.5px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 10px rgba(59,130,246,0.55);
        "></div>
      </div>
      <style>
        @keyframes pulseRing {
          0% { transform: translate(-50%,-50%) scale(0.6); opacity:0.8; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity:0; }
        }
      </style>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
  const Icon = cfg.icon;
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
      {/* Header */}
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

      {/* Details */}
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

      {/* Actions */}
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

  // Location
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Providers
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
  const radiusKm = RADIUS_STEPS[radiusIdx];

  // ── Fetch ──────────────────────────────────────────────────────────────────
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

  // ── GPS locate ─────────────────────────────────────────────────────────────
  const locate = useCallback(() => {
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
        fetchNearby(loc.lat, loc.lng);
        setLocating(false);
      },
      () => {
        setLocError("Location access denied. Enable location in browser settings.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [fetchNearby]);

  // Auto-locate on mount
  useEffect(() => { locate(); }, []);

  // Re-fetch when filters or radius change
  useEffect(() => {
    if (userLoc) fetchNearby(userLoc.lat, userLoc.lng);
  }, [radiusKm, filter, fetchNearby]);

  // ── Filter providers client-side for search ───────────────────────────────
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

  // ── Select provider → fly to it ───────────────────────────────────────────
  const selectProvider = useCallback((p: NearbyProvider) => {
    setSelected(p);
    setSheet("full");
    if (mapRef.current) {
      const midLat = userLoc ? (userLoc.lat + p.latitude) / 2 : p.latitude;
      const midLng = userLoc ? (userLoc.lng + p.longitude) / 2 : p.longitude;
      mapRef.current.flyTo([midLat, midLng], 14, { duration: 0.8 });
    }
  }, [userLoc]);

  // ── Book handler ──────────────────────────────────────────────────────────
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

  const mapCenter: LatLngExpression = userLoc
    ? [userLoc.lat, userLoc.lng]
    : [20.5937, 78.9629]; // India default

  // ── Sheet heights ─────────────────────────────────────────────────────────
  const sheetHeights: Record<SheetState, string> = {
    collapsed: "80px",
    half: "240px",
    full: selected ? "420px" : "240px",
  };

  return (
    <DashboardLayout>
      {/* ── Full-screen map container ──────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* ── Leaflet Map ─────────────────────────────────────────────────── */}
        <MapContainer
          center={mapCenter}
          zoom={userLoc ? 13 : 5}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapInit onReady={(m) => { mapRef.current = m; }} />

          {/* Fly-to on user location */}
          {userLoc && <MapFly lat={userLoc.lat} lng={userLoc.lng} zoom={13} />}

          {/* User location */}
          {userLoc && (
            <>
              <Marker
                position={[userLoc.lat, userLoc.lng]}
                icon={makeUserPin()}
              >
                <Popup>📍 Your location</Popup>
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
            </>
          )}

          {/* Provider markers */}
          {visible.map((p) => {
            const isSelected =
              selected?.id === p.id && selected?.type === p.type;
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

          {/* Straight-line route to selected provider */}
          {userLoc && selected && (
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
        <div
          className="absolute top-4 left-0 right-0 z-[1000] px-4 flex flex-col gap-2 pointer-events-none"
        >
          {/* Filter pills row */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Search toggle */}
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-200 transition-all hover:scale-105"
            >
              {showSearch ? <X className="h-4 w-4 text-slate-600" /> : <Search className="h-4 w-4 text-slate-600" />}
            </button>

            {/* Type filter pills */}
            {(["all", "doctor", "pharmacy", "diagnostic_center"] as const).map((t) => {
              const isAll = t === "all";
              const cfg = isAll ? null : TYPE_CONFIG[t];
              const active = filter === t;
              return (
                <button
                  key={t}
                  onClick={() => { setFilter(t); setSelected(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold shadow-lg transition-all border hover:scale-105"
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

            {/* Locate Me button */}
            <button
              onClick={locate}
              disabled={locating}
              className="ml-auto h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-200 transition-all hover:scale-105 disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <Locate className="h-4 w-4 text-blue-500" />
              )}
            </button>
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
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm shadow-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-violet-300"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-3 text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Error notice */}
          {locError && (
            <div className="pointer-events-auto flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 shadow-lg">
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
            {/* Radius slider row */}
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

              {/* Current radius bubble */}
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
                /* ── Provider detail view ── */
                <ProviderDetail
                  p={selected}
                  onClose={() => { setSelected(null); setSheet("half"); }}
                  onBook={handleBook}
                />
              ) : (
                /* ── Provider list view ── */
                <div className="flex flex-col h-full">
                  {/* Count header */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-800">
                      {loading ? (
                        <span className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                        </span>
                      ) : visible.length === 0 ? (
                        userLoc ? "No providers in this area yet" : "Enable location to search"
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

                  {/* Horizontal scrolling cards */}
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
                        {userLoc
                          ? "No providers found here yet"
                          : "Enable location to find care near you"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        {userLoc
                          ? "Providers appear automatically as doctors, pharmacies & labs register and get approved. Try expanding the radius."
                          : "Click the 📍 locate button to share your position."}
                      </p>
                      {userLoc && radiusKm < 16 && (
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

          {/* Collapsed pull tab */}
          {sheet === "collapsed" && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ChevronUp className="h-3.5 w-3.5" />
              {visible.length} provider{visible.length !== 1 ? "s" : ""} · {radiusKm} km radius
            </div>
          )}
        </div>

        {/* Provider count badge on map */}
        {userLoc && !loading && visible.length > 0 && (
          <div
            className="absolute top-28 right-4 z-[999] px-3 py-1.5 rounded-full text-xs font-black text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}
          >
            {visible.length} nearby
          </div>
        )}
      </div>

      {/* Global slider thumb style */}
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
