import { useState } from "react";
import { useListAppointments, useCreateAppointment, useListDoctors } from "@workspace/api-client-react";
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
import { getListAppointmentsQueryKey, getGetPatientDashboardQueryKey } from "@workspace/api-client-react";
import { Calendar, Plus, Video, Phone, User, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const appointmentSchema = z.object({
  doctorId: z.coerce.number().min(1, "Please select a doctor"),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  type: z.enum(["in_person", "video", "phone"]),
  symptoms: z.string().optional(),
});

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; icon: React.ElementType; label: string }> = {
    confirmed:  { bg: "rgba(34,197,94,0.1)",   color: "#16a34a", icon: CheckCircle2, label: "Confirmed"  },
    pending:    { bg: "rgba(245,158,11,0.1)",   color: "#b45309", icon: AlertCircle,  label: "Pending"    },
    completed:  { bg: "rgba(79,70,229,0.1)",    color: "#4338ca", icon: CheckCircle2, label: "Completed"  },
    cancelled:  { bg: "rgba(239,68,68,0.1)",    color: "#dc2626", icon: XCircle,      label: "Cancelled"  },
  };
  const cfg = configs[status] ?? { bg: "rgba(100,116,139,0.1)", color: "#64748b", icon: AlertCircle, label: status };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ── Appointment type badge ────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, React.ElementType> = {
    in_person: User,
    video:     Video,
    phone:     Phone,
  };
  const Icon = icons[type] ?? User;
  const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Doctor avatar ─────────────────────────────────────────────────────────────
function DoctorAvatar({ name }: { name: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "DR";
  return (
    <div
      className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 text-white"
      style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}
    >
      {initials}
    </div>
  );
}

// ── Date badge ────────────────────────────────────────────────────────────────
function DateBadge({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const mon = d.toLocaleString("default", { month: "short" });
  return (
    <div
      className="flex flex-col items-center justify-center h-12 w-12 rounded-2xl shrink-0"
      style={{ background: "hsl(243,75%,97%)", border: "1.5px solid hsl(243,75%,87%)" }}
    >
      <span className="text-sm font-bold leading-tight" style={{ color: "hsl(243,75%,52%)" }}>{day}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight" style={{ color: "hsl(243,60%,65%)" }}>{mon}</span>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function AppointmentSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 animate-pulse" style={{ boxShadow: "0 1px 4px rgba(79,70,229,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl skeleton-shimmer shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 skeleton-shimmer rounded w-40" />
          <div className="h-3 skeleton-shimmer rounded w-28" />
          <div className="flex gap-2 mt-1">
            <div className="h-5 skeleton-shimmer rounded-full w-20" />
            <div className="h-5 skeleton-shimmer rounded-full w-16" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="h-12 w-12 rounded-2xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PatientAppointments() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: appointments, isLoading: isLoadingApt } = useListAppointments();
  const { data: doctors, isLoading: isLoadingDoc } = useListDoctors();
  const createAppointment = useCreateAppointment();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof appointmentSchema>>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      type: "in_person",
      symptoms: ""
    }
  });

  const onSubmit = (data: z.infer<typeof appointmentSchema>) => {
    createAppointment.mutate({ data }, {
      onSuccess: () => {
        setIsOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientDashboardQueryKey() });
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Appointments</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your upcoming, completed, and cancelled visits.</p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2 rounded-xl font-semibold shadow-sm text-sm h-11 px-5"
                style={{
                  background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
                  border: "none",
                  color: "white",
                }}
              >
                <Plus className="h-4 w-4" />
                Book New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Book New Appointment</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="doctorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doctor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select a doctor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {doctors?.map(doc => (
                              <SelectItem key={doc.id} value={doc.id.toString()}>
                                Dr. {doc.firstName} {doc.lastName} - {doc.specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="appointmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="appointmentTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consultation Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="in_person">In Person</SelectItem>
                            <SelectItem value="video">Video Call</SelectItem>
                            <SelectItem value="phone">Phone Call</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="symptoms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Symptoms <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Briefly describe your symptoms"
                            className="rounded-xl resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-2 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createAppointment.isPending}
                      className="rounded-xl gap-2"
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                        border: "none",
                        color: "white",
                      }}
                    >
                      {createAppointment.isPending ? "Booking..." : "Confirm Booking"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {isLoadingApt ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <AppointmentSkeleton key={i} />)}
          </div>
        ) : appointments?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <Calendar className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No appointments yet</h3>
            <p className="text-sm text-slate-500 mb-5 max-w-xs">Book your first consultation with a doctor to get started on your health journey.</p>
            <Button
              onClick={() => setIsOpen(true)}
              className="rounded-xl gap-2"
              style={{
                background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                border: "none",
                color: "white",
              }}
            >
              <Plus className="h-4 w-4" />
              Book Appointment
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments?.map(apt => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const aptDate = new Date(apt.appointmentDate);
              const isUpcoming = aptDate >= today;

              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-md"
                  style={{
                    boxShadow: "0 1px 4px rgba(79,70,229,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                    border: isUpcoming
                      ? "1px solid hsl(243,75%,93%)"
                      : "1px solid hsl(214,32%,93%)",
                  }}
                >
                  {/* Doctor avatar */}
                  <DoctorAvatar name={apt.doctorName ?? ""} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">Dr. {apt.doctorName}</p>
                    <p className="text-xs text-slate-500 truncate mb-2">{apt.doctorSpecialty}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={apt.status} />
                      <TypeBadge type={apt.type} />
                    </div>
                  </div>

                  {/* Date + time */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <DateBadge dateStr={apt.appointmentDate} />
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">{apt.appointmentTime}</span>
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
