import { useEffect, useRef } from "react";
import { useClerk, useUser, useAuth, ClerkProvider, Show } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { SignInPage, SignUpPage } from "./pages/Auth";
import { Onboarding } from "./pages/Onboarding";
import { useGetMe, setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

// Dashboard Layout
import { DashboardLayout } from "./components/layout/DashboardLayout";

// Landing
import { Landing } from "./pages/Landing";

// Patient Pages
import { PatientDashboard } from "./pages/patient/Dashboard";
import { PatientAppointments } from "./pages/patient/Appointments";
import { PatientDoctors } from "./pages/patient/Doctors";
import { PatientPrescriptions } from "./pages/patient/Prescriptions";
import { PatientLabReports } from "./pages/patient/LabReports";
import { PatientDiagnosticBookings } from "./pages/patient/DiagnosticBookings";
import { PatientMedicineReminders } from "./pages/patient/MedicineReminders";
import { PatientTimeline } from "./pages/patient/Timeline";
import { PatientSymptomCheck } from "./pages/patient/SymptomCheck";
import { PatientProfile } from "./pages/patient/Profile";

// Doctor Pages
import { DoctorDashboard } from "./pages/doctor/Dashboard";
import { DoctorAppointments } from "./pages/doctor/Appointments";
import { DoctorPatients } from "./pages/doctor/Patients";
import { DoctorPrescriptions } from "./pages/doctor/Prescriptions";
import { DoctorProfile } from "./pages/doctor/Profile";

// Diagnostic Center Pages
import { DiagnosticDashboard } from "./pages/diagnostic/Dashboard";
import { DiagnosticBookingsPage } from "./pages/diagnostic/Bookings";
import { DiagnosticReportsPage } from "./pages/diagnostic/Reports";
import { DiagnosticProfile } from "./pages/diagnostic/Profile";

// Pharmacy Pages
import { PharmacyDashboard } from "./pages/pharmacy/Dashboard";
import { PharmacyPrescriptionsPage } from "./pages/pharmacy/Prescriptions";
import { PharmacyProfile } from "./pages/pharmacy/Profile";

// Admin Pages
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminUsersPage } from "./pages/admin/Users";
import { AdminPatientsPage } from "./pages/admin/Patients";
import { AdminDoctorsPage } from "./pages/admin/Doctors";
import { AdminDiagnosticCentersPage } from "./pages/admin/DiagnosticCenters";
import { AdminPharmaciesPage } from "./pages/admin/Pharmacies";
import { AdminAppointmentsPage } from "./pages/admin/Appointments";
import { AdminSettingsPage } from "./pages/admin/Settings";

// Provider Status & Admin Applications
import { ProviderStatusPage } from "./pages/provider/ProviderStatusPage";
import { AdminPendingApplicationsPage } from "./pages/admin/PendingApplications";

const queryClient = new QueryClient();

const clerkPubKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  publishableKeyFromHost(window.location.hostname);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#3B3FBF",
    colorForeground: "#1a1a2e",
    colorMutedForeground: "#64748b",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f8faff",
    colorInputForeground: "#1a1a2e",
    colorNeutral: "#e2e8f0",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-blue-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#1a1a2e] font-bold",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButtonText: "text-[#1a1a2e]",
    formFieldLabel: "text-[#1a1a2e] font-medium",
    footerActionLink: "text-[#3B3FBF] hover:text-[#1A237E]",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-[#3B3FBF]",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border border-slate-200 hover:border-blue-300",
    formButtonPrimary: "bg-[#3B3FBF] hover:bg-[#1A237E] text-white",
    formFieldInput: "border-slate-200 bg-[#f8faff] text-[#1a1a2e] focus:border-[#3B3FBF]",
    footerAction: "bg-slate-50 border-t border-slate-100",
    dividerLine: "bg-slate-200",
    alert: "text-red-600",
    otpCodeFieldInput: "border-slate-200",
    formFieldRow: "space-y-4",
    main: "p-6",
  },
};

function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function getDashboardPath(role?: string | null, status?: string | null): string {
  if (!role) return "/onboarding";
  if (role === "admin") return "/admin/dashboard";
  const providerRoles = ["doctor", "diagnostic_center", "pharmacy"];
  if (providerRoles.includes(role) && status !== "active") {
    return "/provider-status";
  }
  if (role === "diagnostic_center") return "/diagnostic/dashboard";
  return `/${role}/dashboard`;
}

