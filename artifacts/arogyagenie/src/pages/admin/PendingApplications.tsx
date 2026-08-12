import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Check, X, Clock, Stethoscope, Building, Pill, AlertTriangle } from "lucide-react";

interface ProviderApplication {
  id: number;
  type: "DOCTOR" | "DIAGNOSTIC_CENTER" | "PHARMACY";
  status: "PENDING" | "APPROVED" | "REJECTED";
  userId: number | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
  phone: string;
  specialty: string | null;
  address: string | null;
  city: string | null;
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

export function AdminPendingApplicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedApp, setSelectedApp] = useState<ProviderApplication | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  const fetchApplications = async () => {
    return await customFetch<ProviderApplication[]>("/api/admin/provider-applications");
  };

  const { data: applications = [], isLoading, refetch } = useQuery({
    queryKey: ["/admin/provider-applications"],
    queryFn: fetchApplications,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await customFetch(`/api/admin/provider-applications/${id}/approve`, {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Application Approved",
        description: "Provider account has been activated and granted portal access.",
      });
      queryClient.invalidateQueries({ queryKey: ["/admin/provider-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/admin/stats"] });
      setApproveDialogOpen(false);
      setSelectedApp(null);
    },
    onError: (err: Error) => {
      toast({ title: "Approval Failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return await customFetch(`/api/admin/provider-applications/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Application Rejected",
        description: "Provider application status updated to Rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/admin/provider-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/admin/stats"] });
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedApp(null);
    },
    onError: (err: Error) => {
      toast({ title: "Rejection Failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredApps = applications.filter((app) => {
    const matchesTab = activeTab === "ALL" || app.status === activeTab;
    const search = searchQuery.toLowerCase();
    const appName = app.type === "DOCTOR" ? `${app.firstName || ""} ${app.lastName || ""}` : app.name || "";
    const matchesSearch =
      appName.toLowerCase().includes(search) ||
      app.email.toLowerCase().includes(search) ||
      app.phone.includes(search) ||
      (app.specialty && app.specialty.toLowerCase().includes(search)) ||
      (app.address && app.address.toLowerCase().includes(search));
    return matchesTab && matchesSearch;
  });

  const getTypeName = (app: ProviderApplication) => {
    if (app.type === "DOCTOR") return `${app.firstName || ""} ${app.lastName || ""}`.trim() || "Doctor";
    return app.name || app.type.replace("_", " ");
  };

  const getTypeIcon = (type: string) => {
    if (type === "DOCTOR") return <Stethoscope className="h-4 w-4 text-blue-600" />;
    if (type === "DIAGNOSTIC_CENTER") return <Building className="h-4 w-4 text-green-600" />;
    return <Pill className="h-4 w-4 text-purple-600" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === "APPROVED") {
      return <Badge className="bg-green-100 text-green-800 border-green-200">APPROVED</Badge>;
    }
    if (status === "REJECTED") {
      return <Badge variant="destructive">REJECTED</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200">PENDING</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pending Provider Applications</h1>
          <p className="text-slate-500 mt-1">Review, verify, and approve or reject provider registration requests before granting portal access.</p>
        </div>

        {/* Filters and Tabs */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeTab === "PENDING" ? "default" : "outline"}
                  onClick={() => setActiveTab("PENDING")}
                  className="rounded-full px-5 text-sm"
                >
                  <Clock className="h-4 w-4 mr-2" /> Pending ({applications.filter((a) => a.status === "PENDING").length})
                </Button>
                <Button
                  variant={activeTab === "APPROVED" ? "default" : "outline"}
                  onClick={() => setActiveTab("APPROVED")}
                  className="rounded-full px-5 text-sm"
                >
                  <Check className="h-4 w-4 mr-2" /> Approved ({applications.filter((a) => a.status === "APPROVED").length})
                </Button>
                <Button
                  variant={activeTab === "REJECTED" ? "default" : "outline"}
                  onClick={() => setActiveTab("REJECTED")}
                  className="rounded-full px-5 text-sm"
                >
                  <X className="h-4 w-4 mr-2" /> Rejected ({applications.filter((a) => a.status === "REJECTED").length})
                </Button>
                <Button
                  variant={activeTab === "ALL" ? "default" : "outline"}
                  onClick={() => setActiveTab("ALL")}
                  className="rounded-full px-5 text-sm"
                >
                  All Applications ({applications.length})
                </Button>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">
              {activeTab === "ALL" ? "All Provider Applications" : `${activeTab.charAt(0) + activeTab.slice(1).toLowerCase()} Applications`}
            </CardTitle>
            <CardDescription>
              Check applicant contact details, specialty, and facility location before approving portal access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-slate-500">Loading applications...</div>
            ) : filteredApps.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Clock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No applications found</p>
                <p className="text-sm text-slate-400">There are no provider applications matching the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Applicant / Entity</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Specialty / Address</th>
                      <th className="py-3 px-4">Applied Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredApps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(app.type)}
                            <span>{getTypeName(app)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          <Badge variant="outline" className="text-xs">
                            {app.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          <div className="space-y-0.5">
                            <p className="font-medium text-slate-800">{app.email}</p>
                            <p className="text-xs text-slate-500">{app.phone}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-600 max-w-xs truncate">
                          {app.type === "DOCTOR" ? (
                            <span className="font-medium text-blue-700">{app.specialty || "General Physician"}</span>
                          ) : (
                            <span className="text-slate-600">{app.address || app.city || "—"}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-500 text-xs">
                          {new Date(app.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-4 px-4">{getStatusBadge(app.status)}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedApp(app);
                                setViewDialogOpen(true);
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {app.status === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setApproveDialogOpen(true);
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* VIEW DETAILS DIALOG */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                {selectedApp && getTypeIcon(selectedApp.type)}
                Provider Application Details
              </DialogTitle>
              <DialogDescription>Full registration details submitted by provider.</DialogDescription>
            </DialogHeader>
            {selectedApp && (
              <div className="space-y-4 text-sm py-2">
                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Application ID</span>
                  <span className="font-bold text-slate-800">#{selectedApp.id}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Provider Type</Label>
                    <p className="font-semibold text-slate-900">{selectedApp.type.replace("_", " ")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Status</Label>
                    <div className="mt-0.5">{getStatusBadge(selectedApp.status)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-500">
                    {selectedApp.type === "DOCTOR" ? "Doctor Full Name" : "Facility Name"}
                  </Label>
                  <p className="font-semibold text-slate-900">{getTypeName(selectedApp)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Email Address</Label>
                    <p className="font-medium text-slate-800 break-all">{selectedApp.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Phone Number</Label>
                    <p className="font-medium text-slate-800">{selectedApp.phone}</p>
                  </div>
                </div>

                {selectedApp.type === "DOCTOR" && (
                  <div>
                    <Label className="text-xs text-slate-500">Specialty</Label>
                    <p className="font-semibold text-blue-700">{selectedApp.specialty}</p>
                  </div>
                )}

                {(selectedApp.address || selectedApp.city) && (
                  <div>
                    <Label className="text-xs text-slate-500">Address / Location</Label>
                    <p className="font-medium text-slate-800">{[selectedApp.address, selectedApp.city].filter(Boolean).join(", ")}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-slate-500">Registration Date</Label>
                  <p className="text-slate-700">{new Date(selectedApp.createdAt).toLocaleString("en-IN")}</p>
                </div>

                {selectedApp.rejectionReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                    <span className="font-bold block mb-0.5">Rejection Reason:</span>
                    {selectedApp.rejectionReason}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* APPROVE CONFIRMATION DIALOG */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-emerald-700 flex items-center gap-2">
                <Check className="h-5 w-5" /> Approve Provider Application?
              </DialogTitle>
              <DialogDescription>
                This will set provider status to ACTIVE and grant portal access immediately.
              </DialogDescription>
            </DialogHeader>
            {selectedApp && (
              <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                <p><span className="font-semibold">Provider:</span> {getTypeName(selectedApp)}</p>
                <p><span className="font-semibold">Email:</span> {selectedApp.email}</p>
                <p><span className="font-semibold">Type:</span> {selectedApp.type}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={approveMutation.isPending}
                onClick={() => selectedApp && approveMutation.mutate(selectedApp.id)}
              >
                {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* REJECT CONFIRMATION DIALOG */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Reject Provider Application
              </DialogTitle>
              <DialogDescription>
                The provider will be blocked from accessing the portal and notified of the rejection reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {selectedApp && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm">
                  <p><span className="font-semibold">Provider:</span> {getTypeName(selectedApp)} ({selectedApp.email})</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Rejection</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for rejecting this application (e.g. Invalid license credentials)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="h-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={rejectMutation.isPending}
                onClick={() => selectedApp && rejectMutation.mutate({ id: selectedApp.id, reason: rejectionReason })}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
