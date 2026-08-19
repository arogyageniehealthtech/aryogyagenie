import { useState } from "react";
import { useGetDoctorDashboard, useUpdateAppointment, getGetDoctorDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Clock, Clipboard, CheckCircle, XCircle, Plus, User } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PrescribeModal } from "./PrescribeModal";

export function DoctorDashboard() {
  const { data: dashboard, isLoading } = useGetDoctorDashboard();
  const updateAppointment = useUpdateAppointment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Prescribe modal state
  const [prescribeOpen, setPrescribeOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);
  const [targetAppointmentId, setTargetAppointmentId] = useState<number | undefined>(undefined);
  const [targetPatientName, setTargetPatientName] = useState<string | null>(null);

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
            title: "Appointment Updated",
            description: `Status changed to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetDoctorDashboardQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Failed to update status",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading doctor dashboard...</div>
      </DashboardLayout>
    );
  }

  if (!dashboard) return null;

  const firstName = dashboard.firstName?.trim() || dashboard.userName?.trim().split(" ")[0] || "Doctor";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hello {firstName}</h1>
            <p className="text-slate-500 mt-1">Manage your patients, consultations, and digital prescriptions.</p>
          </div>
          <Button onClick={() => handleOpenPrescribe(0)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Issue Prescription
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Today's Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{dashboard.todayAppointments}</span>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
                <span className="font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/60">
                  {dashboard.todayRemainingAppointments ?? dashboard.todayAppointments}
                </span>
                <span>remaining today</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-slate-900">{dashboard.totalPatients}</div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Unique patients served</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Pending Requests</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-amber-600">{dashboard.pendingAppointments}</div>
              <p className="text-xs text-amber-700/80 mt-1.5 font-medium">Awaiting your confirmation</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Prescriptions Issued</CardTitle>
              <Clipboard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-slate-900">{dashboard.totalPrescriptions}</div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Digital Rx records issued</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming / Today's Appointments */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Today's & Upcoming Consultations</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.upcomingAppointments.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No upcoming appointments scheduled for today.</div>
              ) : (
                <div className="space-y-4">
                  {dashboard.upcomingAppointments.map((apt) => (
                    <div key={apt.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {apt.patientName ? apt.patientName : `Patient #${apt.patientId}`}
                          </p>
                          <p className="text-sm text-slate-500">
                            {apt.appointmentDate} at {apt.appointmentTime} • <span className="capitalize">{apt.type.replace('_', ' ')}</span>
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
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

                      {apt.symptoms && (
                        <p className="text-sm text-slate-600 bg-white p-2.5 rounded-md border border-slate-100">
                          <strong className="text-slate-700">Symptoms:</strong> {apt.symptoms}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {apt.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white text-blue-600 hover:text-blue-700 h-8 gap-1"
                            onClick={() => handleUpdateStatus(apt.id, "confirmed")}
                            disabled={updateAppointment.isPending}
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Confirm
                          </Button>
                        )}
                        {apt.status !== "completed" && apt.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white text-green-600 hover:text-green-700 h-8 gap-1"
                            onClick={() => handleUpdateStatus(apt.id, "completed")}
                            disabled={updateAppointment.isPending}
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Complete
                          </Button>
                        )}
                        {apt.status !== "cancelled" && apt.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white text-red-600 hover:text-red-700 h-8 gap-1"
                            onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                            disabled={updateAppointment.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-8 gap-1 ml-auto"
                          onClick={() => handleOpenPrescribe(apt.patientId, apt.id, apt.patientName)}
                        >
                          <Clipboard className="h-3.5 w-3.5" /> Prescribe
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Patients */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Recent Patients</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.recentPatients.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No recent patients found.</div>
              ) : (
                <div className="space-y-4">
                  {dashboard.recentPatients.map((patient) => (
                    <div key={patient.id} className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-50 text-primary rounded-full flex items-center justify-center font-bold">
                          {patient.firstName ? patient.firstName[0] : <User className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-xs text-slate-500">{patient.email}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Visits: {patient.totalVisits} • Last: {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPrescribe(patient.id, undefined, `${patient.firstName} ${patient.lastName}`)}
                        className="gap-1 text-xs h-8"
                      >
                        <Clipboard className="h-3.5 w-3.5" /> Prescribe
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
