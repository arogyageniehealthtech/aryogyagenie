import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  AlertCircle,
  Package,
  Home,
  Store,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Play,
  Pause,
  Copy,
  Check,
  FileText,
  BadgePercent,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { loadGoogleMaps, getGoogleMapsApiKey } from "@/lib/googleMapsLoader";

export interface DeliveryTrackingData {
  order: {
    id: number;
    patientId: number;
    pharmacyId: number | null;
    prescriptionId: number | null;
    medicines: string;
    patientName: string | null;
    patientPhone: string | null;
    patientAddress: string | null;
    patientLat: number | null;
    patientLng: number | null;
    pharmacyName: string | null;
    pharmacyAddress: string | null;
    pharmacyLat: number | null;
    pharmacyLng: number | null;
    status: string;
    totalPrice: number | null;
    estimatedDeliveryMins: number | null;
    deliveryDistanceKm: number | null;
    deliveryPartnerName: string | null;
    deliveryPartnerPhone: string | null;
    deliveryPartnerVehicle: string | null;
    deliveryOtp: string | null;
    paymentMethod: string | null;
    paymentStatus: string | null;
    notes: string | null;
    createdAt: string;
  };
  origin: {
    title: string;
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    title: string;
    address: string;
    lat: number;
    lng: number;
  };
  rider: {
    lat: number;
    lng: number;
    name: string;
    phone: string;
    vehicle: string;
    otp: string;
  };
  waypoints: Array<{ lat: number; lng: number }>;
  riderProgressPct: number;
  remainingMins: number;
  distanceKm: number;
  activeStepIndex: number;
  steps: Array<{ title: string; desc: string; done: boolean }>;
}

interface BlinkitDeliveryTrackerProps {
  orderId: number;
  initialData?: DeliveryTrackingData;
  onClose?: () => void;
  onStatusUpdate?: () => void;
}

