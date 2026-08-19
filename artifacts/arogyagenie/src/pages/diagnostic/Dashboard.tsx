import { useState } from "react";
import { useGetDiagnosticCenterDashboard, useUpdateDiagnosticBooking, getGetDiagnosticCenterDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TestTube, Clock, CheckCircle, XCircle, Plus, FileText, Calendar } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UploadReportModal } from "./UploadReportModal";

export function DiagnosticDashboard() {
  const { data: dashboard, isLoading } = useGetDiagnosticCenterDashboard();
  const updateBooking = useUpdateDiagnosticBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);
  const [targetTestName, setTargetTestName] = useState<string | undefined>(undefined);

  const handleOpenUpload = (patientId?: number, testName?: string) => {
    setTargetPatientId(patientId);
    setTargetTestName(testName);
    setUploadOpen(true);
  };

  const handleUpdateStatus = (id: number, status: "confirmed" | "completed" | "cancelled") => {
    updateBooking.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Booking Status Updated",
            description: `Diagnostic booking marked as ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetDiagnosticCenterDashboardQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Error updating booking.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading diagnostic center dashboard...</div>
      </DashboardLayout>
    );
  }

  if (!dashboard) return null;

  const displayName = dashboard.userName?.trim() || dashboard.name?.trim() || "Diagnostic Center";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{displayName}</h1>
            <p className="text-slate-500 mt-1">Diagnostic Center Dashboard • Manage test bookings, update test statuses, and upload patient lab reports.</p>
          </div>
          <Button onClick={() => handleOpenUpload()} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Upload Lab Report
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Today's Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.todayBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending Bookings</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.pendingBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Completed Tests</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.completedBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Bookings</CardTitle>
              <TestTube className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{dashboard.totalBookings}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Recent Test Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentBookings.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No recent diagnostic bookings.</div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentBookings.map((b) => (
                  <div key={b.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-lg text-slate-900">{b.testName}</p>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            b.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : b.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : b.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Patient ID: <strong className="text-slate-800">#{b.patientId}</strong> • Date:{" "}
                        <strong className="text-slate-800">{b.bookingDate}</strong> {b.bookingTime ? `at ${b.bookingTime}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {b.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-blue-600 hover:text-blue-700 h-8 gap-1"
                          onClick={() => handleUpdateStatus(b.id, "confirmed")}
                          disabled={updateBooking.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Confirm
                        </Button>
                      )}
                      {b.status !== "completed" && b.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-green-600 hover:text-green-700 h-8 gap-1"
                          onClick={() => handleUpdateStatus(b.id, "completed")}
                          disabled={updateBooking.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Complete
                        </Button>
                      )}
                      {b.status !== "cancelled" && b.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-red-600 hover:text-red-700 h-8 gap-1"
                          onClick={() => handleUpdateStatus(b.id, "cancelled")}
                          disabled={updateBooking.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => handleOpenUpload(b.patientId, b.testName)}
                      >
                        <FileText className="h-3.5 w-3.5" /> Upload Report
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <UploadReportModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          defaultPatientId={targetPatientId}
          defaultTestName={targetTestName}
        />
      </div>
    </DashboardLayout>
  );
}
