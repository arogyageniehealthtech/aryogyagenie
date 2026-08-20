import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import {
  MapPin, Stethoscope, Pill, TestTube, Locate, AlertCircle,
  Navigation, ExternalLink, Phone, Star, Search, X,
  Loader2, Calendar, Edit3, Check, CheckCircle2, ChevronRight,
  Sliders, ShieldCheck, Sparkles, Building2, Bed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useLocation } from "wouter";

import { useUserLocation, QUICK_CITIES, fmtDist } from "@/hooks/useUserLocation";
import { GoogleMapView, type MapProviderItem } from "@/components/map/GoogleMapView";
import { RequestMedicineModal } from "@/components/delivery/RequestMedicineModal";

type FilterType = "all" | "doctor" | "hospital" | "diagnostic_center" | "pharmacy";

const TYPE_CONFIG = {
  doctor: {
    label: "Doctor",
    emoji: "🩺",
    color: "bg-red-50 text-red-700 border-red-200",
    badgeColor: "bg-red-600 text-white",
  },
  hospital: {
    label: "Hospital",
    emoji: "🏥",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeColor: "bg-emerald-600 text-white",
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
    color: "bg-teal-50 text-teal-700 border-teal-200",
    badgeColor: "bg-teal-600 text-white",
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Results State
  const [providers, setProviders] = useState<MapProviderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<"split" | "map" | "list">("split");
  const [orderPharmacy, setOrderPharmacy] = useState<{ id: number; name: string; medicine?: string } | null>(null);
  const cardListRef = useRef<HTMLDivElement | null>(null);

  // Discovery quick options catalog
  const NEARBY_SUGGESTIONS = useMemo(() => ({
    doctor: [
      { title: "General Physician", category: "Specialty", subtitle: "Fever, cold, routine checkup & general health", icon: "🩺", type: "doctor" },
      { title: "Cardiologist", category: "Specialty", subtitle: "Heart care, blood pressure & ECG", icon: "🫀", type: "doctor" },
      { title: "Dermatologist", category: "Specialty", subtitle: "Skin rash, acne & allergies", icon: "🧴", type: "doctor" },
      { title: "Pediatrician", category: "Specialty", subtitle: "Child healthcare & wellness", icon: "👶", type: "doctor" },
      { title: "Orthopedic", category: "Specialty", subtitle: "Bone fractures & joint pain", icon: "🦴", type: "doctor" },
    ],
    hospital: [
      { title: "Emergency & Trauma Care", category: "Emergency", subtitle: "24x7 Ambulance, ICU & urgent admission", icon: "🚨", type: "hospital" },
      { title: "Cardiology & CCU", category: "Specialty Hospital", subtitle: "Cardiac care, heart surgery & CCU beds", icon: "🫀", type: "hospital" },
      { title: "General Medicine & Inpatient", category: "Beds Available", subtitle: "Round-the-clock hospital admission & ward care", icon: "🏥", type: "hospital" },
      { title: "Obstetrics & Maternity", category: "Maternity", subtitle: "Delivery suites, NICU & labor rooms", icon: "👶", type: "hospital" },
      { title: "Neurology & Stroke Unit", category: "Specialty Hospital", subtitle: "Advanced neuro care & emergency stroke ICU", icon: "🧠", type: "hospital" },
    ],
    diagnostic_center: [
      { title: "Complete Blood Count (CBC)", category: "Lab Test", subtitle: "Hemoglobin, platelets & infections", icon: "🩸", type: "diagnostic_center" },
      { title: "Lipid Profile", category: "Lab Test", subtitle: "Cholesterol & triglyceride panel", icon: "🫀", type: "diagnostic_center" },
      { title: "Thyroid Profile (T3, T4, TSH)", category: "Lab Test", subtitle: "Hormone level checkup", icon: "🧬", type: "diagnostic_center" },
      { title: "MRI Scan", category: "Radiology", subtitle: "Brain, spine & joint imaging", icon: "🧠", type: "diagnostic_center" },
      { title: "Digital Chest X-Ray", category: "Radiology", subtitle: "Lungs & chest examination", icon: "🩻", type: "diagnostic_center" },
    ],
    pharmacy: [
      { title: "Paracetamol 650", category: "Medicine", subtitle: "Pain relief & antipyretic for fever", icon: "💊", type: "pharmacy" },
      { title: "Dolo 650", category: "Medicine", subtitle: "Fast fever and body ache relief", icon: "💊", type: "pharmacy" },
      { title: "Amoxicillin 500mg", category: "Antibiotic", subtitle: "Broad-spectrum bacterial infection capsule", icon: "💊", type: "pharmacy" },
      { title: "Pantoprazole 40mg", category: "Antacid", subtitle: "Acidity, GERD & gastric relief", icon: "💊", type: "pharmacy" },
      { title: "Cetirizine 10mg", category: "Antihistamine", subtitle: "Allergy, sneezing & runny nose", icon: "💊", type: "pharmacy" },
      { title: "Azithromycin 500mg", category: "Antibiotic", subtitle: "Throat & chest infection tablet", icon: "💊", type: "pharmacy" },
    ],
  }), []);

  const currentSuggestions = useMemo(() => {
    const activeText = filterType === "pharmacy" ? medicineQuery : searchQuery;
    const q = activeText.toLowerCase().trim();

    let pool: Array<{ title: string; category: string; subtitle: string; icon: string; type: string }> = [];
    if (filterType === "doctor") pool = NEARBY_SUGGESTIONS.doctor;
    else if (filterType === "hospital") pool = NEARBY_SUGGESTIONS.hospital;
    else if (filterType === "diagnostic_center") pool = NEARBY_SUGGESTIONS.diagnostic_center;
    else if (filterType === "pharmacy") pool = NEARBY_SUGGESTIONS.pharmacy;
    else {
      pool = [
        ...NEARBY_SUGGESTIONS.doctor.slice(0, 2),
        ...NEARBY_SUGGESTIONS.hospital.slice(0, 2),
        ...NEARBY_SUGGESTIONS.diagnostic_center.slice(0, 2),
        ...NEARBY_SUGGESTIONS.pharmacy.slice(0, 2),
      ];
    }

    if (!q) return pool.slice(0, 4);
    return pool.filter((s) => s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)).slice(0, 5);
  }, [filterType, searchQuery, medicineQuery, NEARBY_SUGGESTIONS]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

        const data = await customFetch<{ results: MapProviderItem[] }>(`/api/nearby?${params}`);
        setProviders(data?.results || []);
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

  // Log live medicine search demand to nearby pharmacies (debounced)
  useEffect(() => {
    const med = medicineQuery.trim() || (filterType === "pharmacy" ? searchQuery.trim() : "");
    if (!med || med.length < 3) return;

    const timer = setTimeout(() => {
      customFetch("/api/medicine-orders/search-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineName: med,
          lat: userLoc.lat,
          lng: userLoc.lng,
          address: locationName,
        }),
      }).catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, [medicineQuery, searchQuery, filterType, userLoc.lat, userLoc.lng, locationName]);

  // Scroll to selected card when selected on map
  const handleSelectProvider = useCallback((provider: MapProviderItem | null) => {
    setSelectedId(provider ? provider.id : null);
    if (provider) {
      const el = document.getElementById(`provider-card-${provider.type}-${provider.id}`);
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
              Locate verified doctors, hospitals, diagnostic labs, and medicine-stocked pharmacies within {radiusKm} km.
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
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 transition-colors"
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
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
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
                  filterType === "doctor" ? "bg-red-600 text-white shadow-xs" : "text-slate-600 hover:text-red-700"
                }`}
              >
                🩺 Doctors
              </button>
              <button
                type="button"
                onClick={() => setFilterType("hospital")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === "hospital" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                🏥 Hospitals
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
                  filterType === "pharmacy" ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-teal-700"
                }`}
              >
                💊 Pharmacies & Medicines
              </button>
            </div>

            {/* Keyword / Specialty / Medicine Search */}
            <div className="flex items-center gap-2 flex-1 max-w-md" ref={searchContainerRef}>
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={
                    filterType === "pharmacy"
                      ? "Search medicine (e.g. Paracetamol 650, Amoxicillin)..."
                      : filterType === "doctor"
                      ? "Search doctor name or specialty (e.g. Cardiology)..."
                      : filterType === "hospital"
                      ? "Search hospital, emergency or departments (e.g. ICU, Trauma)..."
                      : filterType === "diagnostic_center"
                      ? "Search test or center (e.g. Blood Test, MRI)..."
                      : "Search any doctor, hospital, lab, or medicine..."
                  }
                  value={filterType === "pharmacy" ? medicineQuery : searchQuery}
                  onChange={(e) => {
                    if (filterType === "pharmacy") {
                      setMedicineQuery(e.target.value);
                    } else {
                      setSearchQuery(e.target.value);
                    }
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  className="pl-8 pr-8 text-xs h-9 bg-slate-50 border-slate-200"
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

                {/* Suggestions Dropdown */}
                {isSearchFocused && currentSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                        Suggested Options ({currentSuggestions.length})
                      </span>
                      <span className="text-[10px] text-red-600 font-medium">Click to select</span>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {currentSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (item.type === "pharmacy" || filterType === "pharmacy") {
                              setMedicineQuery(item.title);
                            } else {
                              setSearchQuery(item.title);
                            }
                            setIsSearchFocused(false);
                          }}
                          className="w-full flex items-start gap-3 p-2 rounded-xl text-left hover:bg-red-50/80 transition-colors group cursor-pointer"
                        >
                          <span className="text-lg shrink-0 p-1 bg-slate-100 rounded-lg group-hover:bg-red-100 transition-colors">
                            {item.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 group-hover:text-red-700">
                                {item.title}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                {item.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Option Pills by Tab */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Popular Options:
            </span>
            {(filterType === "pharmacy"
              ? ["Paracetamol 650", "Dolo 650", "Amoxicillin 500mg", "Pantoprazole 40mg", "Cetirizine 10mg"]
              : filterType === "hospital"
              ? ["Emergency & Trauma", "Cardiology & ICU", "General Medicine", "Gynecology & Maternity", "Orthopedics"]
              : filterType === "diagnostic_center"
              ? ["Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Profile", "MRI Scan", "X-Ray"]
              : filterType === "doctor"
              ? ["General Physician", "Cardiologist", "Dermatologist", "Pediatrician", "Orthopedic"]
              : ["General Physician", "Emergency & Trauma", "Complete Blood Count", "Paracetamol 650", "Cardiologist"]
            ).map((opt) => {
              const isActive = (filterType === "pharmacy" ? medicineQuery : searchQuery) === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (filterType === "pharmacy") {
                      setMedicineQuery(medicineQuery === opt ? "" : opt);
                    } else {
                      setSearchQuery(searchQuery === opt ? "" : opt);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all border ${
                    isActive
                      ? filterType === "doctor"
                        ? "bg-red-600 text-white border-red-600 shadow-xs"
                        : filterType === "hospital"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-primary text-white border-primary shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {/* ── Radius Slider: 0 km to 18 km ────────────────────────────────────── */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Search Radius:</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                {radiusKm} km
              </span>
              <span className="text-[11px] text-slate-400">(Min: 0 km • Max: 18 km)</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 w-56">
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

              <div className="flex items-center gap-1">
                {[
                  { label: "2 km", val: 2 },
                  { label: "5 km", val: 5 },
                  { label: "10 km", val: 10 },
                  { label: "18 km", val: 18 },
                ].map((m) => (
                  <button
                    key={m.val}
                    type="button"
                    onClick={() => setRadiusKm(m.val)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all border ${
                      radiusKm === m.val
                        ? "bg-primary text-white border-primary shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Discovery Area (List + Map) ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[560px] lg:h-[calc(100vh-280px)]">
          {/* Provider List Column */}
          <div
            ref={cardListRef}
            className="lg:col-span-5 max-h-[380px] lg:max-h-full overflow-y-auto pr-1 space-y-3"
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
                    className="text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
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
                    id={`provider-card-${p.type}-${p.id}`}
                    key={`${p.type}-${p.id}`}
                    onClick={() => handleSelectProvider(p)}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${
                      isSelected
                        ? p.type === "doctor"
                          ? "border-red-500 shadow-md ring-2 ring-red-500/20 bg-red-50/20"
                          : p.type === "hospital"
                          ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/20 bg-emerald-50/20"
                          : p.type === "diagnostic_center"
                          ? "border-sky-500 shadow-md ring-2 ring-sky-500/20 bg-sky-50/20"
                          : "border-teal-500 shadow-md ring-2 ring-teal-500/20 bg-teal-50/20"
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
                      <p className="text-xs text-red-700 font-semibold mb-1">{p.specialty}</p>
                    )}

                    {/* Hospital Bed Availability Badge */}
                    {p.type === "hospital" && typeof p.availableBeds === "number" && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium mb-2 border border-emerald-200/60">
                        <Bed className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span><strong>{p.availableBeds}</strong> Available Beds {p.totalBeds ? `(out of ${p.totalBeds})` : ""}</span>
                      </div>
                    )}

                    {/* Hospital Departments */}
                    {p.type === "hospital" && p.departments && p.departments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {p.departments.slice(0, 3).map((dept) => (
                          <span key={dept} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                            {dept}
                          </span>
                        ))}
                        {p.departments.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                            +{p.departments.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {p.address && (
                      <p className="text-xs text-slate-500 flex items-start gap-1 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{p.address}</span>
                      </p>
                    )}

                    {/* Matched Medicine Badge for Pharmacy */}
                    {p.matchedMedicine && (
                      <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>In Stock: {p.matchedMedicine.medicineName}</span>
                        </div>
                        {p.matchedMedicine.price && (
                          <span className="font-bold text-teal-900">₹{p.matchedMedicine.price}</span>
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
                          className="h-8 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 flex-1"
                        >
                          Book Appointment
                        </Button>
                      )}

                      {p.type === "hospital" && (
                        <div className="flex items-center gap-1.5 flex-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/patient/hospitals`);
                            }}
                            className="h-8 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex-1"
                          >
                            View Hospital
                          </Button>
                          {(p.emergencyHelpline || p.phone) && (
                            <a
                              href={`tel:${p.emergencyHelpline || p.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold shrink-0"
                              title="Call Emergency Helpline"
                            >
                              <Phone className="w-3.5 h-3.5 text-red-600" />
                              Helpline
                            </a>
                          )}
                        </div>
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
                            setOrderPharmacy({
                              id: p.id,
                              name: p.name,
                              medicine: p.matchedMedicine?.medicineName || "",
                            });
                          }}
                          className="h-8 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 flex-1"
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
          <div className="lg:col-span-7 h-[360px] sm:h-[450px] lg:h-full">
            <GoogleMapView
              userLoc={userLoc}
              radiusKm={radiusKm}
              providers={providers}
              selectedId={selectedId}
              onSelectProvider={handleSelectProvider}
              onMapClick={handleMapClick}
              className="w-full h-full min-h-[360px] sm:min-h-[450px] lg:min-h-[450px]"
            />
          </div>
        </div>
      </div>

      {/* Request Medicine Modal */}
      {orderPharmacy && (
        <RequestMedicineModal
          isOpen={Boolean(orderPharmacy)}
          onClose={() => setOrderPharmacy(null)}
          pharmacyId={orderPharmacy.id}
          pharmacyName={orderPharmacy.name}
          defaultMedicines={orderPharmacy.medicine || ""}
        />
      )}
    </DashboardLayout>
  );
}

