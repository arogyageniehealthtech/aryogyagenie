import React, { useState, useEffect, useMemo } from "react";
import { useListPrescriptions, customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import {
  Pill,
  Clock,
  Repeat,
  FileText,
  CheckCircle2,
  Stethoscope,
  Calendar,
  Truck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Flame,
  Search,
  Store,
  Package,
  Check,
  ShoppingBag,
  Heart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PatientMedicineItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  date: string;
  sourceType: "prescription" | "pharmacy_order";
  providerName: string;
  prescriptionId?: number | null;
  orderId?: number | null;
  status: string;
  diagnosis?: string | null;
  totalPrice?: number | null;
  dailyTimes: string[];
  isActiveReminder: boolean;
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function MedicineCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-sm animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl skeleton-shimmer shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 skeleton-shimmer rounded w-28" />
            <div className="h-3 skeleton-shimmer rounded w-16" />
          </div>
        </div>
        <div className="h-5 w-9 skeleton-shimmer rounded-full" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="flex justify-between">
          <div className="h-3 skeleton-shimmer rounded w-16" />
          <div className="h-3 skeleton-shimmer rounded w-20" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 skeleton-shimmer rounded w-12" />
          <div className="h-3 skeleton-shimmer rounded w-24" />
        </div>
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
        <div className="h-8 w-8 skeleton-shimmer rounded-lg" />
      </div>
    </div>
  );
}

