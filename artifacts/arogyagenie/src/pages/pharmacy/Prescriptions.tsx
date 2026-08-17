import { useState, useEffect } from "react";
import { useListPharmacyPrescriptions, useUpdatePrescription, getListPharmacyPrescriptionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Clipboard,
  Pill,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  User,
  Clock,
  MapPin,
  Truck,
  Flame,
  Package,
  Navigation,
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
  isSearchInquiry?: boolean;
  inStock?: boolean;
  matchedMedicinePrice?: number | null;
  matchedMedicineName?: string | null;
}

export function PharmacyPrescriptionsPage() {
  const [activeTab, setActiveTab] = useState<"patient_orders" | "prescriptions">("patient_orders");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const queryParams = {
    status: selectedStatus === "all" ? undefined : selectedStatus,
  };

  const { data: prescriptions, isLoading } = useListPharmacyPrescriptions(queryParams);
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

  // Fetch patient medicine orders
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

  const handleUpdateStatus = (id: number, status: "dispensed" | "expired" | "active") => {
    updatePrescription.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Prescription Updated",
            description: `Status changed to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListPharmacyPrescriptionsQueryKey() });
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
        description: "Patient received 1-click doorstep delivery prompt!",
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

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const pName = (rx.patientName ?? "").toLowerCase();
    const dName = (rx.doctorName ?? "").toLowerCase();
    const medicines = rx.medicines.toLowerCase();
    return pName.includes(q) || dName.includes(q) || medicines.includes(q) || String(rx.id).includes(q);
  });

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const pName = (o.patientName ?? "").toLowerCase();
    const medicines = o.medicines.toLowerCase();
    return pName.includes(q) || medicines.includes(q) || String(o.id).includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Prescriptions & Orders</h1>
            <p className="text-slate-500 mt-1">
              Verify incoming patient medicine orders, accept stock requests, and fulfill doctor prescriptions.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 self-start">
            <button
              onClick={() => setActiveTab("patient_orders")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "patient_orders"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🛵 Patient Medicine Requests ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "prescriptions"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📋 Doctor Prescriptions ({prescriptions?.length || 0})
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by patient, medicine, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchOrders}
                  className="text-xs font-semibold gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin" : ""}`} /> Sync Queue
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab 1: Patient Medicine Requests */}
        {activeTab === "patient_orders" && (
          <div className="space-y-4">
            {ordersLoading && orders.length === 0 ? (
              <div className="py-16 text-center text-slate-500">Loading patient medicine requests...</div>
            ) : filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Package className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-lg font-medium text-slate-700">No patient requests found</p>
                  <p className="text-xs text-slate-400 max-w-xs text-center mt-1">
                    Incoming patient requests and doorstep deliveries will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredOrders.map((order) => {
                  const isRequested = order.status === "requested";
                  const isAccepted = order.status === "accepted";
                  const isConfirmed = order.status === "delivery_confirmed";
                  const isPacking = order.status === "packing";
                  const isOutForDelivery = order.status === "out_for_delivery";
                  const isDelivered = order.status === "delivered";

                  return (
                    <Card
                      key={order.id}
                      className={`overflow-hidden border-t-4 hover:shadow-md transition-shadow ${
                        isRequested
                          ? "border-t-amber-500 bg-amber-50/10"
                          : isAccepted
                          ? "border-t-amber-400 bg-amber-50/20"
                          : isOutForDelivery
                          ? "border-t-purple-500"
                          : "border-t-emerald-500"
                      }`}
                    >
                      <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-slate-900">
                                {order.patientName || `Patient #${order.patientId}`}
                              </h3>
                              <Badge
                                variant={
                                  isRequested
                                    ? "default"
                                    : isDelivered
                                    ? "secondary"
                                    : "outline"
                                }
                                className={`text-[10px] uppercase font-bold ${
                                  isRequested
                                    ? order.isSearchInquiry
                                      ? "bg-amber-500 text-slate-950 font-black"
                                      : "bg-amber-500 text-slate-950"
                                    : isAccepted
                                    ? "bg-amber-500 text-slate-950 font-black animate-pulse"
                                    : isConfirmed
                                    ? "bg-emerald-600 text-white font-bold"
                                    : isOutForDelivery
                                    ? "bg-purple-600 text-white"
                                    : "bg-emerald-600 text-white"
                                }`}
                              >
                                {isRequested && order.isSearchInquiry
                                  ? "⚡ Live Demand"
                                  : isAccepted
                                  ? "⚠️ Awaiting Patient Acceptance"
                                  : isConfirmed
                                  ? "✓ Patient Accepted - Ready to Dispense"
                                  : order.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{order.patientAddress || "Delivery Address"}</span>
                              <span className="font-bold text-emerald-700 ml-1">
                                ({order.deliveryDistanceKm || 2.4} km away)
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {order.inStock !== undefined && isRequested && (
                              <Badge className={`text-[10px] ${order.inStock ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                                {order.inStock ? `✓ In Stock (₹${order.matchedMedicinePrice || 35})` : "⚠️ Not in Stock"}
                              </Badge>
                            )}
                            <span className="text-xs font-mono text-slate-400">Order #{order.id}</span>
                          </div>
                        </div>

                        {/* Handshake Consent Notices */}
                        {isAccepted && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                            <strong>Offer Sent to Patient • Dispensing Locked:</strong> Awaiting patient to confirm whether they want to take the medicine from your pharmacy. You cannot dispense or pack until patient accepts.
                          </div>
                        )}

                        {isConfirmed && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                            <strong>✓ Patient Accepted Your Offer!</strong> You are now authorized to dispense and pack the medicines.
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Requested Medicines
                          </h4>
                          <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap border border-slate-100 text-slate-900">
                            {order.medicines}
                          </div>
                        </div>

                        {order.notes && (
                          <p className="text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                            <strong>Note:</strong> {order.notes}
                          </p>
                        )}

                        {order.totalPrice && (
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span>Quoted Price: <strong>₹{order.totalPrice}</strong></span>
                            <span>ETA: <strong>{order.estimatedDeliveryMins || 18} mins</strong></span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                          {isRequested && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold text-xs"
                              onClick={() => {
                                setSelectedOrderForAccept(order);
                                setPriceInput(order.matchedMedicinePrice ? String(order.matchedMedicinePrice) : (order.totalPrice ? String(order.totalPrice) : "320"));
                                setEtaInput("18");
                              }}
                            >
                              <CheckCircle className="h-4 w-4" /> Accept Request & Offer 1-Click Delivery
                            </Button>
                          )}

                          {isConfirmed && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-bold text-xs"
                              onClick={() => handleUpdateOrderStatus(order.id, "packing")}
                            >
                              <Package className="h-4 w-4" /> Dispense & Mark Packed
                            </Button>
                          )}

                          {isPacking && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-bold text-xs"
                              onClick={() => handleUpdateOrderStatus(order.id, "out_for_delivery")}
                            >
                              <Truck className="h-4 w-4" /> Handover to Express Rider
                            </Button>
                          )}

                          {isOutForDelivery && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white gap-1.5 font-bold text-xs"
                              onClick={() => handleUpdateOrderStatus(order.id, "delivered")}
                            >
                              <CheckCircle className="h-4 w-4" /> Complete Handover
                            </Button>
                          )}

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
            )}
          </div>
        )}

        {/* Tab 2: Doctor Prescriptions */}
        {activeTab === "prescriptions" && (
          <div>
            {isLoading ? (
              <div className="py-16 text-center text-slate-500">Loading prescription queue...</div>
            ) : filteredPrescriptions?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Clipboard className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-lg font-medium text-slate-700">No prescriptions found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPrescriptions?.map((rx) => (
                  <Card key={rx.id} className="overflow-hidden border-t-4 border-t-primary hover:shadow-md transition-shadow">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-slate-900">
                            {rx.patientName ? rx.patientName : `Patient #${rx.patientId}`}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <User className="h-3.5 w-3.5" /> Doctor: {rx.doctorName ? rx.doctorName : `#${rx.doctorId}`} •{" "}
                            <Clock className="h-3.5 w-3.5 ml-1" /> {new Date(rx.prescribedDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={rx.status === "active" ? "default" : rx.status === "dispensed" ? "secondary" : "destructive"}>
                          {rx.status}
                        </Badge>
                      </div>

                      {rx.diagnosis && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnosis</h4>
                          <p className="text-sm font-semibold text-slate-900">{rx.diagnosis}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prescribed Medicines</h4>
                        <div className="bg-slate-50 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap border border-slate-100 text-slate-800">
                          {rx.medicines}
                        </div>
                      </div>

                      {rx.instructions && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Instructions</h4>
                          <p className="text-sm text-slate-700">{rx.instructions}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t">
                        {rx.status === "active" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                            onClick={() => handleUpdateStatus(rx.id, "dispensed")}
                            disabled={updatePrescription.isPending}
                          >
                            <Pill className="h-4 w-4" /> Dispense Medicine
                          </Button>
                        )}
                        {rx.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 gap-1.5"
                            onClick={() => handleUpdateStatus(rx.id, "expired")}
                            disabled={updatePrescription.isPending}
                          >
                            <XCircle className="h-4 w-4" /> Mark Expired
                          </Button>
                        )}
                        {rx.status !== "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-500 gap-1.5 text-xs"
                            onClick={() => handleUpdateStatus(rx.id, "active")}
                            disabled={updatePrescription.isPending}
                          >
                            Re-open Queue
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
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
                  Accept Patient Medicine Request
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Confirm stock and quote delivery pricing & ETA.
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
