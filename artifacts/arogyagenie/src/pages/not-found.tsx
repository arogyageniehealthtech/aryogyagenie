import { Link } from "wouter";
import { ArrowLeft, Home, Stethoscope, Activity, MapPin, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={`${basePath}/logo.png`} alt="ArogyaGenie Logo" className="h-8 w-8 object-contain" />
              <span className="font-bold text-xl text-primary">ArogyaGenie</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-16">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-primary shadow-inner">
              <span className="text-4xl sm:text-5xl font-black">404</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-red-100 text-red-600 p-2 rounded-full border-2 border-white">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
              The healthcare resource or page you are looking for might have been moved, renamed, or is temporarily unavailable.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/">
              <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white gap-2 rounded-full px-6">
                <Home className="h-4 w-4" /> Return to Home
              </Button>
            </Link>
            <Link href="/patient/doctors">
              <Button variant="outline" className="w-full sm:w-auto gap-2 rounded-full px-6 border-slate-300">
                <Stethoscope className="h-4 w-4 text-primary" /> Find Doctors
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="ghost" className="w-full sm:w-auto gap-2 rounded-full px-5 text-slate-600">
                Contact Support
              </Button>
            </Link>
          </div>

          {/* Helpful Links Grid */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-3 text-left">
            <Link href="/sign-in">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition cursor-pointer group">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-primary">
                  <Activity className="h-4 w-4 text-primary" /> Patient Portal
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Access appointments, prescriptions & EHR records</p>
              </div>
            </Link>
            <Link href="/patient/nearby">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition cursor-pointer group">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 group-hover:text-primary">
                  <MapPin className="h-4 w-4 text-emerald-600" /> Nearby Care Map
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Discover verified clinics, pharmacies & labs</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} ArogyaGenie. Need immediate medical assistance? Call National Helpline 112 / Ambulance 108.
      </footer>
    </div>
  );
}