export function PatientMedicineReminders() {
  const { data: prescriptions, isLoading: isRxLoading } = useListPrescriptions();
  const [orders, setOrders] = useState<any[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "prescription" | "pharmacy_order">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReminders, setActiveReminders] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch all pharmacy doorstep purchases and OTC orders
  useEffect(() => {
    let isMounted = true;
    setIsOrdersLoading(true);
    customFetch<any[]>("/api/medicine-orders")
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setOrders(data);
        }
      })
      .catch((err) => console.error("Error fetching medicine orders:", err))
      .finally(() => {
        if (isMounted) setIsOrdersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Combine and parse all medicines (Both Prescriptions & Normal / OTC Platform Purchases)
  const allPatientMedicines = useMemo<PatientMedicineItem[]>(() => {
    const list: PatientMedicineItem[] = [];

    // 1. Extract Doctor Prescriptions
    if (prescriptions && Array.isArray(prescriptions)) {
      prescriptions.forEach((rx) => {
        const rxDate = rx.prescribedDate
          ? new Date(rx.prescribedDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Recent";

        if (!rx.medicines) return;

        let parsedJson = false;
        try {
          if (rx.medicines.trim().startsWith("[") || rx.medicines.trim().startsWith("{")) {
            const parsed = JSON.parse(rx.medicines);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            items.forEach((item: any, idx: number) => {
              if (item && (item.name || item.medicineName)) {
                parsedJson = true;
                const name = item.name || item.medicineName || "Prescribed Medicine";
                const id = `rx-${rx.id}-item-${idx}-${name.replace(/\s+/g, "_")}`;
                list.push({
                  id,
                  name,
                  dosage: item.dosage || "1 dose",
                  frequency: item.frequency || "Twice Daily",
                  duration: item.duration || "5 days",
                  instructions: item.instructions || rx.instructions || "Take as directed by doctor",
                  date: rxDate,
                  sourceType: "prescription",
                  providerName: `Dr. ${rx.doctorName || "Consultant"}`,
                  prescriptionId: rx.id,
                  status: rx.status || "active",
                  diagnosis: rx.diagnosis || null,
                  dailyTimes: ["08:00 AM", "08:00 PM"],
                  isActiveReminder: activeReminders[id] ?? true,
                });
              }
            });
          }
        } catch {
          parsedJson = false;
        }

        if (!parsedJson) {
          const lines = rx.medicines
            .split(/\n|\r\n|;/)
            .map((l) => l.trim())
            .filter(Boolean);

          lines.forEach((line, idx) => {
            const id = `rx-${rx.id}-line-${idx}`;
            const parts = line.split(/-|•|\(|\)/).map((p) => p.trim()).filter(Boolean);
            const name = parts[0] || line;
            const dosage = parts[1] || "1 unit";
            const freq = parts[2] || "Twice Daily";

            list.push({
              id,
              name,
              dosage,
              frequency: freq,
              duration: "As prescribed",
              instructions: rx.instructions || "Take as directed by physician",
              date: rxDate,
              sourceType: "prescription",
              providerName: `Dr. ${rx.doctorName || "Consultant"}`,
              prescriptionId: rx.id,
              status: rx.status || "active",
              diagnosis: rx.diagnosis || null,
              dailyTimes: ["08:00 AM", "08:00 PM"],
              isActiveReminder: activeReminders[id] ?? true,
            });
          });
        }
      });
    }

    // 2. Extract Normal / OTC / Doorstep Purchases
    if (orders && Array.isArray(orders)) {
      orders.forEach((order) => {
        const orderDate = order.createdAt
          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Recent";

        if (!order.medicines) return;

        // Split multiple medicines if ordered together
        const medLines = order.medicines
          .split(/\n|\r\n|,|;/)
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0 && !l.startsWith("[Attached"));

        medLines.forEach((medName: string, idx: number) => {
          const id = `order-${order.id}-item-${idx}-${medName.replace(/\s+/g, "_")}`;
          
          // Avoid duplicate display if already pulled from doctor prescription id
          if (order.prescriptionId && list.some((m) => m.prescriptionId === order.prescriptionId && m.name.toLowerCase() === medName.toLowerCase())) {
            return;
          }

          list.push({
            id,
            name: medName,
            dosage: "As per pack / 1 dose",
            frequency: "As needed / Daily",
            duration: "Fulfilled via Platform",
            instructions: order.notes || "Stored safely in home medicine cabinet",
            date: orderDate,
            sourceType: "pharmacy_order",
            providerName: order.pharmacyName || "Apex Healthcare Pharmacy",
            prescriptionId: order.prescriptionId || null,
            orderId: order.id,
            status: order.status || "delivered",
            totalPrice: order.totalPrice || null,
            dailyTimes: ["08:00 AM", "08:00 PM"],
            isActiveReminder: activeReminders[id] ?? true,
          });
        });
      });
    }

    return list;
  }, [prescriptions, orders, activeReminders]);

  // Filter by Tab and Search
  const filteredMedicines = useMemo(() => {
    return allPatientMedicines.filter((med) => {
      const matchesTab = activeTab === "all" || med.sourceType === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        med.name.toLowerCase().includes(q) ||
        med.providerName.toLowerCase().includes(q) ||
        (med.diagnosis && med.diagnosis.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [allPatientMedicines, activeTab, searchQuery]);

  const toggleReminder = (id: string) => {
    setActiveReminders((prev) => {
      const nextVal = !(prev[id] ?? true);
      toast({
        title: nextVal ? "Dose Reminder Activated" : "Dose Reminder Paused",
        description: `Daily dose notifications ${nextVal ? "enabled" : "paused"} for this medicine.`,
      });
      return { ...prev, [id]: nextVal };
    });
  };

  const rxCount = allPatientMedicines.filter((m) => m.sourceType === "prescription").length;
  const orderCount = allPatientMedicines.filter((m) => m.sourceType === "pharmacy_order").length;
  const activeReminderCount = allPatientMedicines.filter((m) => m.isActiveReminder).length;

  const isLoading = isRxLoading || isOrdersLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Medical History</span>
              <Badge className="bg-emerald-600 text-white font-bold text-xs">
                {allPatientMedicines.length} Medicines on Record
              </Badge>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Complete history of medications taken on the platform — including doctor prescriptions, OTC purchases, and doorstep deliveries.
            </p>
          </div>

          <Link href="/patient/prescriptions">
            <Button className="rounded-xl font-bold text-xs gap-2 shadow-xs bg-slate-900 hover:bg-slate-800 text-white self-start sm:self-auto shrink-0 h-10 px-4 transition-all">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Order Medicine</span>
            </Button>
          </Link>
        </div>

        {/* ── Metric Summary Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab("all")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "all" ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/40" : "bg-white border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>All Medicines</span>
              <Pill className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{allPatientMedicines.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Total platform items</p>
          </div>

          <div
            onClick={() => setActiveTab("prescription")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "prescription" ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-400/40" : "bg-white border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Doctor Prescriptions</span>
              <Stethoscope className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{rxCount}</div>
            <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">Clinical doctor Rx</p>
          </div>

          <div
            onClick={() => setActiveTab("pharmacy_order")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "pharmacy_order" ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/40" : "bg-white border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Pharmacy Purchases</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{orderCount}</div>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">Doorstep & OTC orders</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Dose Reminders</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{activeReminderCount}</div>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">Active daily alerts</p>
          </div>
        </div>

        {/* ── Filter Bar & Search ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "all" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All ({allPatientMedicines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prescription")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "prescription" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              🩺 Doctor Prescriptions ({rxCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pharmacy_order")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "pharmacy_order" ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              📦 Pharmacy & OTC ({orderCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search medicine or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* ── Content Grid ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <MedicineCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-1"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <Pill className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {searchQuery ? "No Matching Medicines Found" : "No Medicines on Record Yet"}
            </h3>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              When doctors issue prescriptions or when you purchase OTC medicines and doorstep deliveries through the platform, all your medications appear here.
            </p>
            <Link href="/patient/prescriptions">
              <Button className="rounded-xl gap-2 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <FileText className="h-4 w-4" />
                Go to Order Medicine & Request Deliveries
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMedicines.map((med) => {
              const isActive = med.isActiveReminder;
              const isPrescription = med.sourceType === "prescription";

              return (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all duration-180 ${
                    isActive ? "border-slate-100/90 hover:shadow-md" : "border-slate-200/70 bg-slate-50/60 opacity-75"
                  }`}
                >
                  <div>
                    {/* Top Accent Line */}
                    <div
                      className="h-1.5 w-full"
                      style={{
                        background: isPrescription
                          ? "linear-gradient(90deg, hsl(243,75%,59%), hsl(260,70%,58%))"
                          : "linear-gradient(90deg, hsl(158,60%,42%), hsl(38,92%,50%))",
                      }}
                    />

                    <div className="p-5 space-y-4">
                      {/* Header row: Icon, Name, Dosage, Source Badge, Switch */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{
                              background: isPrescription
                                ? "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))"
                                : "linear-gradient(135deg, hsl(158,60%,42%), hsl(158,50%,34%))",
                            }}
                          >
                            <Pill className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-sm leading-snug">{med.name}</h3>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md"
                                style={{
                                  background: isPrescription ? "rgba(79,70,229,0.1)" : "rgba(16,185,129,0.1)",
                                  color: isPrescription ? "#4f46e5" : "#059669",
                                }}
                              >
                                {med.dosage}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  isPrescription
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}
                              >
                                {isPrescription ? "Doctor Prescription" : "Pharmacy Purchase"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Switch toggle for daily schedule reminder */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Switch checked={isActive} onCheckedChange={() => toggleReminder(med.id)} />
                          <span className="text-[10px] text-slate-400 font-medium">{isActive ? "Active" : "Paused"}</span>
                        </div>
                      </div>

                      {/* Origin Details (Doctor or Pharmacy) */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1 font-semibold">
                            {isPrescription ? (
                              <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <Store className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            {med.providerName}
                          </span>
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {med.date}
                          </span>
                        </div>
                        {med.diagnosis && (
                          <p className="text-[11px] text-slate-500 truncate">
                            <strong>Diagnosis:</strong> {med.diagnosis}
                          </p>
                        )}
                        {med.totalPrice && (
                          <p className="text-[11px] text-emerald-700 font-semibold">
                            Billed: ₹{med.totalPrice} • Doorstep delivery
                          </p>
                        )}
                      </div>

                      {/* Detail Rows */}
                      <div className="space-y-2 pt-1 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Repeat className="h-3.5 w-3.5" />
                            Dosage / Frequency
                          </span>
                          <span className="font-semibold text-slate-800">{med.frequency}</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            Daily Schedule
                          </span>
                          <div className="flex items-center gap-1">
                            {med.dailyTimes.map((time, tIdx) => (
                              <span
                                key={tIdx}
                                className="font-semibold px-2 py-0.5 rounded-md text-[11px]"
                                style={{ background: "hsl(243,75%,96%)", color: "hsl(243,75%,50%)" }}
                              >
                                {time}
                              </span>
                            ))}
                          </div>
                        </div>

                        {med.instructions && (
                          <div className="pt-2 border-t border-slate-100 text-slate-600">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                              Clinical Instructions & Notes
                            </span>
                            <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {med.instructions}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Platform Verified
                    </span>

                    <Link href="/patient/prescriptions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg gap-1 font-semibold"
                      >
                        {isPrescription ? "View Rx Details" : "Re-order via 1-Click"}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
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

export const PatientMedicalHistory = PatientMedicineReminders;