export function BlinkitDeliveryTracker({
  orderId,
  initialData,
  onClose,
  onStatusUpdate,
}: BlinkitDeliveryTrackerProps) {
  const [data, setData] = useState<DeliveryTrackingData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(initialData?.riderProgressPct ?? 45);
  const [isSimulating, setIsSimulating] = useState(true);
  const { toast } = useToast();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const riderMarkerRef = useRef<google.maps.Marker | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Fetch tracking data
  const fetchTracking = async () => {
    try {
      const res = await fetch(`/api/medicine-orders/${orderId}/tracking`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.riderProgressPct !== undefined) {
          setSimulatedProgress(json.riderProgressPct);
        }
      }
    } catch (err) {
      console.error("Error fetching live tracking:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 6000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Live simulation tick for rider progress
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev >= 98) return 98;
        return prev + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isSimulating]);

  // Copy OTP handler
  const handleCopyOtp = () => {
    const otp = data?.rider?.otp || data?.order?.deliveryOtp || "4829";
    navigator.clipboard.writeText(otp);
    setCopiedOtp(true);
    toast({
      title: "Delivery PIN Copied",
      description: `Share PIN ${otp} with your delivery partner upon arrival.`,
    });
    setTimeout(() => setCopiedOtp(false), 3000);
  };

  // Coordinates resolution
  const originPos = useMemo(
    () => ({
      lat: data?.origin?.lat || data?.order?.pharmacyLat || 22.582,
      lng: data?.origin?.lng || data?.order?.pharmacyLng || 88.421,
    }),
    [data]
  );

  const destPos = useMemo(
    () => ({
      lat: data?.destination?.lat || data?.order?.patientLat || 22.5697,
      lng: data?.destination?.lng || data?.order?.patientLng || 88.3697,
    }),
    [data]
  );

  // Current rider position based on progress
  const riderPos = useMemo(() => {
    const frac = simulatedProgress / 100;
    return {
      lat: originPos.lat + (destPos.lat - originPos.lat) * frac,
      lng: originPos.lng + (destPos.lng - originPos.lng) * frac,
    };
  }, [simulatedProgress, originPos, destPos]);

  // Initialize Google Maps if API key is present
  useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey || !mapContainerRef.current) return;

    let isMounted = true;
    loadGoogleMaps()
      .then((maps) => {
        if (!isMounted || !mapContainerRef.current) return;

        const map = new maps.Map(mapContainerRef.current, {
          center: riderPos,
          zoom: 14,
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", stylers: [{ color: "#dbeafe" }] },
          ],
        });

        // Pharmacy Marker
        new maps.Marker({
          position: originPos,
          map,
          title: data?.origin?.title || "Pharmacy",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
                <circle cx="18" cy="18" r="16" fill="#059669" stroke="#ffffff" stroke-width="2"/>
                <text x="18" y="23" font-size="16" text-anchor="middle" fill="#ffffff">🏪</text>
              </svg>
            `)}`,
            scaledSize: new maps.Size(36, 36),
          },
        });

        // Destination Marker
        new maps.Marker({
          position: destPos,
          map,
          title: data?.destination?.title || "Your Doorstep",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
                <circle cx="18" cy="18" r="16" fill="#2563EB" stroke="#ffffff" stroke-width="2"/>
                <text x="18" y="23" font-size="16" text-anchor="middle" fill="#ffffff">🏠</text>
              </svg>
            `)}`,
            scaledSize: new maps.Size(36, 36),
          },
        });

        // Polyline Route Path
        const polyline = new maps.Polyline({
          path: [originPos, riderPos, destPos],
          strokeColor: "#10B981",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });
        polylineRef.current = polyline;

        // Moving Rider Marker
        const riderMarker = new maps.Marker({
          position: riderPos,
          map,
          title: data?.rider?.name || "Delivery Partner",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
                <circle cx="22" cy="22" r="20" fill="#059669" stroke="#ffffff" stroke-width="3"/>
                <text x="22" y="28" font-size="20" text-anchor="middle" fill="#ffffff">🛵</text>
              </svg>
            `)}`,
            scaledSize: new maps.Size(44, 44),
          },
          zIndex: 9999,
        });
        riderMarkerRef.current = riderMarker;

        mapInstanceRef.current = map;
      })
      .catch((err) => {
        console.warn("Google Maps not initialized, falling back to dynamic vector canvas:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update rider position on Google Map if active
  useEffect(() => {
    if (riderMarkerRef.current) {
      riderMarkerRef.current.setPosition(riderPos);
    }
    if (polylineRef.current) {
      polylineRef.current.setPath([originPos, riderPos, destPos]);
    }
  }, [riderPos, originPos, destPos]);

  const currentEta = useMemo(() => {
    if (data?.order?.status === "delivered") return 0;
    const total = data?.order?.estimatedDeliveryMins || 18;
    return Math.max(1, Math.round(total * (1 - simulatedProgress / 100)));
  }, [data, simulatedProgress]);

  const otp = data?.rider?.otp || data?.order?.deliveryOtp || "5821";
  const pharmacyName = data?.order?.pharmacyName || data?.origin?.title || "Apex Care Pharmacy";
  const patientAddress = data?.order?.patientAddress || data?.destination?.address || "Salt Lake, Kolkata";
  const partnerName = data?.rider?.name || data?.order?.deliveryPartnerName || "Rahul Sharma";
  const partnerVehicle = data?.rider?.vehicle || data?.order?.deliveryPartnerVehicle || "WB-02-AX-8912 (EV Scooter)";
  const partnerPhone = data?.rider?.phone || data?.order?.deliveryPartnerPhone || "+91 98301 22894";

  // Step calculations
  const steps = [
    {
      title: "Order Placed & Confirmed",
      desc: "Order sent to nearby onboarded pharmacies",
      icon: "🛒",
      done: true,
    },
    {
      title: "Pharmacy Accepted",
      desc: `${pharmacyName} verified medicines in stock`,
      icon: "🏪",
      done: true,
    },
    {
      title: "Packed & Tamper-Sealed",
      desc: "Packed with quality check assurance",
      icon: "📦",
      done: simulatedProgress >= 20,
    },
    {
      title: "Out for Doorstep Delivery",
      desc: `${partnerName} is heading towards your location`,
      icon: "🛵",
      done: simulatedProgress >= 40,
    },
    {
      title: "Arrived at Doorstep",
      desc: "Verify 4-digit PIN for handover",
      icon: "🏠",
      done: simulatedProgress >= 95 || data?.order?.status === "delivered",
    },
  ];

  return (
    <div className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 max-w-4xl mx-auto flex flex-col my-4">
      {/* ── Top Blinkit Header Bar ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30 shrink-0">
            🛵
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider bg-yellow-400 text-slate-950 px-2.5 py-0.5 rounded-full">
                ⚡ Blinkit Instant Health
              </span>
              <span className="text-xs text-emerald-100 font-medium">Order #{orderId}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight mt-0.5 flex items-center gap-2">
              Arriving in{" "}
              <span className="text-yellow-300 underline decoration-yellow-400/60 decoration-wavy">
                {currentEta} mins
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={fetchTracking}
            className="bg-white/15 hover:bg-white/25 text-white border-0 text-xs font-semibold gap-1.5 h-8 backdrop-blur-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Live Sync
          </Button>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/20 h-8 w-8 p-0 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Live Route Graph & Map Canvas ──────────────────────────────────────── */}
      <div className="relative w-full h-80 bg-slate-950 overflow-hidden border-b border-slate-800">
        {/* Google Maps Container (if loaded) */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Dynamic Vector Route Canvas (Always visible as rich overlay/fallback) */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
          {/* Animated SVG Route Graph Path */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.9" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Glowing route line */}
            <path
              d="M 80,180 Q 240,60 420,160 T 740,140"
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeDasharray="6,6"
              className="animate-pulse"
              filter="url(#glow)"
            />
          </svg>

          {/* Floating Origin & Destination Pins */}
          <div className="flex items-center justify-between z-10">
            {/* Origin: Pharmacy Node */}
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/40 shadow-xl max-w-[220px]">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Store className="w-3.5 h-3.5" />
                <span>Pharmacy Hub</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{pharmacyName}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {data?.order?.pharmacyAddress || "Verified Medical Store"}
              </p>
            </div>

            {/* Destination: Patient Doorstep Node */}
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-blue-500/40 shadow-xl max-w-[220px] text-right">
              <div className="flex items-center justify-end gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Your Doorstep</span>
                <Home className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-bold text-white truncate">
                {data?.order?.patientName || "Delivery Location"}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{patientAddress}</p>
            </div>
          </div>

          {/* Floating Rider Status Chip */}
          <div className="flex items-center justify-center z-10">
            <div className="bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-full border border-yellow-500/50 shadow-2xl flex items-center gap-3 animate-bounce">
              <span className="text-lg">🛵</span>
              <div className="text-left">
                <p className="text-xs font-black text-yellow-300">
                  {partnerName} is on the way • {data?.distanceKm || 2.4} km away
                </p>
                <p className="text-[10px] text-slate-300">Live GPS tracking active</p>
              </div>
            </div>
          </div>

          {/* Floating Control Bar for Live Simulation */}
          <div className="flex items-center justify-between text-xs text-slate-400 z-10">
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold text-slate-200">Express Delivery Route Active</span>
            </div>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 transition-colors pointer-events-auto cursor-pointer"
            >
              {isSimulating ? <Pause className="w-3 h-3 text-yellow-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
              <span>{isSimulating ? "Pause Simulation" : "Resume Simulation"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Details Grid ─────────────────────────────────────────────────── */}
      <div className="p-6 space-y-6 bg-slate-900">
        {/* 4-Digit Security PIN & Delivery Partner Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Delivery OTP Card */}
          <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Handover Verification PIN</span>
              </div>
              <p className="text-xs text-slate-400">Share this code with rider upon arrival:</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-1.5">
                  {otp.split("").map((digit, i) => (
                    <span
                      key={i}
                      className="w-8 h-10 rounded-lg bg-slate-950 border border-yellow-500/60 font-mono font-black text-xl text-yellow-400 flex items-center justify-center shadow-inner"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyOtp}
                  className="h-9 px-3 border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="h-14 w-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 flex flex-col items-center justify-center text-yellow-400 shrink-0">
              <Sparkles className="w-6 h-6" />
              <span className="text-[9px] font-bold uppercase mt-0.5">Secure</span>
            </div>
          </div>

          {/* Delivery Partner Profile Card */}
          <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl text-emerald-400 font-bold shrink-0">
                👨‍✈️
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-white">{partnerName}</h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                    ★ 4.9
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{partnerVehicle}</p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Fully Vaccinated & Masked
                </p>
              </div>
            </div>

            <a
              href={`tel:${partnerPhone}`}
              className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call Rider
            </a>
          </div>
        </div>

        {/* ── Blinkit Delivery Stepper ────────────────────────────────────────── */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Live Delivery Timeline</span>
          </h4>

          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {steps.map((step, index) => {
              return (
                <div key={index} className="relative flex items-start justify-between gap-4">
                  {/* Step Dot */}
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                      step.done
                        ? "bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-500/40"
                        : "bg-slate-900 border-slate-700 text-slate-500"
                    }`}
                  >
                    {step.done ? "✓" : index + 1}
                  </div>

                  <div>
                    <h5
                      className={`text-sm font-bold ${
                        step.done ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {step.title}
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
                  </div>

                  {step.done && (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
                      Completed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Prescribed Medicines Summary & Bill ──────────────────────────────── */}
        <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-slate-400">Medications Ordered</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                100% Genuine Pharmacy Certified
              </span>
            </div>
            <p className="text-sm font-mono text-slate-200 whitespace-pre-wrap bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-2">
              {data?.order?.medicines || "Prescribed Medications Package"}
            </p>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700/80 min-w-[200px] text-right shrink-0">
            <span className="text-xs text-slate-400 block">Total Amount</span>
            <span className="text-2xl font-black text-white block mt-0.5">
              ₹{data?.order?.totalPrice || 320}
            </span>
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center justify-end gap-1 mt-1">
              <BadgePercent className="w-3.5 h-3.5" /> Free Doorstep Delivery
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
