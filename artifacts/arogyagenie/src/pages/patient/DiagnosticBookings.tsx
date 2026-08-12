import { useState } from "react";
import { useListDiagnosticBookings, useCreateDiagnosticBooking, useListDiagnosticCenters, getListDiagnosticBookingsQueryKey } from "@workspace/api-client-react";
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
import { TestTube, MapPin, Plus, Clock, CheckCircle2, AlertCircle, XCircle, Building2 } from "lucide-react";

const bookingSchema = z.object({
  diagnosticCenterId: z.coerce.number().min(1, "Please select a center"),
  testName: z.string().min(2, "Test name is required"),
  bookingDate: z.string().min(1, "Date is required"),
  bookingTime: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string | null }) {
  const s = status?.toLowerCase() || "pending";
  const configs: Record<string, { bg: string; color: string; icon: React.ElementType; label: string }> = {
    confirmed: { bg: "rgba(34,197,94,0.1)", color: "#16a34a", icon: CheckCircle2, label: "Confirmed" },
    pending: { bg: "rgba(245,158,11,0.1)", color: "#b45309", icon: AlertCircle, label: "Pending" },
    completed: { bg: "rgba(79,70,229,0.1)", color: "#4338ca", icon: CheckCircle2, label: "Completed" },
    cancelled: { bg: "rgba(239,68,68,0.1)", color: "#dc2626", icon: XCircle, label: "Cancelled" },
  };
  const cfg = configs[s] ?? { bg: "rgba(100,116,139,0.1)", color: "#64748b", icon: AlertCircle, label: s };
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

// ─── Date Badge ──────────────────────────────────────────────────────────────
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

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function BookingSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-sm animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl skeleton-shimmer shrink-0" />
        <div className="space-y-2">
          <div className="h-4 skeleton-shimmer rounded w-40" />
          <div className="h-3 skeleton-shimmer rounded w-32" />
          <div className="h-5 skeleton-shimmer rounded-full w-20" />
        </div>
      </div>
      <div className="space-y-2 text-right">
        <div className="h-4 skeleton-shimmer rounded w-16" />
        <div className="h-4 skeleton-shimmer rounded w-12" />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientDiagnosticBookings() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: bookings, isLoading: isLoadingBookings } = useListDiagnosticBookings();
  const { data: centers, isLoading: isLoadingCenters } = useListDiagnosticCenters();
  const createBooking = useCreateDiagnosticBooking();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { testName: "", notes: "" }
  });

  const onSubmit = (data: z.infer<typeof bookingSchema>) => {
    createBooking.mutate({ data }, {
      onSuccess: () => {
        setIsOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListDiagnosticBookingsQueryKey() });
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Diagnostic Tests</h1>
            <p className="text-sm text-slate-500 mt-1">Book diagnostic tests and health packages at partner centers.</p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2 rounded-xl font-semibold shadow-sm"
                style={{
                  background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                  border: "none",
                  color: "white",
                }}
              >
                <Plus className="h-4 w-4" />
                Book a Test
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Book Diagnostic Test</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="diagnosticCenterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diagnostic Center</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select a center" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            {centers?.map(center => (
                              <SelectItem key={center.id} value={center.id.toString()}>
                                {center.name} ({center.city})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="testName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Complete Blood Count, MRI, Thyroid Profile" className="rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bookingDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bookingTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Time <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
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
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any specific requirements or doctor's reference..." className="rounded-xl resize-none" rows={3} {...field} />
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
                      disabled={createBooking.isPending}
                      className="rounded-xl gap-2"
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                        border: "none",
                        color: "white",
                      }}
                    >
                      {createBooking.isPending ? "Booking..." : "Confirm Booking"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Content List ──────────────────────────────────────────────────── */}
        {isLoadingBookings ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <BookingSkeleton key={i} />)}
          </div>
        ) : bookings?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <TestTube className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No test bookings found</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-5">
              Schedule diagnostic tests and health checkup packages with certified partner labs.
            </p>
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
              Book Your First Test
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings?.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-180 gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <DateBadge dateStr={booking.bookingDate} />
                  <div className="min-w-0 space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{booking.testName}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{booking.centerName}</span>
                    </div>
                    <div className="pt-0.5">
                      <StatusBadge status={booking.status} />
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  {booking.bookingTime && (
                    <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{booking.bookingTime}</span>
                    </div>
                  )}
                  {booking.price && (
                    <div className="text-base font-bold" style={{ color: "hsl(243,75%,52%)" }}>
                      ₹{booking.price}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
