import { useListTimeline } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Calendar, FileText, Pill, Stethoscope, TestTube, Activity, Clock } from "lucide-react";

// ─── Event Category Config ───────────────────────────────────────────────────
interface EventConfig {
  icon: React.ElementType;
  gradient: string;
  badgeBg: string;
  badgeColor: string;
  label: string;
}

function getEventConfig(type: string): EventConfig {
  switch (type) {
    case "appointment":
      return {
        icon: Calendar,
        gradient: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
        badgeBg: "rgba(79,70,229,0.1)",
        badgeColor: "#4338ca",
        label: "Appointment",
      };
    case "prescription":
      return {
        icon: Pill,
        gradient: "linear-gradient(135deg, hsl(270,70%,55%), hsl(280,65%,48%))",
        badgeBg: "rgba(147,51,234,0.1)",
        badgeColor: "#7e22ce",
        label: "Prescription",
      };
    case "lab_report":
      return {
        icon: FileText,
        gradient: "linear-gradient(135deg, hsl(158,60%,42%), hsl(158,50%,34%))",
        badgeBg: "rgba(16,185,129,0.1)",
        badgeColor: "#047857",
        label: "Lab Report",
      };
    case "diagnostic_booking":
      return {
        icon: TestTube,
        gradient: "linear-gradient(135deg, hsl(26,80%,52%), hsl(26,75%,44%))",
        badgeBg: "rgba(245,158,11,0.1)",
        badgeColor: "#b45309",
        label: "Diagnostic Test",
      };
    case "symptom_assessment":
      return {
        icon: Activity,
        gradient: "linear-gradient(135deg, hsl(346,80%,54%), hsl(346,75%,46%))",
        badgeBg: "rgba(239,68,68,0.1)",
        badgeColor: "#b91c1c",
        label: "Symptom Assessment",
      };
    case "medicine_reminder":
      return {
        icon: Pill,
        gradient: "linear-gradient(135deg, hsl(173,58%,39%), hsl(173,50%,32%))",
        badgeBg: "rgba(13,148,136,0.1)",
        badgeColor: "#0f766e",
        label: "Medicine Reminder",
      };
    default:
      return {
        icon: Stethoscope,
        gradient: "linear-gradient(135deg, hsl(215,25%,45%), hsl(215,20%,35%))",
        badgeBg: "rgba(100,116,139,0.1)",
        badgeColor: "#475569",
        label: type ? type.replace(/_/g, " ") : "Event",
      };
  }
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div className="relative border-l-2 border-slate-200 ml-4 md:ml-6 space-y-6 pb-6 mt-6 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="relative pl-8 md:pl-10">
          <div className="absolute -left-[18px] top-1 h-9 w-9 rounded-2xl skeleton-shimmer shrink-0" />
          <div className="bg-white p-5 rounded-2xl border border-slate-100/90 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div className="h-4 skeleton-shimmer rounded w-48" />
              <div className="h-4 skeleton-shimmer rounded w-24" />
            </div>
            <div className="h-3 skeleton-shimmer rounded w-full" />
            <div className="h-5 skeleton-shimmer rounded-full w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientTimeline() {
  const { data: timelineEvents, isLoading } = useListTimeline();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">Your complete longitudinal medical history in one chronological view.</p>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {isLoading ? (
          <TimelineSkeleton />
        ) : timelineEvents?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <Clock className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No timeline events yet</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Your consultations, prescriptions, lab reports, and symptom assessments will automatically track here chronologically.
            </p>
          </div>
        ) : (
          <div 
            className="relative border-l-2 ml-4 md:ml-6 space-y-6 pb-8 mt-6"
            style={{ borderColor: "hsl(243,75%,92%)" }}
          >
            {timelineEvents?.map((event) => {
              const cfg = getEventConfig(event.eventType);
              const Icon = cfg.icon;
              const formattedDate = event.eventDate
                ? new Date(event.eventDate).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "";

              return (
                <div key={event.id} className="relative pl-8 md:pl-10 group">
                  {/* Timeline Circle Icon Node */}
                  <div
                    className="absolute -left-[19px] top-1.5 h-9 w-9 rounded-2xl flex items-center justify-center text-white shadow-xs border-2 border-white shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: cfg.gradient }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Card Content */}
                  <div 
                    className="bg-white p-5 rounded-2xl border border-slate-100/90 shadow-sm hover:shadow-md transition-all duration-180 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <h3 className="font-bold text-base text-slate-900 leading-snug">{event.title}</h3>
                      <div 
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0"
                        style={{ background: "hsl(243,75%,96.5%)", color: "hsl(243,75%,50%)" }}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {event.description}
                      </p>
                    )}

                    <div className="pt-0.5 flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                        style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
