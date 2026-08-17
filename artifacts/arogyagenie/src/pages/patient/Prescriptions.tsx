import React, { useState, useEffect, useMemo } from "react";
import { useListPrescriptions, customFetch } from "@workspace/api-client-react";
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
  const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
  const { toast } = useToast();

  // Multi-select medicine basket state
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [customMedInput, setCustomMedInput] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Camera & file upload state
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);

  const commonMeds = [
    "Paracetamol 650",
    "Dolo 650",
    "Azithromycin 500mg",
    "Amoxicillin 500mg",
    "Pantoprazole 40mg",
    "Cetirizine 10mg",
    "Cough Syrup",
    "ORS Electrolyte",
    "Vitamin C + Zinc",
  ];

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await customFetch<MedicineOrderItem[]>("/api/medicine-orders");
      if (Array.isArray(data)) {
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

  // Toggle quick select medicine chip in multi-select basket
  const handleToggleMed = (med: string) => {
    setSelectedMeds((prev) =>
      prev.includes(med) ? prev.filter((m) => m !== med) : [...prev, med]
    );
  };

  // Add custom typed medicine to multi-select basket
  const handleAddCustomMed = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customMedInput.trim();
    if (!trimmed) return;
    if (!selectedMeds.includes(trimmed)) {
      setSelectedMeds((prev) => [...prev, trimmed]);
    }
    setCustomMedInput("");
  };

  // Remove individual medicine from basket
  const handleRemoveMed = (medToRemove: string) => {
    setSelectedMeds((prev) => prev.filter((m) => m !== medToRemove));
  };

  // Handle file or phone camera capture
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
      toast({
        title: "Photo / Document Attached!",
        description: `"${file.name}" ready to broadcast with your medicine request.`,
      });
    };
    reader.readAsDataURL(file);
  };

  // Clear attached photo
  const handleRemoveAttachedImage = () => {
    setAttachedImage(null);
    setAttachedImageName(null);
  };

  // Broadcast Multi-selected Medicines & Attached Photo to Nearby Pharmacies
  const handleBroadcastMultiSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMeds.length === 0 && !attachedImage) {
      toast({
        title: "Selection Empty",
        description: "Please choose at least one medicine or attach a prescription photo.",
        variant: "destructive",
      });
      return;
    }

    setIsBroadcasting(true);
    try {
      const medicinesText = selectedMeds.length > 0
        ? selectedMeds.join("\n")
        : `Prescription / Medicine Photo Attached: ${attachedImageName || "prescription_image.jpg"}`;

      const notesText = [
        `Patient requested ${selectedMeds.length} medicine(s) via multi-select.`,
        attachedImageName ? `[Attached File: ${attachedImageName}]` : null,
      ].filter(Boolean).join(" ");

      await customFetch("/api/medicine-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicines: medicinesText,
          address: locationName,
          latitude: userLoc.lat,
          longitude: userLoc.lng,
          notes: notesText,
        }),
      });

      toast({
        title: "⚡ Request Broadcast to Nearby Pharmacies!",
        description: `Your bundle with ${selectedMeds.length} medicine(s) ${attachedImage ? "and attached photo " : ""}has been broadcast to verified pharmacies in your radius.`,
      });

      setSelectedMeds([]);
      setCustomMedInput("");
      setAttachedImage(null);
      setAttachedImageName(null);
      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Request Failed",
        description: err.message || "Could not broadcast medicine request",
        variant: "destructive",
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Request Doorstep Delivery from Prescription
  const handleRequestDeliveryFromPrescription = async (prescriptionId: number) => {
    setRequestingPrescriptionId(prescriptionId);
    try {
      await customFetch(`/api/medicine-orders/from-prescription/${prescriptionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

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
        </div>

        {/* ── Quick Multi-Select & Camera Upload Card ────────────────────────── */}
        <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Quick Select & Request Medicines</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose multiple medicines below or snap a prescription photo from your phone camera. Nearby pharmacies will view and quote before dispensing!
                  </p>
                </div>
              </div>

              <div className="text-xs font-medium text-slate-500 flex items-center gap-1 self-start">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Radius Delivery: <strong className="text-slate-800">{locationName}</strong></span>
              </div>
            </div>

            {/* Quick Multi-Select Pill Options */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Common & Essential Medicines (Tap to Add/Remove):
                </span>
                {selectedMeds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMeds([])}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Clear Selection ({selectedMeds.length})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {commonMeds.map((med) => {
                  const isSelected = selectedMeds.includes(med);
                  return (
                    <button
                      key={med}
                      type="button"
                      onClick={() => handleToggleMed(med)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs scale-102 ring-2 ring-emerald-300"
                          : "bg-white hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>💊 {med}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Medicine Input & Photo Buttons */}
            <div className="space-y-3 pt-2 border-t border-emerald-100/90">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Type any other medicine name and press Enter to add..."
                    value={customMedInput}
                    onChange={(e) => setCustomMedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomMed();
                      }
                    }}
                    className="pl-10 text-xs sm:text-sm h-11 bg-white border-emerald-200 rounded-xl shadow-2xs font-medium"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => handleAddCustomMed()}
                  disabled={!customMedInput.trim()}
                  variant="outline"
                  className="h-11 px-4 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add to List
                </Button>
              </div>

              {/* Selected Medicines Basket */}
              {selectedMeds.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Selected Medicines ({selectedMeds.length} items):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMeds.map((med) => (
                      <span
                        key={med}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold"
                      >
                        <span>{med}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMed(med)}
                          className="text-emerald-500 hover:text-red-600 font-bold transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera Snap & File Upload Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Phone Camera Snap */}
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>📷 Snap Photo (Phone Camera)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {/* Upload File / Document */}
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>📁 Upload Prescription / Doc</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {/* Attached Photo Preview */}
                {attachedImage && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs shadow-2xs">
                    <img
                      src={attachedImage}
                      alt="Attachment Preview"
                      className="w-7 h-7 rounded-lg object-cover border border-indigo-100"
                    />
                    <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                      {attachedImageName || "Attached Image"}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveAttachedImage}
                      className="text-red-500 hover:text-red-700 font-bold ml-1"
                      title="Remove attached image"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Main Submit Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleBroadcastMultiSelect}
                  disabled={isBroadcasting || (selectedMeds.length === 0 && !attachedImage)}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm gap-2 shadow-md"
                >
                  <Flame className="w-4 h-4 fill-white" />
                  {isBroadcasting
                    ? "Broadcasting to Nearby Pharmacies..."
                    : selectedMeds.length > 0
                    ? `Request ${selectedMeds.length} Selected Medicine(s) from Nearby Pharmacies`
                    : attachedImage
                    ? "Broadcast Attached Prescription Photo to Nearby Pharmacies"
                    : "Select Medicines or Attach Photo to Request"}
                </Button>
              </div>
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
