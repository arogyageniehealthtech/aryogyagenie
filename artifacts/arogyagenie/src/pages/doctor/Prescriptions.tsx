import { useState, useMemo } from "react";
import { useListPrescriptions } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, Plus, User, Filter } from "lucide-react";
import { PrescribeModal } from "./PrescribeModal";

export function DoctorPrescriptions() {
  const [selectedInterval, setSelectedInterval] = useState<string>("all");
  const { data: allPrescriptions, isLoading } = useListPrescriptions();
  const [prescribeOpen, setPrescribeOpen] = useState(false);

  const prescriptions = useMemo(() => {
    if (!allPrescriptions) return [];
    const today = new Date().toISOString().split("T")[0];
    if (selectedInterval === "today") {
      return allPrescriptions.filter((p) => p.prescribedDate === today);
    }
    if (selectedInterval === "90days") {
      const d90 = new Date();
      d90.setDate(d90.getDate() - 90);
      const d90Str = d90.toISOString().split("T")[0];
      return allPrescriptions.filter((p) => p.prescribedDate >= d90Str);
    }
    if (selectedInterval === "1year") {
      const d1y = new Date();
      d1y.setDate(d1y.getDate() - 365);
      const d1yStr = d1y.toISOString().split("T")[0];
      return allPrescriptions.filter((p) => p.prescribedDate >= d1yStr);
    }
    return allPrescriptions;
  }, [allPrescriptions, selectedInterval]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Issued Prescriptions</h1>
            <p className="text-slate-500 mt-1">Review digital prescriptions issued to your patients.</p>
          </div>
          <Button onClick={() => setPrescribeOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Issue New Prescription
          </Button>
        </div>

        {/* Interval Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Timeframe:
          </span>
          {[
            { id: "all", label: "All Records" },
            { id: "today", label: "Today (1 Day)" },
            { id: "90days", label: "Last 90 Days" },
            { id: "1year", label: "Last 1 Year" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedInterval(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedInterval === tab.id
                  ? "bg-violet-600 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading prescriptions...</div>
        ) : prescriptions?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No prescriptions found</p>
              <p className="text-sm text-slate-400 mt-1">
                {selectedInterval !== "all"
                  ? "No digital prescriptions issued within the selected timeframe."
                  : "Digital prescriptions created during consultations will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prescriptions?.map((rx) => (
              <Card key={rx.id} className="relative overflow-hidden border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        {rx.patientName ? rx.patientName : `Patient #${rx.patientId}`}
                      </CardTitle>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        Prescribed: {new Date(rx.prescribedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={rx.status === "active" ? "default" : "secondary"}>
                      {rx.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rx.diagnosis && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnosis</h4>
                      <p className="text-sm font-semibold text-slate-900">{rx.diagnosis}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Medicines & Schedule</h4>
                    <div className="bg-slate-50 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap border border-slate-100 text-slate-800">
                      {rx.medicines}
                    </div>
                  </div>

                  {rx.instructions && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Instructions</h4>
                      <p className="text-sm text-slate-700">{rx.instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <PrescribeModal
          isOpen={prescribeOpen}
          onClose={() => setPrescribeOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
