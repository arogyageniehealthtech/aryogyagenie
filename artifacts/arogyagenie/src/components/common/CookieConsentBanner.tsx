import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "arogyagenie_cookie_consent_v1";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        timer = setTimeout(() => setIsVisible(true), 1200);
      }
    } catch {
      // Ignore localStorage access errors
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {}
    setIsVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "essential_only");
    } catch {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Privacy and Cookie Notice"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-2xl border border-slate-700/80 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-2 flex-1 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-white">Health Privacy & Essential Cookies</h4>
            <button
              onClick={handleDecline}
              className="text-slate-400 hover:text-white p-1 -mr-1 rounded-lg"
              aria-label="Dismiss cookie banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p>
            We use strictly essential cookies to securely authenticate sessions and manage your health records. We never sell your medical data or track you with third-party advertising cookies.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleAccept}
              className="bg-primary hover:bg-primary/90 text-white rounded-lg text-xs h-8 px-4 font-semibold"
            >
              Accept All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg text-xs h-8 px-3"
            >
              Essential Only
            </Button>
            <Link href="/privacy" className="text-xs text-blue-400 hover:underline ml-auto">
              Read Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
export default CookieConsentBanner;
