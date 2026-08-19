import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { FloatingHealthAssistant } from "../health/FloatingHealthAssistant";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const roleLabel = user?.role
    ? user.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  const displayName =
    user?.displayName ||
    (user?.role === "patient" || user?.role === "doctor"
      ? user?.firstName?.trim() || user?.email?.split("@")[0]
      : user?.name || user?.firstName || user?.email?.split("@")[0]) ||
    "User";

  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background relative flex-col lg:flex-row">
      {/* ── Desktop Permanent Sidebar (lg+) ───────────────────────────────── */}
      <div className="hidden lg:flex shrink-0 h-full">
        <Sidebar />
      </div>

      {/* ── Mobile Top Header Bar (< lg) ──────────────────────────────────── */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 sm:px-5 py-3 text-white shrink-0 shadow-sm border-b border-white/10"
        style={{
          background: "linear-gradient(135deg, #18103A 0%, #120A2D 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="h-9 w-9 text-violet-200 hover:text-white hover:bg-white/10 rounded-xl"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src={`${basePath}/logo.png`}
                alt="ArogyaGenie"
                className="h-5 w-5 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white block leading-tight">
                ArogyaGenie
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-violet-300/70 block leading-tight">
                {roleLabel || "Portal"}
              </span>
            </div>
          </div>
        </div>

        {/* User Mini Badge on Mobile Header */}
        {user && (
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs"
              style={{
                background: "linear-gradient(135deg, hsl(238,65%,58%), hsl(207,90%,58%))",
              }}
            >
              {userInitial}
            </div>
          </div>
        )}
      </header>

      {/* ── Mobile Slide-Out Drawer & Backdrop (< lg) ──────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setMobileMenuOpen(false)} className="w-full" />
      </div>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-background flex flex-col">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-1">
          {children}
        </div>
      </main>

      {/* Floating Health Assistant for Patients */}
      {user?.role === "patient" && <FloatingHealthAssistant />}
    </div>
  );
}
