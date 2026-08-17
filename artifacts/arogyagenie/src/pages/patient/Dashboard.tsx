import { useState, useEffect } from "react";
import { useGetPatientDashboard, customFetch } from "@workspace/api-client-react";
import { Calendar, FileText, Pill, Clipboard, ArrowRight, Activity, Clock, Stethoscope, TestTube, Truck } from "lucide-react";
import { Link } from "wouter";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { HealthSummaryCard } from "../../components/health/HealthSummaryCard";
import { HealthAssistantChat } from "../../components/health/HealthAssistantChat";
import { HealthEpisodeTracker } from "../../components/health/HealthEpisodeTracker";
import { LabTrendVisualizer } from "../../components/health/LabTrendVisualizer";
import { OneClickDeliveryCard, type MedicineOrderItem } from "@/components/delivery/OneClickDeliveryCard";

// ─── Skeleton loading shimmer ────────────────────────────────────────────────
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl skeleton-shimmer ${className}`}
      style={{ minHeight: "1rem" }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="rounded-2xl p-6 space-y-3" style={{ background: "rgba(59,63,191,0.08)" }}>
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl p-5 bg-white" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <SkeletonBlock className="h-10 w-10 mb-3 rounded-xl" />
              <SkeletonBlock className="h-7 w-12 mb-1" />
              <SkeletonBlock className="h-3.5 w-24" />
            </div>
          ))}
        </div>
        {/* Body skeleton */}
        <SkeletonBlock className="h-48 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    </DashboardLayout>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
  href: string;
  accentColor: string;
}

function StatCard({ label, value, icon: Icon, gradient, iconColor, href, accentColor }: StatCardProps) {
  return (
    <Link href={href}>
      <div
        className="card-hover relative bg-white rounded-2xl p-5 cursor-pointer group overflow-hidden"
        style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)" }}
      >
        {/* Accent top bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: gradient }} />
        {/* Icon */}
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: gradient + "22", boxShadow: `0 2px 8px ${accentColor}33` }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        {/* Count */}
        <div className="text-3xl font-bold tracking-tight text-slate-900 mb-0.5">{value}</div>
        {/* Label */}
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {/* Arrow */}
        <div
          className="absolute bottom-4 right-4 h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 -translate-x-1 group-hover:translate-x-0"
          style={{ background: gradient }}
        >
          <ArrowRight className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    </Link>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ title, subtitle, actionLabel, actionHref }: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <span className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: "hsl(238,53%,49%)" }}>
            {actionLabel} <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )}
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────
function QuickAction({ label, icon: Icon, href, color }: { label: string; icon: React.ElementType; href: string; color: string }) {
  return (
    <Link href={href}>
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
        style={{ background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(4px)" }}
      >
        <Icon className="h-4 w-4" />
        {label}
      </div>
    </Link>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export function PatientDashboard() {
  const { data: dashboard, isLoading } = useGetPatientDashboard();
  const [orders, setOrders] = useState<MedicineOrderItem[]>([]);

  const fetchOrders = async () => {
    try {
      const data = await customFetch<MedicineOrderItem[]>("/api/medicine-orders");
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch medicine orders:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <DashboardSkeleton />;
  if (!dashboard) return null;

  const firstName = dashboard.firstName?.trim() || dashboard.userName?.trim().split(" ")[0] || "Patient";

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const activeOrAcceptedOrders = orders.filter((o) =>
    ["accepted", "delivery_confirmed", "packing", "out_for_delivery"].includes(o.status)
  );

  const statCards: StatCardProps[] = [
    {
      label: "Upcoming Appointments",
      value: dashboard.upcomingAppointments,
      icon: Calendar,
      gradient: "linear-gradient(135deg, hsl(238,60%,56%), hsl(238,50%,48%))",
      iconColor: "hsl(238,60%,52%)",
      accentColor: "hsl(238,60%,52%)",
      href: "/patient/appointments",
    },
    {
      label: "Active Medicines",
      value: dashboard.activeMedicines,
      icon: Pill,
      gradient: "linear-gradient(135deg, hsl(158,60%,38%), hsl(158,55%,32%))",
      iconColor: "hsl(158,60%,36%)",
      accentColor: "hsl(158,60%,36%)",
      href: "/patient/medicine-reminders",
    },
    {
      label: "Lab Reports",
      value: dashboard.totalLabReports,
      icon: FileText,
      gradient: "linear-gradient(135deg, hsl(260,60%,56%), hsl(260,50%,48%))",
      iconColor: "hsl(260,60%,52%)",
      accentColor: "hsl(260,60%,52%)",
      href: "/patient/lab-reports",
    },
    {
      label: "Prescriptions",
      value: dashboard.totalPrescriptions,
      icon: Clipboard,
      gradient: "linear-gradient(135deg, hsl(26,80%,52%), hsl(26,75%,44%))",
      iconColor: "hsl(26,80%,48%)",
      accentColor: "hsl(26,80%,48%)",
      href: "/patient/prescriptions",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Welcome Hero & Health Score Banner ─────────────────────────────── */}
        <div
          className="relative rounded-3xl overflow-hidden p-6 lg:p-8 text-white"
          style={{
            background: "linear-gradient(135deg, #18103A 0%, #20144F 50%, #2A1768 100%)",
            boxShadow: "0 10px 30px rgba(24, 16, 58, 0.4)",
          }}
        >
          {/* Subtle background glow elements */}
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #6C63FF 0%, transparent 70%)" }} />
          <div className="absolute -bottom-10 left-1/3 h-48 w-48 rounded-full opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #00D2FF 0%, transparent 70%)" }} />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left Col: Greeting & Quick Actions */}
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-violet-300/70">
                {dateStr}
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Good Morning, {firstName} 👋
              </h1>
              <p className="text-sm text-violet-200/80 leading-relaxed max-w-xl">
                Here is your health overview, live vitals tracking, and longitudinal AI medical insights.
              </p>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                <QuickAction label="Book Visit" icon={Calendar} href="/patient/appointments" color="purple" />
                <QuickAction label="Find Doctor" icon={Stethoscope} href="/patient/doctors" color="blue" />
                <QuickAction label="Symptom AI" icon={Activity} href="/patient/symptom-check" color="teal" />
                <QuickAction label="Book Test" icon={TestTube} href="/patient/diagnostic-bookings" color="orange" />
              </div>
            </div>

            {/* Right Col: Health Score Ring Widget (Matching reference screenshot) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex items-center gap-5 shadow-xl w-full max-w-xs">
                {/* Gauge Ring SVG */}
                <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/10"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-400"
                      strokeDasharray="85, 100"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-white leading-none">85</span>
                    <span className="text-[10px] text-emerald-300 font-semibold mt-0.5">/ 100</span>
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Good Health
                  </div>
                  <h4 className="text-sm font-bold text-white">Health Score</h4>
                  <p className="text-[11px] text-violet-200/70 mt-0.5">Vitals & records within normal clinical range</p>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Vitals Strip (Matching reference screenshot) */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-400 shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-violet-200/60 uppercase font-semibold">Heart Rate</p>
                <p className="text-sm font-bold text-white">72 <span className="text-[10px] font-normal text-violet-200/60">bpm</span></p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-violet-200/60 uppercase font-semibold">Sleep</p>
                <p className="text-sm font-bold text-white">7h 30m</p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-violet-200/60 uppercase font-semibold">Steps</p>
                <p className="text-sm font-bold text-white">7,842</p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-300 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-violet-200/60 uppercase font-semibold">Calories</p>
                <p className="text-sm font-bold text-white">1,650 <span className="text-[10px] font-normal text-violet-200/60">kcal</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active 1-Click Medicine Deliveries & Pharmacy Acceptance Prompts ── */}
        {activeOrAcceptedOrders.length > 0 && (
          <div className="space-y-4">
            {activeOrAcceptedOrders.map((order) => (
              <OneClickDeliveryCard key={order.id} order={order} onOrderUpdated={fetchOrders} />
            ))}
          </div>
        )}

        {/* ── Stat Cards ───────────────────────────────────────────────────── */}
        <div>
          <SectionHeading title="Health Overview" subtitle="Your key health metrics at a glance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            {statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        </div>

        {/* ── Longitudinal AI Health Summary ───────────────────────────────── */}
        <div>
          <SectionHeading
            title="AI Health Summary"
            subtitle="Synthesized from your verified medical timeline"
          />
          <HealthSummaryCard />
        </div>

        {/* ── AI Health Assistant ───────────────────────────────────────────── */}
        <div>
          <SectionHeading
            title="AI Health Assistant"
            subtitle="Ask questions about your health records or medical guidelines"
          />
          <HealthAssistantChat />
        </div>

        {/* ── Health Episodes + Lab Trends ─────────────────────────────────── */}
        <div className="space-y-4">
          <HealthEpisodeTracker />
          <LabTrendVisualizer />
        </div>

        {/* ── Recent Appointments + Medicine Reminders ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent Appointments */}
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Recent Appointments</h3>
                <p className="text-xs text-slate-500 mt-0.5">Latest scheduled consultations</p>
              </div>
              <Link href="/patient/appointments">
                <span className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "hsl(238,53%,49%)" }}>
                  View all <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {dashboard.recentAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-400">No recent appointments.</p>
                  <Link href="/patient/appointments">
                    <span className="text-xs font-semibold mt-1 inline-block hover:opacity-80" style={{ color: "hsl(238,53%,49%)" }}>
                      Book one now →
                    </span>
                  </Link>
                </div>
              ) : (
                dashboard.recentAppointments.map((apt) => {
                  const initials = apt.doctorName
                    ? apt.doctorName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
                    : "DR";
                  const apptDate = new Date(apt.appointmentDate);
                  const formattedDate = apptDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  const isUpcoming = apptDate >= today;
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-slate-50"
                      style={{ border: "1px solid hsl(214,31.8%,93%)" }}
                    >
                      {/* Doctor avatar */}
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
                        style={{ background: "linear-gradient(135deg, hsl(238,60%,56%), hsl(207,90%,56%))" }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">Dr. {apt.doctorName}</p>
                        <p className="text-xs text-slate-500 truncate">{apt.doctorSpecialty}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <div
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={
                            isUpcoming
                              ? { background: "rgba(59,63,191,0.1)", color: "hsl(238,53%,49%)" }
                              : { background: "rgba(100,116,139,0.1)", color: "#64748b" }
                          }
                        >
                          {formattedDate}
                        </div>
                        <p className="text-[11px] text-slate-400">{apt.appointmentTime}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Medicine Reminders */}
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Medicine Reminders</h3>
                <p className="text-xs text-slate-500 mt-0.5">Active prescriptions & schedules</p>
              </div>
              <Link href="/patient/medicine-reminders">
                <span className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "hsl(238,53%,49%)" }}>
                  View all <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {dashboard.activeMedicineReminders.length === 0 ? (
                <div className="text-center py-8">
                  <Pill className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-400">No active reminders.</p>
                  <Link href="/patient/medicine-reminders">
                    <span className="text-xs font-semibold mt-1 inline-block hover:opacity-80" style={{ color: "hsl(238,53%,49%)" }}>
                      Add medicines →
                    </span>
                  </Link>
                </div>
              ) : (
                dashboard.activeMedicineReminders.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-emerald-50/40"
                    style={{ border: "1px solid rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.04)" }}
                  >
                    {/* Pill icon */}
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, hsl(158,55%,40%), hsl(158,50%,34%))" }}
                    >
                      <Pill className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{med.medicineName}</p>
                      <p className="text-xs text-slate-500 truncate">{med.dosage} · {med.frequency.replace(/_/g, " ")}</p>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0"
                      style={{ background: "white", border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                    >
                      <Clock className="h-3 w-3" style={{ color: "hsl(158,55%,38%)" }} />
                      <span className="text-xs font-semibold" style={{ color: "hsl(158,55%,35%)" }}>{med.times}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
