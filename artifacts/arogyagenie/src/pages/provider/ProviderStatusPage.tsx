import { useGetMe, customFetch } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { Clock, AlertCircle, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function ProviderStatusPage() {
  const { signOut } = useClerk();
  const { data: user, isLoading } = useGetMe();
  const [appDetails, setAppDetails] = useState<any>(null);

  useEffect(() => {
    customFetch<any>("/api/provider-applications/me")
      .then((data) => {
        if (data && data.application) {
          setAppDetails(data.application);
        }
      })
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading account status...</div>
      </div>
    );
  }

  const isRejected = (user?.status as string) === "rejected" || appDetails?.status === "REJECTED";
  const typeDisplay = appDetails?.type
    ? appDetails.type.replace("_", " ")
    : user?.role
    ? user.role.toUpperCase().replace("_", " ")
    : "PROVIDER";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={`${basePath}/logo.png`} alt="ArogyaGenie Logo" className="h-10 w-10 object-contain" />
          <span className="font-bold text-2xl tracking-tight text-primary">ArogyaGenie</span>
        </div>

        <Card className="border-blue-100 shadow-xl overflow-hidden">
          <CardHeader className={`p-8 text-center ${isRejected ? "bg-red-50 text-red-900 border-b border-red-100" : "bg-blue-50/70 text-blue-900 border-b border-blue-100"}`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
              {isRejected ? (
                <AlertCircle className="h-10 w-10 text-red-600" />
              ) : (
                <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
              )}
            </div>
            <div className="flex justify-center mb-2">
              <Badge variant={isRejected ? "destructive" : "outline"} className="px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                {isRejected ? "Application Rejected" : "Application Pending Approval"}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold">
              {isRejected ? "Application Not Approved" : "Approval Pending"}
            </CardTitle>
            <CardDescription className="text-sm mt-2 font-medium max-w-md mx-auto">
              {isRejected
                ? "Your application to join ArogyaGenie as a provider was not approved at this time."
                : "Application submitted successfully. Our team will review your details and contact you shortly. Portal access will be provided after approval."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            {/* Application Summary Box */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/80 space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Application Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs">Provider Type</span>
                  <span className="font-semibold text-slate-800">{typeDisplay}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Contact Email</span>
                  <span className="font-semibold text-slate-800">{user?.email || appDetails?.email || "—"}</span>
                </div>
                {appDetails?.firstName && (
                  <div>
                    <span className="text-slate-500 block text-xs">Applicant Name</span>
                    <span className="font-semibold text-slate-800">{`${appDetails.firstName} ${appDetails.lastName || ""}`.trim()}</span>
                  </div>
                )}
                {appDetails?.name && (
                  <div>
                    <span className="text-slate-500 block text-xs">Facility Name</span>
                    <span className="font-semibold text-slate-800">{appDetails.name}</span>
                  </div>
                )}
                {appDetails?.specialty && (
                  <div>
                    <span className="text-slate-500 block text-xs">Specialty</span>
                    <span className="font-semibold text-slate-800">{appDetails.specialty}</span>
                  </div>
                )}
                {appDetails?.phone && (
                  <div>
                    <span className="text-slate-500 block text-xs">Phone</span>
                    <span className="font-semibold text-slate-800">{appDetails.phone}</span>
                  </div>
                )}
                {appDetails?.address && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-xs">Address</span>
                    <span className="font-semibold text-slate-800">{appDetails.address}</span>
                  </div>
                )}
              </div>
            </div>

            {isRejected && appDetails?.rejectionReason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                <span className="font-bold block mb-1">Reason for Rejection:</span>
                {appDetails.rejectionReason}
              </div>
            )}

            {!isRejected && (
              <div className="flex items-start gap-3 p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-sm">
                <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  No further action is required from your side. You will receive access automatically once our administrator verifies your credentials.
                </p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full h-11 border-slate-300 hover:bg-slate-100 text-slate-700 font-medium flex items-center justify-center gap-2"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
