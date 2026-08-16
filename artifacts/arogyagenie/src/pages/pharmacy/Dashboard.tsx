import React, { useState, useEffect } from "react";
import { useGetPharmacyDashboard, useUpdatePrescription, getGetPharmacyDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Clipboard,
  Clock,
  CheckCircle,
  Pill,
  User,
  MapPin,
  Flame,
  Truck,
  Package,
  ShieldCheck,
  Phone,
  Navigation,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BlinkitDeliveryTracker } from "@/components/delivery/BlinkitDeliveryTracker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface MedicineOrder {
  id: number;
  patientId: number;
  pharmacyId: number | null;
  prescriptionId: number | null;
  medicines: string;
  patientName: string | null;
  patientPhone: string | null;
  patientAddress: string | null;
  pharmacyName: string | null;
  pharmacyAddress: string | null;
  status: string;
  totalPrice: number | null;
  estimatedDeliveryMins: number | null;
  deliveryDistanceKm: number | null;
  deliveryPartnerName: string | null;
  deliveryPartnerPhone: string | null;
  deliveryPartnerVehicle: string | null;
  deliveryOtp: string | null;
  notes: string | null;
  createdAt: string;
}

export function PharmacyDashboard() {
  const { data: dashboard, isLoading } = useGetPharmacyDashboard();
  const updatePrescription = useUpdatePrescription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderForAccept, setSelectedOrderForAccept] = useState<MedicineOrder | null>(null);
  const [priceInput, setPriceInput] = useState("320");
  const [etaInput, setEtaInput] = useState("18");
  const [isAccepting, setIsAccepting] = useState(false);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<number | null>(null);

  // Fetch medicine requests
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
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkDispensed = (id: number) => {
    updatePrescription.mutate(
      { id, data: { status: "dispensed" } },
      {
        onSuccess: () => {
          toast({
            title: "Prescription Dispensed",
            description: "Prescription marked as dispensed successfully.",
          });
          queryClient.invalidateQueries({ queryKey: getGetPharmacyDashboardQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Error updating status",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Accept incoming patient medicine request
  const handleConfirmAccept = async () => {
    if (!selectedOrderForAccept) return;
    setIsAccepting(true);
    try {
      const res = await fetch(`/api/medicine-orders/${selectedOrderForAccept.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: parseFloat(priceInput) || 320,
          estimatedDeliveryMins: parseInt(etaInput, 10) || 18,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to accept medicine order");
      }

      toast({
        title: "Request Accepted & Confirmed!",
        description: `Patient has been notified: "${dashboard?.name || "Your Pharmacy"} has your medicines! Would you like them delivered to your doorstep in 1 click?"`,
      });

      setSelectedOrderForAccept(null);
      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Accept Failed",
        description: err.message || "Could not accept order",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  // Update order status (packing, out for delivery, delivered)
  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`/api/medicine-orders/${orderId}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast({
          title: "Status Updated",
          description: `Order #${orderId} marked as ${status.replace("_", " ")}.`,
        });
        fetchOrders();
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">
          Loading pharmacy dashboard...
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard) return null;

  const displayName = dashboard.userName?.trim() || dashboard.name?.trim() || "Pharmacy";

  const pendingRequests = orders.filter((o) => o.status === "requested");
  const activeDeliveries = orders.filter((o) =>
    ["accepted", "delivery_confirmed", "packing", "out_for_delivery"].includes(o.status)
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{displayName}</h1>
            <p className="text-slate-500 mt-1">
              Onboarded Pharmacy Hub • Accept patient medicine requests, dispatch express doorstep deliveries, and manage prescriptions.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOrders}
            className="text-xs font-semibold gap-1.5 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin" : ""}`} /> Refresh Queue
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Incoming Requests
              </CardTitle>
              <Flame className="h-4 w-4 text-amber-600 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{pendingRequests.length}</div>
              <p className="text-[11px] text-amber-700 font-semibold mt-1">Patients waiting for confirmation</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Active Deliveries
              </CardTitle>
              <Truck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{activeDeliveries.length}</div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">In transit / Doorstep fleet</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-700">
                Dispensed Today
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{dashboard.dispensedToday}</div>
              <p className="text-[11px] text-slate-500 mt-1">Prescriptions completed</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Total Prescriptions
              </CardTitle>
              <Clipboard className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{dashboard.totalPrescriptions}</div>
              <p className="text-[11px] text-slate-500 mt-1">Lifetime verified Rx</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Section 1: Incoming Patient Medicine Requests (Waiting for Pharmacy Acceptance) ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Incoming Patient Medicine Requests
              </h2>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold text-xs">
                {pendingRequests.length} Pending Acceptance
              </Badge>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <Card className="bg-slate-50 border-dashed border-2">
              <CardContent className="py-12 text-center text-slate-500 space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-800">All incoming patient requests are answered!</p>
                <p className="text-xs text-slate-400">New patient orders in your area will appear here in real-time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pendingRequests.map((req) => (
                <Card
                  key={req.id}
                  className="border-2 border-amber-400/80 bg-white shadow-md hover:shadow-lg transition-all overflow-hidden"
                >
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50/50 pb-3 border-b border-amber-100">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900">
                            {req.patientName || `Patient #${req.patientId}`}
                          </h3>
                          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px]">
                            ⚡ ACTION REQUIRED
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{req.patientAddress || "Kolkata"}</span>
                          <span className="font-bold text-amber-700 ml-1">
                            ({req.deliveryDistanceKm || 2.5} km away)
                          </span>
                        </p>
                      </div>
                      <span className="text-xs font-mono text-slate-400">#{req.id}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {/* Medicines Requested */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Requested Medicines List
                      </span>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-900 whitespace-pre-wrap">
                        {req.medicines}
                      </div>
                    </div>

                    {req.notes && (
                      <p className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                        <strong>Patient Note:</strong> {req.notes}
                      </p>
                    )}

                    {/* Action: Accept Request */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        Patient phone: <strong>{req.patientPhone || "Registered"}</strong>
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedOrderForAccept(req);
                          setPriceInput(req.totalPrice ? String(req.totalPrice) : "320");
                          setEtaInput("18");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-md"
                      >
                        <CheckCircle className="w-4 h-4" /> Accept & Confirm Stock
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 2: Active Doorstep Deliveries (Live Dispatch & Tracking) ── */}
        {activeDeliveries.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Active Doorstep Deliveries & Live Fleet
                </h2>
                <Badge className="bg-emerald-600 text-white font-bold text-xs">
                  {activeDeliveries.length} Active
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeDeliveries.map((order) => {
                const isAccepted = order.status === "accepted";
                const isConfirmed = order.status === "delivery_confirmed";
                const isPacking = order.status === "packing";
                const isOutForDelivery = order.status === "out_for_delivery";

                return (
                  <Card
                    key={order.id}
                    className="border-2 border-emerald-500/30 bg-white shadow-md hover:shadow-lg transition-all"
                  >
                    <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50/50 pb-3 border-b border-emerald-100">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-slate-900">
                              Order #{order.id} • {order.patientName || `Patient #${order.patientId}`}
                            </h3>
                            <Badge
                              className={`text-[10px] font-bold uppercase ${
                                isOutForDelivery
                                  ? "bg-purple-600 text-white animate-pulse"
                                  : isPacking
                                  ? "bg-blue-600 text-white"
                                  : "bg-emerald-600 text-white"
                              }`}
                            >
                              {order.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            📍 {order.patientAddress || "Kolkata"} • Bill: <strong>₹{order.totalPrice || 320}</strong> • ETA: {order.estimatedDeliveryMins || 18}m
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4">
                      {/* Rider details if assigned */}
                      {order.deliveryPartnerName && (
                        <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] uppercase text-emerald-400 font-bold block">
                              Assigned Delivery Partner
                            </span>
                            <p className="font-bold text-sm mt-0.5">{order.deliveryPartnerName}</p>
                            <p className="text-slate-400 text-[11px]">{order.deliveryPartnerVehicle}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase text-yellow-400 font-bold block">
                              Delivery PIN
                            </span>
                            <span className="font-mono font-black text-base text-yellow-300">
                              {order.deliveryOtp || "4829"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Prescribed Medicines Summary */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-800 whitespace-pre-wrap">
                        {order.medicines}
                      </div>

                      {/* State Advancement Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        {isConfirmed && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateOrderStatus(order.id, "packing")}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5"
                          >
                            <Package className="w-3.5 h-3.5" /> Mark Packed & Sealed
                          </Button>
                        )}

                        {(isPacking || isAccepted || isConfirmed) && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateOrderStatus(order.id, "out_for_delivery")}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" /> Handover to Express Rider
                          </Button>
                        )}

                        {isOutForDelivery && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateOrderStatus(order.id, "delivered")}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Complete Handover
                          </Button>
                        )}

                        {/* View Live Route Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveTrackingOrderId(order.id)}
                          className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-bold text-xs gap-1.5 ml-auto"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Live Route Map
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section 3: Recent Prescriptions Queue ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Doctor Prescriptions Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentPrescriptions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No recent prescriptions in queue.</div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-lg text-slate-900">Prescription #{rx.id}</p>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            rx.status === "dispensed"
                              ? "bg-green-100 text-green-800"
                              : rx.status === "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {rx.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Patient ID: <strong className="text-slate-800">#{rx.patientId}</strong> • Doctor ID:{" "}
                        <strong className="text-slate-800">#{rx.doctorId}</strong> • Prescribed:{" "}
                        {rx.prescribedDate}
                      </p>
                      {rx.diagnosis && (
                        <p className="text-xs text-slate-600 mt-1">Diagnosis: {rx.diagnosis}</p>
                      )}
                      <div className="mt-2 bg-white p-2.5 rounded-md font-mono text-xs text-slate-800 border border-slate-100">
                        {rx.medicines}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {rx.status === "active" && (
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleMarkDispensed(rx.id)}
                          disabled={updatePrescription.isPending}
                        >
                          <Pill className="h-4 w-4" /> Dispense Medication
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acceptance Dialog */}
      <Dialog
        open={Boolean(selectedOrderForAccept)}
        onOpenChange={(open) => !open && setSelectedOrderForAccept(null)}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl bg-slate-900 border border-slate-800 text-white p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">
                  Accept Patient Request
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Confirm you have these medicines in stock and quote delivery ETA.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedOrderForAccept && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Patient & Requested Medications
                </span>
                <p className="font-bold text-sm text-white">
                  {selectedOrderForAccept.patientName || `Patient #${selectedOrderForAccept.patientId}`}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{selectedOrderForAccept.patientAddress}</p>
                <div className="mt-2 bg-slate-900 p-2.5 rounded-xl text-xs font-mono text-emerald-300 border border-slate-800">
                  {selectedOrderForAccept.medicines}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-300 block mb-1">
                    Total Medicine Bill (₹)
                  </label>
                  <Input
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white font-bold text-base rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-300 block mb-1">
                    Estimated Delivery (Mins)
                  </label>
                  <Input
                    type="number"
                    value={etaInput}
                    onChange={(e) => setEtaInput(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white font-bold text-base rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs text-emerald-300">
                ⚡ Upon clicking Accept, the patient will immediately receive the notification:
                <strong className="block text-white mt-1">
                  "{displayName} has your medicines! Would you like them delivered to your doorstep in 1 click?"
                </strong>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedOrderForAccept(null)}
                  className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAccept}
                  disabled={isAccepting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
                >
                  {isAccepting ? "Accepting..." : "Confirm & Send 1-Click Prompt"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Live Route Tracker Modal */}
      {activeTrackingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <BlinkitDeliveryTracker
              orderId={activeTrackingOrderId}
              onClose={() => setActiveTrackingOrderId(null)}
              onStatusUpdate={fetchOrders}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
