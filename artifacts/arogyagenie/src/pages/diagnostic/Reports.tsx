import { useState } from "react";
import { useListLabReports } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Search, Calendar, User } from "lucide-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { UploadReportModal } from "./UploadReportModal";

export function DiagnosticReportsPage() {
  const { data: reports, isLoading } = useListLabReports();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const filteredReports = reports?.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.testName.toLowerCase().includes(q) || String(r.patientId).includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Diagnostic Lab Reports Log</h1>
            <p className="text-slate-500 mt-1">Review lab reports uploaded for patients and attach new test results.</p>
          </div>
          <Button onClick={() => setUploadOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Upload Lab Report
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search report by test name or patient ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">Loading lab reports...</div>
        ) : filteredReports?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No lab reports found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredReports?.map((r) => (
              <Card key={r.id} className="overflow-hidden border-t-4 border-t-primary hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{r.testName}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <User className="h-3.5 w-3.5" /> Patient ID: #{r.patientId} •{" "}
                        <Calendar className="h-3.5 w-3.5 ml-1" /> {new Date(r.testDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                        r.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  {r.results && (
                    <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap border border-slate-100 text-slate-800">
                      {r.results}
                    </div>
                  )}

                  {r.aiSummary && (
                    <div className="bg-blue-50/50 p-3 rounded-lg text-xs text-blue-900 border border-blue-100">
                      <strong>AI Summary:</strong> {r.aiSummary}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <UploadReportModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
