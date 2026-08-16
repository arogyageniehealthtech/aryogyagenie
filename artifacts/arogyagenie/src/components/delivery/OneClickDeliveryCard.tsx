import React, { useState } from "react";
import {
  Sparkles,
  MapPin,
  Clock,
  Pill,
  ShieldCheck,
  ArrowRight,
  Store,
  CheckCircle2,
  Navigation,
  ExternalLink,
  Flame,
  BadgePercent,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BlinkitDeliveryTracker } from "./BlinkitDeliveryTracker";

export interface MedicineOrderItem {
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
  createdAt: string;
}

interface OneClickDeliveryCardProps {
  order: MedicineOrderItem;
  onOrderUpdated?: () => void;
}

export function OneClickDeliveryCard({ order, onOrderUpdated }: OneClickDeliveryCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const { toast } = useToast();

  const isAccepted = order.status === "accepted";
  const isConfirmed = [
    "delivery_confirmed",
    "packing",
    "out_for_delivery",
    "delivered",
  ].includes(order.status);

  // 1-Click Doorstep Delivery Confirmation
  const handleOneClickDelivery = async () => {
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/medicine-orders/${order.id}/confirm-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "cash_on_delivery" }),
      });

      if (!res.ok) {
        throw new Error("Failed to confirm 1-click delivery");
      }

      toast({
        title: "⚡ Doorstep Delivery Confirmed!",
        description: `Your order from ${order.pharmacyName || "Pharmacy"} is being packed. Express rider will arrive in ${order.estimatedDeliveryMins || 18} mins!`,
      });

      if (onOrderUpdated) {
        onOrderUpdated();
      }
      setShowTrackerModal(true);
    } catch (err: any) {
      toast({
        title: "Confirmation Failed",
        description: err.message || "Could not confirm delivery",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const pharmacyDisplayName = order.pharmacyName || "Apex Healthcare Pharmacy";
  const deliveryAddress = order.patientAddress || "Your Current Address";
  const etaMins = order.estimatedDeliveryMins || 18;
  const price = order.totalPrice || 320;

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-6 shadow-2xl transition-all hover:border-emerald-400">
        {/* Glowing Decorative Backdrop */}
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />

        {/* Top Header Badge */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              {isAccepted ? "⚡ Pharmacy Accepted Your Request" : "🛵 Live Doorstep Delivery Active"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>ETA: {etaMins} mins</span>
          </div>
        </div>

        {/* Main Body */}
        <div className="relative z-10 mt-4 space-y-4">
          {/* Main Acceptance Announcement Headline */}
          <div>
            <h3 className="text-xl font-black tracking-tight text-white md:text-2xl">
              {pharmacyDisplayName} <span className="text-emerald-400">has your medicines!</span>
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              {isAccepted
                ? "Would you like them delivered to your doorstep in 1 click?"
                : "Your delivery is in progress. Live route tracking is active."}
            </p>
          </div>

          {/* Details Pill Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Pharmacy Source */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-emerald-400">
                <Store className="h-3 w-3" /> Source Pharmacy
              </span>
              <p className="mt-0.5 truncate text-xs font-bold text-white">{pharmacyDisplayName}</p>
              <p className="truncate text-[11px] text-slate-400">
                {order.pharmacyAddress || "Verified Pharmacy Hub"}
              </p>
            </div>

            {/* Doorstep Destination */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-blue-400">
                <MapPin className="h-3 w-3" /> Delivery To
              </span>
              <p className="mt-0.5 truncate text-xs font-bold text-white">Doorstep Delivery</p>
              <p className="truncate text-[11px] text-slate-400">{deliveryAddress}</p>
            </div>

            {/* Total Price & Free Delivery */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-emerald-300">
                <BadgePercent className="h-3 w-3" /> Total Bill
              </span>
              <p className="mt-0.5 text-base font-black text-white">₹{price}</p>
              <p className="text-[11px] font-semibold text-emerald-400">Free 1-Click Delivery</p>
            </div>
          </div>

          {/* Requested Medicines List */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Pill className="h-3.5 w-3.5 text-indigo-400" /> Prescribed Medicines
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verified in Stock
              </span>
            </div>
            <p className="font-mono text-xs text-slate-200 whitespace-pre-wrap">{order.medicines}</p>
          </div>

          {/* Primary Action Section */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            {isAccepted && (
              <Button
                onClick={handleOneClickDelivery}
                disabled={isConfirming}
                className="w-full sm:flex-1 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                {isConfirming ? (
                  "Confirming Delivery..."
                ) : (
                  <span className="flex items-center gap-2">
                    <Flame className="h-4 w-4 fill-slate-950" />
                    YES, DELIVER TO MY DOORSTEP (1-CLICK)
                  </span>
                )}
              </Button>
            )}

            {/* View Live Route Graph Button */}
            <Button
              variant="outline"
              onClick={() => setShowTrackerModal(true)}
              className="w-full sm:w-auto h-12 rounded-2xl border-emerald-500/50 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs gap-2 px-5 cursor-pointer"
            >
              <Navigation className="h-4 w-4" />
              {isAccepted ? "Preview Live Route Graph" : "Track Live Delivery (Blinkit View)"}
            </Button>
          </div>
        </div>
      </div>

      {/* Live Route Modal Tracker */}
      {showTrackerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <BlinkitDeliveryTracker
              orderId={order.id}
              onClose={() => setShowTrackerModal(false)}
              onStatusUpdate={onOrderUpdated}
            />
          </div>
        </div>
      )}
    </>
  );
}
