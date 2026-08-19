import { useState } from "react";
import { useListAdminUsers, useUpdateUserStatus, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Filter, CheckCircle, XCircle, Shield } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function AdminUsersPage() {
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const queryParams = {
    role: selectedRole === "all" ? undefined : selectedRole,
    search: searchQuery ? searchQuery : undefined,
  };

  const { data: users, isLoading } = useListAdminUsers(queryParams);
  const updateStatus = useUpdateUserStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdateStatus = (id: number, status: "active" | "suspended" | "pending") => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "User Status Updated",
            description: `Account status updated to ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        },
        onError: (err: unknown) => {
          toast({
            title: "Update Failed",
            description: err instanceof Error ? err.message : "Error updating user status",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 mt-1">Manage user roles, view registration details, and update active/suspended status.</p>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search user by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="diagnostic_center">Diagnostic Center</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Directory */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading user directory...</div>
        ) : users?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Users className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {users?.map((u) => (
              <Card key={u.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {u.firstName ? u.firstName[0] : u.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900 truncate">
                          {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : u.email}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                          {u.role ?? "unassigned"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                            u.status === "active"
                              ? "bg-green-100 text-green-800"
                              : u.status === "suspended"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {u.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 break-all">
                        ID: #{u.id} • Email: {u.email} • Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {u.status !== "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-green-600 hover:text-green-700 h-8 gap-1"
                        onClick={() => handleUpdateStatus(u.id, "active")}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Activate
                      </Button>
                    )}
                    {u.status !== "suspended" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white text-red-600 hover:text-red-700 h-8 gap-1"
                        onClick={() => handleUpdateStatus(u.id, "suspended")}
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