function RoleRouter() {
  const { data: user, isLoading } = useGetMe();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user || !user.role) {
        setLocation("/onboarding");
      } else {
        setLocation(getDashboardPath(user.role, user.status));
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <div className="min-h-screen flex items-center justify-center">Redirecting...</div>;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <RoleRouter />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  const { data: user, isLoading } = useGetMe();
  const providerRoles = ["doctor", "diagnostic_center", "pharmacy"];

  return (
    <>
      <Show when="signed-in">
        {isLoading ? (
          <div className="min-h-screen flex items-center justify-center">Loading...</div>
        ) : !user?.role ? (
          <Redirect to="/onboarding" />
        ) : (providerRoles.includes(user.role) && user.status !== "active") ? (
          <Redirect to="/provider-status" />
        ) : (allowedRoles && !allowedRoles.includes(user.role)) ? (
          <Redirect to="/" />
        ) : (
          <Component />
        )}
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkTokenBridge />
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/onboarding">
              <Show when="signed-in">
                <Onboarding />
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/provider-status">
              <Show when="signed-in">
                <ProviderStatusPage />
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            {/* Patient Routes */}
            <Route path="/patient/dashboard">
              <ProtectedRoute component={PatientDashboard} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/appointments">
              <ProtectedRoute component={PatientAppointments} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/doctors">
              <ProtectedRoute component={PatientDoctors} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/prescriptions">
              <ProtectedRoute component={PatientPrescriptions} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/lab-reports">
              <ProtectedRoute component={PatientLabReports} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/diagnostic-bookings">
              <ProtectedRoute component={PatientDiagnosticBookings} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/medicine-reminders">
              <ProtectedRoute component={PatientMedicineReminders} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/timeline">
              <ProtectedRoute component={PatientTimeline} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/symptom-check">
              <ProtectedRoute component={PatientSymptomCheck} allowedRoles={["patient"]} />
            </Route>
            <Route path="/patient/profile">
              <ProtectedRoute component={PatientProfile} allowedRoles={["patient"]} />
            </Route>

            {/* Doctor Routes */}
            <Route path="/doctor/dashboard">
              <ProtectedRoute component={DoctorDashboard} allowedRoles={["doctor"]} />
            </Route>
            <Route path="/doctor/appointments">
              <ProtectedRoute component={DoctorAppointments} allowedRoles={["doctor"]} />
            </Route>
            <Route path="/doctor/patients">
              <ProtectedRoute component={DoctorPatients} allowedRoles={["doctor"]} />
            </Route>
            <Route path="/doctor/prescriptions">
              <ProtectedRoute component={DoctorPrescriptions} allowedRoles={["doctor"]} />
            </Route>
            <Route path="/doctor/profile">
              <ProtectedRoute component={DoctorProfile} allowedRoles={["doctor"]} />
            </Route>

            {/* Diagnostic Center Routes */}
            <Route path="/diagnostic/dashboard">
              <ProtectedRoute component={DiagnosticDashboard} allowedRoles={["diagnostic_center"]} />
            </Route>
            <Route path="/diagnostic/bookings">
              <ProtectedRoute component={DiagnosticBookingsPage} allowedRoles={["diagnostic_center"]} />
            </Route>
            <Route path="/diagnostic/reports">
              <ProtectedRoute component={DiagnosticReportsPage} allowedRoles={["diagnostic_center"]} />
            </Route>
            <Route path="/diagnostic/profile">
              <ProtectedRoute component={DiagnosticProfile} allowedRoles={["diagnostic_center"]} />
            </Route>

            {/* Pharmacy Routes */}
            <Route path="/pharmacy/dashboard">
              <ProtectedRoute component={PharmacyDashboard} allowedRoles={["pharmacy"]} />
            </Route>
            <Route path="/pharmacy/prescriptions">
              <ProtectedRoute component={PharmacyPrescriptionsPage} allowedRoles={["pharmacy"]} />
            </Route>
            <Route path="/pharmacy/profile">
              <ProtectedRoute component={PharmacyProfile} allowedRoles={["pharmacy"]} />
            </Route>
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard">
              <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/pending-applications">
              <ProtectedRoute component={AdminPendingApplicationsPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/users">
              <ProtectedRoute component={AdminUsersPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/patients">
              <ProtectedRoute component={AdminPatientsPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/doctors">
              <ProtectedRoute component={AdminDoctorsPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/diagnostic-centers">
              <ProtectedRoute component={AdminDiagnosticCentersPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/pharmacies">
              <ProtectedRoute component={AdminPharmaciesPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/appointments">
              <ProtectedRoute component={AdminAppointmentsPage} allowedRoles={["admin"]} />
            </Route>
            <Route path="/admin/settings">
              <ProtectedRoute component={AdminSettingsPage} allowedRoles={["admin"]} />
            </Route>

            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
