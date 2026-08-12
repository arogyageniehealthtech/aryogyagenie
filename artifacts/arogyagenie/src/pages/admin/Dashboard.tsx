import { useGetAdminStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Stethoscope, Building, Pill, Calendar, FileText, CheckCircle, Clock } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";

export function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading admin dashboard...</div>
      </DashboardLayout>
    );
  }

  if (!stats) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Platform overview, user metrics, provider network, and operational statistics.</p>
        </div>

        {/* Platform Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalUsers}</div>
              <p className="text-xs text-slate-500 mt-1">{stats.activeUsers} active accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Doctors</CardTitle>
              <Stethoscope className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalDoctors}</div>
              <p className="text-xs text-slate-500 mt-1">Verified providers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Diagnostic Centers</CardTitle>
              <Building className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalDiagnosticCenters}</div>
              <p className="text-xs text-slate-500 mt-1">Partner labs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pharmacies</CardTitle>
              <Pill className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalPharmacies}</div>
              <p className="text-xs text-slate-500 mt-1">Partner pharmacies</p>
            </CardContent>
          </Card>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalAppointments}</div>
              <p className="text-xs text-slate-500 mt-1">{stats.appointmentsThisMonth} this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Lab Reports</CardTitle>
              <FileText className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalLabReports}</div>
              <p className="text-xs text-slate-500 mt-1">Uploaded & analyzed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.pendingApprovals}</div>
              <p className="text-xs text-slate-500 mt-1">Providers awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Platform Patients</CardTitle>
              <Users className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.totalPatients}</div>
              <p className="text-xs text-slate-500 mt-1">Registered patients</p>
            </CardContent>
          </Card>
        </div>

        {/* Appointment Breakdown */}
        {stats.appointmentsByStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Appointment Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <p className="text-2xl font-bold text-yellow-800">{stats.appointmentsByStatus.pending}</p>
                  <p className="text-xs text-yellow-600 font-semibold mt-1 uppercase">Pending</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-2xl font-bold text-blue-800">{stats.appointmentsByStatus.confirmed}</p>
                  <p className="text-xs text-blue-600 font-semibold mt-1 uppercase">Confirmed</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-2xl font-bold text-green-800">{stats.appointmentsByStatus.completed}</p>
                  <p className="text-xs text-green-600 font-semibold mt-1 uppercase">Completed</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-2xl font-bold text-red-800">{stats.appointmentsByStatus.cancelled}</p>
                  <p className="text-xs text-red-600 font-semibold mt-1 uppercase">Cancelled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
