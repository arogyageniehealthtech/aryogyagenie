import { useState, useEffect, useMemo } from "react";
import {
  useListAppointments,
  useListDiagnosticBookings,
} from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UniversalAppointmentBooking,
  type AppointmentBookingType,
} from "@/components/appointments/UniversalAppointmentBooking";
import {
  Calendar, Plus, Video, Phone, User, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Sparkles, MapPin, TestTube, Building2, Stethoscope, ChevronRight,
} from "lucide-react";

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; icon: React.ElementType; label: string }> = {
    confirmed: { bg: "rgba(34,197,94,0.12)", color: "#15803d", icon: CheckCircle2, label: "Confirmed" },
    pending:   { bg: "rgba(245,158,11,0.12)", color: "#b45309", icon: AlertCircle,  label: "Pending" },
    completed: { bg: "rgba(99,102,241,0.12)", color: "#4338ca", icon: CheckCircle2, label: "Completed" },
    cancelled: { bg: "rgba(239,68,68,0.12)", color: "#b91c1c", icon: XCircle,      label: "Cancelled" },
  };
  const cfg = configs[status?.toLowerCase()] ?? { bg: "rgba(100,116,139,0.12)", color: "#475569", icon: AlertCircle, label: status };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

// ─── Consultation Type badge ───────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  if (type === "lab_test") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
        <TestTube className="h-3.5 w-3.5 text-sky-600" />
        Diagnostic Lab Test
      </span>
    );
  }

  const icons: Record<string, React.ElementType> = {
    in_person: MapPin,
    video:     Video,
    phone:     Phone,
  };
  const Icon = icons[type] ?? User;
  const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-slate-100/80 text-slate-700 border border-slate-200/60">
      <Icon className="h-3.5 w-3.5 text-violet-600" />
      {label}
    </span>
  );
}

// ─── Provider Avatar ───────────────────────────────────────────────────────────
function ProviderAvatar({ kind, name }: { kind: "doctor" | "clinic" | "lab"; name: string }) {
  if (kind === "lab") {
    return (
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" }}
      >
        <TestTube className="h-6 w-6 relative z-10" />
      </div>
    );
  }

  if (kind === "clinic") {
    return (
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
      >
        <Building2 className="h-6 w-6 relative z-10" />
      </div>
    );
  }

  const initials = name
    ? name.replace(/^Dr\.\s*/i, "").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "DR";

  return (
    <div
      className="h-14 w-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 text-white shadow-md relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #6C63FF 0%, #3B3FBF 100%)" }}
    >
      <div className="absolute inset-0 bg-white/10 opacity-50" />
      <span className="relative z-10">{initials}</span>
    </div>
  );
}

// ─── Date badge ────────────────────────────────────────────────────────────────
function DateBadge({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr);
  const day = isNaN(d.getTime()) ? "--" : d.getDate();
  const mon = isNaN(d.getTime()) ? "---" : d.toLocaleString("default", { month: "short" }).toUpperCase();
  return (
    <div
      className="flex flex-col items-center justify-center h-14 w-14 rounded-2xl shrink-0 shadow-2xs"
      style={{ background: "linear-gradient(135deg, #F3F4FF 0%, #EEF0FF 100%)", border: "1.5px solid #E0E4FF" }}
    >
      <span className="text-base font-extrabold leading-tight text-violet-700">{day}</span>
      <span className="text-[10px] font-bold tracking-wider leading-tight text-violet-500">{mon}</span>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function AppointmentSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl skeleton-shimmer shrink-0" />
          <div className="space-y-2">
            <div className="h-4 skeleton-shimmer rounded w-36" />
            <div className="h-3 skeleton-shimmer rounded w-24" />
          </div>
        </div>
        <div className="h-14 w-14 rounded-2xl skeleton-shimmer shrink-0" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 skeleton-shimmer rounded-full w-20" />
        <div className="h-6 skeleton-shimmer rounded-full w-24" />
      </div>
    </div>
  );
}

interface UnifiedVisitItem {
  id: string;
  rawId: number;
  kind: "doctor" | "clinic" | "lab";
  title: string;
  subtitle: string;
  dateStr: string;
  timeStr: string;
  type: string;
  status: string;
  notes?: string | null;
  fee?: number | null;
  createdAt: string;
}

