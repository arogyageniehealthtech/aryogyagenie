import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useListDoctors, customFetch } from "@workspace/api-client-react";
import { DOCTOR_SPECIALTIES } from "@/lib/specialties";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Search, Star, MapPin, Stethoscope, ArrowRight, Award,
  LayoutGrid, Map as MapIcon, Locate, Calendar, Navigation, Edit3, Loader2, MousePointerClick, X, Radio,
  Sliders, ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { useUserLocation, QUICK_CITIES, fmtDist } from "@/hooks/useUserLocation";
import { GoogleMapView, type MapProviderItem } from "@/components/map/GoogleMapView";

function DoctorCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100/80 shadow-xs animate-pulse">
      <div className="h-24 bg-slate-100 skeleton-shimmer" />
      <div className="pt-12 pb-5 px-5 space-y-3">
        <div className="h-5 skeleton-shimmer rounded w-3/4" />
        <div className="h-4 skeleton-shimmer rounded w-1/2" />
        <div className="space-y-2 pt-2">
          <div className="h-3.5 skeleton-shimmer rounded w-5/6" />
          <div className="h-3.5 skeleton-shimmer rounded w-2/3" />
        </div>
        <div className="pt-4 flex items-center justify-between">
          <div className="h-6 skeleton-shimmer rounded w-16" />
          <div className="h-9 skeleton-shimmer rounded-xl w-24" />
        </div>
      </div>
    </div>
  );
}

