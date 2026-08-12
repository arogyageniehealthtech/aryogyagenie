import { useEffect } from "react";
import { useGetDoctorProfile, useUpdateDoctorProfile, getGetDoctorProfileQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Building, Award, Clock, DollarSign, Save } from "lucide-react";
import { DOCTOR_SPECIALTIES } from "@/lib/specialties";

const doctorProfileSchema = z.object({
  specialty: z.string().min(2, "Specialty is required"),
  qualification: z.string().optional(),
  licenseNumber: z.string().optional(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  consultationFee: z.coerce.number().min(0, "Consultation fee must be >= 0").optional(),
  experience: z.coerce.number().min(0, "Experience must be >= 0").optional(),
  bio: z.string().optional(),
  availableDays: z.string().optional(),
  availableHours: z.string().optional(),
});

export function DoctorProfile() {
  const { data: profile, isLoading } = useGetDoctorProfile();
  const updateProfile = useUpdateDoctorProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof doctorProfileSchema>>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      specialty: "General Physician",
      qualification: "",
      licenseNumber: "",
      clinicName: "",
      clinicAddress: "",
      consultationFee: 0,
      experience: 0,
      bio: "",
      availableDays: "",
      availableHours: "",
    },
  });

  useEffect(() => {
    if (profile) {
      const normalizedSpec = DOCTOR_SPECIALTIES.find(s => 
        s.toLowerCase() === (profile.specialty || "").toLowerCase() ||
        (profile.specialty || "").toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes((profile.specialty || "").toLowerCase())
      ) || profile.specialty || "General Physician";

      form.reset({
        specialty: normalizedSpec,
        qualification: profile.qualification ?? "",
        licenseNumber: profile.licenseNumber ?? "",
        clinicName: profile.clinicName ?? "",
        clinicAddress: profile.clinicAddress ?? "",
        consultationFee: profile.consultationFee ?? 0,
        experience: profile.experience ?? 0,
        bio: profile.bio ?? "",
        availableDays: profile.availableDays ?? "",
        availableHours: profile.availableHours ?? "",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: z.infer<typeof doctorProfileSchema>) => {
    updateProfile.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Profile Saved",
            description: "Doctor profile settings updated successfully.",
          });
          queryClient.invalidateQueries({ queryKey: getGetDoctorProfileQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Failed to Save Profile",
            description: err instanceof Error ? err.message : "Error saving profile",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading doctor profile...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Profile & Settings</h1>
          <p className="text-slate-500 mt-1">Manage your medical qualifications, clinic information, and consultation availability.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Professional Info */}
            <Card>
              <CardHeader className="bg-slate-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Professional Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Specialty *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {DOCTOR_SPECIALTIES.map((spec) => (
                              <option key={spec} value={spec}>
                                {spec}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qualification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qualifications</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MBBS, MD (Internal Medicine)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical License Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MED-89410-IN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experience (Years)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="consultationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consultation Fee ($)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor Bio / Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of your clinical expertise and practice philosophy..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Clinic & Availability */}
            <Card>
              <CardHeader className="bg-slate-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Clinic Information & Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clinicName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic / Hospital Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Arogya Health Clinic" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clinicAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 123 Healthcare Ave, Suite 400" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="availableDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Days</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Monday - Friday" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="availableHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Hours</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 09:00 AM - 05:00 PM" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" className="gap-2 min-w-[180px]" disabled={updateProfile.isPending}>
                <Save className="h-4 w-4" />
                {updateProfile.isPending ? "Saving Profile..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
