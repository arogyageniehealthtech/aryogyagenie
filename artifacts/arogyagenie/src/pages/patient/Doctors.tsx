import { useState } from "react";
import { useListDoctors } from "@workspace/api-client-react";
import { DOCTOR_SPECIALTIES } from "@/lib/specialties";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Star, MapPin, Clock, Stethoscope, ArrowRight, Award } from "lucide-react";
import { useLocation } from "wouter";

// ─── Doctor Card Skeleton ───────────────────────────────────────────────────
function DoctorCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100/80 shadow-sm animate-pulse">
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
  
  // Normalize specialty from URL if needed
  const normalizedSpecialty = DOCTOR_SPECIALTIES.find(s => 
    s.toLowerCase() === rawSpecialty.toLowerCase() ||
    rawSpecialty.toLowerCase().includes(s.toLowerCase()) ||
    s.toLowerCase().includes(rawSpecialty.toLowerCase())
  ) || (rawSpecialty === "all" ? "all" : rawSpecialty);

  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState(normalizedSpecialty);
  const [, setLocation] = useLocation();

  const { data: doctors, isLoading } = useListDoctors({
    search: search.length > 0 ? search : undefined,
    specialty: specialty !== "all" ? specialty : undefined
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Find Doctors</h1>
          <p className="text-sm text-slate-500 mt-1">Search for verified specialists and book your consultation.</p>
        </div>

        {/* ── Search & Filter Bar ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by doctor name, specialty, clinic..." 
              className="pl-10 h-11 rounded-xl bg-white border-slate-200/80 shadow-xs focus-visible:ring-indigo-500"
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

        {/* ── Content Grid ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <DoctorCardSkeleton key={i} />)}
          </div>
        ) : doctors?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
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
              const rating = doc.rating || "4.5";
              const fee = doc.consultationFee || 500;
              const clinic = doc.clinicName || "Apollo Clinic";
              const city = doc.clinicAddress || "New Delhi";
              const exp = doc.experience || "10+";

              return (
                <div 
                  key={doc.id} 
                  className="bg-white rounded-2xl overflow-hidden border border-slate-100/90 shadow-sm hover:shadow-md transition-all duration-180 flex flex-col justify-between group"
                >
                  {/* Top Cover Banner */}
                  <div>
                    <div 
                      className="h-24 relative p-4"
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,96%), hsl(260,70%,93%))",
                      }}
                    >
                      {/* Avatar */}
                      <div className="absolute -bottom-9 left-5 h-18 w-18 rounded-2xl border-4 border-white bg-white overflow-hidden shadow-sm flex items-center justify-center shrink-0">
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

                      {/* Rating pill */}
                      <div className="absolute top-3.5 right-3.5 bg-white/90 backdrop-blur-xs text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs border border-amber-200/60 text-amber-800">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                        {rating}
                      </div>
                    </div>

                    {/* Info Body */}
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

                  {/* Card Footer */}
                  <div className="px-5 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fee</span>
                      <span className="font-bold text-slate-900 text-base">₹{fee}</span>
                    </div>
                    <Button 
                      onClick={() => setLocation('/patient/appointments')}
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
        )}
      </div>
    </DashboardLayout>
  );
}
