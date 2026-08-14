import { useState, useEffect, useCallback, useRef } from "react";
import { useListDoctors } from "@workspace/api-client-react";
import { DOCTOR_SPECIALTIES } from "@/lib/specialties";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Search, Star, MapPin, Stethoscope, ArrowRight, Award,
  LayoutGrid, Map as MapIcon, Locate, Calendar, Navigation,
} from "lucide-react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { divIcon, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const RADIUS_STEPS = [2, 4, 6, 8, 10, 12, 14, 16]; // km

function makeDoctorPin(selected = false) {
  const sz = selected ? 46 : 38;
  return divIcon({
    html: `
      <div style="
        position:relative;
        width:${sz}px; height:${sz}px;
        background:white;
        border:3px solid #7C3AED;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 ${selected ? 8 : 4}px ${selected ? 24 : 12}px rgba(124,58,237,${selected ? 0.4 : 0.25});
        display:flex; align-items:center; justify-content:center;
        transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
      ">
        <span style="transform:rotate(45deg); font-size:${selected ? 22 : 18}px; line-height:1;">
          🩺
        </span>
      </div>`,
    className: "",
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz],
    popupAnchor: [0, -sz],
  });
}

function makePatientPin() {
  return divIcon({
    html: `
      <div style="position:relative; width:24px; height:24px;">
        <div style="
          position:absolute; top:50%; left:50%;
          transform: translate(-50%, -50%);
          width:40px; height:40px;
          background: rgba(59,130,246,0.2);
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
          box-shadow: 0 2px 10px rgba(59,130,246,0.5);
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

function MapFly({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.9 });
  }, [lat, lng, zoom, map]);
  return null;
}

// ─── Doctor Card Skeleton ───────────────────────────────────────────────────
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

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientDoctors() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawSpecialty = urlParams.get("specialty") || "all";
  
  const normalizedSpecialty = DOCTOR_SPECIALTIES.find(s => 
    s.toLowerCase() === rawSpecialty.toLowerCase() ||
    rawSpecialty.toLowerCase().includes(s.toLowerCase()) ||
    s.toLowerCase().includes(rawSpecialty.toLowerCase())
  ) || (rawSpecialty === "all" ? "all" : rawSpecialty);

  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState(normalizedSpecialty);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [, setLocation] = useLocation();

  // Map state
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [radiusIdx, setRadiusIdx] = useState(3); // default 8 km
  const [nearbyDocs, setNearbyDocs] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const radiusKm = RADIUS_STEPS[radiusIdx];

  const { data: doctors, isLoading } = useListDoctors({
    search: search.length > 0 ? search : undefined,
    specialty: specialty !== "all" ? specialty : undefined
  });

  // GPS Locate
  const locateUser = useCallback(() => {
    setLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    locateUser();
  }, [locateUser]);

  // Fetch nearby doctors for map view
  const fetchNearbyDoctors = useCallback(async () => {
    if (!userLoc) return;
    setLoadingNearby(true);
    try {
      const params = new URLSearchParams({
        lat: userLoc.lat.toString(),
        lng: userLoc.lng.toString(),
        radius: radiusKm.toString(),
        type: "doctor",
        ...(specialty !== "all" ? { search: specialty } : {}),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/nearby?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNearbyDocs(data.results || []);
      }
    } catch {
      setNearbyDocs([]);
    } finally {
      setLoadingNearby(false);
    }
  }, [userLoc, radiusKm, specialty, search]);

  useEffect(() => {
    if (viewMode === "map" && userLoc) {
      fetchNearbyDoctors();
    }
  }, [viewMode, userLoc, radiusKm, specialty, search, fetchNearbyDoctors]);

  const defaultCenter: LatLngExpression = userLoc
    ? [userLoc.lat, userLoc.lng]
    : [22.5726, 88.3639]; // Default Metro center

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Page Header & View Toggle ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Find Doctors</h1>
            <p className="text-sm text-slate-500 mt-0.5">Search verified medical specialists near you.</p>
          </div>

          {/* View Toggle Switch */}
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
              onClick={() => {
                setViewMode("map");
                if (!userLoc) locateUser();
              }}
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

        {/* ── Search & Filter Bar ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by doctor name, specialty, clinic..." 
                className="pl-10 h-11 rounded-xl bg-white border-slate-200/80 shadow-xs focus-visible:ring-violet-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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

          {/* Specialty Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {["all", "General Physician", "Cardiologist", "Dermatologist", "Neurologist", "Pediatrician", "Orthopedist"].map((chip) => {
              const isSelected = specialty.toLowerCase() === chip.toLowerCase();
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSpecialty(chip)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                    isSelected
                      ? "bg-violet-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-700"
                  }`}
                >
                  {chip === "all" ? "All" : chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MAP VIEW MODE ─────────────────────────────────────────────────── */}
        {viewMode === "map" ? (
          <div className="space-y-3">
            {/* Radius Slider Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-500 shrink-0">Radius Range:</span>
                <input
                  type="range"
                  min={0}
                  max={RADIUS_STEPS.length - 1}
                  step={1}
                  value={radiusIdx}
                  onChange={(e) => setRadiusIdx(Number(e.target.value))}
                  className="w-full sm:w-48 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #7C3AED ${(radiusIdx / (RADIUS_STEPS.length - 1)) * 100}%, #E2E8F0 0%)`,
                    accentColor: "#7C3AED",
                  }}
                />
                <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold shrink-0">
                  {radiusKm} km
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs text-slate-500 font-medium">
                  {loadingNearby ? "Locating doctors..." : `${nearbyDocs.length} doctor(s) found near you`}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={locateUser}
                  disabled={locating}
                  className="h-8 text-xs rounded-xl gap-1"
                >
                  <Locate className="h-3.5 w-3.5 text-blue-500" />
                  {locating ? "Locating..." : "My Location"}
                </Button>
              </div>
            </div>

            {/* Map & Doctor List Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[550px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              {/* Doctor Cards Sidebar */}
              <div className="lg:col-span-1 border-r border-slate-100 flex flex-col h-full bg-slate-50/50">
                <div className="p-3 border-b border-slate-100 bg-white">
                  <p className="text-xs font-bold text-slate-500">
                    Doctors within {radiusKm} km
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {loadingNearby ? (
                    <div className="py-12 text-center text-xs text-slate-400">Loading nearby doctors...</div>
                  ) : nearbyDocs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <p className="text-sm font-semibold">No doctors within {radiusKm} km</p>
                      <p className="text-xs max-w-xs mx-auto text-slate-400">Try expanding the range slider above or selecting "All Specialties".</p>
                    </div>
                  ) : (
                    nearbyDocs.map((doc) => {
                      const isSelected = selectedDocId === doc.id;
                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            if (mapRef.current) {
                              mapRef.current.flyTo([doc.latitude, doc.longitude], 15);
                            }
                          }}
                          className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-violet-50/80 border-violet-500 shadow-xs"
                              : "bg-white border-slate-200/80 hover:border-violet-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-slate-900">{doc.name}</h4>
                              <p className="text-xs text-violet-600 font-semibold">{doc.specialty}</p>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">
                              {doc.distanceKm < 1 ? `${Math.round(doc.distanceKm * 1000)}m` : `${doc.distanceKm.toFixed(1)} km`}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate">{doc.address}</span>
                          </p>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                            <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {doc.rating || "4.8"}
                            </span>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/patient/appointments?doctorId=${doc.id}`);
                              }}
                              className="h-7 text-xs font-semibold rounded-lg px-3 bg-violet-600 text-white"
                            >
                              Book Visit
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Interactive Map View */}
              <div className="lg:col-span-2 relative h-full">
                <MapContainer
                  center={defaultCenter}
                  zoom={userLoc ? 12 : 6}
                  style={{ height: "100%", width: "100%", zIndex: 0 }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {userLoc && <MapFly lat={userLoc.lat} lng={userLoc.lng} zoom={13} />}

                  {/* Patient Location Marker */}
                  {userLoc && (
                    <>
                      <Marker position={[userLoc.lat, userLoc.lng]} icon={makePatientPin()}>
                        <Popup>📍 Your Location</Popup>
                      </Marker>
                      <Circle
                        center={[userLoc.lat, userLoc.lng]}
                        radius={radiusKm * 1000}
                        pathOptions={{
                          color: "#7C3AED",
                          fillColor: "#7C3AED",
                          fillOpacity: 0.05,
                          weight: 1.5,
                          dashArray: "6 4",
                        }}
                      />
                    </>
                  )}

                  {/* Doctor Markers */}
                  {nearbyDocs.map((doc) => (
                    <Marker
                      key={doc.id}
                      position={[doc.latitude, doc.longitude]}
                      icon={makeDoctorPin(selectedDocId === doc.id)}
                      eventHandlers={{ click: () => setSelectedDocId(doc.id) }}
                    >
                      <Popup>
                        <div className="min-w-[160px]">
                          <p className="font-bold text-sm text-slate-900">{doc.name}</p>
                          <p className="text-xs text-violet-600 font-semibold">{doc.specialty}</p>
                          <p className="text-xs text-slate-500 mt-1">📍 {doc.address}</p>
                          <p className="text-xs font-bold text-blue-600 mt-1">
                            {doc.distanceKm < 1 ? `${Math.round(doc.distanceKm * 1000)}m away` : `${doc.distanceKm.toFixed(1)} km away`}
                          </p>
                          <button
                            onClick={() => setLocation(`/patient/appointments?doctorId=${doc.id}`)}
                            className="mt-2 w-full py-1 text-xs font-bold text-white bg-violet-600 rounded-md"
                          >
                            Book Visit
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        ) : (
          /* ── GRID VIEW MODE ────────────────────────────────────────────────── */
          isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => <DoctorCardSkeleton key={i} />)}
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
                onClick={() => { setSearch(""); setSpecialty("all"); }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {doctors?.map(doc => {
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
                            <span className="truncate">{clinic}, {city}</span>
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
