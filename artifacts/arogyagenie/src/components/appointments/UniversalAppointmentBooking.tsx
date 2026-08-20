import { useState, useEffect, useMemo } from "react";
import {
  useListDoctors,
  useGetDoctorAvailableSlots,
  useCreateAppointment,
  useListDiagnosticCenters,
  useCreateDiagnosticBooking,
  getListAppointmentsQueryKey,
  getListDiagnosticBookingsQueryKey,
  getGetPatientDashboardQueryKey,
  getGetDoctorAvailableSlotsQueryKey,
} from "@workspace/api-client-react";
import { DEMO_HOSPITALS } from "@/data/demoHospitals";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Stethoscope, Building2, TestTube, Clock, MapPin, Video, Phone,
  Check, AlertCircle, Sparkles, ArrowLeft, Loader2, Star, CheckCircle2, ChevronRight, User,
} from "lucide-react";

export type AppointmentBookingType = "doctor" | "clinic" | "lab";

interface UniversalAppointmentBookingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: AppointmentBookingType | null;
  initialDoctorId?: number | null;
  initialHospitalId?: number | null;
  initialCenterId?: number | null;
  initialTestName?: string | null;
  onSuccess?: () => void;
}

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

const doctorBookingSchema = z.object({
  doctorId: z.coerce.number().min(1, "Please select a doctor"),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Please select an available consultation slot"),
  type: z.enum(["in_person", "video", "phone"]),
  symptoms: z.string().optional(),
});

const clinicBookingSchema = z.object({
  clinicId: z.string().min(1, "Please select a clinic or hospital"),
  doctorId: z.coerce.number().min(1, "Please select a specialist or OPD department doctor"),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Please select a time slot"),
  type: z.literal("in_person"),
  symptoms: z.string().optional(),
});

const labBookingSchema = z.object({
  diagnosticCenterId: z.coerce.number().min(1, "Please select a diagnostic center"),
  testName: z.string().min(2, "Test name is required"),
  bookingDate: z.string().min(1, "Date is required"),
  bookingTime: z.string().min(1, "Please select a time slot"),
  notes: z.string().optional(),
});

// Quick suggestions for Diagnostic Lab Tests
const LAB_TEST_SUGGESTIONS = [
  "Complete Blood Count (CBC)",
  "Lipid Profile (Cholesterol)",
  "Thyroid Profile (T3, T4, TSH)",
  "Fasting Blood Sugar & HbA1c",
  "Liver Function Test (LFT)",
  "Kidney Function Test (KFT)",
  "Digital Chest X-Ray",
  "MRI Scan (Brain / Spine)",
  "Ultrasound Abdomen",
  "Vitamin D & B12 Test",
];

const DEFAULT_LAB_SLOTS = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:30 AM",
  "02:00 PM",
  "03:30 PM",
  "04:30 PM",
  "06:00 PM",
];