// ─── Main component ────────────────────────────────────────────────────────────
export function PatientAppointments() {
  // Booking modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<AppointmentBookingType | null>(null);
  const [modalInitialDoctorId, setModalInitialDoctorId] = useState<number | null>(null);
  const [modalInitialHospitalId, setModalInitialHospitalId] = useState<number | null>(null);
  const [modalInitialCenterId, setModalInitialCenterId] = useState<number | null>(null);
  const [modalInitialTestName, setModalInitialTestName] = useState<string | null>(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<"all" | "upcoming" | "completed" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data queries
  const { data: appointments, isLoading: isLoadingApt } = useListAppointments();
  const { data: diagnosticBookings, isLoading: isLoadingDiag } = useListDiagnosticBookings();

  // Auto-open modal if navigated with query params (Entry Point B support)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("type") as AppointmentBookingType | null;
    const docIdParam = params.get("doctorId");
    const hospIdParam = params.get("hospitalId") || params.get("clinicId");
    const centerIdParam = params.get("centerId") || params.get("diagnosticCenterId");
    const testParam = params.get("testName") || params.get("test");

    let shouldOpen = false;

    if (typeParam) {
      setModalInitialType(typeParam);
      shouldOpen = true;
    }
    if (docIdParam) {
      const dId = parseInt(docIdParam, 10);
      if (!isNaN(dId)) {
        setModalInitialType("doctor");
        setModalInitialDoctorId(dId);
        shouldOpen = true;
      }
    }
    if (hospIdParam) {
      const hId = parseInt(hospIdParam, 10);
      if (!isNaN(hId)) {
        setModalInitialType("clinic");
        setModalInitialHospitalId(hId);
        shouldOpen = true;
      }
    }
    if (centerIdParam) {
      const cId = parseInt(centerIdParam, 10);
      if (!isNaN(cId)) {
        setModalInitialType("lab");
        setModalInitialCenterId(cId);
        shouldOpen = true;
      }
    }
    if (testParam) {
      setModalInitialTestName(testParam);
      setModalInitialType("lab");
      shouldOpen = true;
    }

    if (shouldOpen) {
      setIsModalOpen(true);
    }
  }, []);

  const handleOpenUniversalBooking = () => {
    setModalInitialType(null);
    setModalInitialDoctorId(null);
    setModalInitialHospitalId(null);
    setModalInitialCenterId(null);
    setModalInitialTestName(null);
    setIsModalOpen(true);
  };

  // ─── UNIFIED APPOINTMENTS LIST ─────────────────────────────────────────────
  const unifiedVisits: UnifiedVisitItem[] = useMemo(() => {
    const list: UnifiedVisitItem[] = [];

    // Map Doctor and Clinic Appointments
    if (appointments && Array.isArray(appointments)) {
      appointments.forEach((apt) => {
        const isClinic = Boolean(apt.symptoms?.startsWith("[Clinic Visit]"));
        list.push({
          id: `apt-${apt.id}`,
          rawId: apt.id,
          kind: isClinic ? "clinic" : "doctor",
          title: apt.doctorName ? `Dr. ${apt.doctorName}` : "Medical Specialist",
          subtitle: apt.doctorSpecialty || (isClinic ? "Clinic Facility Checkup" : "Specialist Consultation"),
          dateStr: apt.appointmentDate,
          timeStr: apt.appointmentTime || "10:00 AM",
          type: apt.type || "in_person",
          status: apt.status || "pending",
          notes: apt.symptoms ? apt.symptoms.replace(/^\[Clinic Visit\]\s*/, "") : null,
          fee: apt.consultationFee,
          createdAt: apt.createdAt,
        });
      });
    }

    // Map Diagnostic Lab Bookings
    if (diagnosticBookings && Array.isArray(diagnosticBookings)) {
      diagnosticBookings.forEach((b) => {
        list.push({
          id: `diag-${b.id}`,
          rawId: b.id,
          kind: "lab",
          title: b.testName || "Diagnostic Test",
          subtitle: b.centerName || "Certified Diagnostic Lab",
          dateStr: b.bookingDate,
          timeStr: b.bookingTime || "09:00 AM",
          type: "lab_test",
          status: b.status || "pending",
          notes: b.notes,
          fee: b.price,
          createdAt: b.createdAt,
        });
      });
    }

    // Sort by appointment date / creation date (newest first)
    list.sort((a, b) => {
      const dateA = new Date(`${a.dateStr} ${a.timeStr}`).getTime() || new Date(a.createdAt).getTime();
      const dateB = new Date(`${b.dateStr} ${b.timeStr}`).getTime() || new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return list;
  }, [appointments, diagnosticBookings]);

  // Metrics computation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalCount = unifiedVisits.length;
  const upcomingCount = unifiedVisits.filter(
    (v) => new Date(v.dateStr) >= today && v.status !== "cancelled"
  ).length;
  const completedCount = unifiedVisits.filter(
    (v) => v.status === "completed" || (new Date(v.dateStr) < today && v.status !== "cancelled")
  ).length;
  const pendingCount = unifiedVisits.filter((v) => v.status === "pending").length;

  // Filtered visits
  const filteredVisits = unifiedVisits.filter((visit) => {
    const visitDate = new Date(visit.dateStr);
    const matchesFilter =
      activeFilter === "all" ? true :
      activeFilter === "upcoming" ? visitDate >= today && visit.status !== "cancelled" :
      activeFilter === "completed" ? visit.status === "completed" || (visitDate < today && visit.status !== "cancelled") :
      activeFilter === "cancelled" ? visit.status === "cancelled" : true;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      visit.title.toLowerCase().includes(q) ||
      visit.subtitle.toLowerCase().includes(q) ||
      (visit.notes && visit.notes.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  const isLoading = isLoadingApt || isLoadingDiag;

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Top Hero Summary Banner ────────────────────────────────────────── */}
        <div
          className="rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white"
          style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)" }}
        >
          {/* Background glow circles */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute right-1/3 -top-10 w-48 h-48 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-violet-200 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Patient Care & Booking Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Appointments</h1>
              <p className="text-sm text-violet-200/80 mt-1 max-w-md">
                Schedule, track, and manage all your doctor consultations, clinic visits, and diagnostic lab tests.
              </p>
            </div>

            {/* Universal Appointment Booking Button */}
            <Button
              onClick={handleOpenUniversalBooking}
              className="gap-2 rounded-2xl font-bold shadow-lg text-sm h-12 px-6 hover:scale-105 transition-all duration-200 shrink-0"
              style={{
                background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Plus className="h-5 w-5" />
              Book New Appointment
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold">{totalCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Total Bookings</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold text-emerald-300">{upcomingCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Upcoming</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold text-amber-300">{pendingCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Pending</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold text-indigo-200">{completedCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Completed</div>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Tabs ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: "All Visits" },
              { id: "upcoming", label: "Upcoming" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  activeFilter === tab.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search doctor, clinic, test, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200/80 text-xs focus-visible:ring-violet-500"
            />
          </div>
        </div>

        {/* ── Grid Content ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => (
              <AppointmentSkeleton key={i} />
            ))}
          </div>
        ) : filteredVisits.length === 0 ? (
          /* Empty State Card */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="h-20 w-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-4 text-violet-600">
              <Calendar className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No appointments found</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              {searchQuery || activeFilter !== "all"
                ? "No appointments match your search filter criteria. Try adjusting your filters."
                : "You don't have any appointments scheduled yet. Book a consultation or lab test now."}
            </p>
            <Button
              onClick={() => {
                handleOpenUniversalBooking();
                setSearchQuery("");
                setActiveFilter("all");
              }}
              className="rounded-xl gap-2 font-bold shadow-md px-6 h-11"
              style={{
                background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
                color: "white",
              }}
            >
              <Plus className="h-4 w-4" />
              Book Appointment
            </Button>
          </div>
        ) : (
          /* 2-Column Responsive Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredVisits.map((visit) => {
              const visitDate = new Date(visit.dateStr);
              const isUpcoming = visitDate >= today && visit.status !== "cancelled";

              return (
                <div
                  key={visit.id}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
                >
                  {/* Accent Top Border line */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      visit.kind === "lab"
                        ? "bg-gradient-to-r from-sky-400 to-blue-500"
                        : visit.kind === "clinic"
                        ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                        : isUpcoming
                        ? "bg-gradient-to-r from-violet-500 to-indigo-500"
                        : "bg-slate-200"
                    }`}
                  />

                  {/* Header Row: Provider Info + Date Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ProviderAvatar kind={visit.kind} name={visit.title} />
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-violet-600 transition-colors">
                            {visit.title}
                          </h3>
                          <p className="text-xs font-medium text-slate-500 truncate mb-1">
                            {visit.subtitle}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5 text-violet-500" />
                            <span className="font-semibold text-slate-700">{visit.timeStr}</span>
                          </div>
                        </div>
                      </div>

                      <DateBadge dateStr={visit.dateStr} />
                    </div>

                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <StatusBadge status={visit.status} />
                      <TypeBadge type={visit.type} />
                    </div>

                    {/* Symptoms / Notes note if available */}
                    {visit.notes && (
                      <div className="bg-slate-50 rounded-2xl p-3 mb-4 text-xs text-slate-600 border border-slate-100">
                        <span className="font-semibold text-slate-700">
                          {visit.kind === "lab" ? "Notes: " : "Symptoms: "}
                        </span>
                        {visit.notes}
                      </div>
                    )}
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                    <span className="text-xs font-semibold text-slate-400">
                      ID: #{visit.rawId}
                    </span>
                    <div className="flex items-center gap-2">
                      {visit.type === "video" && isUpcoming && (
                        <Button
                          size="sm"
                          className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Join Video Call
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-9 text-xs font-semibold hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Reusable Universal Appointment Booking Dialog ─────────────────── */}
      <UniversalAppointmentBooking
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialType={modalInitialType}
        initialDoctorId={modalInitialDoctorId}
        initialHospitalId={modalInitialHospitalId}
        initialCenterId={modalInitialCenterId}
        initialTestName={modalInitialTestName}
      />
    </DashboardLayout>
  );
}
