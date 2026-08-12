import { useState } from "react";
import { useListPharmacyPrescriptions, useUpdatePrescription, getListPharmacyPrescriptionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clipboard, Pill, Filter, Search, CheckCircle, XCircle, User, Clock } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function PharmacyPrescriptionsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const queryParams = {
    status: selectedStatus === "all" ? undefined : selectedStatus,
  };

  const { data: prescriptions, isLoading } = useListPharmacyPrescriptions(queryParams);
  const updatePrescription = useUpdatePrescription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdateStatus = (id: number, status: "dispensed" | "expired" | "active") => {
    updatePrescription.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Prescription Updated",
            description: `Status changed to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListPharmacyPrescriptionsQueryKey() });
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

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const pName = (rx.patientName ?? "").toLowerCase();
    const dName = (rx.doctorName ?? "").toLowerCase();
    const medicines = rx.medicines.toLowerCase();
    return pName.includes(q) || dName.includes(q) || medicines.includes(q) || String(rx.id).includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Prescription Queue</h1>
          <p className="text-slate-500 mt-1">Verify prescriptions issued by doctors and fulfill medicine orders.</p>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by patient, doctor, medicine, or ID..."
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
                    <SelectItem value="active">Active (Pending)</SelectItem>
                    <SelectItem value="dispensed">Dispensed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prescriptions Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading prescription queue...</div>
        ) : filteredPrescriptions?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Clipboard className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No prescriptions found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPrescriptions?.map((rx) => (
              <Card key={rx.id} className="overflow-hidden border-t-4 border-t-primary hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">
                        {rx.patientName ? rx.patientName : `Patient #${rx.patientId}`}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <User className="h-3.5 w-3.5" /> Doctor: {rx.doctorName ? rx.doctorName : `#${rx.doctorId}`} •{" "}
                        <Clock className="h-3.5 w-3.5 ml-1" /> {new Date(rx.prescribedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={rx.status === "active" ? "default" : rx.status === "dispensed" ? "secondary" : "destructive"}>
                      {rx.status}
                    </Badge>
                  </div>

                  {rx.diagnosis && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnosis</h4>
                      <p className="text-sm font-semibold text-slate-900">{rx.diagnosis}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prescribed Medicines</h4>
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

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t">
                    {rx.status === "active" && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        onClick={() => handleUpdateStatus(rx.id, "dispensed")}
                        disabled={updatePrescription.isPending}
                      >
                        <Pill className="h-4 w-4" /> Dispense Medicine
                      </Button>
                    )}
                    {rx.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 gap-1.5"
                        onClick={() => handleUpdateStatus(rx.id, "expired")}
                        disabled={updatePrescription.isPending}
                      >
                        <XCircle className="h-4 w-4" /> Mark Expired
                      </Button>
                    )}
                    {rx.status !== "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-500 gap-1.5 text-xs"
                        onClick={() => handleUpdateStatus(rx.id, "active")}
                        disabled={updatePrescription.isPending}
                      >
                        Re-open Queue
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
