import { useState, useMemo } from "react";
import {
  useGetDoctorDashboard,
  useUpdateAppointment,
  useListPrescriptions,
  getGetDoctorDashboardQueryKey,
  type Appointment,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar, Users, Clock, Clipboard, CheckCircle, XCircle, Plus, User,
  CalendarCheck, Activity, ChevronRight, FileText, Check, AlertCircle, Sparkles, Filter,
} from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PrescribeModal } from "./PrescribeModal";

type PrescriptionInterval = "today" | "90days" | "1year";

export function DoctorDashboard() {
  const { data: dashboard, isLoading } = useGetDoctorDashboard();
  const updateAppointment = useUpdateAppointment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Prescribe modal state
  const [prescribeOpen, setPrescribeOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);
  const [targetAppointmentId, setTargetAppointmentId] = useState<number | undefined>(undefined);
  const [targetPatientName, setTargetPatientName] = useState<string | null>(null);

  // Prescription filter interval state
  const [rxInterval, setRxInterval] = useState<PrescriptionInterval>("today");
  const [rxModalOpen, setRxModalOpen] = useState(false);

  // Pending requests modal state
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  // Today consultation filter
  const [todayFilter, setTodayFilter] = useState<"all" | "remaining" | "completed">("all");

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Fetch prescriptions list for prescription inspection modal
  const { data: allPrescriptions, isLoading: isLoadingRxList } = useListPrescriptions();

  const prescriptionsList = useMemo(() => {
    if (!allPrescriptions) return [];
    if (rxInterval === "today") {
      return allPrescriptions.filter((p) => p.prescribedDate === todayStr);
    }
    if (rxInterval === "90days") {
      const d90 = new Date();
      d90.setDate(d90.getDate() - 90);
      const d90Str = d90.toISOString().split("T")[0];
      return allPrescriptions.filter((p) => p.prescribedDate >= d90Str);
    }
    if (rxInterval === "1year") {
      const d1y = new Date();
      d1y.setDate(d1y.getDate() - 365);
      const d1yStr = d1y.toISOString().split("T")[0];
      return allPrescriptions.filter((p) => p.prescribedDate >= d1yStr);
    }
    return allPrescriptions;
  }, [allPrescriptions, rxInterval, todayStr]);

  const handleOpenPrescribe = (patientId: number, appointmentId?: number, patientName?: string | null) => {
    setTargetPatientId(patientId);
    setTargetAppointmentId(appointmentId);
    setTargetPatientName(patientName ?? null);
    setPrescribeOpen(true);
  };

  const handleUpdateStatus = (id: number, status: "confirmed" | "completed" | "cancelled") => {
    updateAppointment.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Appointment Updated",
            description: `Status changed to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetDoctorDashboardQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Failed to update status",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Today's appointments list
  const todayAppointments = useMemo(() => {
    if (dashboard?.todayAppointmentsList) {
      return dashboard.todayAppointmentsList;
    }
    // Fallback if computed from upcomingAppointments
    return (dashboard?.upcomingAppointments || []).filter(
      (a) => a.appointmentDate === todayStr && a.status !== "cancelled"
    );
  }, [dashboard, todayStr]);

  const filteredTodayAppointments = useMemo(() => {
    if (todayFilter === "remaining") {
      return todayAppointments.filter((a) => a.status !== "completed");
    }
    if (todayFilter === "completed") {
      return todayAppointments.filter((a) => a.status === "completed");
    }
    return todayAppointments;
  }, [todayAppointments, todayFilter]);

  // Upcoming appointments list (All future confirmed appointments)
  const upcomingAppointments = useMemo(() => {
    if (dashboard?.upcomingAppointmentsList) {
      return dashboard.upcomingAppointmentsList;
    }
    return (dashboard?.upcomingAppointments || []).filter(
      (a) => a.appointmentDate > todayStr && a.status === "confirmed"
    );
  }, [dashboard, todayStr]);

  // Group upcoming appointments by Date
  const upcomingGroupedByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of upcomingAppointments) {
      const dateKey = apt.appointmentDate;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(apt);
    }
    return Array.from(map.entries()).sort(([d1], [d2]) => d1.localeCompare(d2));
  }, [upcomingAppointments]);

  // Pending appointments list
  const pendingAppointments = useMemo(() => {
    if (dashboard?.pendingAppointmentsList) {
      return dashboard.pendingAppointmentsList;
    }
    return (dashboard?.upcomingAppointments || []).filter((a) => a.status === "pending");
  }, [dashboard]);

  // Displayed prescription count based on interval selector
  const displayedRxCount = useMemo(() => {
    if (!dashboard) return 0;
    if (dashboard.prescriptionsSummary) {
      if (rxInterval === "today") return dashboard.prescriptionsSummary.today;
      if (rxInterval === "90days") return dashboard.prescriptionsSummary.last90Days;
      if (rxInterval === "1year") return dashboard.prescriptionsSummary.last1Year;
      return dashboard.prescriptionsSummary.total;
    }
    if (rxInterval === "today") return dashboard.todayPrescriptions ?? dashboard.totalPrescriptions;
    if (rxInterval === "90days") return dashboard.last90DaysPrescriptions ?? dashboard.totalPrescriptions;
    if (rxInterval === "1year") return dashboard.last1YearPrescriptions ?? dashboard.totalPrescriptions;
    return dashboard.totalPrescriptions;
  }, [dashboard, rxInterval]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading doctor dashboard...</div>
      </DashboardLayout>
    );
  }

  if (!dashboard) return null;

  const firstName = dashboard.firstName?.trim() || dashboard.userName?.trim().split(" ")[0] || "Doctor";
  const todayRemainingCount = dashboard.todayRemainingAppointments ?? (dashboard.todayAppointments - dashboard.completedAppointments);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold mb-2 border border-violet-100">
              <Sparkles className="h-3.5 w-3.5" /> Doctor Clinical Workspace
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hello Dr. {firstName}</h1>
            <p className="text-slate-500 mt-1">Manage today's consultations, review pending requests, and track prescriptions.</p>
          </div>
          <div className="flex items-center gap-3">
            {dashboard.pendingAppointments > 0 && (
              <Button
                variant="outline"
                onClick={() => setPendingModalOpen(true)}
                className="gap-2 border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100 font-semibold"
              >
                <Clock className="h-4 w-4 text-amber-600" />
                <span>{dashboard.pendingAppointments} Pending Requests</span>
              </Button>
            )}
            <Button onClick={() => handleOpenPrescribe(0)} className="gap-2 shrink-0 bg-primary shadow-xs">
              <Plus className="h-4 w-4" /> Issue Prescription
            </Button>
          </div>
        </div>

        {/* ── 5 Core Metric Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Today's Appointments (Fixed Total) */}
          <Card
            onClick={() => {
              const el = document.getElementById("todays-consultations-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-violet-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Today's Appointments
              </CardTitle>
              <Calendar className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{dashboard.todayAppointments}</span>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">TOTAL</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
                <span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200/60">
                  {todayRemainingCount}
                </span>
                <span>remaining today</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Remaining Patients for Today */}
          <Card
            onClick={() => {
              setTodayFilter("remaining");
              const el = document.getElementById("todays-consultations-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-emerald-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Remaining Patients
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-emerald-700">
                {todayRemainingCount}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">
                From today's scheduled appointments
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Pending Requests */}
          <Card
            onClick={() => setPendingModalOpen(true)}
            className="border-amber-200/70 bg-gradient-to-br from-amber-50/30 to-white shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-amber-400"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Pending Requests
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600">{dashboard.pendingAppointments}</span>
                <span className="text-xs text-amber-700/80 font-bold uppercase tracking-wider">Requests</span>
              </div>
              <p className="text-xs text-amber-700 mt-1.5 font-medium flex items-center justify-between">
                <span>Awaiting confirmation</span>
                <ChevronRight className="h-3.5 w-3.5 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Upcoming Consultations */}
          <Card
            onClick={() => {
              const el = document.getElementById("upcoming-consultations-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-indigo-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Upcoming Consultations
              </CardTitle>
              <CalendarCheck className="h-4 w-4 text-indigo-600 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-700">
                  {dashboard.upcomingAppointmentsCount ?? upcomingAppointments.length}
                </span>
                <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Confirmed</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">
                All future confirmed visits
              </p>
            </CardContent>
          </Card>

          {/* Card 5: Prescriptions Issued (With Interval Selector) */}
          <Card className="border-slate-200/80 shadow-2xs hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5">
              <CardTitle className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Prescriptions Issued
              </CardTitle>
              <Clipboard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900">{displayedRxCount}</span>
                <button
                  type="button"
                  onClick={() => setRxModalOpen(true)}
                  className="text-xs text-violet-600 hover:text-violet-800 font-bold underline cursor-pointer"
                >
                  View Details
                </button>
              </div>

              {/* Interval Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                {[
                  { id: "today", label: "Today" },
                  { id: "90days", label: "90 Days" },
                  { id: "1year", label: "1 Year" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRxInterval(tab.id as PrescriptionInterval);
                    }}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${
                      rxInterval === tab.id
                        ? "bg-white text-violet-700 shadow-2xs font-extrabold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Consultations & Patient Section ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Separated Consultation Lists (8 Cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* 1. Today's Consultations Section */}
            <Card id="todays-consultations-section" className="border-slate-200 shadow-xs overflow-hidden">
              <CardHeader className="bg-slate-50/60 pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Today's Consultations
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Scheduled for today ({todayStr}) • {todayAppointments.length} total ({todayRemainingCount} remaining)
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                    <button
                      onClick={() => setTodayFilter("all")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        todayFilter === "all" ? "bg-violet-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      All ({todayAppointments.length})
                    </button>
                    <button
                      onClick={() => setTodayFilter("remaining")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        todayFilter === "remaining" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Remaining ({todayRemainingCount})
                    </button>
                    <button
                      onClick={() => setTodayFilter("completed")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        todayFilter === "completed" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Completed ({todayAppointments.filter((a) => a.status === "completed").length})
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {filteredTodayAppointments.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center gap-2">
                    <Calendar className="h-10 w-10 text-slate-300" />
                    <span>No consultations found for today under this filter.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTodayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col space-y-3 ${
                          apt.status === "completed"
                            ? "bg-slate-50/80 border-slate-200/60 opacity-90"
                            : apt.status === "pending"
                            ? "bg-amber-50/40 border-amber-200"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-sm shrink-0">
                              {apt.patientName ? apt.patientName[0] : <User className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-base">
                                {apt.patientName ? apt.patientName : `Patient #${apt.patientId}`}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-bold text-slate-800">{apt.appointmentTime}</span>
                                <span>•</span>
                                <span className="capitalize">{apt.type.replace("_", " ")}</span>
                                {apt.consultationFee && (
                                  <>
                                    <span>•</span>
                                    <span className="font-semibold text-slate-700">₹{apt.consultationFee}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <Badge
                            className={
                              apt.status === "confirmed"
                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                : apt.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : apt.status === "cancelled"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }
                          >
                            {apt.status}
                          </Badge>
                        </div>

                        {apt.symptoms && (
                          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <strong className="text-slate-700">Reported Symptoms:</strong> {apt.symptoms}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap border-t border-slate-100">
                          {apt.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 gap-1.5 rounded-lg border-blue-200 font-semibold text-xs"
                              onClick={() => handleUpdateStatus(apt.id, "confirmed")}
                              disabled={updateAppointment.isPending}
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Confirm Appointment
                            </Button>
                          )}

                          {apt.status !== "completed" && apt.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1.5 rounded-lg border-emerald-200 font-semibold text-xs"
                              onClick={() => handleUpdateStatus(apt.id, "completed")}
                              disabled={updateAppointment.isPending}
                            >
                              <Check className="h-3.5 w-3.5" /> Mark Completed
                            </Button>
                          )}

                          {apt.status !== "cancelled" && apt.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white text-red-600 hover:text-red-700 hover:bg-red-50 h-8 gap-1.5 rounded-lg border-red-200 font-semibold text-xs"
                              onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                              disabled={updateAppointment.isPending}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          )}

                          <Button
                            size="sm"
                            className="h-8 gap-1.5 ml-auto rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white"
                            onClick={() => handleOpenPrescribe(apt.patientId, apt.id, apt.patientName)}
                          >
                            <Clipboard className="h-3.5 w-3.5" /> Prescribe
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Upcoming Consultations Section (Organized by Date) */}
            <Card id="upcoming-consultations-section" className="border-slate-200 shadow-xs overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50/70 to-violet-50/50 pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <CalendarCheck className="h-5 w-5 text-indigo-600" />
                      Upcoming Consultations
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      All future doctor-confirmed appointments (Total: {upcomingAppointments.length} confirmed)
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200 self-start sm:self-auto font-bold">
                    {upcomingAppointments.length} Future Bookings
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {upcomingGroupedByDate.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center gap-2">
                    <CalendarCheck className="h-10 w-10 text-slate-300" />
                    <span>No future confirmed appointments scheduled.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {upcomingGroupedByDate.map(([dateKey, dateAppts]) => {
                      const formattedDateHeader = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });

                      return (
                        <div key={dateKey} className="space-y-3">
                          {/* Date Section Header */}
                          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200/80">
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <h3 className="font-bold text-sm text-slate-900">{formattedDateHeader}</h3>
                            <span className="text-xs font-semibold text-slate-400">({dateAppts.length} patients)</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {dateAppts.map((apt) => (
                              <div
                                key={apt.id}
                                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">
                                      {apt.patientName ? apt.patientName : `Patient #${apt.patientId}`}
                                    </p>
                                    <p className="text-xs text-indigo-600 font-semibold mt-0.5 flex items-center gap-1.5">
                                      <Clock className="h-3 w-3" />
                                      {apt.appointmentTime} • <span className="capitalize">{apt.type.replace("_", " ")}</span>
                                    </p>
                                  </div>
                                  <Badge className="bg-blue-100 text-blue-800 text-[10px] uppercase font-bold">
                                    {apt.status}
                                  </Badge>
                                </div>

                                {apt.symptoms && (
                                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg line-clamp-2">
                                    <span className="font-medium text-slate-700">Symptoms:</span> {apt.symptoms}
                                  </p>
                                )}

                                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                                  <span className="text-slate-400 font-medium">Fee: ₹{apt.consultationFee || 500}</span>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                                      className="h-7 text-xs text-red-600 hover:bg-red-50"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenPrescribe(apt.patientId, apt.id, apt.patientName)}
                                      className="h-7 text-xs font-semibold gap-1 text-violet-700 border-violet-200 hover:bg-violet-50"
                                    >
                                      <Clipboard className="h-3 w-3" /> Prescribe
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Pending Requests & Recent Patients (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Action Pending Requests Card */}
            <Card className="border-amber-200 shadow-xs bg-gradient-to-b from-amber-50/50 to-white">
              <CardHeader className="pb-3 border-b border-amber-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Pending Requests ({pendingAppointments.length})
                  </CardTitle>
                  {pendingAppointments.length > 0 && (
                    <button
                      onClick={() => setPendingModalOpen(true)}
                      className="text-xs text-amber-700 font-bold hover:underline"
                    >
                      View All
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {pendingAppointments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No unconfirmed appointment requests waiting.
                  </div>
                ) : (
                  pendingAppointments.slice(0, 4).map((apt) => (
                    <div key={apt.id} className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-900 text-xs truncate">
                          {apt.patientName ? apt.patientName : `Patient #${apt.patientId}`}
                        </p>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          {apt.appointmentDate}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {apt.appointmentTime} • {apt.type.replace("_", " ")}
                      </p>
                      {apt.symptoms && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded truncate">
                          {apt.symptoms}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(apt.id, "confirmed")}
                          disabled={updateAppointment.isPending}
                          className="h-7 text-xs flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          <Check className="h-3 w-3 mr-1" /> Accept & Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                          disabled={updateAppointment.isPending}
                          className="h-7 text-xs text-red-600 hover:bg-red-50 rounded-lg px-2"
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Patients */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Recent Patients
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {dashboard.recentPatients.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">No recent patients found.</div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs flex items-center justify-between gap-2 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 bg-violet-50 text-violet-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                            {patient.firstName ? patient.firstName[0] : <User className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              Visits: {patient.totalVisits} • {patient.lastVisit || "Recent"}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPrescribe(patient.id, undefined, `${patient.firstName} ${patient.lastName}`)}
                          className="text-[11px] h-7 px-2 font-semibold text-violet-700 border-violet-200 hover:bg-violet-50 shrink-0"
                        >
                          <Clipboard className="h-3 w-3 mr-1" /> Prescribe
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Pending Requests Full Modal ────────────────────────────────────── */}
        <Dialog open={pendingModalOpen} onOpenChange={setPendingModalOpen}>
          <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Pending Appointment Requests ({pendingAppointments.length})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <p className="text-xs text-slate-500">
                Confirming an appointment automatically schedules it. Today's appointments appear in Today's Consultations, and future appointments move to Upcoming Consultations.
              </p>

              {pendingAppointments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No pending appointment requests.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAppointments.map((apt) => (
                    <div key={apt.id} className="p-4 rounded-2xl bg-amber-50/30 border border-amber-200/80 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {apt.patientName ? apt.patientName : `Patient #${apt.patientId}`}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Requested Date: <strong className="text-slate-900">{apt.appointmentDate}</strong> at{" "}
                            <strong className="text-slate-900">{apt.appointmentTime}</strong> • Type:{" "}
                            <span className="capitalize">{apt.type.replace("_", " ")}</span>
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                          Pending
                        </Badge>
                      </div>

                      {apt.symptoms && (
                        <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                          <strong className="text-slate-700">Reason for visit:</strong> {apt.symptoms}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                          disabled={updateAppointment.isPending}
                          className="h-8 text-xs text-red-600 hover:bg-red-50 border-slate-200"
                        >
                          Decline Request
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(apt.id, "confirmed")}
                          disabled={updateAppointment.isPending}
                          className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Accept & Confirm
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Prescriptions Issued Interval Inspection Modal ─────────────────── */}
        <Dialog open={rxModalOpen} onOpenChange={setRxModalOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Clipboard className="h-5 w-5 text-primary" />
                  Prescriptions Issued ({displayedRxCount})
                </DialogTitle>

                {/* Filter Tabs in Modal */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {[
                    { id: "today", label: "Today (1 Day)" },
                    { id: "90days", label: "Last 90 Days" },
                    { id: "1year", label: "Last 1 Year" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRxInterval(tab.id as PrescriptionInterval)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        rxInterval === tab.id
                          ? "bg-violet-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <p className="text-xs text-slate-500">
                Official digital prescription records issued by you for the selected timeframe ({rxInterval}).
              </p>

              {isLoadingRxList ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading prescription records...</div>
              ) : !prescriptionsList || prescriptionsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                  <FileText className="h-10 w-10 text-slate-300" />
                  <span>No prescriptions found for the selected timeframe.</span>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {prescriptionsList.map((rx) => (
                    <div key={rx.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {rx.patientName ? rx.patientName : `Patient #${rx.patientId}`}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Prescribed Date: <strong className="text-slate-800">{rx.prescribedDate}</strong> • Rx ID: #{rx.id}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                          {rx.status}
                        </Badge>
                      </div>

                      {rx.diagnosis && (
                        <p className="text-xs font-semibold text-violet-800 bg-violet-50 px-2.5 py-1 rounded-lg">
                          Diagnosis: {rx.diagnosis}
                        </p>
                      )}

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs font-mono whitespace-pre-wrap text-slate-800">
                        {rx.medicines}
                      </div>

                      {rx.instructions && (
                        <p className="text-xs text-slate-500">
                          <strong className="text-slate-700">Instructions:</strong> {rx.instructions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Prescribe Modal ────────────────────────────────────────────────── */}
        <PrescribeModal
          isOpen={prescribeOpen}
          onClose={() => setPrescribeOpen(false)}
          defaultPatientId={targetPatientId}
          defaultAppointmentId={targetAppointmentId}
          patientName={targetPatientName}
        />
      </div>
    </DashboardLayout>
  );
}
