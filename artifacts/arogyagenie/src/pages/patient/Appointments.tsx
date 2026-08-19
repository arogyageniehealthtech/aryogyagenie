import { useState, useEffect } from "react";
import {
  useListAppointments,
  useCreateAppointment,
  useListDoctors,
  useGetDoctorAvailableSlots,
  getListAppointmentsQueryKey,
  getGetPatientDashboardQueryKey,
  getGetDoctorAvailableSlotsQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Plus, Video, Phone, User, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Sparkles, MapPin, Loader2, Check,
} from "lucide-react";

const appointmentSchema = z.object({
  doctorId: z.coerce.number().min(1, "Please select a doctor"),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Please select an available consultation slot"),
  type: z.enum(["in_person", "video", "phone"]),
  symptoms: z.string().optional(),
});

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

// ─── Doctor avatar ─────────────────────────────────────────────────────────────
function DoctorAvatar({ name }: { name: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
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

// ─── Main component ────────────────────────────────────────────────────────────
export function PatientAppointments() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "upcoming" | "completed" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: appointments, isLoading: isLoadingApt } = useListAppointments();
  const { data: doctors } = useListDoctors();
  const createAppointment = useCreateAppointment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const todayStr = new Date().toISOString().split("T")[0];

  const form = useForm<z.infer<typeof appointmentSchema>>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      doctorId: 0,
      appointmentDate: todayStr,
      appointmentTime: "",
      type: "in_person",
      symptoms: ""
    }
  });

  const selectedDoctorId = form.watch("doctorId");
  const selectedDate = form.watch("appointmentDate");
  const selectedTime = form.watch("appointmentTime");

  // Query doctor's available slots for selected doctor and date
  const {
    data: slotData,
    isLoading: isLoadingSlots,
    refetch: refetchSlots,
  } = useGetDoctorAvailableSlots(
    selectedDoctorId,
    { date: selectedDate },
    {
      query: {
        queryKey: getGetDoctorAvailableSlotsQueryKey(selectedDoctorId, { date: selectedDate }),
        enabled: Boolean(selectedDoctorId && selectedDoctorId > 0 && selectedDate),
      },
    }
  );

  // Auto-open modal if navigated with ?doctorId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docIdParam = params.get("doctorId");
    if (docIdParam) {
      const docIdNum = parseInt(docIdParam, 10);
      if (!isNaN(docIdNum)) {
        form.setValue("doctorId", docIdNum);
        form.setValue("appointmentDate", todayStr);
        setIsOpen(true);
      }
    }
  }, [todayStr, form]);

  // Reset selected slot when doctor or date changes
  useEffect(() => {
    form.setValue("appointmentTime", "");
  }, [selectedDoctorId, selectedDate, form]);

  const onSubmit = (data: z.infer<typeof appointmentSchema>) => {
    createAppointment.mutate({ data }, {
      onSuccess: () => {
        toast({
          title: "Appointment Requested",
          description: `Your consultation request for ${data.appointmentDate} at ${data.appointmentTime} has been submitted.`,
        });
        setIsOpen(false);
        form.reset({
          doctorId: 0,
          appointmentDate: todayStr,
          appointmentTime: "",
          type: "in_person",
          symptoms: "",
        });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientDashboardQueryKey() });
      },
      onError: (err: any) => {
        const errMsg = err?.message || "Failed to book appointment. Please try another slot.";
        toast({
          title: "Booking Failed",
          description: errMsg,
          variant: "destructive",
        });
        // Invalidate slots to refresh availability state
        if (selectedDoctorId && selectedDate) {
          queryClient.invalidateQueries({
            queryKey: getGetDoctorAvailableSlotsQueryKey(selectedDoctorId, { date: selectedDate }),
          });
        }
      }
    });
  };

  // Metrics computation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalCount = appointments?.length ?? 0;
  const upcomingCount = appointments?.filter(a => new Date(a.appointmentDate) >= today && a.status !== "cancelled")?.length ?? 0;
  const completedCount = appointments?.filter(a => a.status === "completed" || new Date(a.appointmentDate) < today)?.length ?? 0;
  const pendingCount = appointments?.filter(a => a.status === "pending")?.length ?? 0;

  // Filtered appointments
  const filteredAppointments = appointments?.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    const matchesFilter =
      activeFilter === "all" ? true :
      activeFilter === "upcoming" ? aptDate >= today && apt.status !== "cancelled" :
      activeFilter === "completed" ? apt.status === "completed" || (aptDate < today && apt.status !== "cancelled") :
      activeFilter === "cancelled" ? apt.status === "cancelled" : true;

    const matchesSearch =
      !searchQuery ||
      apt.doctorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.doctorSpecialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.symptoms?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

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
                <span>Patient Care Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Appointments</h1>
              <p className="text-sm text-violet-200/80 mt-1 max-w-md">
                View, schedule, and track all your medical consultations in one place.
              </p>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  className="gap-2 rounded-2xl font-bold shadow-lg text-sm h-12 px-6 hover:scale-105 transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Book New Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Book Consultation Appointment
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
                    {/* Doctor Selector */}
                    <FormField
                      control={form.control}
                      name="doctorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-slate-800">Select Doctor *</FormLabel>
                          <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value ? field.value.toString() : ""}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs">
                                <SelectValue placeholder="Choose a specialist..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl max-h-[260px]">
                              {doctors?.map((doc) => (
                                <SelectItem key={doc.id} value={doc.id.toString()}>
                                  Dr. {doc.firstName} {doc.lastName} — {doc.specialty} (₹{doc.consultationFee || 500})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Date Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="appointmentDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-slate-800">Appointment Date *</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                min={todayStr}
                                className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-slate-800">Consultation Type *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="in_person">🏥 In-Person Clinic Visit</SelectItem>
                                <SelectItem value="video">📹 Video Consultation</SelectItem>
                                <SelectItem value="phone">📞 Phone Call</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Doctor-Provided Available Consultation Slots */}
                    <FormField
                      control={form.control}
                      name="appointmentTime"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-primary" />
                              Available Consultation Slots *
                            </FormLabel>
                            {slotData?.slotDuration && (
                              <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                                {slotData.slotDuration} min intervals
                              </span>
                            )}
                          </div>

                          {!selectedDoctorId || selectedDoctorId === 0 ? (
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
                              Please select a doctor to view available consultation slots.
                            </div>
                          ) : !selectedDate ? (
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
                              Please select an appointment date.
                            </div>
                          ) : isLoadingSlots ? (
                            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span>Retrieving doctor's consultation slots for {selectedDate}...</span>
                            </div>
                          ) : !slotData?.isAvailable || slotData?.slots?.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-center text-xs text-amber-800 space-y-1">
                              <p className="font-bold flex items-center justify-center gap-1">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                No Consultation Slots Available
                              </p>
                              <p className="text-[11px] text-amber-700">
                                Doctor is not available for checkups on {slotData?.dayOfWeek || "this date"}. Please choose another date.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[180px] overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
                                {slotData.slots.map((slot) => {
                                  const isSelected = field.value === slot.time;
                                  return (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      disabled={!slot.available}
                                      onClick={() => field.onChange(slot.time)}
                                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                                        isSelected
                                          ? "bg-violet-600 text-white shadow-md ring-2 ring-violet-500/30 scale-102"
                                          : slot.available
                                          ? "bg-white text-slate-800 border border-slate-200 hover:border-violet-400 hover:bg-violet-50/60 shadow-2xs cursor-pointer"
                                          : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed line-through opacity-60"
                                      }`}
                                    >
                                      <span>{slot.time}</span>
                                      {!slot.available && (
                                        <span className="text-[9px] font-semibold no-underline tracking-tighter uppercase text-slate-400">
                                          {slot.reason === "booked" ? "Booked" : "Past"}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {field.value && (
                                <p className="text-xs text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  Selected Time: <span className="underline">{field.value}</span>
                                </p>
                              )}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Symptoms Textarea */}
                    <FormField
                      control={form.control}
                      name="symptoms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-slate-800">
                            Reason for Visit / Symptoms <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Briefly describe your symptoms, health concerns, or reason for checkup..."
                              className="rounded-xl resize-none p-3 text-xs bg-white border-slate-200 shadow-2xs"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl h-11 px-5 font-semibold w-full sm:w-auto border-slate-200"
                        onClick={() => setIsOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createAppointment.isPending || !selectedTime}
                        className="rounded-xl h-11 px-6 font-bold shadow-md w-full sm:w-auto"
                        style={{
                          background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
                          color: "white",
                        }}
                      >
                        {createAppointment.isPending ? "Booking Appointment..." : "Confirm Booking"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold">{totalCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Total Visits</div>
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
            ].map(tab => (
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
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search doctor or symptoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200/80 text-xs focus-visible:ring-violet-500"
            />
          </div>
        </div>

        {/* ── Grid Content ───────────────────────────────────────────────────── */}
        {isLoadingApt ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <AppointmentSkeleton key={i} />)}
          </div>
        ) : filteredAppointments?.length === 0 ? (
          /* Empty State Card */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="h-20 w-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-4 text-violet-600">
              <Calendar className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No appointments found</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              {searchQuery || activeFilter !== "all"
                ? "No appointments match your search filter criteria. Try adjusting your filters."
                : "You don't have any appointments scheduled yet. Book a consultation with a specialist now."}
            </p>
            <Button
              onClick={() => { setIsOpen(true); setSearchQuery(""); setActiveFilter("all"); }}
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
            {filteredAppointments?.map(apt => {
              const aptDate = new Date(apt.appointmentDate);
              const isUpcoming = aptDate >= today && apt.status !== "cancelled";

              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
                >
                  {/* Accent Top Border line */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      isUpcoming ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-slate-200"
                    }`}
                  />

                  {/* Header Row: Doctor Info + Date Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <DoctorAvatar name={apt.doctorName ?? ""} />
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-violet-600 transition-colors">
                            Dr. {apt.doctorName}
                          </h3>
                          <p className="text-xs font-medium text-slate-500 truncate mb-1">
                            {apt.doctorSpecialty || "General Specialist"}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5 text-violet-500" />
                            <span className="font-semibold text-slate-700">{apt.appointmentTime}</span>
                          </div>
                        </div>
                      </div>

                      <DateBadge dateStr={apt.appointmentDate} />
                    </div>

                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <StatusBadge status={apt.status} />
                      <TypeBadge type={apt.type} />
                    </div>

                    {/* Symptoms note if available */}
                    {apt.symptoms && (
                      <div className="bg-slate-50 rounded-2xl p-3 mb-4 text-xs text-slate-600 border border-slate-100">
                        <span className="font-semibold text-slate-700">Symptoms: </span>
                        {apt.symptoms}
                      </div>
                    )}
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                    <span className="text-xs font-semibold text-slate-400">
                      ID: #{apt.id}
                    </span>
                    <div className="flex items-center gap-2">
                      {apt.type === "video" && isUpcoming && (
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
    </DashboardLayout>
  );
}
