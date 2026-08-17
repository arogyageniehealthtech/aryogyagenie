import { useState, useEffect, useRef } from "react";
import { Bot, Sparkles, X } from "lucide-react";
import { HealthAssistantChat } from "./HealthAssistantChat";

export function FloatingHealthAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* ── Floating Chat Panel ───────────────────────────────────────────── */}
      {isOpen && (
        <div
          ref={containerRef}
          role="dialog"
          aria-label="AI Health Assistant Chat"
          className="fixed bottom-20 sm:bottom-22 right-3 sm:right-6 z-50 w-[420px] max-w-[calc(100vw-1.5rem)] h-[580px] max-h-[calc(100vh-6.5rem)] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{
            boxShadow: "0 20px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          <HealthAssistantChat
            className="h-full w-full border-0 shadow-none rounded-3xl"
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      {/* ── Floating Trigger Button ───────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close AI Health Assistant" : "Open AI Health Assistant"}
          aria-expanded={isOpen}
          className={`group relative flex items-center gap-2.5 rounded-full px-4 py-3 sm:px-5 sm:py-3.5 text-white font-bold text-sm shadow-xl transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-95 ${
            isOpen
              ? "bg-slate-900 hover:bg-slate-800 shadow-slate-900/30"
              : "bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-700 shadow-primary/35 hover:shadow-2xl hover:scale-105"
          }`}
        >
          {isOpen ? (
            <>
              <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
              <span className="hidden sm:inline text-xs font-semibold">Close Assistant</span>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Bot className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              </div>
              <span className="tracking-tight text-xs sm:text-sm">AI Health Assistant</span>
              <Sparkles className="h-3.5 w-3.5 text-emerald-300 animate-pulse hidden sm:inline" />
            </>
          )}
        </button>
      </div>
    </>
  );
}
