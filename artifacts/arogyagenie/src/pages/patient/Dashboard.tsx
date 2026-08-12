import { useGetPatientDashboard } from "@workspace/api-client-react";
import { Calendar, FileText, Pill, Clipboard, ArrowRight, Activity, Clock, Stethoscope, TestTube } from "lucide-react";
import { Link } from "wouter";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { HealthSummaryCard } from "../../components/health/HealthSummaryCard";
import { HealthAssistantChat } from "../../components/health/HealthAssistantChat";
import { HealthEpisodeTracker } from "../../components/health/HealthEpisodeTracker";
import { LabTrendVisualizer } from "../../components/health/LabTrendVisualizer";

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

  if (isLoading) return <DashboardSkeleton />;
  if (!dashboard) return null;

  const firstName = dashboard.firstName?.trim() || dashboard.userName?.trim().split(" ")[0] || "Patient";

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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

        {/* ── Welcome Hero Banner ──────────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden px-7 py-6"
          style={{
            background: "linear-gradient(135deg, hsl(238,58%,38%) 0%, hsl(238,52%,28%) 50%, hsl(244,55%,24%) 100%)",
            boxShadow: "0 8px 28px rgba(59,63,191,0.3), 0 2px 8px rgba(59,63,191,0.2)",
          }}
        >
          {/* Background orbs for depth */}
          <div
            className="absolute -top-12 -right-12 h-48 w-48 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, white, transparent)" }}
          />
          <div
            className="absolute -bottom-8 left-20 h-32 w-32 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, hsl(207,90%,70%), transparent)" }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                {dateStr}
              </p>
              <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "rgba(255,255,255,0.97)" }}>
                Hello, {firstName} 👋
              </h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Here's your health overview and longitudinal AI insights.
              </p>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 mt-4">
                <QuickAction label="Book Appointment" icon={Calendar}  href="/patient/appointments" color="blue" />
                <QuickAction label="Find a Doctor"    icon={Stethoscope} href="/patient/doctors" color="teal" />
                <QuickAction label="Symptom Check"    icon={Activity}   href="/patient/symptom-check" color="purple" />
                <QuickAction label="Book a Test"      icon={TestTube}   href="/patient/diagnostic-bookings" color="orange" />
              </div>
            </div>
          </div>
        </div>

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