export function PatientDoctors() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawSpecialty = urlParams.get("specialty") || "all";

  const normalizedSpecialty = DOCTOR_SPECIALTIES.find(
    (s) =>
      s.toLowerCase() === rawSpecialty.toLowerCase() ||
      rawSpecialty.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(rawSpecialty.toLowerCase()),
  ) || (rawSpecialty === "all" ? "all" : rawSpecialty);

  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState(normalizedSpecialty);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [, setLocation] = useLocation();

  // Shared location hook
  const {
    userLoc,
    locationName,
    isLiveGps,
    locating,
    locError,
    startLiveGPS,
    handleMapClick,
    searchAddress: hookSearchAddress,
    selectQuickCity: hookSelectQuickCity,
    isSearchingAddress,
  } = useUserLocation();

  const [providerType, setProviderType] = useState<"all" | "doctor" | "diagnostic_center">("all");
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showAddressBox, setShowAddressBox] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10); // 2 km to 18 km
  const [nearbyDocs, setNearbyDocs] = useState<MapProviderItem[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyFetchError, setNearbyFetchError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Doctor search quick suggestions
  const DOCTOR_SUGGESTIONS = useMemo(() => [
    { title: "General Physician", category: "Specialty", subtitle: "Fever, cold, routine care & general health", icon: "🩺" },
    { title: "Cardiologist", category: "Specialty", subtitle: "Heart checkup, chest pain & blood pressure", icon: "🫀" },
    { title: "Dermatologist", category: "Specialty", subtitle: "Skin rash, acne, hair & allergy issues", icon: "🧴" },
    { title: "Pediatrician", category: "Specialty", subtitle: "Child healthcare, vaccinations & growth", icon: "👶" },
    { title: "Orthopedic", category: "Specialty", subtitle: "Bone fractures, joint pain & arthritis", icon: "🦴" },
    { title: "Neurologist", category: "Specialty", subtitle: "Migraines, headaches & nerve disorders", icon: "🧠" },
    { title: "Complete Blood Count (CBC)", category: "Diagnostic Lab", subtitle: "Pathology blood tests & infection check", icon: "🔬" },
    { title: "MRI / Digital X-Ray", category: "Diagnostic Lab", subtitle: "Radiology scan & imaging centers", icon: "🩻" },
  ], []);

  const filteredSuggestions = useMemo(() => {
    if (!search.trim()) return DOCTOR_SUGGESTIONS.slice(0, 4);
    const q = search.toLowerCase().trim();
    return DOCTOR_SUGGESTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [search, DOCTOR_SUGGESTIONS]);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // List view data query
  const { data: doctors, isLoading } = useListDoctors({
    search: search.length > 0 ? search : undefined,
    specialty: specialty !== "all" ? specialty : undefined,
  });

  const searchAddress = useCallback(
    async (queryAddress: string) => {
      const found = await hookSearchAddress(queryAddress);
      if (found) setShowAddressBox(false);
    },
    [hookSearchAddress],
  );

  const selectQuickCity = useCallback(
    (city: (typeof QUICK_CITIES)[number]) => {
      hookSelectQuickCity(city);
      setShowAddressBox(false);
    },
    [hookSelectQuickCity],
  );

  // Fetch nearby providers for Map View from backend PostGIS
  const fetchNearbyDoctors = useCallback(async () => {
    setLoadingNearby(true);
    setNearbyFetchError(null);
    try {
      const params = new URLSearchParams({
        lat: userLoc.lat.toString(),
        lng: userLoc.lng.toString(),
        radius: radiusKm.toString(),
        type: providerType,
        ...(specialty !== "all" ? { specialty } : {}),
        ...(search ? { search } : {}),
      });
      const data = await customFetch<{ results: MapProviderItem[] }>(`/api/nearby?${params}`);
      setNearbyDocs(data?.results || []);
    } catch (err: any) {
      setNearbyDocs([]);
      setNearbyFetchError(err?.message || "Failed to fetch nearby medical providers. Please ensure the backend server is running.");
    } finally {
      setLoadingNearby(false);
    }
  }, [userLoc.lat, userLoc.lng, radiusKm, providerType, specialty, search]);

  useEffect(() => {
    if (viewMode === "map") {
      fetchNearbyDoctors();
    }
  }, [viewMode, userLoc.lat, userLoc.lng, radiusKm, providerType, specialty, search, fetchNearbyDoctors]);

  const handleSelectDoctor = useCallback((doc: MapProviderItem | null) => {
    setSelectedDocId(doc ? doc.id : null);
    if (doc) {
      const el = document.getElementById(`doc-list-item-${doc.type}-${doc.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-primary" />
              Find Doctors
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Search verified medical specialists near you.</p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-slate-200/80">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "grid"
                  ? "bg-white text-violet-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              List View
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "map"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Map View
            </button>
          </div>
        </div>

        {/* Search & Specialty Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1" ref={searchContainerRef}>
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by doctor name, specialty, clinic..."
                className="pl-10 pr-8 h-11 rounded-xl bg-white border-slate-200/80 shadow-xs focus-visible:ring-violet-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Suggestions Dropdown Popup */}
              {isSearchFocused && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Suggested Options ({filteredSuggestions.length})
                    </span>
                    <span className="text-[10px] text-violet-600 font-medium">Click to select</span>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {filteredSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearch(item.title);
                          setIsSearchFocused(false);
                        }}
                        className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-violet-50/80 transition-colors group cursor-pointer"
                      >
                        <span className="text-xl shrink-0 p-1 bg-slate-100 rounded-lg group-hover:bg-violet-100 transition-colors">
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-violet-700">
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

            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="w-full sm:w-[240px] h-11 rounded-xl bg-white border-slate-200/80 shadow-xs">
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] rounded-xl">
                <SelectItem value="all">All Specialties</SelectItem>
                {DOCTOR_SPECIALTIES.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Option Pill Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Quick Options:
            </span>
            {["General Physician", "Cardiologist", "Dermatologist", "Pediatrician", "Orthopedic"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSearch(search === opt ? "" : opt)}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all border ${
                  search === opt
                    ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* ── View Toggle: Map vs Grid ────────────────────────────────────────── */}
        {viewMode === "map" ? (
          <div className="space-y-4">
            {/* Radius & Location Settings Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Provider Type Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setProviderType("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      providerType === "all"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ✨ All Care ({nearbyDocs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderType("doctor")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      providerType === "doctor"
                        ? "bg-violet-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-violet-700"
                    }`}
                  >
                    🩺 Doctors
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderType("diagnostic_center")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      providerType === "diagnostic_center"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-sky-700"
                    }`}
                  >
                    🔬 Diagnostic Labs
                  </button>
                </div>

                {/* Location Display & Live GPS Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
                    <span className={`h-2 w-2 rounded-full ${isLiveGps ? "bg-emerald-500 animate-pulse" : "bg-primary"}`} />
                    <span className="font-medium truncate max-w-[150px]">{locationName}</span>
                    <button
                      onClick={() => setShowAddressBox((s) => !s)}
                      className="text-violet-600 hover:underline font-bold ml-1 cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3 inline" />
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant={isLiveGps ? "default" : "outline"}
                    onClick={startLiveGPS}
                    disabled={locating}
                    className={`h-8 text-xs rounded-xl gap-1 font-bold ${isLiveGps ? "bg-emerald-600 text-white" : ""}`}
                  >
                    {locating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isLiveGps ? (
                      <Radio className="h-3.5 w-3.5 animate-pulse text-white" />
                    ) : (
                      <Locate className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    {isLiveGps ? "Live GPS" : "GPS"}
                  </Button>
                </div>
              </div>

              {/* Radius Controls: Slider & Quick Milestone Pills */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 max-w-md">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>Radius:</span>
                    <span className="font-bold text-violet-700 px-2 py-0.5 rounded bg-violet-50 border border-violet-200">
                      {radiusKm} km
                    </span>
                  </div>
                  <Slider
                    value={[radiusKm]}
                    min={0}
                    max={18}
                    step={1}
                    onValueChange={(v) => setRadiusKm(v[0])}
                    className="flex-1"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0 font-medium">18 km max</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-400">Quick Range:</span>
                  {[
                    { label: "2 km (Near Me)", val: 2 },
                    { label: "5 km", val: 5 },
                    { label: "10 km", val: 10 },
                    { label: "18 km (Full Area)", val: 18 },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setRadiusKm(m.val)}
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all border ${
                        radiusKm === m.val
                          ? "bg-violet-600 text-white border-violet-600 shadow-2xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-violet-50 hover:text-violet-700"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {showAddressBox && (
                <div className="pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                  <div className="flex gap-2">
                    <input
                      placeholder="Enter city or area (e.g. Salt Lake, Kolkata)..."
                      value={customAddressInput}
                      onChange={(e) => setCustomAddressInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") searchAddress(customAddressInput);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
                    />
                    <Button
                      size="sm"
                      onClick={() => searchAddress(customAddressInput)}
                      disabled={isSearchingAddress || !customAddressInput.trim()}
                      className="h-8 text-xs font-bold bg-violet-600 text-white rounded-xl"
                    >
                      {isSearchingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set Location"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] font-semibold text-slate-400">Quick Select:</span>
                    {QUICK_CITIES.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => selectQuickCity(c)}
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-700 transition-all border border-slate-200/60"
                      >
                        📍 {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Split List & Google Map View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[560px] lg:h-[560px]">
              {/* Doctor / Lab List Column */}
              <div className="lg:col-span-5 max-h-[380px] lg:max-h-full overflow-y-auto pr-1 space-y-3">
                <div className="p-3 border-b border-slate-100 bg-white rounded-xl flex items-center justify-between shadow-2xs sticky top-0 z-10">
                  <p className="text-xs font-bold text-slate-700">
                    Providers within {radiusKm} km ({nearbyDocs.length})
                  </p>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" /> Click pin to inspect
                  </span>
                </div>

                {loadingNearby ? (
                  <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="font-medium">Searching verified healthcare providers near you...</span>
                  </div>
                ) : nearbyFetchError ? (
                  <div className="p-6 rounded-2xl bg-white border border-rose-200 text-center space-y-2 shadow-2xs">
                    <p className="text-sm font-semibold text-rose-700">{nearbyFetchError}</p>
                    <p className="text-xs text-slate-500">Please check your connection and retry.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fetchNearbyDoctors()}
                      className="text-xs border-slate-200"
                    >
                      Retry Discovery
                    </Button>
                  </div>
                ) : nearbyDocs.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2 shadow-2xs">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No medical providers found within {radiusKm} km</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Try expanding the search radius slider up to 18 km or selecting a different location.
                    </p>
                    {radiusKm < 18 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRadiusKm(18)}
                        className="text-xs border-violet-200 text-violet-700 hover:bg-violet-50 font-bold"
                      >
                        Expand to 18 km
                      </Button>
                    )}
                  </div>
                ) : (
                  nearbyDocs.map((doc) => {
                    const isSelected = selectedDocId === doc.id;
                    const isDoctor = doc.type === "doctor";
                    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${doc.latitude},${doc.longitude}`;

                    return (
                      <div
                        id={`doc-list-item-${doc.type}-${doc.id}`}
                        key={`${doc.type}-${doc.id}`}
                        onClick={() => handleSelectDoctor(doc)}
                        className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? isDoctor
                              ? "bg-red-50/80 border-red-500 shadow-xs ring-2 ring-red-500/20"
                              : "bg-sky-50/80 border-sky-500 shadow-xs ring-2 ring-sky-500/20"
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isDoctor
                                    ? "bg-red-100 text-red-700"
                                    : "bg-sky-100 text-sky-700"
                                }`}
                              >
                                {isDoctor ? "🩺 Doctor" : "🔬 Diagnostic Lab"}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-900">{doc.name}</h4>
                            {doc.specialty && (
                              <p className="text-xs text-red-600 font-semibold mt-0.5">{doc.specialty}</p>
                            )}
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                            {fmtDist(doc.distanceKm)}
                          </span>
                        </div>

                        {doc.address && (
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate">{doc.address}</span>
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {doc.rating || "4.8"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={directionsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title="Directions"
                            >
                              <Navigation className="w-3 h-3 text-blue-600" />
                              Directions
                            </a>

                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isDoctor) {
                                  setLocation(`/patient/appointments?doctorId=${doc.id}`);
                                } else {
                                  setLocation(`/patient/diagnostic-bookings?centerId=${doc.id}`);
                                }
                              }}
                              className={`h-7 text-xs font-semibold rounded-lg px-3 text-white ${
                                isDoctor ? "bg-red-600 hover:bg-red-700" : "bg-sky-600 hover:bg-sky-700"
                              }`}
                            >
                              {isDoctor ? "Book Visit" : "Book Test"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Google Map Column */}
              <div className="lg:col-span-7 h-[360px] sm:h-[450px] lg:h-full">
                <GoogleMapView
                  userLoc={userLoc}
                  radiusKm={radiusKm}
                  providers={nearbyDocs}
                  selectedId={selectedDocId}
                  onSelectProvider={handleSelectDoctor}
                  onMapClick={handleMapClick}
                  className="w-full h-full min-h-[360px] sm:min-h-[450px] lg:min-h-[500px]"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── Grid View ────────────────────────────────────────────────────────── */
          isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <DoctorCardSkeleton key={i} />
              ))}
            </div>
          ) : doctors?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "hsl(243,75%,97%)" }}
              >
                <Stethoscope className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">No doctors found</h3>
              <p className="text-sm text-slate-500 max-w-xs mb-4">
                We couldn't find any doctors matching your current search or specialty filter.
              </p>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setSearch("");
                  setSpecialty("all");
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {doctors?.map((doc) => {
                const initials = `${doc.firstName?.[0] || ""}${doc.lastName?.[0] || ""}`.toUpperCase() || "DR";
                const rating = doc.rating || "4.8";
                const fee = doc.consultationFee || 500;
                const clinic = doc.clinicName || "ArogyaGenie Medical Center";
                const city = doc.clinicAddress || "Kolkata";
                const exp = doc.experience || "10+";

                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-100/90 shadow-xs hover:shadow-md transition-all duration-180 flex flex-col justify-between group"
                  >
                    <div>
                      <div
                        className="h-24 relative p-4"
                        style={{
                          background: "linear-gradient(135deg, hsl(243,75%,96%), hsl(260,70%,93%))",
                        }}
                      >
                        <div className="absolute -bottom-9 left-5 h-18 w-18 rounded-2xl border-4 border-white bg-white overflow-hidden shadow-xs flex items-center justify-center shrink-0">
                          {doc.avatarUrl ? (
                            <img src={doc.avatarUrl} alt={doc.firstName} className="h-full w-full object-cover" />
                          ) : (
                            <div
                              className="h-full w-full flex items-center justify-center font-bold text-lg text-white"
                              style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}
                            >
                              {initials}
                            </div>
                          )}
                        </div>

                        <div className="absolute top-3.5 right-3.5 bg-white/90 backdrop-blur-xs text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs border border-amber-200/60 text-amber-800">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                          {rating}
                        </div>
                      </div>

                      <div className="pt-12 pb-4 px-5 space-y-3">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                            Dr. {doc.firstName} {doc.lastName}
                          </h3>
                          <span
                            className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1"
                            style={{ background: "hsl(243,75%,96%)", color: "hsl(243,75%,50%)" }}
                          >
                            {doc.specialty}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-500 pt-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {clinic}, {city}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Award className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{exp} years experience</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between mt-auto">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fee</span>
                        <span className="font-bold text-slate-900 text-base">₹{fee}</span>
                      </div>
                      <Button
                        onClick={() => setLocation(`/patient/appointments?doctorId=${doc.id}`)}
                        size="sm"
                        className="rounded-xl gap-1.5 font-semibold text-xs h-9 px-4 shadow-2xs"
                        style={{
                          background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                          border: "none",
                          color: "white",
                        }}
                      >
                        Book Visit
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
