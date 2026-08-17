import React, { useState, useEffect, useMemo } from "react";
import { useListPrescriptions } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import {
  FileText,
  Download,
  Clock,
  Pill,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Truck,
  Sparkles,
  Navigation,
  Plus,
  Flame,
  Search,
  MapPin,
  Store,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { OneClickDeliveryCard, type MedicineOrderItem } from "@/components/delivery/OneClickDeliveryCard";
import { RequestMedicineModal } from "@/components/delivery/RequestMedicineModal";
import { BlinkitDeliveryTracker } from "@/components/delivery/BlinkitDeliveryTracker";
import { useUserLocation } from "@/hooks/useUserLocation";

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isActive = status?.toLowerCase() === "active";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: isActive ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)",
        color: isActive ? "#16a34a" : "#64748b",
      }}
    >
      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
    </span>
  );
}

// ─── Doctor Initials Avatar ──────────────────────────────────────────────────
function DoctorAvatar({ name }: { name?: string | null }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "DR";
  return (
    <div
      className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-2xs"
      style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}
    >
      {initials}
    </div>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function PrescriptionSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-sm animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl skeleton-shimmer shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 skeleton-shimmer rounded w-32" />
            <div className="h-3 skeleton-shimmer rounded w-20" />
          </div>
        </div>
        <div className="h-6 skeleton-shimmer rounded-full w-16" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 skeleton-shimmer rounded w-24" />
        <div className="h-4 skeleton-shimmer rounded w-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 skeleton-shimmer rounded w-28" />
        <div className="h-16 skeleton-shimmer rounded-xl w-full" />
      </div>
      <div className="pt-2 flex justify-end">
        <div className="h-9 skeleton-shimmer rounded-xl w-32" />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientPrescriptions() {
  const { userLoc, locationName } = useUserLocation();
  const { data: prescriptions, isLoading } = useListPrescriptions();
  const [orders, setOrders] = useState<MedicineOrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [requestingPrescriptionId, setRequestingPrescriptionId] = useState<number | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
  const { toast } = useToast();

  // Quick medicine search / order state
  const [quickMedQuery, setQuickMedQuery] = useState("");
  const [isSubmittingQuickMed, setIsSubmittingQuickMed] = useState(false);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/medicine-orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch medicine orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, []);

  // Transmit live search inquiry to nearby radius pharmacies as user types
  useEffect(() => {
    if (!quickMedQuery.trim() || quickMedQuery.trim().length < 3) return;
    const timer = setTimeout(() => {
      fetch("/api/medicine-orders/search-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineName: quickMedQuery.trim(),
          lat: userLoc.lat,
          lng: userLoc.lng,
          address: locationName,
        }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [quickMedQuery, userLoc.lat, userLoc.lng, locationName]);

  // Handle Quick Medicine Order Submission to nearby pharmacies
  const handleQuickMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMedQuery.trim()) return;
    setIsSubmittingQuickMed(true);
    try {
      const res = await fetch("/api/medicine-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicines: quickMedQuery.trim(),
          address: locationName,
          latitude: userLoc.lat,
          longitude: userLoc.lng,
          notes: `Quick order from Prescription Section for "${quickMedQuery.trim()}"`,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send order request");
      }

      toast({
        title: "⚡ Request Broadcast to Nearby Pharmacies!",
        description: `Your request for "${quickMedQuery.trim()}" is visible to verified pharmacies in your radius. When a pharmacy accepts, you'll be prompted to confirm before they dispense!`,
      });

      setQuickMedQuery("");
      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Order Failed",
        description: err.message || "Could not submit medicine order",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingQuickMed(false);
    }
  };

  // Request Doorstep Delivery from Prescription
  const handleRequestDeliveryFromPrescription = async (prescriptionId: number) => {
    setRequestingPrescriptionId(prescriptionId);
    try {
      const res = await fetch(`/api/medicine-orders/from-prescription/${prescriptionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Failed to create medicine request");
      }

      toast({
        title: "⚡ Request Broadcast to Nearby Pharmacies!",
        description:
          "Nearby pharmacies in your radius are reviewing your prescribed medicines. You will receive an offer to accept before dispensing!",
      });

      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Request Failed",
        description: err.message || "Could not request medicine delivery",
        variant: "destructive",
      });
    } finally {
      setRequestingPrescriptionId(null);
    }
  };

  // Find active orders by prescriptionId
  const getOrderForPrescription = (rxId: number) => {
    return orders.find((o) => o.prescriptionId === rxId);
  };

  // Filter accepted / active orders for top highlight banners
  const acceptedOrActiveOrders = orders.filter((o) =>
    ["accepted", "delivery_confirmed", "packing", "out_for_delivery"].includes(o.status)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prescriptions & Medicines</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
              <span>Official digital prescriptions and instant 1-click doorstep medicine delivery</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-600" />
                {locationName}
              </span>
            </p>
          </div>

          <Button
            onClick={() => setShowRequestModal(true)}
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md self-start"
          >
            <Plus className="w-4 h-4" /> Order OTC / Custom Medicine
          </Button>
        </div>

        {/* ── Quick Search & Order Medicine from Nearby Pharmacies ────────────── */}
        <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Order Any Medicine from Nearby Pharmacies</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                      ⚡ Radius Broadcast & 2-Way Consent
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Type any OTC or prescribed medicine. Nearby pharmacies will view your request and offer stock. You choose to accept before they dispense!
                  </p>
                </div>
              </div>

              <div className="text-xs font-medium text-slate-500 flex items-center gap-1 self-start">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Detected Delivery: <strong className="text-slate-800">{locationName}</strong></span>
              </div>
            </div>

            <form onSubmit={handleQuickMedSubmit} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Enter medicine name (e.g. Paracetamol 650, Amoxicillin 500mg, Dolo 650, Azithromycin)..."
                  value={quickMedQuery}
                  onChange={(e) => setQuickMedQuery(e.target.value)}
                  className="pl-10 text-xs sm:text-sm h-11 bg-white border-emerald-200 rounded-xl shadow-2xs font-medium"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmittingQuickMed || !quickMedQuery.trim()}
                className="w-full sm:w-auto h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shrink-0 shadow-sm"
              >
                <Flame className="w-4 h-4 fill-white" />
                {isSubmittingQuickMed ? "Broadcasting..." : "Request from Nearby Pharmacies"}
              </Button>
            </form>

            {/* Popular Quick Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-emerald-100/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Quick Select:
              </span>
              {[
                "Paracetamol 650",
                "Amoxicillin 500mg",
                "Dolo 650",
                "Pantoprazole 40mg",
                "Cetirizine 10mg",
                "Azithromycin 500mg",
              ].map((med) => (
                <button
                  key={med}
                  type="button"
                  onClick={() => setQuickMedQuery(med)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 text-xs font-semibold transition-all"
                >
                  💊 {med}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Highlight: 1-Click Doorstep Delivery Prompts for Accepted Orders ── */}
        {acceptedOrActiveOrders.length > 0 && (
          <div className="space-y-4">
            {acceptedOrActiveOrders.map((order) => (
              <OneClickDeliveryCard key={order.id} order={order} onOrderUpdated={fetchOrders} />
            ))}
          </div>
        )}

        {/* ── Content Grid of Prescriptions ─────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <span>Doctor Prescriptions</span>
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[...Array(4)].map((_, i) => (
                <PrescriptionSkeleton key={i} />
              ))}
            </div>
          ) : prescriptions?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "hsl(243,75%,97%)" }}
              >
                <ClipboardList className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">No digital prescriptions found</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                When your doctor issues a digital prescription after a consultation, it will appear here. You can also order any medicine above!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {prescriptions?.map((rx) => {
                const formattedDate = rx.prescribedDate
                  ? new Date(rx.prescribedDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "";

                const linkedOrder = getOrderForPrescription(rx.id);
                const isRequesting = requestingPrescriptionId === rx.id;

                return (
                  <div
                    key={rx.id}
                    className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all duration-180"
                  >
                    <div>
                      {/* Header Banner */}
                      <div
                        className="p-5 border-b border-slate-100 flex items-start justify-between gap-3"
                        style={{
                          background: "linear-gradient(135deg, hsl(243,75%,98%), hsl(260,70%,96%))",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <DoctorAvatar name={rx.doctorName} />
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">Dr. {rx.doctorName}</h3>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{formattedDate}</span>
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={rx.status} />
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-4">
                        {/* Diagnosis */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Diagnosis
                          </span>
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Stethoscope className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span>{rx.diagnosis || "Not specified"}</span>
                          </div>
                        </div>

                        {/* Medicines */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Prescribed Medicines
                          </span>
                          <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-100 text-xs font-mono text-slate-800 leading-relaxed whitespace-pre-wrap">
                            <div className="flex items-center gap-1.5 text-indigo-600 font-sans font-semibold text-[11px] mb-1.5 border-b border-slate-200/60 pb-1">
                              <Pill className="h-3.5 w-3.5" />
                              <span>Rx Details</span>
                            </div>
                            {rx.medicines}
                          </div>
                        </div>

                        {/* Linked Delivery Order Status */}
                        {linkedOrder && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-semibold">
                              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>
                                {linkedOrder.status === "requested"
                                  ? "Waiting for Medplus acceptance..."
                                  : linkedOrder.status === "accepted"
                                  ? `${linkedOrder.pharmacyName || "Medplus"} confirmed stock! 1-Click ready.`
                                  : `Status: ${linkedOrder.status.replace("_", " ")}`}
                              </span>
                            </div>
                            {linkedOrder.status !== "requested" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTrackingOrderId(linkedOrder.id)}
                                className="h-7 text-[11px] font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                              >
                                <Navigation className="w-3 h-3 mr-1" /> Track
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Instructions */}
                        {rx.instructions && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Instructions
                            </span>
                            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/80">
                              {rx.instructions}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      {/* Doorstep Delivery 1-Click Trigger */}
                      {!linkedOrder ? (
                        <Button
                          size="sm"
                          onClick={() => handleRequestDeliveryFromPrescription(rx.id)}
                          disabled={isRequesting}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
                        >
                          <Flame className="w-3.5 h-3.5 fill-white" />
                          {isRequesting ? "Sending to Medplus..." : "Deliver from Medplus (1-Click)"}
                        </Button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Order Active (#{linkedOrder.id})
                        </span>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-2 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors ml-auto"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* OTC / Custom Medicine Request Modal */}
      <RequestMedicineModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={fetchOrders}
      />

      {/* Live Route Tracker Modal */}
      {trackingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <BlinkitDeliveryTracker
              orderId={trackingOrderId}
              onClose={() => setTrackingOrderId(null)}
              onStatusUpdate={fetchOrders}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
