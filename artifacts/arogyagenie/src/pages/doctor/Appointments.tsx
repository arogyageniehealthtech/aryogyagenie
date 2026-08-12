import { useState } from "react";
import { useListDoctorAppointments, useUpdateAppointment, getListDoctorAppointmentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clipboard, Filter, Plus, Search } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PrescribeModal } from "./PrescribeModal";

export function DoctorAppointments() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Prescribe modal state
  const [prescribeOpen, setPrescribeOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);
  const [targetAppointmentId, setTargetAppointmentId] = useState<number | undefined>(undefined);
  const [targetPatientName, setTargetPatientName] = useState<string | null>(null);

  const queryParams = {
    status: selectedStatus === "all" ? undefined : selectedStatus,
    date: selectedDate ? selectedDate : undefined,
  };

  const { data: appointments, isLoading } = useListDoctorAppointments(queryParams);
  const updateAppointment = useUpdateAppointment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenPrescribe = (patientId: number, appointmentId?: number, patientName?: string | null) => {
    setTargetPatientId(patientId);
    setTargetAppointmentId(appointmentId);
    setTargetPatientName(patientName ?? null);
    setPrescribeOpen(true);
  };

  const handleUpdateStatus = (id: number, status: "confirmed" | "completed" | "cancelled") => {
    updateAppointment.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Appointment Status Updated",
            description: `Appointment marked as ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListDoctorAppointmentsQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Failed to Update Status",
            description: err instanceof Error ? err.message : "Error updating status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const filteredAppointments = appointments?.filter((apt) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const pName = (apt.patientName ?? "").toLowerCase();
    const symptoms = (apt.symptoms ?? "").toLowerCase();
    return pName.includes(q) || symptoms.includes(q) || String(apt.patientId).includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Appointments</h1>
            <p className="text-slate-500 mt-1">Review patient bookings, update consultation status, and issue prescriptions.</p>
          </div>
          <Button onClick={() => handleOpenPrescribe(0)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Issue Prescription
          </Button>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by patient name or symptoms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-[160px]"
                  />
                  {selectedDate && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDate("")} className="text-xs">
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading appointments...</div>
        ) : filteredAppointments?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <CalendarIcon className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No appointments found</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or date selection.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAppointments?.map((apt) => (
              <Card key={apt.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-xl text-slate-900">
                          {apt.patientName ? apt.patientName : `Patient #${apt.patientId}`}
                        </h3>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            apt.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : apt.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : apt.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Date: <strong className="text-slate-800">{apt.appointmentDate}</strong> at{" "}
                        <strong className="text-slate-800">{apt.appointmentTime}</strong> • Type:{" "}
                        <span className="capitalize text-slate-700">{apt.type.replace('_', ' ')}</span>
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      {apt.consultationFee && (
                        <p className="text-sm font-semibold text-slate-900">
                          Fee: ${apt.consultationFee}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="py-4 space-y-2 text-sm text-slate-700">
                    {apt.symptoms && (
                      <div>
                        <strong className="text-slate-900">Reported Symptoms:</strong>
                        <p className="mt-0.5 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">{apt.symptoms}</p>
                      </div>
                    )}
                    {apt.notes && (
                      <div>
                        <strong className="text-slate-900">Patient Notes:</strong>
                        <p className="mt-0.5 text-slate-600">{apt.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 flex-wrap border-t border-slate-100 mt-2">
                    {apt.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-blue-600 hover:text-blue-700 gap-1.5"
                        onClick={() => handleUpdateStatus(apt.id, "confirmed")}
                        disabled={updateAppointment.isPending}
                      >
                        <CheckCircle className="h-4 w-4" /> Confirm Appointment
                      </Button>
                    )}

                    {apt.status !== "completed" && apt.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-green-600 hover:text-green-700 gap-1.5"
                        onClick={() => handleUpdateStatus(apt.id, "completed")}
                        disabled={updateAppointment.isPending}
                      >
                        <CheckCircle className="h-4 w-4" /> Mark Completed
                      </Button>
                    )}

                    {apt.status !== "cancelled" && apt.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-red-600 hover:text-red-700 gap-1.5"
                        onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                        disabled={updateAppointment.isPending}
                      >
                        <XCircle className="h-4 w-4" /> Cancel Appointment
                      </Button>
                    )}

                    <Button
                      size="sm"
                      className="gap-1.5 ml-auto"
                      onClick={() => handleOpenPrescribe(apt.patientId, apt.id, apt.patientName)}
                    >
                      <Clipboard className="h-4 w-4" /> Issue Digital Prescription
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <PrescribeModal
          isOpen={prescribeOpen}
          onClose={() => setPrescribeOpen(false)}
          defaultPatientId={targetPatientId}
          defaultAppointmentId={targetAppointmentId}
          patientName={targetPatientName}
        />
      </div>
    </DashboardLayout>
  );
}
