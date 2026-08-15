import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import {
  MapPin, Stethoscope, Pill, TestTube, Locate, AlertCircle,
  Navigation, ExternalLink, Phone, Star, Search, X,
  Loader2, Calendar, Edit3, Check, CheckCircle2, ChevronRight,
  Sliders, ShieldCheck, Sparkles, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useLocation } from "wouter";
import { useUserLocation, QUICK_CITIES, fmtDist } from "@/hooks/useUserLocation";
import { GoogleMapView, type MapProviderItem } from "@/components/map/GoogleMapView";

type FilterType = "all" | "doctor" | "pharmacy" | "diagnostic_center";

const TYPE_CONFIG = {
  doctor: {
    label: "Doctor",
    emoji: "🩺",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    badgeColor: "bg-violet-600 text-white",
  },
  diagnostic_center: {
    label: "Diagnostic Lab",
    emoji: "🔬",
    color: "bg-sky-50 text-sky-700 border-sky-200",
    badgeColor: "bg-sky-600 text-white",
  },
  pharmacy: {
    label: "Pharmacy",
    emoji: "💊",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeColor: "bg-emerald-600 text-white",
  },
};

export function NearbyCareMap() {
  const [, setLocation] = useLocation();

  // Location Hook
  const {
    userLoc,
    locationName,
    isLiveGps,
    locating,
    locError,
    startLiveGPS,
    handleMapClick,
    searchAddress,
    selectQuickCity,
    isSearchingAddress,
  } = useUserLocation();

  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showAddressBox, setShowAddressBox] = useState(false);

  // Discovery Filter State
  const [radiusKm, setRadiusKm] = useState(10); // 2 km to 18 km
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [medicineQuery, setMedicineQuery] = useState("");

  // Results State
  const [providers, setProviders] = useState<MapProviderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<"split" | "map" | "list">("split");

  const cardListRef = useRef<HTMLDivElement | null>(null);

  // Fetch from backend location discovery API
  const fetchNearby = useCallback(
    async (lat: number, lng: number, rad: number, type: FilterType, search: string, med: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          radius: rad.toString(),
          type,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(med.trim() ? { medicine: med.trim() } : {}),
        });

        const res = await fetch(`/api/nearby?${params}`);
        if (!res.ok) throw new Error("Failed to fetch nearby providers");
        const data = await res.json();
        setProviders(data.results || []);
      } catch {
        setProviders([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Trigger query on location, radius, or filter change
  useEffect(() => {
    fetchNearby(userLoc.lat, userLoc.lng, radiusKm, filterType, searchQuery, medicineQuery);
  }, [userLoc.lat, userLoc.lng, radiusKm, filterType, searchQuery, medicineQuery, fetchNearby]);

  // Scroll to selected card when selected on map
  const handleSelectProvider = useCallback((provider: MapProviderItem | null) => {
    setSelectedId(provider ? provider.id : null);
    if (provider) {
      const el = document.getElementById(`provider-card-${provider.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, []);

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAddressInput.trim()) return;
    const success = await searchAddress(customAddressInput);
    if (success) {
      setShowAddressBox(false);
      setCustomAddressInput("");
    }
  };

  const handleQuickCitySelect = (city: (typeof QUICK_CITIES)[number]) => {
    selectQuickCity(city);
    setShowAddressBox(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              Nearest Healthcare Discovery
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Locate verified doctors, diagnostic centers, and medicine-stocked pharmacies within {radiusKm} km.
            </p>
          </div>

          {/* Location Indicator & Change Location Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-medium text-slate-700">
              <span className={`w-2 h-2 rounded-full ${isLiveGps ? "bg-emerald-500 animate-pulse" : "bg-primary"}`} />
              <span className="truncate max-w-[180px]" title={locationName}>
                {locationName}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddressBox(!showAddressBox)}
              className="text-xs h-9 gap-1.5 border-slate-200"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Change
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={startLiveGPS}
              disabled={locating}
              className="text-xs h-9 gap-1.5 bg-primary hover:bg-primary/90 text-white"
            >
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Locate className="w-3.5 h-3.5" />}
              {locating ? "Locating..." : "Use GPS"}
            </Button>
          </div>
        </div>

        {/* ── Location Change Box (Collapsible) ─────────────────────────────────── */}
        {showAddressBox && (
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Select or Search Location
              </h3>
              <button
                onClick={() => setShowAddressBox(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddressSubmit} className="flex gap-2">
              <Input
                placeholder="Enter city, locality, or landmark (e.g. Salt Lake Sector V, Kolkata)..."
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value)}
                className="text-xs h-9 flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSearchingAddress || !customAddressInput.trim()}
                className="text-xs h-9 gap-1.5"
              >
                {isSearchingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Search
              </Button>
            </form>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                Quick Select City:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CITIES.map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => handleQuickCitySelect(city)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 hover:bg-violet-50 text-slate-700 hover:text-violet-700 border border-slate-200 hover:border-violet-200 transition-colors"
                  >
                    📍 {city.name}
                  </button>
                ))}
              </div>
            </div>

            {locError && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {locError}
              </p>
            )}
          </div>
        )}

        {/* ── Filter Controls Bar ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ✨ All Providers ({providers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("doctor")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === "doctor" ? "bg-violet-600 text-white shadow-xs" : "text-slate-600 hover:text-violet-700"
                }`}
              >
                🩺 Doctors
              </button>
              <button
                type="button"
                onClick={() => setFilterType("diagnostic_center")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === "diagnostic_center" ? "bg-sky-600 text-white shadow-xs" : "text-slate-600 hover:text-sky-700"
                }`}
              >
                🔬 Diagnostic Labs
              </button>
              <button
                type="button"
                onClick={() => setFilterType("pharmacy")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === "pharmacy" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                💊 Pharmacies & Medicines
              </button>
            </div>

            {/* Keyword / Specialty / Medicine Search */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={
                    filterType === "pharmacy"
                      ? "Search medicine (e.g. Paracetamol 650, Amoxicillin)..."
                      : filterType === "doctor"
                      ? "Search doctor name or specialty (e.g. Cardiology)..."
                      : filterType === "diagnostic_center"
                      ? "Search test or center (e.g. Blood Test, MRI)..."
                      : "Search any doctor, lab, or medicine..."
                  }
                  value={filterType === "pharmacy" ? medicineQuery : searchQuery}
                  onChange={(e) => {
                    if (filterType === "pharmacy") {
                      setMedicineQuery(e.target.value);
                    } else {
                      setSearchQuery(e.target.value);
                    }
                  }}
                  className="pl-8 text-xs h-9 bg-slate-50 border-slate-200"
                />
                {(searchQuery || medicineQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setMedicineQuery("");
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Radius Slider: 0 km to 18 km ────────────────────────────────────── */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Search Radius:</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                {radiusKm} km
              </span>
              <span className="text-[11px] text-slate-400">(Min: 0 km • Max: 18 km)</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-72">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">0 km</span>
              <Slider
                value={[radiusKm]}
                min={0}
                max={18}
                step={1}
                onValueChange={(vals) => setRadiusKm(vals[0])}
                className="flex-1"
              />
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">18 km</span>
            </div>
          </div>
        </div>

        {/* ── Main Discovery Area (List + Map) ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
          {/* Provider List Column */}
          <div
            ref={cardListRef}
            className="lg:col-span-5 h-full overflow-y-auto pr-1 space-y-3"
          >
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs animate-pulse space-y-3"
                  >
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-4/5" />
                  </div>
                ))}
              </div>
            ) : providers.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">No providers found in this radius</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Try expanding the search radius slider to 18 km or selecting a different location above.
                </p>
                {radiusKm < 18 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRadiusKm(18)}
                    className="text-xs gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
                  >
                    Expand to 18 km
                  </Button>
                )}
              </div>
            ) : (
              providers.map((p) => {
                const isSelected = p.id === selectedId;
                const typeCfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.doctor;
                const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${p.latitude},${p.longitude}`;

                return (
                  <div
                    id={`provider-card-${p.id}`}
                    key={`${p.type}-${p.id}`}
                    onClick={() => handleSelectProvider(p)}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${
                      isSelected
                        ? "border-violet-500 shadow-md ring-2 ring-violet-500/20 bg-violet-50/20"
                        : "border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${typeCfg.color}`}>
                          {typeCfg.emoji} {typeCfg.label}
                        </span>
                        {p.rating ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {p.rating}
                          </span>
                        ) : null}
                      </div>

                      {/* Distance Badge */}
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {fmtDist(p.distanceKm)}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mb-1">{p.name}</h3>

                    {p.specialty && (
                      <p className="text-xs text-violet-700 font-semibold mb-1">{p.specialty}</p>
                    )}

                    {p.address && (
                      <p className="text-xs text-slate-500 flex items-start gap-1 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{p.address}</span>
                      </p>
                    )}

                    {/* Matched Medicine Badge for Pharmacy */}
                    {p.matchedMedicine && (
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>In Stock: {p.matchedMedicine.medicineName}</span>
                        </div>
                        {p.matchedMedicine.price && (
                          <span className="font-bold text-emerald-900">₹{p.matchedMedicine.price}</span>
                        )}
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {p.type === "doctor" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/patient/appointments?doctorId=${p.id}`);
                          }}
                          className="h-8 text-xs font-semibold bg-primary text-white hover:bg-primary/90 flex-1"
                        >
                          Book Appointment
                        </Button>
                      )}

                      {p.type === "diagnostic_center" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/patient/diagnostic-bookings?centerId=${p.id}`);
                          }}
                          className="h-8 text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 flex-1"
                        >
                          Book Test
                        </Button>
                      )}

                      {p.type === "pharmacy" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/patient/prescriptions`);
                          }}
                          className="h-8 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex-1"
                        >
                          Order Medicine
                        </Button>
                      )}

                      {/* Get Directions Action */}
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                        title="Open in Google Maps"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        Directions
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Interactive Google Map Column */}
          <div className="lg:col-span-7 h-full">
            <GoogleMapView
              userLoc={userLoc}
              radiusKm={radiusKm}
              providers={providers}
              selectedId={selectedId}
              onSelectProvider={handleSelectProvider}
              onMapClick={handleMapClick}
              className="w-full h-full min-h-[450px]"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
