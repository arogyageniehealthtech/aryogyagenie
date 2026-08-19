import { useState } from "react";
import { useListAdminUsers, useUpdateUserStatus, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Search, Filter, CheckCircle, XCircle, Phone, MapPin } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function AdminDiagnosticCentersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: users, isLoading } = useListAdminUsers({
    role: "diagnostic_center",
    search: searchQuery.length > 0 ? searchQuery : undefined,
  });

  const updateStatus = useUpdateUserStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdateStatus = (id: number, status: "active" | "suspended" | "pending") => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Diagnostic Center Status Updated",
            description: `Account status updated to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        },
        onError: (err: unknown) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Error updating diagnostic center status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const filteredCenters = users?.filter((u) => {
    if (statusFilter === "all") return true;
    return u.status === statusFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Diagnostic Labs Directory</h1>
          <p className="text-slate-500 mt-1">Review partner diagnostic labs, contact info, locations, and account status.</p>
        </div>

        {/* Search & Filter Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search lab by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Labs Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading diagnostic labs directory...</div>
        ) : filteredCenters?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Building className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No diagnostic labs found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCenters?.map((dc) => (
              <Card key={dc.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
                        <Building className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">
                          {dc.firstName || dc.lastName ? `${dc.firstName ?? ""} ${dc.lastName ?? ""}`.trim() : dc.email}
                        </h3>
                        <p className="text-xs text-slate-500">{dc.email}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                        dc.status === "active"
                          ? "bg-green-100 text-green-800"
                          : dc.status === "suspended"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {dc.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t pt-3">
                    {dc.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{dc.phone}</span>
                      </p>
                    )}
                    {dc.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{dc.address}</span>
                      </p>
                    )}
                    <p className="text-slate-400 pt-1">Registered: {new Date(dc.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-2 border-t pt-3">
                    {dc.status !== "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-green-600 hover:text-green-700 h-8 gap-1 flex-1"
                        onClick={() => handleUpdateStatus(dc.id, "active")}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Activate
                      </Button>
                    )}
                    {dc.status !== "suspended" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-red-600 hover:text-red-700 h-8 gap-1 flex-1"
                        onClick={() => handleUpdateStatus(dc.id, "suspended")}
                        disabled={updateStatus.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Suspend
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
