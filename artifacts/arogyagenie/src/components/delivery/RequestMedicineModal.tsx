import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pill, MapPin, Sparkles, Store, Clock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMedicines?: string;
  prescriptionId?: number;
  pharmacyId?: number;
  pharmacyName?: string;
  onSuccess?: () => void;
}

export function RequestMedicineModal({
  isOpen,
  onClose,
  defaultMedicines = "",
  prescriptionId,
  pharmacyId,
  pharmacyName,
  onSuccess,
}: RequestMedicineModalProps) {
  const [medicines, setMedicines] = useState(defaultMedicines);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (defaultMedicines) {
      setMedicines(defaultMedicines);
    }
  }, [defaultMedicines, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicines.trim()) {
      toast({
        title: "Required",
        description: "Please specify required medicines",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let savedLoc: any = null;
      try {
        const raw = localStorage.getItem("arogyagenie_user_location");
        if (raw) savedLoc = JSON.parse(raw);
      } catch {}

      const body: any = {
        medicines: medicines.trim(),
        prescriptionId: prescriptionId || null,
        pharmacyId: pharmacyId || null,
        address: deliveryAddress.trim() || savedLoc?.name || undefined,
        latitude: savedLoc?.lat || undefined,
        longitude: savedLoc?.lng || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/medicine-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit request");
      }

      toast({
        title: "Medicine Request Sent!",
        description: "Nearby onboarded pharmacies are reviewing your medicines. You'll receive a 1-click doorstep delivery prompt once accepted!",
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: "Request Failed",
        description: err.message || "Could not submit medicine request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl bg-slate-900 border border-slate-800 text-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Request Medicine Delivery
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Broadcast request to verified onboarded pharmacies for fast doorstep delivery.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {pharmacyName && (
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <Store className="h-4 w-4 text-emerald-400" />
                <span>Preferred Pharmacy:</span>
              </div>
              <span className="font-bold text-white">{pharmacyName}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
              Required Medicines & Dosage
            </label>
            <Textarea
              required
              rows={3}
              value={medicines}
              onChange={(e) => setMedicines(e.target.value)}
              placeholder="e.g. Paracetamol 650mg (10 tabs)&#10;Amoxicillin 500mg (6 caps)&#10;Pantoprazole 40mg (15 tabs)"
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl font-mono text-xs focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
              Delivery Address (Optional)
            </label>
            <Input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Leave empty to use your registered address"
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl text-xs focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
              Special Instructions or Notes (Optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call before delivery, ring flat 4B bell"
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl text-xs focus:border-emerald-500"
            />
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Once a pharmacy accepts, you'll receive a 1-click confirmation with real-time Blinkit route tracking!
            </span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
            >
              {loading ? "Sending..." : "Submit Medicine Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
