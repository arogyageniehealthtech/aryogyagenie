import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useListDiagnosticBookings, useCreateDiagnosticBooking, useListDiagnosticCenters, getListDiagnosticBookingsQueryKey, customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { GoogleMapView, type MapProviderItem } from "@/components/map/GoogleMapView";
import { useUserLocation, QUICK_CITIES, fmtDist } from "@/hooks/useUserLocation";
import { Slider } from "@/components/ui/slider";
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
  Search, Sparkles, FileText, ArrowRight, ShieldCheck, Map as MapIcon, X,
  LayoutGrid, Star, Locate, Sliders, Navigation, Loader2, MousePointerClick, Edit3, Radio
} from "lucide-react";

const bookingSchema = z.object({
  diagnosticCenterId: z.coerce.number().min(1, "Please select a center"),
  testName: z.string().min(2, "Test name is required"),
  bookingDate: z.string().min(1, "Date is required"),
  bookingTime: z.string().optional(),
  notes: z.string().optional(),
});

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

export function PatientDiagnosticBookings() {
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "confirmed" | "pending" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Location Hook for Map View
  const {
    userLoc,
    locationName,
    isLiveGps,
    locating,
    startLiveGPS,
    handleMapClick,
    searchAddress: hookSearchAddress,
    selectQuickCity: hookSelectQuickCity,
    isSearchingAddress,
  } = useUserLocation();

  const [customAddressInput, setCustomAddressInput] = useState("");
  const [showAddressBox, setShowAddressBox] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10); // 0 km to 18 km
  const [nearbyLabs, setNearbyLabs] = useState<MapProviderItem[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyFetchError, setNearbyFetchError] = useState<string | null>(null);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);

  // Diagnostic Test quick suggestions catalog
  const DIAGNOSTIC_SUGGESTIONS = useMemo(() => [
    { title: "Complete Blood Count (CBC)", category: "Blood Test", subtitle: "Hemoglobin, WBC, RBC, Platelets & Infections", icon: "🩸" },
    { title: "Lipid Profile (Cholesterol)", category: "Cardio Health", subtitle: "Total Cholesterol, HDL, LDL & Triglycerides", icon: "🫀" },
    { title: "Thyroid Profile (T3, T4, TSH)", category: "Endocrine", subtitle: "Thyroid gland hormonal activity & metabolism", icon: "🧬" },
    { title: "Fasting Blood Sugar & HbA1c", category: "Diabetes", subtitle: "Blood glucose and 3-month average sugar level", icon: "🍬" },
    { title: "Liver Function Test (LFT)", category: "Organ Panel", subtitle: "Bilirubin, SGOT, SGPT, Protein & Liver enzymes", icon: "🧪" },
    { title: "Kidney Function Test (KFT)", category: "Organ Panel", subtitle: "Creatinine, Urea, Uric Acid & Electrolytes", icon: "🧫" },
    { title: "MRI Scan (Brain / Spine)", category: "Radiology", subtitle: "High-resolution magnetic resonance imaging", icon: "🧠" },
    { title: "Digital Chest X-Ray", category: "Radiology", subtitle: "Lungs, chest cavity & respiratory examination", icon: "🩻" },
    { title: "Ultrasound Abdomen", category: "Sonography", subtitle: "Liver, Gallbladder, Kidneys & Abdominal scan", icon: "🔊" },
    { title: "Vitamin D & B12 Test", category: "Nutritional", subtitle: "Bone density, nerve health & deficiency check", icon: "☀️" },
  ], []);

  const filteredTestSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return DIAGNOSTIC_SUGGESTIONS.slice(0, 4);
    const q = searchQuery.toLowerCase().trim();
    return DIAGNOSTIC_SUGGESTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery, DIAGNOSTIC_SUGGESTIONS]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

  // Fetch nearby diagnostic labs strictly for Map View from backend PostGIS
  const fetchNearbyLabs = useCallback(async () => {
    setLoadingNearby(true);
    setNearbyFetchError(null);
    try {
      const params = new URLSearchParams({
        lat: userLoc.lat.toString(),
        lng: userLoc.lng.toString(),
        radius: radiusKm.toString(),
        type: "diagnostic_center",
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      });
      const data = await customFetch<{ results: MapProviderItem[] }>(`/api/nearby?${params}`);
      const labResults = (data?.results || []).filter((r) => r.type === "diagnostic_center");
      setNearbyLabs(labResults);
    } catch (err: any) {
      setNearbyLabs([]);
      setNearbyFetchError(err?.message || "Failed to fetch nearby diagnostic centers. Please ensure the backend server is running.");
    } finally {
      setLoadingNearby(false);
    }
  }, [userLoc.lat, userLoc.lng, radiusKm, searchQuery]);

  useEffect(() => {
    if (viewMode === "map") {
      fetchNearbyLabs();
    }
  }, [viewMode, userLoc.lat, userLoc.lng, radiusKm, searchQuery, fetchNearbyLabs]);

  const handleSelectLab = useCallback((lab: MapProviderItem | null) => {
    setSelectedLabId(lab ? lab.id : null);
    if (lab) {
      const el = document.getElementById(`lab-list-item-${lab.type}-${lab.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, []);

  const totalCount = bookings?.length ?? 0;
  const confirmedCount = bookings?.filter(b => b.status === "confirmed")?.length ?? 0;
  const pendingCount = bookings?.filter(b => b.status === "pending" || !b.status)?.length ?? 0;
  const completedCount = bookings?.filter(b => b.status === "completed")?.length ?? 0;

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

  const searchAddress = useCallback(
    async (queryAddress: string) => {
      const found = await hookSearchAddress(queryAddress);
      if (found) setShowAddressBox(false);
    },
    [hookSearchAddress],
  );

  const selectQuickCity = useCallback(
    (city: (typeof QUICK_CITIES)[number]) => {
      hookSelectQuickCity(city);
      setShowAddressBox(false);
    },
    [hookSelectQuickCity],
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ── Top Header & Mode Toggle Bar ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TestTube className="w-6 h-6 text-primary" />
              Tests & Diagnostic Centers
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Schedule lab tests and discover certified diagnostic centers near you.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-slate-200/80">
              <button
                type="button"
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
                type="button"
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "map"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                Map View
              </button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  className="gap-2 rounded-xl font-bold shadow-sm text-xs h-9 px-4 hover:opacity-90 text-white"
                  style={{
                    background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)",
                  }}
                >
                  <Plus className="h-4 w-4" />
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
                          {centers && centers.length > 0 ? (
                            <Select onValueChange={field.onChange} value={field.value?.toString() || (selectedCenterId ? selectedCenterId.toString() : undefined)}>
                              <FormControl>
                                <SelectTrigger className="rounded-xl h-11">
                                  <SelectValue placeholder="Select a center" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                {centers.map(center => (
                                  <SelectItem key={center.id} value={center.id.toString()}>
                                    {center.name} ({center.city || "Kolkata"})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                              ℹ️ No diagnostic centers are onboarded yet. Test booking will be activated once a center onboards.
                            </div>
                          )}
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
                            <Input placeholder="e.g. Complete Blood Count (CBC)" className="rounded-xl h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="bookingDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold">Date</FormLabel>
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
                            <FormLabel className="font-semibold">Time Slot</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="rounded-xl h-11">
                                  <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="08:00 AM">08:00 AM</SelectItem>
                                <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                                <SelectItem value="02:00 PM">02:00 PM</SelectItem>
                                <SelectItem value="04:00 PM">04:00 PM</SelectItem>
                              </SelectContent>
                            </Select>
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
                          <FormLabel className="font-semibold">Doctor Prescription / Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Any specific requirements or doctor notes..." className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={createBooking.isPending}
                      className="w-full h-12 rounded-xl font-bold text-white shadow-md"
                      style={{ background: "linear-gradient(135deg, #6C63FF 0%, #4D44DB 100%)" }}
                    >
                      {createBooking.isPending ? "Confirming..." : "Confirm Booking"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── View Toggle: Map vs Grid ────────────────────────────────────────── */}
        {viewMode === "map" ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Diagnostic Centers Count Badge */}
                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center gap-1.5 shadow-2xs">
                    🔬 Verified Diagnostic Labs & Centers ({nearbyLabs.length})
                  </span>
                </div>

                {/* Location Display & Live GPS Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
                    <span className={`h-2 w-2 rounded-full ${isLiveGps ? "bg-emerald-500 animate-pulse" : "bg-primary"}`} />
                    <span className="font-medium truncate max-w-[150px]">{locationName}</span>
                    <button
                      type="button"
                      onClick={() => setShowAddressBox((s) => !s)}
                      className="text-violet-600 hover:underline font-bold ml-1 cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3 inline" />
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant={isLiveGps ? "default" : "outline"}
                    onClick={startLiveGPS}
                    disabled={locating}
                    className={`h-8 text-xs rounded-xl gap-1 font-bold ${isLiveGps ? "bg-emerald-600 text-white" : ""}`}
                  >
                    {locating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isLiveGps ? (
                      <Radio className="h-3.5 w-3.5 animate-pulse text-white" />
                    ) : (
                      <Locate className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    {isLiveGps ? "Live GPS" : "GPS"}
                  </Button>
                </div>
              </div>

              {/* Radius Controls: Slider & Quick Milestone Pills */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 max-w-md">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>Radius:</span>
                    <span className="font-bold text-sky-700 px-2 py-0.5 rounded bg-sky-50 border border-sky-200">
                      {radiusKm} km
                    </span>
                  </div>
                  <Slider
                    value={[radiusKm]}
                    min={0}
                    max={18}
                    step={1}
                    onValueChange={(vals) => setRadiusKm(vals[0])}
                    className="flex-1"
                  />
                  <span className="text-[11px] font-semibold text-slate-400 shrink-0">18 km</span>
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { label: "2 km", val: 2 },
                    { label: "5 km", val: 5 },
                    { label: "10 km", val: 10 },
                    { label: "18 km", val: 18 },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setRadiusKm(m.val)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all border ${
                        radiusKm === m.val
                          ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Selector Popup Box */}
              {showAddressBox && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Change Search Location</span>
                    <button
                      type="button"
                      onClick={() => setShowAddressBox(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customAddressInput.trim()) {
                        searchAddress(customAddressInput.trim());
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Search area (e.g. Salt Lake Sector V, Kolkata)..."
                      className="text-xs h-9 bg-white flex-1"
                      value={customAddressInput}
                      onChange={(e) => setCustomAddressInput(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSearchingAddress || !customAddressInput.trim()}
                      className="text-xs h-9"
                    >
                      {isSearchingAddress ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Set
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick:</span>
                    {QUICK_CITIES.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => selectQuickCity(c)}
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-sky-100 hover:text-sky-700 transition-all border border-slate-200/60"
                      >
                        📍 {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Split List & Google Map View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[560px] lg:h-[560px]">
              {/* Diagnostic Center List Column */}
              <div className="lg:col-span-5 max-h-[380px] lg:max-h-full overflow-y-auto pr-1 space-y-3">
                <div className="p-3 border-b border-slate-100 bg-white rounded-xl flex items-center justify-between shadow-2xs sticky top-0 z-10">
                  <p className="text-xs font-bold text-slate-700">
                    Diagnostic Centers within {radiusKm} km ({nearbyLabs.length})
                  </p>
                  <span className="text-[10px] text-sky-600 font-semibold flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" /> Click pin to inspect
                  </span>
                </div>

                {loadingNearby ? (
                  <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="font-medium">Searching verified diagnostic labs near you...</span>
                  </div>
                ) : nearbyFetchError ? (
                  <div className="p-6 rounded-2xl bg-white border border-rose-200 text-center space-y-2 shadow-2xs">
                    <p className="text-sm font-semibold text-rose-700">{nearbyFetchError}</p>
                    <p className="text-xs text-slate-500">Please check your connection and retry.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fetchNearbyLabs()}
                      className="text-xs border-slate-200"
                    >
                      Retry Discovery
                    </Button>
                  </div>
                ) : nearbyLabs.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2 shadow-2xs">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No diagnostic labs found within {radiusKm} km</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Try expanding the search radius slider up to 18 km or selecting a different location.
                    </p>
                    {radiusKm < 18 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRadiusKm(18)}
                        className="text-xs border-sky-200 text-sky-700 hover:bg-sky-50 font-bold"
                      >
                        Expand to 18 km
                      </Button>
                    )}
                  </div>
                ) : (
                  nearbyLabs.map((lab) => {
                    const isSelected = selectedLabId === lab.id;
                    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${lab.latitude},${lab.longitude}`;

                    return (
                      <div
                        id={`lab-list-item-${lab.type}-${lab.id}`}
                        key={`${lab.type}-${lab.id}`}
                        onClick={() => handleSelectLab(lab)}
                        className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-sky-50/80 border-sky-500 shadow-xs ring-2 ring-sky-500/20"
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                                🔬 Diagnostic Center
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-900">{lab.name}</h4>
                            {lab.specialty && (
                              <p className="text-xs text-sky-700 font-semibold mt-0.5">{lab.specialty}</p>
                            )}
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                            {fmtDist(lab.distanceKm)}
                          </span>
                        </div>

                        {lab.address && (
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate">{lab.address}</span>
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {lab.rating || "4.7"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={directionsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title="Directions"
                            >
                              <Navigation className="w-3 h-3 text-blue-600" />
                              Directions
                            </a>

                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCenterId(lab.id);
                                setIsOpen(true);
                              }}
                              className="h-7 text-xs font-semibold rounded-lg px-3 text-white bg-sky-600 hover:bg-sky-700"
                            >
                              Book Test
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Google Map Column */}
              <div className="lg:col-span-7 h-[360px] sm:h-[450px] lg:h-full">
                <GoogleMapView
                  userLoc={userLoc}
                  radiusKm={radiusKm}
                  providers={nearbyLabs}
                  category="diagnostic_center"
                  selectedId={selectedLabId}
                  onSelectProvider={handleSelectLab}
                  onMapClick={handleMapClick}
                  className="w-full h-full min-h-[360px] sm:min-h-[450px] lg:min-h-[500px]"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── List View: Bookings & Test Search ────────────────────────────────── */
          <>
            {/* ── Top Hero Summary Banner ────────────────────────────────────────── */}
            <div
              className="rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white"
              style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)" }}
            >
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
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-6 border-t border-white/10">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center">
                  <div className="text-2xl font-bold">{totalCount}</div>
                  <div className="text-[11px] font-medium text-violet-200/80 uppercase tracking-wider">Total Tests</div>
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
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {[
                    { id: "all", label: "All Tests" },
                    { id: "confirmed", label: "Confirmed" },
                    { id: "pending", label: "Pending" },
                    { id: "completed", label: "Completed" },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
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

                <div className="relative w-full sm:w-80" ref={searchContainerRef}>
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search test or lab center..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    className="pl-9 pr-8 h-10 rounded-xl bg-slate-50 border-slate-200/80 text-xs focus-visible:ring-violet-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Diagnostic Suggestions Dropdown */}
                  {isSearchFocused && filteredTestSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                          Popular Diagnostic Tests ({filteredTestSuggestions.length})
                        </span>
                        <span className="text-[10px] text-violet-600 font-medium">Click to select</span>
                      </div>
                      <div className="p-1.5 space-y-1">
                        {filteredTestSuggestions.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSearchQuery(item.title);
                              setIsSearchFocused(false);
                            }}
                            className="w-full flex items-start gap-3 p-2 rounded-xl text-left hover:bg-violet-50/80 transition-colors group cursor-pointer"
                          >
                            <span className="text-lg shrink-0 p-1 bg-slate-100 rounded-lg group-hover:bg-violet-100 transition-colors">
                              {item.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 group-hover:text-violet-700">
                                  {item.title}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Option Test Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Quick Options:
                </span>
                {["Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Profile", "MRI Scan", "Fasting Blood Sugar"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSearchQuery(searchQuery === opt ? "" : opt)}
                    className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all border ${
                      searchQuery === opt
                        ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Content Grid ──────────────────────────────────────────────────── */}
            {isLoadingBookings ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => <BookingSkeleton key={i} />)}
              </div>
            ) : filteredBookings?.length === 0 ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredBookings?.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
                  >
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

                      <div className="flex items-center justify-between gap-2 mb-4">
                        <StatusBadge status={booking.status} />

                        {booking.price && (
                          <span className="inline-flex items-center text-sm font-extrabold px-3 py-1 rounded-xl bg-violet-50 text-violet-700 border border-violet-100">
                            ₹{booking.price}
                          </span>
                        )}
                      </div>

                      {booking.notes && (
                        <div className="bg-slate-50 rounded-2xl p-3 mb-4 text-xs text-slate-600 border border-slate-100">
                          <span className="font-semibold text-slate-700">Notes: </span>
                          {booking.notes}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                      <span className="text-xs font-semibold text-slate-400">
                        Ref: #{booking.id}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (booking.diagnosticCenterId) {
                              setSelectedLabId(booking.diagnosticCenterId);
                            }
                            setViewMode("map");
                          }}
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
