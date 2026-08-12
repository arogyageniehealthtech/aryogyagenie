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
import {
  TestTube, MapPin, Plus, Clock, CheckCircle2, AlertCircle, XCircle, Building2,
  Search, Sparkles, FileText, ArrowRight, ShieldCheck
} from "lucide-react";

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
    confirmed: { bg: "rgba(34,197,94,0.12)", color: "#15803d", icon: CheckCircle2, label: "Confirmed" },
    pending:   { bg: "rgba(245,158,11,0.12)", color: "#b45309", icon: AlertCircle,  label: "Pending" },
    completed: { bg: "rgba(99,102,241,0.12)", color: "#4338ca", icon: CheckCircle2, label: "Completed" },
    cancelled: { bg: "rgba(239,68,68,0.12)", color: "#b91c1c", icon: XCircle,      label: "Cancelled" },
  };
  const cfg = configs[s] ?? { bg: "rgba(100,116,139,0.12)", color: "#475569", icon: AlertCircle, label: s };
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

// ─── Date Badge ──────────────────────────────────────────────────────────────
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

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function BookingSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
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
      <div className="h-6 skeleton-shimmer rounded-full w-24" />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientDiagnosticBookings() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "confirmed" | "pending" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bookings, isLoading: isLoadingBookings } = useListDiagnosticBookings();
  const { data: centers } = useListDiagnosticCenters();
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

  // Metrics computation
  const totalCount = bookings?.length ?? 0;
  const confirmedCount = bookings?.filter(b => b.status === "confirmed")?.length ?? 0;
  const pendingCount = bookings?.filter(b => b.status === "pending" || !b.status)?.length ?? 0;
  const completedCount = bookings?.filter(b => b.status === "completed")?.length ?? 0;

  // Filtered bookings
  const filteredBookings = bookings?.filter(b => {
    const statusStr = b.status?.toLowerCase() || "pending";
    const matchesFilter =
      activeFilter === "all" ? true :
      activeFilter === "confirmed" ? statusStr === "confirmed" :
      activeFilter === "pending" ? statusStr === "pending" :
      activeFilter === "completed" ? statusStr === "completed" : true;

    const matchesSearch =
      !searchQuery ||
      b.testName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.centerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Top Hero Summary Banner ────────────────────────────────────────── */}
        <div
          className="rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)" }}
        >
          {/* Glowing background shapes */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute right-1/3 -top-10 w-48 h-48 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-violet-200 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Diagnostics & Labs</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Diagnostic Tests</h1>
              <p className="text-sm text-violet-200/80 mt-1 max-w-md">
                Schedule diagnostic tests and health packages at certified partner centers.
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
                  Book a Test
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Book Diagnostic Test</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="diagnosticCenterId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Diagnostic Center</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl h-11">
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
                          <FormLabel className="font-semibold">Test Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Complete Blood Count, MRI, Thyroid Profile" className="rounded-xl h-11" {...field} />
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
                            <FormLabel className="font-semibold">Preferred Date</FormLabel>
                            <FormControl>
                              <Input type="date" className="rounded-xl h-11" {...field} />
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
                            <FormLabel className="font-semibold">Preferred Time <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
                            <FormControl>
                              <Input type="time" className="rounded-xl h-11" {...field} />
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
                          <FormLabel className="font-semibold">Additional Notes <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Textarea placeholder="Any specific requirements or doctor's reference..." className="rounded-xl resize-none p-3" rows={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-3 flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl h-11 px-5 font-semibold"
                        onClick={() => setIsOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createBooking.isPending}
                        className="rounded-xl h-11 px-6 font-bold shadow-md"
                        style={{
                          background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
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

          {/* Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold">{totalCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Total Booked</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-bold text-emerald-300">{confirmedCount}</div>
              <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Confirmed</div>
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
              { id: "all", label: "All Tests" },
              { id: "confirmed", label: "Confirmed" },
              { id: "pending", label: "Pending" },
              { id: "completed", label: "Completed" },
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
              placeholder="Search test or lab center..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200/80 text-xs focus-visible:ring-violet-500"
            />
          </div>
        </div>

        {/* ── Content Grid ──────────────────────────────────────────────────── */}
        {isLoadingBookings ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <BookingSkeleton key={i} />)}
          </div>
        ) : filteredBookings?.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="h-20 w-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-4 text-violet-600">
              <TestTube className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No diagnostic test bookings found</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              {searchQuery || activeFilter !== "all"
                ? "No test bookings match your search filter. Try clearing your search or filter."
                : "You don't have any diagnostic tests scheduled yet. Book your lab tests now."}
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
              Book Test
            </Button>
          </div>
        ) : (
          /* 2-Column Responsive Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredBookings?.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
              >
                {/* Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />

                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md"
                        style={{ background: "linear-gradient(135deg, #6C63FF 0%, #3B3FBF 100%)" }}
                      >
                        <TestTube className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-violet-600 transition-colors">
                          {booking.testName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mb-1">
                          <Building2 className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <span className="truncate font-semibold">{booking.centerName}</span>
                        </div>
                        {booking.bookingTime && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5 text-violet-500" />
                            <span className="font-semibold text-slate-700">{booking.bookingTime}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <DateBadge dateStr={booking.bookingDate} />
                  </div>

                  {/* Badges & Pricing */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <StatusBadge status={booking.status} />

                    {booking.price && (
                      <span className="inline-flex items-center text-sm font-extrabold px-3 py-1 rounded-xl bg-violet-50 text-violet-700 border border-violet-100">
                        ₹{booking.price}
                      </span>
                    )}
                  </div>

                  {/* Notes / Special Instructions if present */}
                  {booking.notes && (
                    <div className="bg-slate-50 rounded-2xl p-3 mb-4 text-xs text-slate-600 border border-slate-100">
                      <span className="font-semibold text-slate-700">Notes: </span>
                      {booking.notes}
                    </div>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <span className="text-xs font-semibold text-slate-400">
                    Ref: #{booking.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-9 text-xs font-semibold hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
                    >
                      Lab Directions
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
