import { useGetPatientHealthSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, Pill, AlertCircle, FileText, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HealthSummaryCard() {
  const { data: summary, isLoading, refetch, isRefetching } = useGetPatientHealthSummary();

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm animate-pulse">
        <CardContent className="p-6 space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-4 bg-slate-100 rounded w-2/3"></div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-white via-blue-50/20 to-slate-50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-white/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Longitudinal AI Health Summary
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Synthesized from your verified medical timeline</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-500 gap-1.5"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Dynamic AI Interpretation */}
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI Journey Overview</span>
            <Badge variant="secondary" className="text-[10px]">AI-Assisted Interpretation</Badge>
          </div>
          <p className="text-sm leading-relaxed text-slate-800 font-medium">{summary.aiInterpretation}</p>
        </div>

        {/* 2-Column Facts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* Recent Health Events */}
          <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-100">
            <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600" /> Recent Medical Events
            </h4>
            {summary.recentHealthEvents.length > 0 ? (
              <ul className="text-xs space-y-1 text-slate-700">
                {summary.recentHealthEvents.map((ev, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No recent health events recorded.</p>
            )}
          </div>

          {/* Current Medicines */}
          <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-100">
            <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Pill className="h-4 w-4 text-teal-600" /> Current Prescribed Medicines
            </h4>
            {summary.currentMedicines.length > 0 ? (
              <ul className="text-xs space-y-1 text-slate-700">
                {summary.currentMedicines.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-teal-600 font-bold">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No active medicine reminders.</p>
            )}
          </div>

          {/* Active Concerns */}
          <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-100">
            <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" /> Active Health Concerns
            </h4>
            {summary.activeConcerns.length > 0 ? (
              <ul className="text-xs space-y-1 text-slate-700">
                {summary.activeConcerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No active symptoms flagged.</p>
            )}
          </div>

          {/* Follow-up Requirements */}
          <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-100">
            <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Follow-Up Guidance
            </h4>
            {summary.followUpRequirements.length > 0 ? (
              <ul className="text-xs space-y-1 text-slate-700">
                {summary.followUpRequirements.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No urgent follow-up required.</p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic text-right pt-2 border-t border-slate-100">
          {summary.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
