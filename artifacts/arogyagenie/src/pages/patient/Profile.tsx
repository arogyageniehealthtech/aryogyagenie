import { useEffect } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { User, Phone, Activity, Heart, Save, CheckCircle2, ShieldCheck, MapPin, Calendar, Mail } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  allergies: z.string().optional(),
  existingConditions: z.string().optional(),
  currentMedications: z.string().optional(),
  previousIllnesses: z.string().optional(),
  emergencyContact: z.string().optional(),
});

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl skeleton-shimmer shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-6 skeleton-shimmer rounded w-48" />
            <div className="h-4 skeleton-shimmer rounded w-32" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="h-5 skeleton-shimmer rounded w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 skeleton-shimmer rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientProfile() {
  const { data: user, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "", lastName: "", phone: "", dateOfBirth: "", age: "", gender: "",
      bloodGroup: "", address: "", city: "", state: "", allergies: "",
      existingConditions: "", currentMedications: "", previousIllnesses: "", emergencyContact: ""
    }
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : "",
        age: user.age || "",
        gender: user.gender || "",
        bloodGroup: user.bloodGroup || "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        allergies: user.allergies || "",
        existingConditions: user.existingConditions || "",
        currentMedications: user.currentMedications || "",
        previousIllnesses: user.previousIllnesses || "",
        emergencyContact: user.emergencyContact || "",
      });
    }
  }, [user, form]);

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    updateMe.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Profile updated successfully." });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to update profile.", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <ProfileSkeleton />;

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "PA";
  const fullName = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Patient Profile";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your personal details, contact preferences, and medical background.</p>
        </div>

        {/* ── Profile Hero Card ────────────────────────────────────────────── */}
        <div 
          className="bg-white rounded-2xl border border-slate-100/90 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 overflow-hidden relative"
        >
          <div 
            className="absolute top-0 right-0 h-32 w-64 opacity-30 pointer-events-none rounded-full"
            style={{ background: "radial-gradient(circle, hsl(243,75%,90%), transparent)" }}
          />

          <div className="flex items-center gap-4 relative">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-xs"
              style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{fullName}</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3" /> Patient
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {user?.email || "patient@arogyagenie.com"}
              </p>
            </div>
          </div>

          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={updateMe.isPending}
            className="rounded-xl gap-2 font-semibold text-xs h-10 px-5 shadow-xs w-full sm:w-auto"
            style={{
              background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
              border: "none",
              color: "white",
            }}
          >
            {updateMe.isPending ? (
              "Saving Changes..."
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Profile
              </>
            )}
          </Button>
        </div>

        {/* ── Profile Form ─────────────────────────────────────────────────── */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* 1. PERSONAL INFORMATION */}
            <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden">
              <div 
                className="p-5 border-b border-slate-100 flex items-center gap-2.5"
                style={{ background: "linear-gradient(135deg, hsl(243,75%,98%), hsl(260,70%,96%))" }}
              >
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Personal Information</h3>
                  <p className="text-[11px] text-slate-500">Legal name, age, and identity details</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">First Name</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Last Name</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Date of Birth</FormLabel>
                      <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="age" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Age</FormLabel>
                      <FormControl><Input placeholder="e.g. 28" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Gender</FormLabel>
                      <FormControl><Input placeholder="e.g. Male, Female, Other" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </div>

            {/* 2. CONTACT DETAILS */}
            <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden">
              <div 
                className="p-5 border-b border-slate-100 flex items-center gap-2.5"
                style={{ background: "linear-gradient(135deg, hsl(243,75%,98%), hsl(260,70%,96%))" }}
              >
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Contact & Address Details</h3>
                  <p className="text-[11px] text-slate-500">Phone numbers, emergency contacts, and residential location</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Phone Number</FormLabel>
                      <FormControl><Input placeholder="e.g. +91 9876543210" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Emergency Contact</FormLabel>
                      <FormControl><Input placeholder="e.g. Spouse: +91 9876543211" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">City</FormLabel>
                      <FormControl><Input placeholder="e.g. New Delhi" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">State</FormLabel>
                      <FormControl><Input placeholder="e.g. Delhi" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-900">Residential Address</FormLabel>
                    <FormControl><Textarea placeholder="Full home address..." className="rounded-xl resize-none min-h-[70px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* 3. MEDICAL BACKGROUND */}
            <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm overflow-hidden">
              <div 
                className="p-5 border-b border-slate-100 flex items-center gap-2.5"
                style={{ background: "linear-gradient(135deg, hsl(158,60%,97%), hsl(158,50%,93%))" }}
              >
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Heart className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Medical Background & History</h3>
                  <p className="text-[11px] text-slate-500">Blood group, known allergies, chronic conditions, and current medications</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-900">Blood Group</FormLabel>
                      <FormControl><Input placeholder="e.g. O+, A-, AB+" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="allergies" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-900">Allergies</FormLabel>
                    <FormControl><Textarea placeholder="List any known drug, food, or environmental allergies..." className="rounded-xl resize-none min-h-[70px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="existingConditions" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-900">Existing Conditions</FormLabel>
                    <FormControl><Textarea placeholder="List chronic or existing conditions (e.g. Asthma, Hypertension, Type 2 Diabetes)..." className="rounded-xl resize-none min-h-[70px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currentMedications" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-900">Current Medications</FormLabel>
                    <FormControl><Textarea placeholder="List prescription or over-the-counter medications..." className="rounded-xl resize-none min-h-[70px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="previousIllnesses" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-900">Previous Major Illnesses / Surgeries</FormLabel>
                    <FormControl><Textarea placeholder="List past major illnesses, hospitalizations, or surgeries..." className="rounded-xl resize-none min-h-[70px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Submit Action Bar ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100/90 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Ensure all medical details are accurate for AI clinical insights.</span>
              <Button
                type="submit"
                disabled={updateMe.isPending}
                className="rounded-xl gap-2 font-semibold text-xs h-10 px-6 shadow-xs"
                style={{
                  background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                  border: "none",
                  color: "white",
                }}
              >
                {updateMe.isPending ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
