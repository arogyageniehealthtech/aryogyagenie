import { useState } from "react";
import { useListLabReports, useCreateLabReport, useAnalyzeLabReport, getListLabReportsQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Plus, AlertCircle, HelpCircle, CheckCircle2, Calendar, Activity, UploadCloud, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const reportSchema = z.object({
  testName: z.string().min(2, "Test name is required"),
  testDate: z.string().min(1, "Date is required"),
  results: z.string().optional(),
});

interface ParsedAIAnalysis {
  summary?: string;
  keyFindings?: string[];
  abnormalValues?: string[];
  possibleSignificance?: string[];
  questionsForDoctor?: string[];
  urgency?: string;
  disclaimer?: string;
}

function parseAISummary(rawSummary?: string | null): ParsedAIAnalysis | null {
  if (!rawSummary) return null;
  try {
    const parsed = JSON.parse(rawSummary);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as ParsedAIAnalysis;
    }
  } catch (_e) {
    return { summary: rawSummary };
  }
  return { summary: rawSummary };
}

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isCompleted = status?.toLowerCase() === "completed";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: isCompleted ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
        color: isCompleted ? "#16a34a" : "#b45309",
      }}
    >
      {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
    </span>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function LabReportSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden animate-pulse flex flex-col lg:flex-row">
      <div className="p-6 flex-1 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <div className="h-5 skeleton-shimmer rounded w-48" />
            <div className="h-3.5 skeleton-shimmer rounded w-28" />
          </div>
          <div className="h-6 skeleton-shimmer rounded-full w-20" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 skeleton-shimmer rounded w-36" />
          <div className="h-24 skeleton-shimmer rounded-xl w-full" />
        </div>
      </div>
      <div className="p-6 lg:w-96 bg-indigo-50/30 space-y-3 border-t lg:border-t-0 lg:border-l border-slate-100">
        <div className="h-5 skeleton-shimmer rounded w-40" />
        <div className="h-16 skeleton-shimmer rounded-xl w-full" />
        <div className="h-12 skeleton-shimmer rounded-xl w-full" />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientLabReports() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: reports, isLoading } = useListLabReports();
  const createReport = useCreateLabReport();
  const analyzeReport = useAnalyzeLabReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: { testName: "", testDate: new Date().toISOString().split("T")[0], results: "" }
  });

  const onSubmit = (data: z.infer<typeof reportSchema>) => {
    createReport.mutate({ data }, {
      onSuccess: () => {
        setIsOpen(false);
        form.reset();
        toast({ title: "Report Saved", description: "Lab test report uploaded successfully." });
        queryClient.invalidateQueries({ queryKey: getListLabReportsQueryKey() });
      }
    });
  };

  const handleTriggerAnalysis = (id: number) => {
    analyzeReport.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "AI Analysis Generated", description: "Plain-English interpretation generated for your report." });
          queryClient.invalidateQueries({ queryKey: getListLabReportsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Analysis Failed", description: err instanceof Error ? err.message : "Error analyzing report.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lab Reports</h1>
            <p className="text-sm text-slate-500 mt-1">Manage diagnostic results and view AI-powered medical explanations.</p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2 rounded-xl font-semibold shadow-sm"
                style={{
                  background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                  border: "none",
                  color: "white",
                }}
              >
                <Plus className="h-4 w-4" />
                Upload Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Upload Lab Report</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="testName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Complete Blood Count (CBC)" className="rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="testDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Date</FormLabel>
                        <FormControl>
                          <Input type="date" className="rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="results"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Results / Value Readings</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Hemoglobin 14.2 g/dL, WBC 6.8 K/uL"
                            className="min-h-[110px] font-mono text-xs rounded-xl resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl w-full sm:w-auto"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createReport.isPending}
                      className="rounded-xl gap-2 w-full sm:w-auto"
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                        border: "none",
                        color: "white",
                      }}
                    >
                      {createReport.isPending ? "Uploading..." : "Save Report"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Content Section ──────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-5">
            {[...Array(3)].map((_, i) => <LabReportSkeleton key={i} />)}
          </div>
        ) : reports?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <FileText className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No lab reports found</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-5">
              Upload your lab test readings to store them securely and get AI-powered plain-English explanations.
            </p>
            <Button
              onClick={() => setIsOpen(true)}
              className="rounded-xl gap-2"
              style={{
                background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                border: "none",
                color: "white",
              }}
            >
              <Plus className="h-4 w-4" />
              Upload First Report
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {reports?.map((report) => {
              const aiData = parseAISummary(report.aiSummary);
              const formattedDate = report.testDate
                ? new Date(report.testDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "";

              const isUrgent = aiData?.urgency === "ATTENTION_REQUIRED" || aiData?.urgency === "URGENT";

              return (
                <div 
                  key={report.id} 
                  className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden flex flex-col lg:flex-row hover:shadow-md transition-all duration-180"
                >
                  {/* Left Panel: Original Medical Readings */}
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{report.testName}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Test Date: {formattedDate}</span>
                        </div>
                      </div>
                      <StatusBadge status={report.status} />
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Original Medical Readings
                      </span>
                      {report.results ? (
                        <div className="text-xs text-slate-800 bg-slate-50/90 p-4 rounded-xl font-mono whitespace-pre-wrap border border-slate-100 leading-relaxed">
                          {report.results}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                          No detailed raw text readings provided.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Panel: AI Plain-English Interpretation */}
                  <div 
                    className="p-6 lg:w-96 flex flex-col justify-between space-y-4 border-t lg:border-t-0 lg:border-l border-slate-100"
                    style={{ background: "linear-gradient(180deg, hsl(243,75%,98.5%), hsl(250,50%,97%))" }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2">
                          <div 
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: "hsl(243,75%,92%)", color: "hsl(243,75%,52%)" }}
                          >
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">AI Interpretation</h4>
                        </div>
                        {aiData?.urgency && (
                          <span 
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: isUrgent ? "rgba(239,68,68,0.12)" : "rgba(79,70,229,0.1)",
                              color: isUrgent ? "#dc2626" : "#4338ca",
                              border: isUrgent ? "1px solid rgba(239,68,68,0.25)" : "none"
                            }}
                          >
                            {aiData.urgency.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>

                      {aiData ? (
                        <div className="space-y-3 text-xs text-slate-700">
                          {aiData.summary && (
                            <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 shadow-2xs leading-relaxed text-slate-800 font-medium">
                              {aiData.summary}
                            </div>
                          )}

                          {aiData.abnormalValues && aiData.abnormalValues.length > 0 && (
                            <div className="bg-red-50/80 p-3 rounded-xl border border-red-100 space-y-1">
                              <h5 className="text-[11px] font-bold text-red-700 uppercase flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5" /> Out of Range Values
                              </h5>
                              <ul className="text-xs space-y-0.5 text-red-900 font-mono pl-1">
                                {aiData.abnormalValues.map((v, i) => (
                                  <li key={i}>• {v}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {aiData.questionsForDoctor && aiData.questionsForDoctor.length > 0 && (
                            <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                              <h5 className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                                <HelpCircle className="h-3.5 w-3.5 text-indigo-500" /> Questions for Doctor
                              </h5>
                              <ul className="text-xs space-y-1 text-slate-600 pl-1">
                                {aiData.questionsForDoctor.map((q, i) => (
                                  <li key={i}>• {q}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <p className="text-[10px] text-slate-400 italic pt-1 border-t border-indigo-100/60">
                            ⚠️ Informational AI summary only. Not a clinical diagnosis.
                          </p>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-3">
                          <p className="text-xs text-slate-500">
                            Get a plain-English AI analysis & explanation of these test values.
                          </p>
                          <Button
                            size="sm"
                            className="rounded-xl gap-2 font-semibold text-xs h-9 shadow-xs"
                            style={{
                              background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                              border: "none",
                              color: "white",
                            }}
                            onClick={() => handleTriggerAnalysis(report.id)}
                            disabled={analyzeReport.isPending}
                          >
                            <Sparkles className={`h-3.5 w-3.5 ${analyzeReport.isPending ? "animate-spin" : ""}`} />
                            {analyzeReport.isPending ? "Analyzing..." : "Analyze with AI"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
