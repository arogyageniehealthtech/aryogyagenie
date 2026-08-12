import { useState } from "react";
import { useListDoctorPatients, type PatientSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Search, Clipboard, User, Calendar, Mail, FileText } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { PrescribeModal } from "./PrescribeModal";
import { DoctorPatientBriefingCard } from "../../components/health/DoctorPatientBriefingCard";

export function DoctorPatients() {
  const { data: patients, isLoading } = useListDoctorPatients();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);

  // Prescribe modal state
  const [prescribeOpen, setPrescribeOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);
  const [targetPatientName, setTargetPatientName] = useState<string | null>(null);

  const handleOpenPrescribe = (patientId: number, patientName?: string | null) => {
    setTargetPatientId(patientId);
    setTargetPatientName(patientName ?? null);
    setPrescribeOpen(true);
  };

  const filteredPatients = patients?.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(q) || p.email.toLowerCase().includes(q) || String(p.id).includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Patients</h1>
            <p className="text-slate-500 mt-1">View patients who have consulted with you, review visit histories, and issue prescriptions.</p>
          </div>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search patient by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Patients Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading patients list...</div>
        ) : filteredPatients?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Users className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No patients found</p>
              <p className="text-sm text-slate-400 mt-1">Patients will appear here after booking appointments with you.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients?.map((patient) => (
              <Card key={patient.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                        {patient.firstName ? patient.firstName[0] : <User className="h-6 w-6" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">
                          {patient.firstName} {patient.lastName}
                        </h3>
                        <p className="text-xs text-slate-500">Patient ID: #{patient.id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600 border-t pt-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Total Consultations: <strong className="text-slate-800">{patient.totalVisits}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Last Visit: <strong className="text-slate-800">{patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : "N/A"}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-5 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setSelectedPatient(patient)}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1"
                      onClick={() => handleOpenPrescribe(patient.id, `${patient.firstName} ${patient.lastName}`)}
                    >
                      <Clipboard className="h-3.5 w-3.5" /> Prescribe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Patient Details Modal */}
        {selectedPatient && (
          <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="h-10 w-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                    {selectedPatient.firstName ? selectedPatient.firstName[0] : "P"}
                  </div>
                  <div>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                    <p className="text-xs text-slate-500 font-normal">Patient Record ID: #{selectedPatient.id}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3 text-sm text-slate-700">
                <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-semibold text-slate-900">{selectedPatient.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Visits:</span>
                    <span className="font-semibold text-slate-900">{selectedPatient.totalVisits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Consultation:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedPatient.lastVisit ? new Date(selectedPatient.lastVisit).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Milestone 6: Clinical AI Consultation Briefing */}
                <DoctorPatientBriefingCard patientId={selectedPatient.id} />

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-slate-700 text-xs leading-relaxed">
                  <strong>Clinical Note:</strong> As a treating physician, you can review this patient's consultation records and issue digital prescriptions. Medical timeline events are automatically linked to patient records upon prescription creation.
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedPatient(null)}>
                  Close
                </Button>
                <Button
                  className="gap-1.5"
                  onClick={() => {
                    const pid = selectedPatient.id;
                    const pName = `${selectedPatient.firstName} ${selectedPatient.lastName}`;
                    setSelectedPatient(null);
                    handleOpenPrescribe(pid, pName);
                  }}
                >
                  <Clipboard className="h-4 w-4" /> Issue Prescription
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <PrescribeModal
          isOpen={prescribeOpen}
          onClose={() => setPrescribeOpen(false)}
          defaultPatientId={targetPatientId}
          patientName={targetPatientName}
        />
      </div>
    </DashboardLayout>
  );
}
