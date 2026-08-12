import { useListPrescriptions } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { FileText, Download, Clock, Pill, Stethoscope, CheckCircle2, AlertCircle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const { data: prescriptions, isLoading } = useListPrescriptions();

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prescriptions</h1>
          <p className="text-sm text-slate-500 mt-1">View and download your official digital prescriptions.</p>
        </div>

        {/* ── Content Grid ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <PrescriptionSkeleton key={i} />)}
          </div>
        ) : prescriptions?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <ClipboardList className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No prescriptions found</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              When your doctor issues a digital prescription after a consultation, it will appear here.
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

                  {/* Card Footer */}
                  <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl gap-2 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
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
    </DashboardLayout>
  );
}
