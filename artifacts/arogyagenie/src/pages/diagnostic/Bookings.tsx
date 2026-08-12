import { useState } from "react";
import { useListDiagnosticCenterBookings, useUpdateDiagnosticBooking, getListDiagnosticCenterBookingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestTube, CheckCircle, XCircle, FileText, Filter, Search, Plus } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UploadReportModal } from "./UploadReportModal";

export function DiagnosticBookingsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);
  const [targetTestName, setTargetTestName] = useState<string | undefined>(undefined);

  const queryParams = {
    status: selectedStatus === "all" ? undefined : selectedStatus,
  };

  const { data: bookings, isLoading } = useListDiagnosticCenterBookings(queryParams);
  const updateBooking = useUpdateDiagnosticBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
            description: `Status changed to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListDiagnosticCenterBookingsQueryKey() });
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

  const filteredBookings = bookings?.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const tName = b.testName.toLowerCase();
    const pName = (b.patientName ?? "").toLowerCase();
    return tName.includes(q) || pName.includes(q) || String(b.patientId).includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Diagnostic Test Bookings</h1>
            <p className="text-slate-500 mt-1">Manage test schedules, update status, and attach patient lab reports.</p>
          </div>
          <Button onClick={() => handleOpenUpload()} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Upload Lab Report
          </Button>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by test name, patient, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[160px]">
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
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading diagnostic bookings...</div>
        ) : filteredBookings?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <TestTube className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No test bookings found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings?.map((b) => (
              <Card key={b.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-xl text-slate-900">{b.testName}</h3>
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
                        Patient: <strong className="text-slate-800">{b.patientName ? b.patientName : `#${b.patientId}`}</strong> • Date:{" "}
                        <strong className="text-slate-800">{b.bookingDate}</strong> {b.bookingTime ? `at ${b.bookingTime}` : ""}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      {b.price && (
                        <p className="text-sm font-semibold text-slate-900">
                          Price: ${b.price}
                        </p>
                      )}
                    </div>
                  </div>

                  {b.notes && (
                    <div className="py-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-3">
                      <strong className="text-slate-900">Notes:</strong> {b.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 flex-wrap">
                    {b.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-blue-600 hover:text-blue-700 gap-1.5"
                        onClick={() => handleUpdateStatus(b.id, "confirmed")}
                        disabled={updateBooking.isPending}
                      >
                        <CheckCircle className="h-4 w-4" /> Confirm Booking
                      </Button>
                    )}

                    {b.status !== "completed" && b.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-green-600 hover:text-green-700 gap-1.5"
                        onClick={() => handleUpdateStatus(b.id, "completed")}
                        disabled={updateBooking.isPending}
                      >
                        <CheckCircle className="h-4 w-4" /> Mark Completed
                      </Button>
                    )}

                    {b.status !== "cancelled" && b.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-red-600 hover:text-red-700 gap-1.5"
                        onClick={() => handleUpdateStatus(b.id, "cancelled")}
                        disabled={updateBooking.isPending}
                      >
                        <XCircle className="h-4 w-4" /> Cancel Booking
                      </Button>
                    )}

                    <Button
                      size="sm"
                      className="gap-1.5 ml-auto"
                      onClick={() => handleOpenUpload(b.patientId, b.testName)}
                    >
                      <FileText className="h-4 w-4" /> Upload Patient Report
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

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
