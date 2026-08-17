import React, { useState, useEffect } from "react";
import { useGetPharmacyDashboard, useUpdatePrescription, getGetPharmacyDashboardQueryKey, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Search,
  Plus,
  AlertCircle,
  DollarSign,
  TrendingUp,
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

interface InventoryItem {
  inventoryId: number;
  medicineId: number;
  medicineName: string;
  genericName: string | null;
  category: string | null;
  dosageForm: string | null;
  strength: string | null;
  price: number | null;
  inStock: boolean;
  quantity: number | null;
  updatedAt: string;
}

export function PharmacyDashboard() {
  const { data: dashboard, isLoading } = useGetPharmacyDashboard();
  const updatePrescription = useUpdatePrescription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"inquiries" | "deliveries" | "inventory" | "prescriptions">("inquiries");

  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderForAccept, setSelectedOrderForAccept] = useState<MedicineOrder | null>(null);
  const [priceInput, setPriceInput] = useState("320");
  const [etaInput, setEtaInput] = useState("18");
  const [isAccepting, setIsAccepting] = useState(false);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<number | null>(null);

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedGeneric, setNewMedGeneric] = useState("");
  const [newMedCategory, setNewMedCategory] = useState("Analgesics & Antipyretics");
  const [newMedPrice, setNewMedPrice] = useState("35");
  const [newMedQty, setNewMedQty] = useState("100");
  const [isAddingMed, setIsAddingMed] = useState(false);

  // Fetch medicine requests using customFetch with Clerk token
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await customFetch<MedicineOrder[]>("/api/medicine-orders");
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch medicine orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch pharmacy inventory
  const fetchInventory = async () => {
    setInventoryLoading(true);
    try {
      const data = await customFetch<InventoryItem[]>("/api/pharmacies/me/inventory");
      if (Array.isArray(data)) {
        setInventory(data);
      }
    } catch (err) {
      console.error("Failed to fetch pharmacy inventory:", err);
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchInventory();
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
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

  // Accept incoming patient medicine request or search inquiry
  const handleConfirmAccept = async () => {
    if (!selectedOrderForAccept) return;
    setIsAccepting(true);
    try {
      await customFetch(`/api/medicine-orders/${selectedOrderForAccept.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: parseFloat(priceInput) || 320,
          estimatedDeliveryMins: parseInt(etaInput, 10) || 18,
        }),
      });

      toast({
        title: "Offer Sent to Patient!",
        description: `Patient prompt displayed: "${dashboard?.name || "Your Pharmacy"} has your medicine! Would you like to take it?". Dispensing is locked until patient confirms.`,
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
      await customFetch(`/api/medicine-orders/${orderId}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      toast({
        title: "Status Updated",
        description: `Order #${orderId} marked as ${status.replace("_", " ")}.`,
      });
      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Cannot advance order status",
        variant: "destructive",
      });
    }
  };

  // Toggle inventory in-stock status
  const handleToggleStock = async (item: InventoryItem) => {
    const newStock = !item.inStock;
    // Optimistic UI update
    setInventory((prev) =>
      prev.map((i) => (i.inventoryId === item.inventoryId ? { ...i, inStock: newStock } : i))
    );

    try {
      await customFetch("/api/pharmacies/me/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId: item.medicineId,
          price: item.price,
          inStock: newStock,
          quantity: newStock ? (item.quantity || 100) : 0,
        }),
      });

      toast({
        title: newStock ? "Marked In Stock" : "Marked Out of Stock",
        description: `${item.medicineName} is now ${newStock ? "available" : "out of stock"} for patient searches.`,
      });
      fetchOrders();
    } catch {
      fetchInventory();
    }
  };

  // Quick Add / Quick In-Stock for a searched medicine
  const handleQuickAddMedicine = async (medName: string) => {
    try {
      await customFetch("/api/pharmacies/me/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineName: medName,
          price: 35.0,
          inStock: true,
          quantity: 100,
        }),
      });

      toast({
        title: "Added to Inventory!",
        description: `${medName} is now in stock (₹35) and will match all nearby patient searches!`,
      });
      fetchInventory();
      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Could not add medicine",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Add custom medicine dialog submit
  const handleAddMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    setIsAddingMed(true);
    try {
      await customFetch("/api/pharmacies/me/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineName: newMedName.trim(),
          genericName: newMedGeneric.trim() || undefined,
          category: newMedCategory,
          price: parseFloat(newMedPrice) || 35,
          inStock: true,
          quantity: parseInt(newMedQty, 10) || 100,
        }),
      });

      toast({
        title: "Medicine Added to Stock!",
        description: `${newMedName} is now live in your catalog for patient discovery.`,
      });
      setNewMedName("");
      setNewMedGeneric("");
      setIsAddMedOpen(false);
      fetchInventory();
      fetchOrders();
    } catch (err: any) {
      toast({
        title: "Failed to add medicine",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingMed(false);
    }
  };

  const fallbackDashboard = {
    userName: "Verified Partner Pharmacy",
    name: "Apex Healthcare Pharmacy",
    totalPrescriptions: orders.length,
    pendingPrescriptions: orders.filter((o) => o.status === "requested").length,
    dispensedToday: orders.filter((o) => o.status === "delivered").length,
    recentPrescriptions: [],
  };

  const activeDashboard = dashboard || fallbackDashboard;
  const displayName = activeDashboard.userName?.trim() || activeDashboard.name?.trim() || "Verified Pharmacy";

  const liveInquiries = orders.filter((o) => o.status === "requested");
  const activeDeliveries = orders.filter((o) =>
    ["accepted", "delivery_confirmed", "packing", "out_for_delivery"].includes(o.status)
  );

  const filteredInventory = inventory.filter(
    (item) =>
      item.medicineName.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      (item.genericName && item.genericName.toLowerCase().includes(inventorySearch.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(inventorySearch.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{displayName}</h1>
              <Badge className="bg-emerald-600 text-white font-bold text-xs">Verified Pharmacy</Badge>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Live Patient Medicine Inquiries • Express 1-Click Doorstep Deliveries • Real-time Inventory Catalog
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fetchOrders();
                fetchInventory();
              }}
              className="text-xs font-semibold gap-1.5 border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading || inventoryLoading ? "animate-spin" : ""}`} /> Refresh Data
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddMedOpen(true)}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Medicine Stock
            </Button>
          </div>
        </div>

        {/* ── Metric Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-amber-500 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer" onClick={() => setActiveTab("inquiries")}>
            <CardHeader className="flex flex-row items-center justify-between pb-1.5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Patient Search Demands
              </CardTitle>
              <Flame className="h-4 w-4 text-amber-600 animate-bounce" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{liveInquiries.length}</div>
              <p className="text-[11px] text-amber-700 font-semibold mt-1">Patients seeking medicines nearby</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer" onClick={() => setActiveTab("deliveries")}>
            <CardHeader className="flex flex-row items-center justify-between pb-1.5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Active Orders & Dispatch
              </CardTitle>
              <Truck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{activeDeliveries.length}</div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">Awaiting consent / In transit</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer" onClick={() => setActiveTab("inventory")}>
            <CardHeader className="flex flex-row items-center justify-between pb-1.5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-700">
                In-Stock Medicines
              </CardTitle>
              <Pill className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">
                {inventory.filter((i) => i.inStock).length} <span className="text-sm font-normal text-slate-400">/ {inventory.length}</span>
              </div>
              <p className="text-[11px] text-blue-700 font-semibold mt-1">Catalog items ready for discovery</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer" onClick={() => setActiveTab("prescriptions")}>
            <CardHeader className="flex flex-row items-center justify-between pb-1.5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Total Prescriptions
              </CardTitle>
              <Clipboard className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{activeDashboard.totalPrescriptions}</div>
              <p className="text-[11px] text-slate-500 mt-1">Dispensed: {activeDashboard.dispensedToday} today</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Navigation Tabs ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("inquiries")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "inquiries"
                ? "bg-amber-500 text-slate-950 shadow-xs"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/50"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            ⚡ Live Patient Medicine Inquiries ({liveInquiries.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("deliveries")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "deliveries"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/50"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            📦 Doorstep Orders ({activeDeliveries.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "inventory"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/50"
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            💊 My Medicine Inventory & Stock ({inventory.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("prescriptions")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "prescriptions"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/50"
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            📋 Doctor Prescriptions Queue
          </button>
        </div>

        {/* ── TAB 1: Live Patient Medicine Inquiries & Search Demands ──────── */}
        {activeTab === "inquiries" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  Live Patient Medicine Inquiries & Search Demands
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Whenever a patient searches for a medicine nearby or requests delivery, their inquiry appears here in real-time.
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs self-start">
                ⚡ {liveInquiries.length} Active Demands
              </Badge>
            </div>

            {liveInquiries.length === 0 ? (
              <Card className="bg-slate-50/80 border-dashed border-2 border-slate-200">
                <CardContent className="py-14 text-center text-slate-500 space-y-3">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="font-bold text-slate-800 text-base">All Patient Medicine Demands are Answered!</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    When patients search for medicines (e.g. Paracetamol, Amoxicillin, Dolo 650) in your service radius, their inquiries will appear here automatically with 1-click fulfillment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveInquiries.map((req) => {
                  const hasStock = req.inStock ?? false;
                  const price = req.matchedMedicinePrice || 35;

                  return (
                    <Card
                      key={req.id}
                      className="border-2 border-amber-400/90 bg-white shadow-md hover:shadow-lg transition-all overflow-hidden rounded-2xl"
                    >
                      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50/60 pb-3 border-b border-amber-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base text-slate-900">
                                {req.patientName || `Patient #${req.patientId}`}
                              </h3>
                              <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] uppercase">
                                ⚡ Live Demand
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{req.patientAddress || "Lake Town / Dum Dum"}</span>
                              <span className="font-bold text-amber-700 ml-1">
                                ({req.deliveryDistanceKm || 2.5} km away)
                              </span>
                            </p>
                          </div>
                          <span className="text-xs font-mono text-slate-400">#{req.id}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3.5">
                        {/* Searched Medicine Banner */}
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                            Patient Searched & Requested
                          </span>
                          <div className="text-base font-black text-emerald-300 font-mono">
                            💊 {req.medicines}
                          </div>
                          {req.notes && (
                            <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                              {req.notes}
                            </p>
                          )}
                        </div>

                        {/* Stock Status Indicator */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                          <span className="text-slate-600 font-medium">Your Stock Status:</span>
                          {hasStock ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                              ✓ In Stock (₹{price})
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                              ⚠️ Check Stock
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          {!hasStock && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickAddMedicine(req.medicines.split("\n")[0].trim())}
                              className="text-xs font-semibold gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                              <Plus className="w-3.5 h-3.5" /> Mark In-Stock
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedOrderForAccept(req);
                              setPriceInput(price ? String(price) : "320");
                              setEtaInput("18");
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-md flex-1"
                          >
                            <CheckCircle className="w-4 h-4" /> Accept & Offer 1-Click Delivery
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

        {/* ── TAB 2: Doorstep Express Orders & Live Dispatch ────────────────── */}
        {activeTab === "deliveries" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  Active Doorstep Deliveries & Live Fleet
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track packing, express courier dispatch, OTP verification, and doorstep handovers.
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white font-bold text-xs">
                {activeDeliveries.length} Active Orders
              </Badge>
            </div>

            {activeDeliveries.length === 0 ? (
              <Card className="bg-slate-50/80 border-dashed border-2 border-slate-200">
                <CardContent className="py-12 text-center text-slate-500 space-y-2">
                  <Package className="w-10 h-10 text-slate-400 mx-auto" />
                  <h3 className="font-bold text-slate-800 text-base">No Orders Currently in Transit</h3>
                  <p className="text-xs text-slate-400">Accepted patient orders will show their real-time packing and delivery progress here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeDeliveries.map((order) => {
                  const isAccepted = order.status === "accepted";
                  const isConfirmed = order.status === "delivery_confirmed";
                  const isPacking = order.status === "packing";
                  const isOutForDelivery = order.status === "out_for_delivery";
                  const isDelivered = order.status === "delivered";

                  return (
                    <Card
                      key={order.id}
                      className={`border-2 bg-white shadow-md hover:shadow-lg transition-all rounded-2xl overflow-hidden ${
                        isAccepted
                          ? "border-amber-400/80 bg-amber-50/20"
                          : "border-emerald-500/40"
                      }`}
                    >
                      <CardHeader className={`pb-3 border-b ${
                        isAccepted
                          ? "bg-gradient-to-r from-amber-50 to-orange-50/50 border-amber-100"
                          : "bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-100"
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base text-slate-900">
                                Order #{order.id} • {order.patientName || `Patient #${order.patientId}`}
                              </h3>
                              <Badge
                                className={`text-[10px] font-bold uppercase ${
                                  isAccepted
                                    ? "bg-amber-500 text-slate-950 font-black animate-pulse"
                                    : isConfirmed
                                    ? "bg-emerald-600 text-white font-bold"
                                    : isOutForDelivery
                                    ? "bg-purple-600 text-white"
                                    : isPacking
                                    ? "bg-blue-600 text-white"
                                    : "bg-emerald-600 text-white"
                                }`}
                              >
                                {isAccepted
                                  ? "⚠️ AWAITING PATIENT ACCEPTANCE"
                                  : isConfirmed
                                  ? "✓ PATIENT ACCEPTED - READY TO DISPENSE"
                                  : order.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              📍 {order.patientAddress || "Kolkata"} • Bill: <strong>₹{order.totalPrice || 320}</strong> • ETA: {order.estimatedDeliveryMins || 18}m
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3">
                        {/* Status Handshake Banner */}
                        {isAccepted && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping mt-1 shrink-0" />
                            <div>
                              <p className="font-bold text-amber-950">Offer Sent to Patient • Dispensing Locked</p>
                              <p className="text-[11px] text-amber-800 mt-0.5">
                                Prompt sent to patient: <em>"Would you like to take it from your pharmacy?"</em>. You CANNOT dispense or pack until the patient accepts your offer.
                              </p>
                            </div>
                          </div>
                        )}

                        {isConfirmed && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-emerald-950">Patient Accepted Your Offer!</p>
                              <p className="text-[11px] text-emerald-800 mt-0.5">
                                Patient confirmed to take the medicine from your pharmacy. You are now authorized to dispense and pack the order.
                              </p>
                            </div>
                          </div>
                        )}

                        {order.deliveryPartnerName && (
                          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] uppercase text-emerald-400 font-bold block">
                                Assigned Courier Rider
                              </span>
                              <p className="font-bold text-sm mt-0.5">{order.deliveryPartnerName}</p>
                              <p className="text-slate-400 text-[11px]">{order.deliveryPartnerVehicle}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] uppercase text-amber-400 font-bold block">
                                Delivery OTP
                              </span>
                              <span className="font-mono font-black text-base text-amber-300">
                                {order.deliveryOtp || "4829"}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-xs text-slate-800 whitespace-pre-wrap">
                          {order.medicines}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {/* When confirmed by patient, pharmacy can now dispense & mark packed */}
                          {isConfirmed && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateOrderStatus(order.id, "packing")}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                            >
                              <Package className="w-3.5 h-3.5" /> Dispense & Mark Packed
                            </Button>
                          )}

                          {isPacking && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateOrderStatus(order.id, "out_for_delivery")}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                            >
                              <Truck className="w-3.5 h-3.5" /> Handover to Express Rider
                            </Button>
                          )}

                          {isOutForDelivery && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateOrderStatus(order.id, "delivered")}
                              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Complete Handover
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTrackingOrderId(order.id)}
                            className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-bold text-xs gap-1.5 ml-auto"
                          >
                            <Navigation className="w-3.5 h-3.5" /> Route Map
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

        {/* ── TAB 3: My Medicine Inventory & Stock Manager ──────────────────── */}
        {activeTab === "inventory" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-600" />
                  My Pharmacy Medicine Inventory & Catalog
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage stock availability, unit prices, and catalog items. Medicines marked in-stock instantly match patient discovery searches.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search medicine or generic..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-8 text-xs h-9 bg-slate-50 border-slate-200"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAddMedOpen(true)}
                  className="text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medicine
                </Button>
              </div>
            </div>

            {filteredInventory.length === 0 ? (
              <Card className="bg-slate-50/80 border-dashed border-2 border-slate-200">
                <CardContent className="py-12 text-center text-slate-500 space-y-2">
                  <Pill className="w-10 h-10 text-slate-400 mx-auto" />
                  <h3 className="font-bold text-slate-800 text-base">No Medicines Found</h3>
                  <p className="text-xs text-slate-400">Click "Add Medicine" to add items to your catalog.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredInventory.map((item) => (
                  <div
                    key={item.inventoryId}
                    className={`p-4 rounded-2xl bg-white border transition-all ${
                      item.inStock
                        ? "border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-xs"
                        : "border-slate-200/50 bg-slate-50/60 opacity-75"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{item.medicineName}</h4>
                        {item.genericName && (
                          <p className="text-xs text-slate-500 font-medium">{item.genericName}</p>
                        )}
                      </div>
                      <Badge
                        className={`text-[10px] font-bold ${
                          item.inStock
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {item.inStock ? "IN STOCK" : "OUT OF STOCK"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
                      <span>Category: <strong className="text-slate-800">{item.category || "General"}</strong></span>
                      <span>Unit Price: <strong className="text-emerald-700 font-bold">₹{item.price || 35}</strong></span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                      <span className="text-xs font-semibold text-slate-700">Stock Availability</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.inStock ? "Available" : "Hidden"}
                        </span>
                        <Switch
                          checked={item.inStock}
                          onCheckedChange={() => handleToggleStock(item)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: Doctor Prescriptions Queue ─────────────────────────────── */}
        {activeTab === "prescriptions" && (
          <Card className="rounded-2xl border border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">Doctor Prescriptions Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {activeDashboard.recentPrescriptions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No recent prescriptions in queue.</div>
              ) : (
                <div className="space-y-3">
                  {activeDashboard.recentPrescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-base text-slate-900">Prescription #{rx.id}</p>
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
                        <p className="text-xs text-slate-500 mt-1">
                          Patient ID: <strong>#{rx.patientId}</strong> • Doctor ID: <strong>#{rx.doctorId}</strong> • Prescribed: {rx.prescribedDate}
                        </p>
                        {rx.diagnosis && <p className="text-xs text-slate-600 mt-1">Diagnosis: {rx.diagnosis}</p>}
                        <div className="mt-2 bg-white p-2.5 rounded-md font-mono text-xs text-slate-800 border border-slate-100">
                          {rx.medicines}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {rx.status === "active" && (
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                            onClick={() => handleMarkDispensed(rx.id)}
                            disabled={updatePrescription.isPending}
                          >
                            <Pill className="h-3.5 w-3.5" /> Dispense Medication
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
                  Accept & Confirm Stock
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Confirm medicine availability and quote delivery price & ETA.
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
                    Medicine Bill (₹)
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
                ⚡ Upon clicking Accept, the patient will immediately receive the 1-click prompt:
                <strong className="block text-white mt-1">
                  "{displayName} has your medicines in stock! Would you like 1-click doorstep delivery?"
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
                  {isAccepting ? "Accepting..." : "Confirm & Send 1-Click Offer"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add New Medicine Dialog */}
      <Dialog open={isAddMedOpen} onOpenChange={setIsAddMedOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl bg-slate-900 border border-slate-800 text-white p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">Add Medicine to Stock</DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Add a medicine to your inventory so patient searches match your pharmacy.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddMedicineSubmit} className="space-y-3.5 mt-2">
            <div>
              <label className="text-xs font-bold uppercase text-slate-300 block mb-1">
                Medicine Name *
              </label>
              <Input
                required
                placeholder="e.g. Paracetamol 650, Dolo 650, Amoxicillin 500mg"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-300 block mb-1">
                Generic Composition (Optional)
              </label>
              <Input
                placeholder="e.g. Acetaminophen 650mg, Amoxicillin Trihydrate"
                value={newMedGeneric}
                onChange={(e) => setNewMedGeneric(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1">
                  Unit Price (₹)
                </label>
                <Input
                  type="number"
                  value={newMedPrice}
                  onChange={(e) => setNewMedPrice(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-bold text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-300 block mb-1">
                  Initial Quantity
                </label>
                <Input
                  type="number"
                  value={newMedQty}
                  onChange={(e) => setNewMedQty(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-bold text-xs rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddMedOpen(false)}
                className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isAddingMed || !newMedName.trim()}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 shadow-md"
              >
                {isAddingMed ? "Adding..." : "Add to Stock"}
              </Button>
            </DialogFooter>
          </form>
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
