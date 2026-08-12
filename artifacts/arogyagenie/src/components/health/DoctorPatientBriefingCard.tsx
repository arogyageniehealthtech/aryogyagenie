import { useGetDoctorPatientAiSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Sparkles, FileText, Pill, AlertCircle } from "lucide-react";

interface DoctorPatientBriefingCardProps {
  patientId: number;
}

export function DoctorPatientBriefingCard({ patientId }: DoctorPatientBriefingCardProps) {
  const { data: briefing, isLoading } = useGetDoctorPatientAiSummary(patientId);

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm animate-pulse">
        <CardContent className="p-4 text-xs text-slate-500">Generating clinical AI briefing...</CardContent>
      </Card>
    );
  }

  if (!briefing) return null;

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600 text-white">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Clinical AI Consultation Briefing</CardTitle>
            <p className="text-xs text-slate-500">Synthesized longitudinal history for Doctor Consultation</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4 text-xs text-slate-700">
        <div className="bg-white p-3 rounded-lg border border-indigo-100 font-medium leading-relaxed">
          {briefing.patientOverview}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {briefing.keyDiagnoses.length > 0 && (
            <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1">
              <h5 className="font-bold text-slate-900 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-indigo-600" /> Active Diagnoses
              </h5>
              <ul className="space-y-0.5 text-slate-600">
                {briefing.keyDiagnoses.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            </div>
          )}

          {briefing.activeMedications.length > 0 && (
            <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1">
              <h5 className="font-bold text-slate-900 flex items-center gap-1">
                <Pill className="h-3.5 w-3.5 text-teal-600" /> Active Medications
              </h5>
              <ul className="space-y-0.5 text-slate-600">
                {briefing.activeMedications.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-400 italic text-right border-t border-indigo-50 pt-2">
          {briefing.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
