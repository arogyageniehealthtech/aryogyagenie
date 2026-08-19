import { useEffect, useState } from "react";
import { useGetDoctorProfile, useUpdateDoctorProfile, getGetDoctorProfileQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Building, Award, Clock, DollarSign, Save, Calendar, Check, X } from "lucide-react";
import { DOCTOR_SPECIALTIES } from "@/lib/specialties";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

interface DayScheduleState {
  available: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_SCHEDULE: Record<Weekday, DayScheduleState> = {
  Monday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
  Tuesday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
  Wednesday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
  Thursday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
  Friday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
  Saturday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
  Sunday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
};

const TIME_OPTIONS = [
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM",
];

const doctorProfileSchema = z.object({
  specialty: z.string().min(2, "Specialty is required"),
  qualification: z.string().optional(),
  licenseNumber: z.string().optional(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  consultationFee: z.coerce.number().min(0, "Consultation fee must be >= 0").optional(),
  experience: z.coerce.number().min(0, "Experience must be >= 0").optional(),
  bio: z.string().optional(),
  availableDays: z.string().optional(),
  availableHours: z.string().optional(),
});

export function DoctorProfile() {
  const { data: profile, isLoading } = useGetDoctorProfile();
  const updateProfile = useUpdateDoctorProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [weeklySchedule, setWeeklySchedule] = useState<Record<Weekday, DayScheduleState>>(DEFAULT_SCHEDULE);

  const form = useForm<z.infer<typeof doctorProfileSchema>>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      specialty: "General Physician",
      qualification: "",
      licenseNumber: "",
      clinicName: "",
      clinicAddress: "",
      consultationFee: 0,
      experience: 0,
      bio: "",
      availableDays: "",
      availableHours: "",
    },
  });

  useEffect(() => {
    if (profile) {
      const normalizedSpec = DOCTOR_SPECIALTIES.find(s => 
        s.toLowerCase() === (profile.specialty || "").toLowerCase() ||
        (profile.specialty || "").toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes((profile.specialty || "").toLowerCase())
      ) || profile.specialty || "General Physician";

      form.reset({
        specialty: normalizedSpec,
        qualification: profile.qualification ?? "",
        licenseNumber: profile.licenseNumber ?? "",
        clinicName: profile.clinicName ?? "",
        clinicAddress: profile.clinicAddress ?? "",
        consultationFee: profile.consultationFee ?? 0,
        experience: profile.experience ?? 0,
        bio: profile.bio ?? "",
        availableDays: profile.availableDays ?? "",
        availableHours: profile.availableHours ?? "",
      });

      // Parse scheduleConfig if returned or deserialize from availableHours / availableDays
      const rawCfg = (profile as any).scheduleConfig;
      if (rawCfg && rawCfg.schedule) {
        setWeeklySchedule({
          ...DEFAULT_SCHEDULE,
          ...rawCfg.schedule,
        });
        if (rawCfg.slotDuration) setSlotDuration(rawCfg.slotDuration);
      } else if (profile.availableHours && profile.availableHours.startsWith("{")) {
        try {
          const parsed = JSON.parse(profile.availableHours);
          if (parsed.schedule) {
            setWeeklySchedule({ ...DEFAULT_SCHEDULE, ...parsed.schedule });
            if (parsed.slotDuration) setSlotDuration(parsed.slotDuration);
          }
        } catch {
          // fallback
        }
      }
    }
  }, [profile, form]);

  const handleToggleDay = (day: Weekday) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        available: !prev[day].available,
      },
    }));
  };

  const handleTimeChange = (day: Weekday, field: "startTime" | "endTime", value: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleApplyPreset = (preset: "mon-fri" | "mon-sat" | "all") => {
    const updated = { ...weeklySchedule };
    WEEKDAYS.forEach((day) => {
      const isWeekend = day === "Saturday" || day === "Sunday";
      if (preset === "mon-fri") {
        updated[day] = { available: !isWeekend, startTime: "09:00 AM", endTime: "05:00 PM" };
      } else if (preset === "mon-sat") {
        updated[day] = { available: day !== "Sunday", startTime: "09:00 AM", endTime: "05:00 PM" };
      } else {
        updated[day] = { available: true, startTime: "09:00 AM", endTime: "05:00 PM" };
      }
    });
    setWeeklySchedule(updated);
  };

  const onSubmit = (data: z.infer<typeof doctorProfileSchema>) => {
    const scheduleConfig = {
      slotDuration,
      schedule: weeklySchedule,
    };

    const activeDays = Object.entries(weeklySchedule)
      .filter(([_, s]) => s.available)
      .map(([d]) => d.slice(0, 3));
    const availableDaysSummary = activeDays.length > 0 ? activeDays.join(", ") : "None";

    const payload: any = {
      ...data,
      scheduleConfig,
      availableDays: availableDaysSummary,
      availableHours: JSON.stringify(scheduleConfig),
    };

    updateProfile.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({
            title: "Profile & Schedule Saved",
            description: "Doctor profile settings and consultation availability updated successfully.",
          });
          queryClient.invalidateQueries({ queryKey: getGetDoctorProfileQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Failed to Save Profile",
            description: err instanceof Error ? err.message : "Error saving profile",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading doctor profile...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Profile & Settings</h1>
          <p className="text-slate-500 mt-1">Manage your medical qualifications, clinic information, and patient consultation availability.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Professional Info */}
            <Card>
              <CardHeader className="bg-slate-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Professional Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Specialty *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {DOCTOR_SPECIALTIES.map((spec) => (
                              <option key={spec} value={spec}>
                                {spec}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qualification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qualifications</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MBBS, MD (Internal Medicine)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical License Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MED-89410-IN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experience (Years)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="consultationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consultation Fee ($)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor Bio / Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of your clinical expertise and practice philosophy..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Clinic Info */}
            <Card>
              <CardHeader className="bg-slate-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Clinic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clinicName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic / Hospital Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Arogya Health Clinic" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clinicAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 123 Healthcare Ave, Suite 400" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Consultation Schedule & Availability Manager */}
            <Card className="border-indigo-100 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-violet-50/70 to-indigo-50/50 pb-4 border-b border-indigo-100/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                      <Clock className="h-5 w-5 text-primary" />
                      Consultation Schedule & Slot Duration
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Configure your available days, consultation hours, and slot intervals. Patients can only book from these defined slots.
                    </p>
                  </div>

                  {/* Slot Duration Selector */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                    <span className="text-xs font-semibold text-slate-600">Slot Duration:</span>
                    <select
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(Number(e.target.value))}
                      className="text-xs font-bold text-violet-700 bg-violet-50 rounded-lg px-2 py-1 border border-violet-200 outline-none cursor-pointer"
                    >
                      <option value={15}>15 mins</option>
                      <option value={20}>20 mins</option>
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins</option>
                    </select>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 pt-3 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Templates:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("mon-fri")}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-violet-50 hover:text-violet-700 font-medium transition-all"
                  >
                    Mon – Fri (9 AM – 5 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("mon-sat")}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-violet-50 hover:text-violet-700 font-medium transition-all"
                  >
                    Mon – Sat (9 AM – 5 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("all")}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-violet-50 hover:text-violet-700 font-medium transition-all"
                  >
                    All 7 Days
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-3">
                {WEEKDAYS.map((day) => {
                  const schedule = weeklySchedule[day] || { available: false, startTime: "09:00 AM", endTime: "05:00 PM" };
                  return (
                    <div
                      key={day}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        schedule.available
                          ? "bg-white border-slate-200 shadow-2xs"
                          : "bg-slate-50/70 border-slate-200/60 opacity-80"
                      }`}
                    >
                      {/* Day Toggle */}
                      <div className="flex items-center gap-3 w-40 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleDay(day)}
                          className={`h-7 w-7 rounded-xl flex items-center justify-center transition-all ${
                            schedule.available
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                          }`}
                          title={schedule.available ? "Mark as day off" : "Mark as available"}
                        >
                          {schedule.available ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                        <span className={`text-sm font-bold ${schedule.available ? "text-slate-900" : "text-slate-500"}`}>
                          {day}
                        </span>
                      </div>

                      {/* Working Hours Time Pickers */}
                      {schedule.available ? (
                        <div className="flex items-center gap-2.5 flex-1 max-w-md">
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="text-xs text-slate-500 font-medium shrink-0">From:</span>
                            <select
                              value={schedule.startTime}
                              onChange={(e) => handleTimeChange(day, "startTime", e.target.value)}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs outline-none focus:ring-2 focus:ring-violet-500"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-xs text-slate-400 font-bold shrink-0">→</span>

                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="text-xs text-slate-500 font-medium shrink-0">To:</span>
                            <select
                              value={schedule.endTime}
                              onChange={(e) => handleTimeChange(day, "endTime", e.target.value)}
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs outline-none focus:ring-2 focus:ring-violet-500"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          Unavailable / Day Off
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" className="gap-2 min-w-[180px]" disabled={updateProfile.isPending}>
                <Save className="h-4 w-4" />
                {updateProfile.isPending ? "Saving Profile..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
