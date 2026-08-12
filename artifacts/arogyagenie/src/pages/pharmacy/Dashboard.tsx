import { useGetPharmacyDashboard, useUpdatePrescription, getGetPharmacyDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clipboard, Clock, CheckCircle, Pill, User } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function PharmacyDashboard() {
  const { data: dashboard, isLoading } = useGetPharmacyDashboard();
  const updatePrescription = useUpdatePrescription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleMarkDispensed = (id: number) => {
    updatePrescription.mutate(
      { id, data: { status: "dispensed" } },
      {
        onSuccess: () => {
          toast({
            title: "Prescription Dispensed",
            description: "Prescription marked as dispensed successfully.",
          });
          queryClient.invalidateQueries({ queryKey: getGetPharmacyDashboardQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Error updating status",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading pharmacy dashboard...</div>
      </DashboardLayout>
    );
  }

  if (!dashboard) return null;

  const displayName = dashboard.userName?.trim() || dashboard.name?.trim() || "Pharmacy";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{displayName}</h1>
          <p className="text-slate-500 mt-1">Pharmacy Dashboard • Review active digital prescriptions, verify doctor signatures, and dispense medications.</p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending Prescriptions</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.pendingPrescriptions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Dispensed Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.dispensedToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Prescriptions</CardTitle>
              <Clipboard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.totalPrescriptions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Prescriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Recent Prescription Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentPrescriptions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No recent prescriptions in queue.</div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentPrescriptions.map((rx) => (
                  <div key={rx.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-lg text-slate-900">
                          Prescription #{rx.id}
                        </p>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            rx.status === "dispensed"
                              ? "bg-green-100 text-green-800"
                              : rx.status === "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {rx.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Patient ID: <strong className="text-slate-800">#{rx.patientId}</strong> • Doctor ID: <strong className="text-slate-800">#{rx.doctorId}</strong> • Prescribed: {rx.prescribedDate}
                      </p>
                      {rx.diagnosis && (
                        <p className="text-xs text-slate-600 mt-1">Diagnosis: {rx.diagnosis}</p>
                      )}
                      <div className="mt-2 bg-white p-2.5 rounded-md font-mono text-xs text-slate-800 border border-slate-100">
                        {rx.medicines}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {rx.status === "active" && (
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleMarkDispensed(rx.id)}
                          disabled={updatePrescription.isPending}
                        >
                          <Pill className="h-4 w-4" /> Dispense Medication
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
