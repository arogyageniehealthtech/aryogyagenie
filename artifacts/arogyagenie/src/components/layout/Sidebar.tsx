import { useUser, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import {
  LogOut, Home, User, Calendar, Activity, Pill, Clock,
  Stethoscope, Clipboard, FileText, Settings, TestTube,
  Users, LineChart, Building, Building2, Shield, MapPin, type LucideIcon
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "AG";
}

function getRoleLabel(role?: string | null): string {
  if (!role) return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className = "" }: SidebarProps = {}) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: user } = useGetMe();

  if (!user) return null;

  const role = user.role;
  type NavItem = { href: string; label: string; icon: LucideIcon };
  let navItems: NavItem[] = [];

  if (role === "patient") {
    navItems = [
      { href: "/patient/dashboard",          label: "Dashboard",       icon: Home },
      { href: "/patient/appointments",        label: "Appointments",    icon: Calendar },
      { href: "/patient/doctors",             label: "Find Doctors",    icon: Stethoscope },
      { href: "/patient/hospitals",           label: "Hospital",        icon: Building2 },
      { href: "/patient/nearby",              label: "Nearest Care Map", icon: MapPin },
      { href: "/patient/prescriptions",       label: "Prescriptions",   icon: Clipboard },
      { href: "/patient/lab-reports",         label: "Lab Reports",     icon: FileText },
      { href: "/patient/diagnostic-bookings", label: "Tests & Diagnostics", icon: TestTube },
      { href: "/patient/medicine-reminders",  label: "Medicines",       icon: Pill },
      { href: "/patient/timeline",            label: "Health Timeline", icon: Clock },
      { href: "/patient/symptom-check",       label: "Symptom Checker", icon: Activity },
      { href: "/patient/profile",             label: "Profile",         icon: User },
    ];
  } else if (role === "doctor") {
    navItems = [
      { href: "/doctor/dashboard",    label: "Dashboard",    icon: Home },
      { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
      { href: "/doctor/patients",     label: "My Patients",  icon: Users },
      { href: "/doctor/prescriptions",label: "Prescriptions",icon: Clipboard },
      { href: "/doctor/profile",      label: "Profile",      icon: User },
    ];
  } else if (role === "diagnostic_center") {
    navItems = [
      { href: "/diagnostic/dashboard", label: "Dashboard",   icon: Home },
      { href: "/diagnostic/bookings",  label: "Bookings",    icon: Calendar },
      { href: "/diagnostic/reports",   label: "Lab Reports", icon: FileText },
      { href: "/diagnostic/profile",   label: "Profile",     icon: User },
    ];
  } else if (role === "pharmacy") {
    navItems = [
      { href: "/pharmacy/dashboard",     label: "Dashboard",    icon: Home },
      { href: "/pharmacy/prescriptions", label: "Prescriptions",icon: Clipboard },
      { href: "/pharmacy/profile",       label: "Profile",      icon: User },
    ];
  } else if (role === "admin") {
    navItems = [
      { href: "/admin/dashboard",              label: "Dashboard",         icon: LineChart },
      { href: "/admin/pending-applications",   label: "Pending Applications", icon: Clock },
      { href: "/admin/users",                  label: "Users",             icon: Users },
      { href: "/admin/patients",               label: "Patients",          icon: User },
      { href: "/admin/doctors",                label: "Doctors",           icon: Stethoscope },
      { href: "/admin/diagnostic-centers",     label: "Diagnostic Labs",   icon: Building },
      { href: "/admin/pharmacies",             label: "Pharmacies",        icon: Pill },
      { href: "/admin/appointments",           label: "Appointments",      icon: Calendar },
      { href: "/admin/settings",               label: "System Settings",   icon: Shield },
    ];
  }

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const displayName =
    user.displayName ||
    ((role === "patient" || role === "doctor")
      ? (user.firstName?.trim() || user.email?.split("@")[0])
      : (user.name || user.firstName || user.email?.split("@")[0]));

  const initials = getInitials(displayName, user.email);

  return (
    <div
      className={`w-64 flex flex-col h-full shrink-0 overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(180deg, #18103A 0%, #120A2D 50%, #0E0724 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo Area */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md bg-white p-2"
        >
          <img
            src={`${basePath}/logo.png`}
            alt="ArogyaGenie"
            className="h-6 w-6 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div>
          <span
            className="font-extrabold text-lg tracking-tight"
            style={{ color: "rgba(255,255,255,0.97)" }}
          >
            ArogyaGenie
          </span>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-violet-300/60">
            Health Portal
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3" style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

      {/* Nav label */}
      <p className="px-5 mb-2 text-[10px] font-semibold tracking-widest uppercase text-violet-200/40">
        Navigation
      </p>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, #6C63FF 0%, #5247E6 100%)",
                      color: "#FFFFFF",
                      boxShadow: "0 4px 14px rgba(108, 99, 255, 0.4)",
                    }
                  : {
                      color: "rgba(255,255,255,0.65)",
                      background: "transparent",
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
                }
              }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {isActive && (
                <div
                  className="ml-auto h-2 w-2 rounded-full bg-white shadow-xs"
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom: User Info + Logout */}
      <div className="mt-auto">
        {/* Divider */}
        <div className="mx-4 mb-3" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

        {/* User Card */}
        {user && (
          <div className="mx-3 mb-2 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(238,65%,58%), hsl(207,90%,58%))", color: "white" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {displayName}
                </p>
                <p
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: "rgba(255,255,255,0.38)" }}
                >
                  {getRoleLabel(role)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all duration-200"
            style={{ background: "#EF4444", color: "#FFFFFF" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#FFFFFF";
              (e.currentTarget as HTMLElement).style.color = "#EF4444";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#EF4444";
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
            }}
          >
            <LogOut className="h-4 w-4 shrink-0 transition-colors" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
