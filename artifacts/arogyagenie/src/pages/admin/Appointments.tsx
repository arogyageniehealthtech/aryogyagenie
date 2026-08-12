import { useState } from "react";
import { useListAdminAppointments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "../../components/layout/DashboardLayout";

export function AdminAppointmentsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const queryParams = { status: selectedStatus === "all" ? undefined : selectedStatus };
  const { data: appointments, isLoading } = useListAdminAppointments(queryParams);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Appointments Log</h1>
          <p className="text-slate-500 mt-1">Audit all doctor consultation bookings across the platform.</p>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
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
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading appointments log...</div>
        ) : appointments?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Calendar className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No appointments found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments?.map((apt) => (
              <Card key={apt.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-lg">Appointment #{apt.id}</span>
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
                  <p className="text-xs text-slate-500 mt-1">
                    Patient ID: #{apt.patientId} • Doctor ID: #{apt.doctorId} • Date: {apt.appointmentDate} at {apt.appointmentTime}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
