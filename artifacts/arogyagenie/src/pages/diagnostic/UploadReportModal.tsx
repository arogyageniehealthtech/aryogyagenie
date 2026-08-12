import { useState } from "react";
import { useCreateLabReport, useExtractOcr, getGetDiagnosticCenterDashboardQueryKey, getListLabReportsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FileText, Scan, Sparkles } from "lucide-react";

const reportSchema = z.object({
  patientId: z.coerce.number().min(1, "Patient ID is required"),
  testName: z.string().min(2, "Test name is required"),
  testDate: z.string().min(1, "Test date is required"),
  results: z.string().optional(),
  fileUrl: z.string().optional(),
});

interface UploadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPatientId?: number;
  defaultTestName?: string;
}

export function UploadReportModal({
  isOpen,
  onClose,
  defaultPatientId,
  defaultTestName,
}: UploadReportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReport = useCreateLabReport();
  const extractOcr = useExtractOcr();

  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      patientId: defaultPatientId ?? 0,
      testName: defaultTestName ?? "",
      testDate: new Date().toISOString().split("T")[0],
      results: "",
      fileUrl: "",
    },
  });

  const handleRunOcr = () => {
    const fileUrl = form.getValues("fileUrl");
    const currentResults = form.getValues("results");

    extractOcr.mutate(
      {
        data: {
          fileUrl: fileUrl || undefined,
          rawText: currentResults || undefined,
          imageBase64: !fileUrl && !currentResults ? "sample_base64_lab_document" : undefined,
        },
      },
      {
        onSuccess: (data) => {
          toast({
            title: "OCR Scan Completed",
            description: `Extracted ${data.extractedLabValues?.length ?? 0} test readings with ${data.confidenceScore}% confidence.`,
          });

          if (data.rawExtractedText) {
            form.setValue("results", data.rawExtractedText);
          }
        },
        onError: (err: unknown) => {
          toast({
            title: "OCR Failed",
            description: err instanceof Error ? err.message : "Error extracting text.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const onSubmit = (data: z.infer<typeof reportSchema>) => {
    createReport.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Report Uploaded",
            description: `Lab test report for ${data.testName} saved successfully.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetDiagnosticCenterDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLabReportsQueryKey() });
          form.reset();
          onClose();
        },
        onError: (err: unknown) => {
          toast({
            title: "Upload Failed",
            description: err instanceof Error ? err.message : "Error saving report.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileText className="h-5 w-5 text-primary" />
            Upload Diagnostic Test Report
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient ID</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter Patient ID" {...field} />
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
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="testName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Name / Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Complete Blood Count (CBC) / Lipid Profile" {...field} />
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Test Results & Value Readings</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary gap-1"
                      onClick={handleRunOcr}
                      disabled={extractOcr.isPending}
                    >
                      <Scan className="h-3.5 w-3.5" />
                      {extractOcr.isPending ? "Scanning..." : "Auto-Extract with OCR"}
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Hemoglobin: 14.2 g/dL (Normal)&#10;WBC: 6,800 /mcL&#10;Platelets: 250,000 /mcL"
                      className="min-h-[110px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Document / PDF URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://storage.arogyagenie.com/reports/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createReport.isPending}>
                {createReport.isPending ? "Saving Report..." : "Save Lab Report"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
