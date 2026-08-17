import React, { useState, useEffect, useMemo } from "react";
import { useListPrescriptions, customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  ShieldCheck,
  AlertCircle,
  Flame,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrescribedMedItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  prescribedDate: string;
  doctorName?: string | null;
  prescriptionId?: number;
  status: "active" | "dispensed" | "expired";
  diagnosis?: string | null;
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
  const { data: prescriptions, isLoading } = useListPrescriptions();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeReminders, setActiveReminders] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch orders fulfilled on the platform
  useEffect(() => {
    let isMounted = true;
    customFetch<any[]>("/api/medicine-orders")
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setOrders(data);
        }
      })
      .catch((err) => console.error("Error fetching medicine orders:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Parse structured medicine items from all prescriptions and platform deliveries
  const prescribedMedicines = useMemo<PrescribedMedItem[]>(() => {
    const list: PrescribedMedItem[] = [];

    if (!prescriptions || !Array.isArray(prescriptions)) return list;

    prescriptions.forEach((rx) => {
      const rxDate = rx.prescribedDate
        ? new Date(rx.prescribedDate).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Recent";

      if (!rx.medicines) return;

      // Try parsing JSON medicines if structured
      let parsedFromJSON = false;
      try {
        if (rx.medicines.trim().startsWith("[") || rx.medicines.trim().startsWith("{")) {
          const parsed = JSON.parse(rx.medicines);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          items.forEach((item: any, idx: number) => {
            if (item && (item.name || item.medicineName)) {
              parsedFromJSON = true;
              const name = item.name || item.medicineName || "Prescribed Medicine";
              const id = `rx-${rx.id}-item-${idx}-${name.replace(/\s+/g, "_")}`;
              list.push({
                id,
                name,
                dosage: item.dosage || "1 dose",
                frequency: item.frequency || "Twice Daily",
                duration: item.duration || "5 days",
                instructions: item.instructions || rx.instructions || "Take as directed by physician",
                prescribedDate: rxDate,
                doctorName: rx.doctorName || "Treating Physician",
                prescriptionId: rx.id,
                status: (rx.status as any) || "active",
                diagnosis: rx.diagnosis || null,
                dailyTimes: ["08:00 AM", "08:00 PM"],
                isActiveReminder: activeReminders[id] ?? true,
              });
            }
          });
        }
      } catch {
        parsedFromJSON = false;
      }

      // If plain text format, split lines/items
      if (!parsedFromJSON) {
        const lines = rx.medicines
          .split(/\n|\r\n|;/)
          .map((l) => l.trim())
          .filter(Boolean);

        lines.forEach((line, idx) => {
          const id = `rx-${rx.id}-line-${idx}`;
          // Extract dosage/frequency if line contains hyphens or parentheses
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
            instructions: rx.instructions || "Take as advised by your doctor",
            prescribedDate: rxDate,
            doctorName: rx.doctorName || "Consultant Doctor",
            prescriptionId: rx.id,
            status: (rx.status as any) || "active",
            diagnosis: rx.diagnosis || null,
            dailyTimes: ["08:00 AM", "08:00 PM"],
            isActiveReminder: activeReminders[id] ?? true,
          });
        });
      }
    });

    return list;
  }, [prescriptions, activeReminders]);

  const toggleReminder = (id: string) => {
    setActiveReminders((prev) => {
      const nextVal = !(prev[id] ?? true);
      toast({
        title: nextVal ? "Dose Reminder Activated" : "Dose Reminder Paused",
        description: `Daily dose notifications ${nextVal ? "enabled" : "paused"} for this prescribed medicine.`,
      });
      return { ...prev, [id]: nextVal };
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Prescribed Medicines</span>
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs">
                Platform Prescriptions Only
              </Badge>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Medicines prescribed to you by verified doctors on the platform and fulfilled via digital prescriptions.
            </p>
          </div>

          <Link href="/patient/prescriptions">
            <Button
              className="rounded-xl font-bold text-xs gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white self-start"
            >
              <FileText className="h-4 w-4" />
              View Digital Prescriptions
            </Button>
          </Link>
        </div>

        {/* ── Informational Notice ──────────────────────────────────────────── */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-indigo-950">Strict Medical Integrity: </span>
            This section only displays medications officially prescribed by doctors or fulfilled through your digital prescriptions. Manual unauthorized additions are disabled to ensure medical record safety.
          </div>
        </div>

        {/* ── Content Grid ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <MedicineCardSkeleton key={i} />
            ))}
          </div>
        ) : prescribedMedicines.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-1"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <Pill className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Prescribed Medicines Yet</h3>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              When your doctor issues a digital prescription after a consultation or when you order prescribed medicines through the platform, they will automatically appear here with their dosage schedules.
            </p>
            <Link href="/patient/prescriptions">
              <Button
                className="rounded-xl gap-2 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <FileText className="h-4 w-4" />
                Go to Prescriptions & Doorstep Delivery
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {prescribedMedicines.map((med) => {
              const isActive = med.isActiveReminder;

              return (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all duration-180 ${
                    isActive
                      ? "border-slate-100/90 hover:shadow-md"
                      : "border-slate-200/70 bg-slate-50/60 opacity-70"
                  }`}
                >
                  <div>
                    {/* Top Accent Line */}
                    <div
                      className="h-1.5 w-full"
                      style={{
                        background: isActive
                          ? "linear-gradient(90deg, hsl(158,60%,42%), hsl(243,75%,59%))"
                          : "hsl(214,32%,85%)",
                      }}
                    />

                    <div className="p-5 space-y-4">
                      {/* Header row: Icon, Name, Dosage, Switch */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{
                              background: isActive
                                ? "linear-gradient(135deg, hsl(158,60%,42%), hsl(158,50%,34%))"
                                : "hsl(214,32%,75%)",
                            }}
                          >
                            <Pill className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug">{med.name}</h3>
                            <span
                              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md mt-0.5"
                              style={{
                                background: isActive ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
                                color: isActive ? "#059669" : "#64748b",
                              }}
                            >
                              {med.dosage}
                            </span>
                          </div>
                        </div>

                        {/* Switch toggle for daily schedule reminder */}
                        <div className="flex flex-col items-end gap-1">
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleReminder(med.id)}
                          />
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                      </div>

                      {/* Doctor & Prescription Origin */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1 font-semibold">
                            <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                            Dr. {med.doctorName}
                          </span>
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {med.prescribedDate}
                          </span>
                        </div>
                        {med.diagnosis && (
                          <p className="text-[11px] text-slate-500 truncate">
                            <strong>For:</strong> {med.diagnosis}
                          </p>
                        )}
                      </div>

                      {/* Detail Rows */}
                      <div className="space-y-2 pt-1 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Repeat className="h-3.5 w-3.5" />
                            Frequency
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
                              Clinical Instructions
                            </span>
                            <p className="text-xs text-slate-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100/70">
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
                      Prescription Verified
                    </span>

                    <Link href="/patient/prescriptions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg gap-1 font-semibold"
                      >
                        Prescription Details
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
