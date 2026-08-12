import { useState } from "react";
import { useListPrescriptions } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, Plus, User } from "lucide-react";
import { PrescribeModal } from "./PrescribeModal";

export function DoctorPrescriptions() {
  const { data: prescriptions, isLoading } = useListPrescriptions();
  const [prescribeOpen, setPrescribeOpen] = useState(false);

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

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading prescriptions...</div>
        ) : prescriptions?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No prescriptions issued yet</p>
              <p className="text-sm text-slate-400 mt-1">Digital prescriptions created during consultations will appear here.</p>
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
