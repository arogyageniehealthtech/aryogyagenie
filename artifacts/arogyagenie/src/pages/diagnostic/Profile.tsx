import { useEffect } from "react";
import { useGetDiagnosticCenterProfile, useUpdateDiagnosticCenterProfile, getGetDiagnosticCenterProfileQueryKey } from "@workspace/api-client-react";
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
import { Building, Award, Phone, MapPin, Clock, Save } from "lucide-react";

const diagnosticProfileSchema = z.object({
  name: z.string().min(2, "Center name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  accreditation: z.string().optional(),
  services: z.string().optional(),
  openingHours: z.string().optional(),
});

export function DiagnosticProfile() {
  const { data: profile, isLoading } = useGetDiagnosticCenterProfile();
  const updateProfile = useUpdateDiagnosticCenterProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof diagnosticProfileSchema>>({
    resolver: zodResolver(diagnosticProfileSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      city: "",
      accreditation: "",
      services: "",
      openingHours: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        city: profile.city ?? "",
        accreditation: profile.accreditation ?? "",
        services: profile.services ?? "",
        openingHours: profile.openingHours ?? "",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: z.infer<typeof diagnosticProfileSchema>) => {
    updateProfile.mutate(
      { data },
      {
        onSuccess: () => {
          toast({
            title: "Profile Updated",
            description: "Diagnostic center profile settings saved successfully.",
          });
          queryClient.invalidateQueries({ queryKey: getGetDiagnosticCenterProfileQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Save Failed",
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
        <div className="flex h-full items-center justify-center py-20 text-slate-500">Loading center profile...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Diagnostic Center Profile</h1>
          <p className="text-slate-500 mt-1">Manage accreditation, test catalog services, contact information, and operating hours.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader className="bg-slate-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Center Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diagnostic Center Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Apex Diagnostics Lab" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. +1 800 555 0199" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 500 Lab Center Blvd" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. San Francisco" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accreditation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accreditation / Certification</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. CAP Accredited, ISO 15189" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="openingHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Hours</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Mon-Sat: 07:00 AM - 08:00 PM" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="services"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Services Offered / Test Catalog Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Blood Tests, Lipid Panels, MRI, X-Ray, CT Scan, Pathology, Ultrasound..."
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

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" className="gap-2 min-w-[180px]" disabled={updateProfile.isPending}>
                <Save className="h-4 w-4" />
                {updateProfile.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