export function UniversalAppointmentBooking({
  open,
  onOpenChange,
  initialType,
  initialDoctorId,
  initialHospitalId,
  initialCenterId,
  initialTestName,
  onSuccess,
}: UniversalAppointmentBookingProps) {
  const [bookingType, setBookingType] = useState<AppointmentBookingType | null>(initialType || null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Queries
  const { data: doctors, isLoading: isLoadingDoctors } = useListDoctors();
  const { data: diagnosticCenters, isLoading: isLoadingCenters } = useListDiagnosticCenters();
  const createAppointment = useCreateAppointment();
  const createDiagnosticBooking = useCreateDiagnosticBooking();

  // Combine Clinic / Hospital entities
  const clinicOptions = useMemo(() => {
    const list: Array<{ id: string; name: string; address: string; phone?: string; doctorId?: number }> = [];

    // Add Demo & Partner Hospitals
    DEMO_HOSPITALS.forEach((h) => {
      list.push({
        id: `hosp-${h.id}`,
        name: h.name,
        address: h.address,
        phone: h.phone,
      });
    });

    // Add Clinics from Onboarded Doctors
    doctors?.forEach((d) => {
      const clinicName = d.clinicName || "ArogyaGenie Medical Center";
      if (!list.some((item) => item.name === clinicName)) {
        list.push({
          id: `doc-clinic-${d.id}`,
          name: clinicName,
          address: d.clinicAddress || d.address || "Health Tech Center",
          doctorId: d.id,
        });
      }
    });

    return list;
  }, [doctors]);

  // ─── 1. Doctor Form ──────────────────────────────────────────────────────────
  const doctorForm = useForm<z.infer<typeof doctorBookingSchema>>({
    resolver: zodResolver(doctorBookingSchema),
    defaultValues: {
      doctorId: initialDoctorId || 0,
      appointmentDate: todayStr,
      appointmentTime: "",
      type: "in_person",
      symptoms: "",
    },
  });

  const selectedDoctorId = doctorForm.watch("doctorId");
  const selectedDoctorDate = doctorForm.watch("appointmentDate");

  // Query real-time availability slots for doctor
  const {
    data: doctorSlotsData,
    isLoading: isLoadingDoctorSlots,
  } = useGetDoctorAvailableSlots(
    selectedDoctorId,
    { date: selectedDoctorDate },
    {
      query: {
        queryKey: getGetDoctorAvailableSlotsQueryKey(selectedDoctorId, { date: selectedDoctorDate }),
        enabled: Boolean(selectedDoctorId && selectedDoctorId > 0 && selectedDoctorDate),
      },
    }
  );

  // ─── 2. Clinic Form ──────────────────────────────────────────────────────────
  const clinicForm = useForm<z.infer<typeof clinicBookingSchema>>({
    resolver: zodResolver(clinicBookingSchema),
    defaultValues: {
      clinicId: initialHospitalId ? `hosp-${initialHospitalId}` : "",
      doctorId: 0,
      appointmentDate: todayStr,
      appointmentTime: "",
      type: "in_person",
      symptoms: "",
    },
  });

  const selectedClinicId = clinicForm.watch("clinicId");
  const selectedClinicDoctorId = clinicForm.watch("doctorId");
  const selectedClinicDate = clinicForm.watch("appointmentDate");

  // Availability slots for selected doctor in clinic
  const {
    data: clinicDoctorSlotsData,
    isLoading: isLoadingClinicSlots,
  } = useGetDoctorAvailableSlots(
    selectedClinicDoctorId,
    { date: selectedClinicDate },
    {
      query: {
        queryKey: getGetDoctorAvailableSlotsQueryKey(selectedClinicDoctorId, { date: selectedClinicDate }),
        enabled: Boolean(selectedClinicDoctorId && selectedClinicDoctorId > 0 && selectedClinicDate),
      },
    }
  );

  // ─── 3. Lab Form ─────────────────────────────────────────────────────────────
  const labForm = useForm<z.infer<typeof labBookingSchema>>({
    resolver: zodResolver(labBookingSchema),
    defaultValues: {
      diagnosticCenterId: initialCenterId || 0,
      testName: initialTestName || "",
      bookingDate: todayStr,
      bookingTime: "09:00 AM",
      notes: "",
    },
  });

  // Sync initial props whenever modal opens or props update
  useEffect(() => {
    if (open) {
      if (initialType) {
        setBookingType(initialType);
      } else if (initialDoctorId) {
        setBookingType("doctor");
      } else if (initialHospitalId) {
        setBookingType("clinic");
      } else if (initialCenterId) {
        setBookingType("lab");
      } else {
        setBookingType(null);
      }

      if (initialDoctorId) {
        doctorForm.setValue("doctorId", initialDoctorId);
      }
      if (initialHospitalId) {
        clinicForm.setValue("clinicId", `hosp-${initialHospitalId}`);
      }
      if (initialCenterId) {
        labForm.setValue("diagnosticCenterId", initialCenterId);
      }
      if (initialTestName) {
        labForm.setValue("testName", initialTestName);
      }
    }
  }, [open, initialType, initialDoctorId, initialHospitalId, initialCenterId, initialTestName]);

  // Reset time slot when doctor or date changes
  useEffect(() => {
    doctorForm.setValue("appointmentTime", "");
  }, [selectedDoctorId, selectedDoctorDate]);

  useEffect(() => {
    clinicForm.setValue("appointmentTime", "");
  }, [selectedClinicDoctorId, selectedClinicDate]);

  // Auto-set clinic doctor if clinic corresponds to a specific doctor or select first doctor
  useEffect(() => {
    if (selectedClinicId && doctors && doctors.length > 0) {
      const match = clinicOptions.find((c) => c.id === selectedClinicId);
      if (match?.doctorId) {
        clinicForm.setValue("doctorId", match.doctorId);
      } else if (!clinicForm.getValues("doctorId") || clinicForm.getValues("doctorId") === 0) {
        clinicForm.setValue("doctorId", doctors[0].id);
      }
    }
  }, [selectedClinicId, clinicOptions, doctors]);

  // ─── SUBMISSION HANDLERS ───────────────────────────────────────────────────

  const onDoctorSubmit = (data: z.infer<typeof doctorBookingSchema>) => {
    createAppointment.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Doctor Appointment Requested",
            description: `Your consultation request for ${data.appointmentDate} at ${data.appointmentTime} has been confirmed.`,
          });
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientDashboardQueryKey() });
          doctorForm.reset();
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: any) => {
          toast({
            title: "Booking Failed",
            description: err?.message || "Failed to book appointment. Please try selecting another slot.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const onClinicSubmit = (data: z.infer<typeof clinicBookingSchema>) => {
    const payload = {
      doctorId: data.doctorId,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      type: data.type,
      symptoms: data.symptoms ? `[Clinic Visit] ${data.symptoms}` : "[Clinic Visit] Routine checkup / OPD Consultation",
    };

    createAppointment.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({
            title: "Clinic Visit Booked",
            description: `Your in-person appointment for ${data.appointmentDate} at ${data.appointmentTime} has been submitted.`,
          });
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientDashboardQueryKey() });
          clinicForm.reset();
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: any) => {
          toast({
            title: "Booking Failed",
            description: err?.message || "Failed to schedule clinic visit. Please try another slot.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const onLabSubmit = (data: z.infer<typeof labBookingSchema>) => {
    createDiagnosticBooking.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Diagnostic Test Scheduled",
            description: `Your booking for "${data.testName}" on ${data.bookingDate} at ${data.bookingTime} is confirmed.`,
          });
          queryClient.invalidateQueries({ queryKey: getListDiagnosticBookingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientDashboardQueryKey() });
          labForm.reset();
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: any) => {
          toast({
            title: "Test Booking Failed",
            description: err?.message || "Could not book diagnostic test. Please check all fields.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto rounded-3xl p-6 border-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {bookingType === "doctor" && "Book Doctor Appointment"}
              {bookingType === "clinic" && "Book Clinic / Hospital Visit"}
              {bookingType === "lab" && "Book Diagnostic Lab Test"}
              {!bookingType && "Book New Appointment"}
            </DialogTitle>

            {bookingType && !initialType && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBookingType(null)}
                className="text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 h-8 px-2.5 rounded-xl gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change Type
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {bookingType === "doctor" && "Schedule a consultation with a verified medical specialist."}
            {bookingType === "clinic" && "Schedule an in-person consultation or facility visit."}
            {bookingType === "lab" && "Reserve pathology tests and radiological scans."}
            {!bookingType && "Choose the type of healthcare appointment you wish to schedule."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── STEP 1: APPOINTMENT TYPE SELECTOR ────────────────────────────────── */}
        {!bookingType && (
          <div className="space-y-3 pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Appointment Category
            </p>

            <div className="grid grid-cols-1 gap-3">
              {/* Doctor Option */}
              <button
                type="button"
                onClick={() => setBookingType("doctor")}
                className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-violet-400 hover:bg-violet-50/40 hover:shadow-md transition-all text-left flex items-start justify-between group cursor-pointer"
              >
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-violet-700 transition-colors">
                        Doctor Appointment
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                        In-Person & Online
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Consult directly with verified specialist doctors (Cardiologists, Physicians, Pediatricians, etc.).
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-violet-600 transition-colors shrink-0 mt-3" />
              </button>

              {/* Clinic Option */}
              <button
                type="button"
                onClick={() => setBookingType("clinic")}
                className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-md transition-all text-left flex items-start justify-between group cursor-pointer"
              >
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                        Clinic / Hospital Visit
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Walk-in & OPD
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Book an in-person consultation or facility visit at partner medical clinics and hospitals.
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0 mt-3" />
              </button>

              {/* Lab Test Option */}
              <button
                type="button"
                onClick={() => setBookingType("lab")}
                className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-sky-400 hover:bg-sky-50/40 hover:shadow-md transition-all text-left flex items-start justify-between group cursor-pointer"
              >
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <TestTube className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-sky-700 transition-colors">
                        Lab / Diagnostic Test
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        Tests & Scans
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Schedule pathology blood tests, radiology, digital X-rays, and MRI scans with certified labs.
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-sky-600 transition-colors shrink-0 mt-3" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2A: DOCTOR BOOKING FLOW ──────────────────────────────────── */}
        {bookingType === "doctor" && (
          <Form {...doctorForm}>
            <form onSubmit={doctorForm.handleSubmit(onDoctorSubmit)} className="space-y-4 pt-1">
              {/* Doctor Selector */}
              <FormField
                control={doctorForm.control}
                name="doctorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800 flex items-center justify-between">
                      <span>Select Doctor *</span>
                      {doctors && (
                        <span className="text-[11px] font-normal text-slate-400">
                          {doctors.length} specialists available
                        </span>
                      )}
                    </FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value && field.value > 0 ? field.value.toString() : ""}
                    >
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

              {/* Date & Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={doctorForm.control}
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
                  control={doctorForm.control}
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

              {/* Consultation Slots Grid */}
              <FormField
                control={doctorForm.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        Available Time Slots *
                      </FormLabel>
                      {doctorSlotsData?.slotDuration && (
                        <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          {doctorSlotsData.slotDuration} min intervals
                        </span>
                      )}
                    </div>

                    {!selectedDoctorId || selectedDoctorId === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
                        Please select a doctor to check available schedule slots.
                      </div>
                    ) : isLoadingDoctorSlots ? (
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Checking doctor availability slots...</span>
                      </div>
                    ) : !doctorSlotsData?.isAvailable || doctorSlotsData?.slots?.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-center text-xs text-amber-800 space-y-1">
                        <p className="font-bold flex items-center justify-center gap-1">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          No Slots Available
                        </p>
                        <p className="text-[11px] text-amber-700">
                          Doctor is not available on {doctorSlotsData?.dayOfWeek || "this date"}. Please choose another date.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[170px] overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
                          {doctorSlotsData.slots.map((slot) => {
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
                            Selected Slot: <span className="underline">{field.value}</span>
                          </p>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Symptoms / Notes */}
              <FormField
                control={doctorForm.control}
                name="symptoms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">
                      Symptoms / Reason for Visit <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your health symptoms, reason for consultation, or existing diagnosis..."
                        className="rounded-xl resize-none p-3 text-xs bg-white border-slate-200 shadow-2xs"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-11 px-5 font-semibold"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAppointment.isPending || !doctorForm.watch("appointmentTime")}
                  className="rounded-xl h-11 px-6 font-bold shadow-md text-white"
                  style={{ background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)" }}
                >
                  {createAppointment.isPending ? "Confirming Booking..." : "Confirm Doctor Appointment"}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* ─── STEP 2B: CLINIC / HOSPITAL VISIT FLOW ─────────────────────────── */}
        {bookingType === "clinic" && (
          <Form {...clinicForm}>
            <form onSubmit={clinicForm.handleSubmit(onClinicSubmit)} className="space-y-4 pt-1">
              {/* Clinic / Facility Selection */}
              <FormField
                control={clinicForm.control}
                name="clinicId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">Select Clinic or Hospital *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs">
                          <SelectValue placeholder="Choose a medical clinic or hospital..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl max-h-[260px]">
                        {clinicOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Doctor / Specialist at Clinic */}
              <FormField
                control={clinicForm.control}
                name="doctorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">Attending Specialist / Department *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value && field.value > 0 ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs">
                          <SelectValue placeholder="Choose specialist doctor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl max-h-[260px]">
                        {doctors?.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id.toString()}>
                            Dr. {doc.firstName} {doc.lastName} ({doc.specialty})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Selection */}
              <FormField
                control={clinicForm.control}
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">Visit Date *</FormLabel>
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

              {/* Available Slots Grid */}
              <FormField
                control={clinicForm.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-emerald-600" />
                      Available Checkup Slots *
                    </FormLabel>

                    {isLoadingClinicSlots ? (
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        <span>Retrieving facility consultation slots...</span>
                      </div>
                    ) : clinicDoctorSlotsData?.slots && clinicDoctorSlotsData.slots.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
                        {clinicDoctorSlotsData.slots.map((slot) => {
                          const isSelected = field.value === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => field.onChange(slot.time)}
                              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/30"
                                  : slot.available
                                  ? "bg-white text-slate-800 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/60 shadow-2xs cursor-pointer"
                                  : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed line-through opacity-60"
                              }`}
                            >
                              <span>{slot.time}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Fallback default slots if doctor schedule not explicitly configured */
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
                        {["09:30 AM", "10:30 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM", "06:30 PM"].map((timeStr) => {
                          const isSelected = field.value === timeStr;
                          return (
                            <button
                              key={timeStr}
                              type="button"
                              onClick={() => field.onChange(timeStr)}
                              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/30"
                                  : "bg-white text-slate-800 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/60 shadow-2xs cursor-pointer"
                              }`}
                            >
                              <span>{timeStr}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {field.value && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Selected Checkup Time: <span className="underline">{field.value}</span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Symptoms */}
              <FormField
                control={clinicForm.control}
                name="symptoms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">
                      Reason for Clinic Visit <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="OPD checkup, general health evaluation, routine vitals, or follow-up..."
                        className="rounded-xl resize-none p-3 text-xs bg-white border-slate-200 shadow-2xs"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-11 px-5 font-semibold"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAppointment.isPending || !clinicForm.watch("appointmentTime")}
                  className="rounded-xl h-11 px-6 font-bold shadow-md text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {createAppointment.isPending ? "Confirming Visit..." : "Confirm Clinic Appointment"}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* ─── STEP 2C: LAB / DIAGNOSTIC TEST FLOW ───────────────────────────── */}
        {bookingType === "lab" && (
          <Form {...labForm}>
            <form onSubmit={labForm.handleSubmit(onLabSubmit)} className="space-y-4 pt-1">
              {/* Diagnostic Center Selector */}
              <FormField
                control={labForm.control}
                name="diagnosticCenterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">Select Diagnostic Center *</FormLabel>
                    {diagnosticCenters && diagnosticCenters.length > 0 ? (
                      <Select
                        onValueChange={(val) => field.onChange(Number(val))}
                        value={field.value && field.value > 0 ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs">
                            <SelectValue placeholder="Choose a certified lab..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl max-h-[260px]">
                          {diagnosticCenters.map((dc) => (
                            <SelectItem key={dc.id} value={dc.id.toString()}>
                              {dc.name} — {dc.city || "Kolkata"} ({dc.accreditation || "NABL Certified"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                        ℹ️ Lab centers are loading. You can proceed with standard partner centers.
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Test Name & Suggestions */}
              <FormField
                control={labForm.control}
                name="testName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="font-semibold text-slate-800">Test or Diagnostic Scan Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Complete Blood Count (CBC) or MRI Spine"
                        className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs text-xs"
                        {...field}
                      />
                    </FormControl>

                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {LAB_TEST_SUGGESTIONS.slice(0, 6).map((test) => (
                        <button
                          key={test}
                          type="button"
                          onClick={() => field.onChange(test)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg transition-all border font-medium ${
                            field.value === test
                              ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
                          }`}
                        >
                          {test}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date & Time Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={labForm.control}
                  name="bookingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-800">Test Date *</FormLabel>
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
                  control={labForm.control}
                  name="bookingTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-800">Sample / Slot Time *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200 shadow-2xs">
                            <SelectValue placeholder="Select sample time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {DEFAULT_LAB_SLOTS.map((slot) => (
                            <SelectItem key={slot} value={slot}>
                              {slot}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Doctor Prescription / Notes */}
              <FormField
                control={labForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-800">
                      Prescription / Special Preparation Notes <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. 10 hours fasting required, prescribed by Dr. Roy for lipid monitoring..."
                        className="rounded-xl resize-none p-3 text-xs bg-white border-slate-200 shadow-2xs"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-11 px-5 font-semibold"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDiagnosticBooking.isPending || !labForm.watch("testName")}
                  className="rounded-xl h-11 px-6 font-bold shadow-md text-white bg-sky-600 hover:bg-sky-700"
                >
                  {createDiagnosticBooking.isPending ? "Scheduling Test..." : "Confirm Lab Booking"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
