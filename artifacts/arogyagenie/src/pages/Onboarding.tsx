import { useGetMe, customFetch, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  User, Stethoscope, TestTube, Pill, CheckCircle2, Clock,
  MapPin, Loader2, Navigation,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DOCTOR_SPECIALTIES } from "@/lib/specialties";

const SPECIALTIES = DOCTOR_SPECIALTIES;

const onboardingSchema = z.object({
  role: z.enum(["patient", "doctor", "diagnostic_center", "pharmacy"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().min(5, "Phone number is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  specialty: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

import { detectAddressCoordinates } from "@/lib/geocode";

// ─── AddressWithGeocode Component ────────────────────────────────────────────
interface AddressWithGeocodeProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  onCoordsDetected: (lat: number, lng: number) => void;
  label?: string;
}

function AddressWithGeocode({
  value,
  onChange,
  placeholder,
  onCoordsDetected,
  label = "Address *",
}: AddressWithGeocodeProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<
    { type: "success"; text: string } | { type: "error"; text: string } | null
  >(null);

  const handleGeocode = useCallback(async () => {
    if (!value.trim()) {
      setGeocodeStatus({ type: "error", text: "Please enter an address first." });
      return;
    }
    setGeocoding(true);
    setGeocodeStatus(null);
    try {
      const result = await detectAddressCoordinates(value.trim());
      if (!result) {
        setGeocodeStatus({
          type: "error",
          text: "Address not found. Try adding more detail (e.g. locality, city).",
        });
      } else {
        onCoordsDetected(result.lat, result.lng);
        setGeocodeStatus({
          type: "success",
          text: `📍 Located: ${result.displayName} (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`,
        });
      }
    } catch {
      setGeocodeStatus({ type: "error", text: "Geocoding failed. Please try again." });
    } finally {
      setGeocoding(false);
    }
  }, [value, onCoordsDetected]);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setGeocodeStatus(null);
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGeocode}
          disabled={geocoding || !value.trim()}
          className="shrink-0 gap-1.5 h-10 px-3 border-violet-200 text-violet-700 hover:bg-violet-50"
          title="Auto-detect coordinates from address using OpenStreetMap (free)"
        >
          {geocoding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Navigation className="h-3.5 w-3.5" />
          )}
          {geocoding ? "Locating…" : "Detect"}
        </Button>
      </div>
      {geocodeStatus && (
        <p
          className={`text-xs flex items-start gap-1 mt-1 ${
            geocodeStatus.type === "success" ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {geocodeStatus.type === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" />
          ) : (
            <MapPin className="h-3.5 w-3.5 mt-px shrink-0" />
          )}
          {geocodeStatus.text}
        </p>
      )}
      {!geocodeStatus && value.trim() && (
        <p className="text-xs text-slate-400">
          Click <strong>Detect</strong> to auto-locate this address on the map (free, no key needed).
        </p>
      )}
    </div>
  );
}

// ─── Onboarding Page ──────────────────────────────────────────────────────────
export function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading } = useGetMe();
  const queryClient = useQueryClient();

  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Geocoded coordinates — stored separately, not in form schema
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      role: "patient",
      firstName: "",
      lastName: "",
      name: "",
      phone: "",
      email: "",
      specialty: "General Physician",
      address: "",
      dateOfBirth: "",
      gender: "",
    },
  });

  const selectedRole = form.watch("role");
  const addressValue = form.watch("address") ?? "";

  // Reset coords when role changes
  useEffect(() => {
    setCoords(null);
  }, [selectedRole]);

  const getDashboardPath = (role?: string | null, status?: string | null): string => {
    if (!role) return "/onboarding";
    if (role === "admin") return "/admin/dashboard";
    if (status && status !== "active") return "/provider-status";
    if (role === "diagnostic_center") return "/diagnostic/dashboard";
    return `/${role}/dashboard`;
  };

  useEffect(() => {
    if (user?.role) {
      setLocation(getDashboardPath(user.role, user.status));
    }
    if (user?.email && !form.getValues("email")) {
      form.setValue("email", user.email);
    }
  }, [user, setLocation, form]);

  if (isLoading || (user?.role && !submittedMessage)) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading profile setup...</div>;
  }

  const onSubmit = async (data: z.infer<typeof onboardingSchema>) => {
    setIsSubmitting(true);
    try {
      if (data.role === "patient") {
        const updatedUser = await customFetch<any>("/api/users/me/onboard", {
          method: "POST",
          body: JSON.stringify({
            role: "patient",
            firstName: data.firstName || "Patient",
            lastName: data.lastName || "",
            phone: data.phone,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
          }),
        });
        queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/patient/dashboard");
      } else {
        const appType =
          data.role === "doctor"
            ? "DOCTOR"
            : data.role === "diagnostic_center"
            ? "DIAGNOSTIC_CENTER"
            : "PHARMACY";

        const payload: Record<string, any> = {
          type: appType,
          firstName: data.firstName,
          lastName: data.lastName,
          name:
            data.name ||
            (data.firstName && data.lastName
              ? `${data.firstName} ${data.lastName}`
              : undefined),
          phone: data.phone,
          email: data.email || user?.email,
          specialty: data.specialty,
          address: data.address,
          // Attach geocoded coordinates if the provider clicked "Detect"
          ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
        };

        const responseData = await customFetch<any>("/api/provider-applications", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setSubmittedMessage(
          responseData?.message ||
            "Application submitted successfully. Our team will review your details and contact you shortly. Portal access will be provided after approval."
        );
      }
    } catch (err: any) {
      toast({
        title: "Registration Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl bg-card rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
        <div className="bg-primary p-6 sm:p-8 text-white text-center">
          <img
            src={`${basePath}/logo.png`}
            alt="ArogyaGenie Logo"
            className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 bg-white rounded-full p-2"
          />
          <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Welcome to ArogyaGenie</h1>
          <p className="text-xs sm:text-sm text-primary-foreground/80">Select your role to register your account.</p>
        </div>

        <div className="p-4 sm:p-8">
          {submittedMessage ? (
            <div className="py-8 px-2 sm:px-4 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
                <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Application Submitted</h3>
                <p className="text-slate-600 max-w-md mx-auto leading-relaxed">{submittedMessage}</p>
                {coords && (
                  <p className="text-xs text-emerald-600 flex items-center justify-center gap-1 mt-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Location registered — you will appear on the patient map after approval.
                  </p>
                )}
              </div>
              <div className="pt-4">
                <Button
                  className="bg-primary text-white px-8 h-11 w-full sm:w-auto"
                  onClick={() => setLocation("/provider-status")}
                >
                  View Application Status
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
                {/* Role selector */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-base font-semibold">I am joining as a...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
                        >
                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="patient" className="peer sr-only" />
                            </FormControl>
                            <FormLabel className="flex flex-col items-center justify-center p-4 sm:p-6 border-2 rounded-xl cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-blue-50/50 transition-all">
                              <User className="h-7 w-7 sm:h-8 sm:w-8 mb-2 text-slate-500 peer-data-[state=checked]:text-primary" />
                              <span className="font-semibold text-foreground text-sm sm:text-base">Patient</span>
                            </FormLabel>
                          </FormItem>

                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="doctor" className="peer sr-only" />
                            </FormControl>
                            <FormLabel className="flex flex-col items-center justify-center p-4 sm:p-6 border-2 rounded-xl cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-blue-50/50 transition-all">
                              <Stethoscope className="h-7 w-7 sm:h-8 sm:w-8 mb-2 text-slate-500 peer-data-[state=checked]:text-primary" />
                              <span className="font-semibold text-foreground text-sm sm:text-base">Doctor</span>
                            </FormLabel>
                          </FormItem>

                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="diagnostic_center" className="peer sr-only" />
                            </FormControl>
                            <FormLabel className="flex flex-col items-center justify-center p-4 sm:p-6 border-2 rounded-xl cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-blue-50/50 transition-all">
                              <TestTube className="h-7 w-7 sm:h-8 sm:w-8 mb-2 text-slate-500 peer-data-[state=checked]:text-primary" />
                              <span className="font-semibold text-foreground text-sm sm:text-base text-center">Diagnostic Center</span>
                            </FormLabel>
                          </FormItem>

                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="pharmacy" className="peer sr-only" />
                            </FormControl>
                            <FormLabel className="flex flex-col items-center justify-center p-4 sm:p-6 border-2 rounded-xl cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-blue-50/50 transition-all">
                              <Pill className="h-7 w-7 sm:h-8 sm:w-8 mb-2 text-slate-500 peer-data-[state=checked]:text-primary" />
                              <span className="font-semibold text-foreground text-sm sm:text-base">Pharmacy</span>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* DOCTOR REGISTRATION FORM */}
                {selectedRole === "doctor" && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Join as Doctor</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Dr. Rajesh" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Sharma" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone *</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 9876543210" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="doctor@clinic.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialty *</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {SPECIALTIES.map((spec) => (
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

                    {/* Clinic address with Nominatim geocoding */}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressWithGeocode
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="123 Clinic Road, Salt Lake, Kolkata"
                              label="Clinic Address (for patient map)"
                              onCoordsDetected={(lat, lng) => setCoords({ lat, lng })}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* DIAGNOSTIC CENTER REGISTRATION FORM */}
                {selectedRole === "diagnostic_center" && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Register Diagnostic Center</h3>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Center Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Apollo Diagnostics Center" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Address with geocoding */}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressWithGeocode
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="123 Health Ave, MG Road, Bengaluru"
                              label="Center Address (for patient map)"
                              onCoordsDetected={(lat, lng) => setCoords({ lat, lng })}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone *</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 9876543210" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="contact@apollodiagnostics.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* PHARMACY REGISTRATION FORM */}
                {selectedRole === "pharmacy" && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Register Pharmacy</h3>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pharmacy Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="MedPlus Pharmacy" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Address with geocoding */}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressWithGeocode
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="45 Station Road, Mumbai"
                              label="Pharmacy Address (for patient map)"
                              onCoordsDetected={(lat, lng) => setCoords({ lat, lng })}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone *</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 9876543210" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="info@medplus.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* PATIENT REGISTRATION FORM */}
                {selectedRole === "patient" && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Patient Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 9876543210" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Provider geocode status banner */}
                {selectedRole !== "patient" && !coords && addressValue.trim() && (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    Click <strong className="mx-0.5">Detect</strong> next to your address to register on the patient map.
                  </p>
                )}
                {selectedRole !== "patient" && coords && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Location detected ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}) — you will appear on the patient map after approval.
                  </p>
                )}

                <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : selectedRole === "patient" ? (
                    "Complete Patient Setup"
                  ) : (
                    "Submit Application for Approval"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
