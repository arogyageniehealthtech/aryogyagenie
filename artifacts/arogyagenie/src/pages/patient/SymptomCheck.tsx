import { useState } from "react";
import {
  useListSymptomAssessments,
  useCreateSymptomAssessment,
  useGenerateFollowUpQuestions,
  getListSymptomAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Brain, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert, Stethoscope, FileText, RefreshCw, Sparkles, Clock, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

const initialFormSchema = z.object({
  symptoms: z.string().min(10, "Please describe your symptoms in more detail (min 10 chars)."),
  severity: z.enum(["mild", "moderate", "severe"]),
  duration: z.string().min(1, "Please enter how long you've had these symptoms."),
  additionalNotes: z.string().optional(),
});

type InitialFormValues = z.infer<typeof initialFormSchema>;
type Stage = "initial" | "emergency" | "followup" | "result" | "invalid";

// ─── Skeleton Loader for History ─────────────────────────────────────────────
function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm animate-pulse space-y-2">
          <div className="flex justify-between">
            <div className="h-3 skeleton-shimmer rounded w-24" />
            <div className="h-4 skeleton-shimmer rounded-full w-16" />
          </div>
          <div className="h-4 skeleton-shimmer rounded w-3/4" />
          <div className="h-3 skeleton-shimmer rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PatientSymptomCheck() {
  const [stage, setStage] = useState<Stage>("initial");
  const [initialData, setInitialData] = useState<InitialFormValues | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [emergencyMessage, setEmergencyMessage] = useState<string>("");
  const [invalidReason, setInvalidReason] = useState<string>("");
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: assessments, isLoading } = useListSymptomAssessments();
  const generateFollowUp = useGenerateFollowUpQuestions();
  const createAssessment = useCreateSymptomAssessment();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<InitialFormValues>({
    resolver: zodResolver(initialFormSchema),
    defaultValues: { symptoms: "", severity: "mild", duration: "", additionalNotes: "" },
  });

  const handleInitialSubmit = (data: InitialFormValues) => {
    setIsSubmitting(true);
    setInitialData(data);

    generateFollowUp.mutate(
      { data },
      {
        onSuccess: (res) => {
          setIsSubmitting(false);
          if ((res as any).isInvalidInput) {
            setInvalidReason((res as any).invalidMessage || "Your input doesn't appear to describe recognizable health symptoms. Please try again.");
            setStage("invalid");
          } else if (res.isEmergency) {
            setEmergencyMessage(
              res.emergencyMessage ||
                "Your reported symptoms indicate a potential medical emergency. Please call local emergency services or go to the nearest emergency room immediately."
            );
            setStage("emergency");
          } else {
            setFollowUpQuestions(res.questions || []);
            const initialAns: Record<string, string> = {};
            (res.questions || []).forEach((q) => {
              initialAns[q] = "";
            });
            setAnswers(initialAns);
            setStage("followup");
          }
        },
        onError: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleFinalSubmit = () => {
    if (!initialData) return;
    setIsSubmitting(true);

    createAssessment.mutate(
      {
        data: {
          symptoms: initialData.symptoms,
          severity: initialData.severity,
          duration: initialData.duration,
          additionalNotes: initialData.additionalNotes,
          followUpQuestions,
          followUpAnswers: answers,
        },
      },
      {
        onSuccess: (res) => {
          setIsSubmitting(false);
          setActiveAssessment(res);
          setStage("result");
          queryClient.invalidateQueries({ queryKey: getListSymptomAssessmentsQueryKey() });
        },
        onError: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleReset = () => {
    setStage("initial");
    setInitialData(null);
    setFollowUpQuestions([]);
    setAnswers({});
    setEmergencyMessage("");
    setInvalidReason("");
    setActiveAssessment(null);
    form.reset({ symptoms: "", severity: "mild", duration: "", additionalNotes: "" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Symptom Checker</h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive AI-assisted 2-stage symptom assessment with clinical RAG evidence integration.
          </p>
        </div>

        {/* ── Layout Grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT 2 COLUMNS: ASSESSMENT STAGES */}
          <div className="lg:col-span-2 space-y-6">

            {/* STAGE 1: INITIAL FORM */}
            {stage === "initial" && (
              <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden">
                <div 
                  className="p-5 border-b border-slate-100 flex items-center justify-between"
                  style={{ background: "linear-gradient(135deg, hsl(243,75%,98%), hsl(260,70%,96%))" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="p-2 rounded-xl text-white shadow-2xs"
                      style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}
                    >
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">Stage 1: Describe Your Symptoms</h2>
                      <p className="text-xs text-slate-500">Provide details about how you are feeling</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    Step 1 of 2
                  </span>
                </div>

                <div className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-4">
                      {/* Body Area Selector (Matching Reference SYMPTOM CHECKER UI) */}
                      <div className="space-y-2 mb-4">
                        <label className="font-semibold text-slate-900 text-xs uppercase tracking-wider block">
                          Where is the problem? Select area:
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { label: "Head", icon: "🧠" },
                            { label: "Chest", icon: "🫁" },
                            { label: "Stomach", icon: "🤢" },
                            { label: "Back", icon: "🦴" },
                            { label: "Arms", icon: "💪" },
                            { label: "Legs", icon: "🦵" },
                          ].map((area) => (
                            <button
                              key={area.label}
                              type="button"
                              onClick={() => {
                                const current = form.getValues("symptoms");
                                const prefix = current ? `${current}, ` : "";
                                form.setValue("symptoms", `${prefix}Pain/Discomfort in ${area.label.toLowerCase()}`, {
                                  shouldValidate: true,
                                });
                              }}
                              className="flex flex-col items-center justify-center p-3 rounded-xl border border-violet-100 bg-violet-50/50 hover:bg-violet-600 hover:text-white transition-all text-xs font-semibold text-violet-900 shadow-2xs group"
                            >
                              <span className="text-lg mb-1">{area.icon}</span>
                              <span>{area.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="symptoms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-slate-900 text-sm">
                              Describe your symptoms in detail:
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="e.g. I have had a high fever, dry cough, and mild body aches for 2 days..."
                                className="min-h-[100px] rounded-xl resize-none focus-visible:ring-violet-500"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="severity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-semibold text-slate-900 text-sm">Severity</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="mild">Mild (Noticeable but manageable)</SelectItem>
                                  <SelectItem value="moderate">Moderate (Interferes with activities)</SelectItem>
                                  <SelectItem value="severe">Severe (Incapacitating / severe discomfort)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-semibold text-slate-900 text-sm">Duration</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. 2 days, 3 weeks" className="rounded-xl" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="additionalNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-slate-900 text-sm">
                              Additional Context <span className="text-slate-400 font-normal">(Optional)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Recent travel, known triggers, or previous episode details" className="rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full h-11 text-sm font-semibold rounded-xl gap-2 mt-2" 
                        disabled={isSubmitting}
                        style={{
                          background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                          border: "none",
                          color: "white",
                        }}
                      >
                        {isSubmitting ? "Checking Safety & Generating Questions..." : "Continue to AI Assessment"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>
            )}

            {/* STAGE: EMERGENCY INTERCEPT */}
            {stage === "emergency" && (
              <div className="bg-red-50/90 rounded-2xl border border-red-200 shadow-md overflow-hidden p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-red-200/80 pb-4">
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-600 shrink-0">
                    <ShieldAlert className="h-6 w-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-red-950 tracking-tight">EMERGENCY SAFETY INTERCEPT</h2>
                    <p className="text-xs text-red-700">Immediate medical attention may be required</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-200/80 shadow-2xs">
                  <p className="font-semibold text-sm leading-relaxed text-red-950">{emergencyMessage}</p>
                </div>

                <div className="bg-red-100/60 p-4 rounded-xl text-xs text-red-900 space-y-1.5 border border-red-200/60">
                  <p className="font-bold">⚠️ Critical Guidance:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Do not wait for symptoms to worsen.</li>
                    <li>Contact local emergency services immediately (108 / 911).</li>
                    <li>If driving is unsafe, request an emergency ambulance.</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 rounded-xl flex-1 gap-2 text-sm"
                    onClick={() => window.open("tel:108")}
                  >
                    Call Emergency Services (108 / 911)
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-900 hover:bg-red-100 h-11 rounded-xl text-xs font-semibold"
                    onClick={() => setLocation("/patient/doctors?specialty=Cardiologist")}
                  >
                    Find Emergency Specialist
                  </Button>
                  <Button variant="ghost" className="h-11 rounded-xl text-slate-600 text-xs" onClick={handleReset}>
                    Reset Form
                  </Button>
                </div>
              </div>
            )}

            {/* STAGE: INVALID SYMPTOM INPUT INTERCEPT */}
            {stage === "invalid" && (
              <div className="bg-amber-50/90 rounded-2xl border border-amber-200 shadow-md overflow-hidden p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-amber-200/80 pb-4">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-amber-950 tracking-tight">Input Not Recognized as Health Symptoms</h2>
                    <p className="text-xs text-amber-800">Please describe physical health symptoms</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs">
                  <p className="font-semibold text-sm leading-relaxed text-amber-950">{invalidReason}</p>
                </div>

                <div className="bg-amber-100/60 p-4 rounded-xl text-xs text-amber-900 space-y-1.5 border border-amber-200/60">
                  <p className="font-bold">💡 Tips for a better description:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Describe what body part is affected (e.g. head, stomach, chest, throat)</li>
                    <li>Describe what you feel (e.g. pain, ache, fever, nausea, fatigue)</li>
                    <li>Example: <span className="font-mono bg-amber-50 px-1 rounded border border-amber-200">"I have a fever and sore throat for 2 days"</span></li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button 
                    className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm" 
                    onClick={handleReset}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* STAGE 2: AI FOLLOW-UP QUESTIONS */}
            {stage === "followup" && (
              <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden">
                <div 
                  className="p-5 border-b border-slate-100 flex items-center justify-between"
                  style={{ background: "linear-gradient(135deg, hsl(243,75%,98%), hsl(260,70%,96%))" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="p-2 rounded-xl text-white shadow-2xs"
                      style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}
                    >
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">Stage 2: AI Clinical Follow-up Questions</h2>
                      <p className="text-xs text-slate-500">Answer specific questions to refine diagnosis accuracy</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    Step 2 of 2
                  </span>
                </div>

                <div className="p-6 space-y-5">
                  <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 text-xs text-slate-700 font-medium leading-relaxed">
                    To provide an accurate assessment, our AI assistant generated specific follow-up questions based on your reported symptoms:
                  </div>

                  <div className="space-y-4">
                    {followUpQuestions.map((q, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
                        <label className="text-xs font-bold text-slate-900 block leading-snug">
                          {idx + 1}. {q}
                        </label>
                        <Textarea
                          placeholder="Type your answer here..."
                          className="bg-white min-h-[70px] text-xs rounded-xl resize-none focus-visible:ring-indigo-500"
                          value={answers[q] || ""}
                          onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button 
                      className="flex-1 h-11 font-semibold rounded-xl text-sm gap-2" 
                      disabled={isSubmitting} 
                      onClick={handleFinalSubmit}
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                        border: "none",
                        color: "white",
                      }}
                    >
                      {isSubmitting ? "Retrieving Clinical RAG & Analyzing..." : "Generate Final AI Assessment"}
                      <Brain className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl" onClick={() => setStage("initial")}>
                      Back
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: STRUCTURED ASSESSMENT RESULT */}
            {stage === "result" && activeAssessment && (
              <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden space-y-0">
                <div 
                  className="p-5 border-b border-slate-100 flex items-center justify-between"
                  style={{ background: "linear-gradient(135deg, hsl(158,60%,97%), hsl(158,50%,93%))" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="p-2 rounded-xl text-white shadow-2xs"
                      style={{ background: "linear-gradient(135deg, hsl(158,60%,42%), hsl(158,50%,34%))" }}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">AI Clinical Assessment Result</h2>
                      <p className="text-xs text-slate-500">Synthesized using evidence-based RAG guidelines</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 rounded-xl text-xs bg-white">
                    <RefreshCw className="h-3.5 w-3.5" />
                    New Assessment
                  </Button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Triage Urgency Header */}
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-50/70 border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Triage Urgency Level:</span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${
                        activeAssessment.urgencyLevel === "EMERGENCY"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : activeAssessment.urgencyLevel === "HIGH"
                          ? "bg-orange-100 text-orange-800 border-orange-300"
                          : activeAssessment.urgencyLevel === "MODERATE"
                          ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {activeAssessment.urgencyLevel || "LOW"}
                    </span>
                  </div>

                  {/* Possible Conditions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-indigo-600" />
                      Possible Conditions & Clinical Rationale
                    </h3>

                    {activeAssessment.structuredAssessment?.possibleConditions ? (
                      <div className="space-y-3">
                        {activeAssessment.structuredAssessment.possibleConditions.map((cond: any, idx: number) => (
                          <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-white shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-900 text-sm">{cond.name}</span>
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                                  cond.confidence === "High"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : cond.confidence === "Moderate"
                                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                              >
                                {cond.confidence} Confidence
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{cond.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-800">
                        {activeAssessment.possibleConditions}
                      </div>
                    )}
                  </div>

                  {/* Risk Factors */}
                  {activeAssessment.structuredAssessment?.riskFactors?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Identified Risk Factors</span>
                      <div className="flex flex-wrap gap-2">
                        {activeAssessment.structuredAssessment.riskFactors.map((factor: string, idx: number) => (
                          <span key={idx} className="text-xs bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-full font-medium">
                            • {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Doctor Referral Banner */}
                  <div 
                    className="p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    style={{ background: "linear-gradient(135deg, hsl(243,75%,97%), hsl(260,70%,95%))" }}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">Recommended Specialty</span>
                      <span className="text-base font-bold text-indigo-950">
                        {activeAssessment.recommendedSpecialty || "General Physician"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-xl gap-1.5 text-xs font-semibold shadow-2xs"
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                        border: "none",
                        color: "white",
                      }}
                      onClick={() =>
                        setLocation(`/patient/doctors?specialty=${encodeURIComponent(activeAssessment.recommendedSpecialty || "General Physician")}`)
                      }
                    >
                      Find a {activeAssessment.recommendedSpecialty || "General Physician"} Specialist
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Recommended Action */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Action</span>
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                      {activeAssessment.recommendedAction}
                    </p>
                  </div>

                  {/* RAG Sources Evidence */}
                  {activeAssessment.sources && activeAssessment.sources.length > 0 && (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-500" />
                        Retrieved Clinical Guidelines Evidence (RAG)
                      </span>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        {activeAssessment.sources.map((src: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100">
                            <span className="font-semibold text-slate-900">{src.documentTitle}</span>
                            <span className="text-[11px] text-slate-400">{src.publisher || "Official Guidelines"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="bg-amber-50/80 border border-amber-200/80 text-amber-900 p-3.5 rounded-xl flex gap-2.5 text-xs leading-relaxed">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Medical Disclaimer:</strong> This assessment is generated by an AI assistant for informational purposes only. It is not a professional medical diagnosis or treatment plan. Always consult a qualified healthcare provider for medical concerns.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 1 COLUMN: PAST ASSESSMENTS HISTORY */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              Assessment History
            </h2>

            {isLoading ? (
              <HistorySkeleton />
            ) : assessments?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <Activity className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">No past assessments found.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                {assessments?.map((assessment: any) => {
                  const isInvalid = assessment.assessmentStatus === "INVALID_INPUT";
                  const isEmergencyRecord = assessment.assessmentStatus === "EMERGENCY";
                  const formattedDate = assessment.createdAt
                    ? new Date(assessment.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <div 
                      key={assessment.id} 
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all duration-180 ${
                        isInvalid ? "border-slate-200 opacity-60 bg-slate-50/60" : "border-slate-100/90"
                      }`}
                    >
                      <div className={`p-4 border-b ${isInvalid ? "bg-amber-50/50 border-amber-100" : "bg-slate-50/70 border-slate-100"}`}>
                        <div className="flex justify-between items-start mb-1.5 flex-wrap gap-1">
                          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formattedDate}
                          </span>
                          <div className="flex gap-1 flex-wrap justify-end">
                            {isInvalid ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                Invalid Input
                              </span>
                            ) : isEmergencyRecord ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-red-100 text-red-800 border border-red-300">
                                Emergency
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completed
                              </span>
                            )}
                            {!isInvalid && assessment.urgencyLevel && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  assessment.urgencyLevel === "EMERGENCY"
                                    ? "bg-red-100 text-red-800"
                                    : assessment.urgencyLevel === "HIGH"
                                    ? "bg-orange-100 text-orange-800"
                                    : assessment.urgencyLevel === "MODERATE"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {assessment.urgencyLevel}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className={`text-xs font-semibold line-clamp-2 ${isInvalid ? "text-slate-500 italic" : "text-slate-900"}`}>
                          "{assessment.symptoms}"
                        </p>
                        {assessment.duration && (
                          <p className="text-[11px] text-slate-400 mt-1">Duration: {assessment.duration}</p>
                        )}
                        {isInvalid && (
                          <p className="text-[11px] text-amber-700 font-medium mt-1 italic">
                            ⚠ Flagged as unrecognized health description.
                          </p>
                        )}
                      </div>

                      {!isInvalid && assessment.possibleConditions && (
                        <div className="p-3.5 bg-white space-y-2 text-xs">
                          <div>
                            <strong className="text-slate-900 block text-[11px] mb-0.5">Possible Conditions:</strong>
                            <p className="text-slate-600 leading-relaxed text-xs">{assessment.possibleConditions}</p>
                          </div>
                          {assessment.recommendedSpecialty && (
                            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-indigo-900 font-semibold">
                              <span className="text-[11px] truncate">Specialty: {assessment.recommendedSpecialty}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
                                onClick={() =>
                                  setLocation(`/patient/doctors?specialty=${encodeURIComponent(assessment.recommendedSpecialty)}`)
                                }
                              >
                                View Doctors
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
