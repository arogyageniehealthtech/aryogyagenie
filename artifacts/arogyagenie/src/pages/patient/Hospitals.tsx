import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Building2,
  MapPin,
  Phone,
  Search,
  Bed,
  HeartPulse,
  Navigation,
  ShieldCheck,
  Locate,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sliders,
  CheckCircle2,
  PhoneCall,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUserLocation, fmtDist, QUICK_CITIES } from "@/hooks/useUserLocation";
import { GoogleMapView, type MapProviderItem } from "@/components/map/GoogleMapView";
import {
  HOSPITAL_SEARCH_RADIUS_KM,
  getDemoHospitalsWithinRadius,
} from "@/data/demoHospitals";
import type { HospitalItem } from "@/types/hospital";

const SPECIALTY_FILTERS = [
  "All",
  "General Medicine",
  "Cardiology",
  "Gynecology",
  "Pediatrics",
  "Emergency & Trauma",
];

export function PatientHospitals() {
  const [, setLocation] = useLocation();
  // Location hook
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

  const [radiusKm, setRadiusKm] = useState<number>(HOSPITAL_SEARCH_RADIUS_KM);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"split" | "list" | "map">("split");
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showAddressBox, setShowAddressBox] = useState(false);

  const cardListRef = useRef<HTMLDivElement | null>(null);

  // Compute hospitals strictly within the 18 km radius relative to current user coordinates
  const hospitalsInRadius = useMemo(() => {
    return getDemoHospitalsWithinRadius(userLoc.lat, userLoc.lng, radiusKm);
  }, [userLoc.lat, userLoc.lng, radiusKm]);

  // Filter by search query and specialty
  const filteredHospitals = useMemo(() => {
    return hospitalsInRadius.filter((h) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        h.departments.some((d) => d.toLowerCase().includes(q)) ||
        h.specialties.some((s) => s.name.toLowerCase().includes(q));

      const matchesSpecialty =
        selectedSpecialty === "All" ||
        h.departments.some((d) => d.toLowerCase().includes(selectedSpecialty.toLowerCase())) ||
        h.specialties.some((s) => s.name.toLowerCase().includes(selectedSpecialty.toLowerCase()));

      return matchesSearch && matchesSpecialty;
    });
  }, [hospitalsInRadius, searchQuery, selectedSpecialty]);

  // Convert strictly to GoogleMapView MapProviderItem format (hospital only)
  const mapProviders: MapProviderItem[] = useMemo(() => {
    return filteredHospitals.map((h) => ({
      id: h.id,
      type: "hospital",
      name: h.name,
      address: h.address,
      city: h.city,
      phone: h.phone,
      emergencyHelpline: h.emergencyHelpline,
      latitude: h.latitude,
      longitude: h.longitude,
      distanceKm: h.distanceKm || 0,
      rating: h.rating,
      openingHours: h.openingHours,
      availableBeds: h.availableBeds,
      totalBeds: h.totalBeds,
      departments: h.departments,
      specialties: h.specialties,
    }));
  }, [filteredHospitals]);

  // Handle marker selection from map or list
  const handleSelectHospital = (h: HospitalItem | MapProviderItem | null) => {
    if (!h) {
      setSelectedHospitalId(null);
      return;
    }
    setSelectedHospitalId(h.id);

    // Scroll to the selected hospital card if on desktop/list
    const el = document.getElementById(`hospital-card-${h.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const selectedHospital = useMemo(() => {
    return filteredHospitals.find((h) => h.id === selectedHospitalId) || null;
  }, [filteredHospitals, selectedHospitalId]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden">
        {/* ── Top Header & Location Control Bar ───────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 shrink-0 z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    ArogyaGenie Partner Hospitals
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> 0–18 km Radius
                    </Badge>
                  </h1>
                  <p className="text-xs text-slate-500">
                    Emergency-ready hospitals with real-time bed capacity and specialty care within 18 km
                  </p>
                </div>
              </div>
            </div>

            {/* Current Location & GPS Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 max-w-[280px] sm:max-w-xs truncate">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{locationName || "Detecting location..."}</span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={startLiveGPS}
                disabled={locating}
                className="h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                title="Locate using live GPS"
              >
                <Locate className={`h-3.5 w-3.5 text-blue-600 ${locating ? "animate-spin" : ""}`} />
                {locating ? "Locating..." : isLiveGps ? "Live GPS" : "My GPS"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddressBox((prev) => !prev)}
                className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
              >
                Change Area
              </Button>
            </div>
          </div>

          {/* Expandable Area Selector */}
          {showAddressBox && (
            <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-2 items-center text-xs">
              <span className="font-semibold text-slate-600 shrink-0">Quick Cities:</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {QUICK_CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      selectQuickCity(c);
                      setShowAddressBox(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-primary hover:text-primary transition-colors text-[11px] font-medium"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 w-full sm:w-auto">
                <Input
                  value={customAddressInput}
                  onChange={(e) => setCustomAddressInput(e.target.value)}
                  placeholder="Enter city or landmark..."
                  className="h-8 text-xs bg-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customAddressInput.trim()) {
                      searchAddress(customAddressInput);
                      setShowAddressBox(false);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (customAddressInput.trim()) {
                      searchAddress(customAddressInput);
                      setShowAddressBox(false);
                    }
                  }}
                  disabled={isSearchingAddress}
                  className="h-8 px-3 text-xs"
                >
                  Search
                </Button>
              </div>
            </div>
          )}

          {/* Search Bar & Specialty Filter Chips */}
          <div className="mt-3 flex flex-col md:flex-row gap-2.5 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hospital or specialty..."
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            {/* Specialty Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
              {SPECIALTY_FILTERS.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSelectedSpecialty(spec)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedSpecialty === spec
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60"
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>

            {/* Mobile View Toggle */}
            <div className="flex md:hidden items-center rounded-xl bg-slate-100 p-1 w-full justify-center">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-colors ${
                  mobileView === "list" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                List ({filteredHospitals.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileView("map")}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-colors ${
                  mobileView === "map" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                Map View
              </button>
            </div>
          </div>
        </header>

        {/* ── Main Content: Split List & Google Map ───────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* LEFT: Hospital Cards List */}
          <div
            ref={cardListRef}
            className={`w-full md:w-[440px] lg:w-[480px] shrink-0 bg-slate-50/60 border-r border-slate-200 overflow-y-auto p-4 space-y-3.5 ${
              mobileView === "map" ? "hidden md:block" : "block"
            }`}
          >
            {/* Demo Data Notice */}
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">ArogyaGenie Partner Network</span>
                <p className="text-[11px] text-emerald-800">
                  Showing {filteredHospitals.length} onboarded hospitals with simulated real-time bed capacities within the 18 km radius.
                </p>
              </div>
            </div>

            {filteredHospitals.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700 text-sm">No hospitals found within 18 km</p>
                <p className="text-xs text-slate-500">
                  Try clearing your search query or selecting a different location area.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSpecialty("All");
                  }}
                  className="text-xs mt-2"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              filteredHospitals.map((hospital) => {
                const isSelected = hospital.id === selectedHospitalId;
                return (
                  <div
                    key={hospital.id}
                    id={`hospital-card-${hospital.id}`}
                    onClick={() => handleSelectHospital(hospital)}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                        : "border-slate-200 hover:border-emerald-300 hover:shadow-xs"
                    }`}
                  >
                    {/* Header: Name, Distance & Partner Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-base hover:text-emerald-700 transition-colors">
                            {hospital.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {hospital.address}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Partner
                        </Badge>
                        <span className="text-xs font-bold text-emerald-700 font-mono">
                          {fmtDist(hospital.distanceKm || 0)} away
                        </span>
                      </div>
                    </div>

                    {/* Total Available Beds Indicator */}
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-900">Total Available Beds</span>
                      </div>
                      <span className="text-xs font-black text-emerald-800 px-2 py-0.5 rounded-md bg-white border border-emerald-200">
                        {hospital.availableBeds} / {hospital.totalBeds || 100} Beds
                      </span>
                    </div>

                    {/* Bed Breakdown by Specialty */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Specialty Bed Availability
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {hospital.specialties.map((spec, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <span className="font-medium text-slate-700 truncate pr-1">{spec.name}</span>
                            <span className="font-bold text-emerald-700 shrink-0">{spec.availableBeds} beds</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions: Direct Phone, Emergency & Map Focus */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <a
                        href={`tel:${hospital.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5 text-emerald-600" /> {hospital.phone}
                      </a>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/patient/appointments?type=clinic&hospitalId=${hospital.id}`);
                          }}
                          className="h-8 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                        >
                          Book Visit
                        </Button>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
                          title="Get directions on Google Maps"
                        >
                          <Navigation className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT: Interactive Google Map */}
          <div
            className={`flex-1 h-full min-h-[400px] relative ${
              mobileView === "list" ? "hidden md:block" : "block"
            }`}
          >
            <GoogleMapView
              userLoc={userLoc}
              radiusKm={radiusKm}
              providers={mapProviders}
              category="hospital"
              selectedId={selectedHospitalId}
              onSelectProvider={(p) => handleSelectHospital(p)}
              onMapClick={handleMapClick}
              className="w-full h-full min-h-[450px]"
            />

            {/* Map Legend Overlay */}
            <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200 shadow-md flex items-center gap-3 text-xs font-medium text-slate-700 select-none">
              <div className="flex items-center gap-1.5">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
                <span>🟢 + Hospital ({mapProviders.length})</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="flex h-3 w-3 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                <span>Your Location</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
