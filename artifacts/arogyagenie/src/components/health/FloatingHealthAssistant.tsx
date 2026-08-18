import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, X, Activity, Bot } from "lucide-react";
import { HealthAssistantChat } from "./HealthAssistantChat";

export function FloatingHealthAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Close on Escape key press, and open on custom trigger event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-ai-assistant", handleOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-ai-assistant", handleOpen);
    };
  }, [isOpen]);

  return (
    <>
      {/* ── Floating Chat Panel (Emerges from Orb) ────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-label="AI Health Assistant"
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.86, y: 24, transformOrigin: "bottom right" }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.88, y: 20, transition: { duration: 0.18, ease: "easeOut" } }
            }
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 28,
              mass: 0.9,
            }}
            className="fixed bottom-20 sm:bottom-24 right-2 sm:right-6 z-50 w-[720px] max-w-[calc(100vw-1rem)] h-[640px] max-h-[calc(100vh-6.5rem)] bg-[#07091d] rounded-3xl overflow-hidden flex flex-col border border-indigo-500/30"
            style={{
              boxShadow:
                "0 30px 90px -15px rgba(59, 63, 191, 0.45), 0 10px 30px -10px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.25)",
            }}
          >
            {/* Top ambient accent beam */}
            <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 shrink-0" />
            
            <HealthAssistantChat
              className="h-full w-full border-0 shadow-none rounded-none"
              onClose={() => setIsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Health Orb & Floating Trigger ──────────────────────────────── */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3">
        {/* Hover Pill Tooltip (Desktop only) */}
        <AnimatePresence>
          {!isOpen && isHovered && (
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.92 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-semibold border border-indigo-400/30 shadow-xl pointer-events-none select-none"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>Ask your AI Health Assistant</span>
              <Sparkles className="h-3 w-3 text-cyan-300" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Living Health Orb / Close Control */}
        {isOpen ? (
          <motion.button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close AI Health Assistant"
            initial={{ scale: 0.8, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-900/95 hover:bg-slate-900 text-white flex items-center justify-center shadow-xl border border-slate-700/70 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6 text-slate-200" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={() => setIsOpen(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            aria-label="Open AI Health Assistant"
            aria-expanded={isOpen}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.94 }}
            className="group relative h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary/40 select-none"
          >
            {/* 1. Outer Ambient Aura / Breathing Glow */}
            {!shouldReduceMotion && (
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.35, 0.65, 0.35],
                }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -inset-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 blur-md -z-10 pointer-events-none"
              />
            )}

            {/* 2. Delicate Orbital Neural / Vital Ring */}
            <div className="absolute -inset-1 rounded-full pointer-events-none -z-5">
              <svg
                viewBox="0 0 100 100"
                className={`w-full h-full ${shouldReduceMotion ? "" : "animate-[spin_16s_linear_infinite]"}`}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="url(#orb-ring-gradient)"
                  strokeWidth="1.5"
                  strokeDasharray="4 8"
                  opacity="0.75"
                />
                <circle cx="50" cy="4" r="2" fill="#38bdf8" />
                <circle cx="85" cy="80" r="1.5" fill="#a855f7" />
                <defs>
                  <linearGradient id="orb-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* 3. Spherical Dimensional Core (The Orb) */}
            <div
              className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center border border-white/30"
              style={{
                background:
                  "radial-gradient(circle at 35% 28%, #818cf8 0%, #4f46e5 42%, #312e81 82%, #1e1b4b 100%)",
                boxShadow:
                  "inset 0 2px 4px rgba(255, 255, 255, 0.6), inset 0 -3px 8px rgba(0, 0, 0, 0.45), 0 10px 25px -4px rgba(79, 70, 229, 0.5)",
              }}
            >
              {/* Glass Top Arc Specular Highlight */}
              <div className="absolute top-1 inset-x-2.5 h-3.5 rounded-full bg-gradient-to-b from-white/60 to-transparent blur-[0.6px] pointer-events-none" />

              {/* 4. Center Visual: AI Sparkle + Living Medical Pulse */}
              <div className="relative flex items-center justify-center z-10 text-white">
                <div className="relative">
                  {/* Central AI Sparkle Icon */}
                  <Sparkles className="h-6 w-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] group-hover:rotate-12 transition-transform duration-300" />
                  
                  {/* Micro Health Pulse / Heartbeat Line Wave beneath */}
                  <div className="absolute -bottom-1.5 inset-x-[-4px] flex items-center justify-center opacity-90">
                    <svg viewBox="0 0 32 10" className="w-7 h-2 text-cyan-300 drop-shadow-[0_0_4px_#38bdf8]">
                      <path
                        d="M 0 5 L 8 5 L 11 1 L 14 9 L 17 3 L 20 6 L 23 5 L 32 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 5. Ambient Micro Particles inside Orb */}
              <div className="absolute top-2 right-2.5 w-1 h-1 rounded-full bg-cyan-300 blur-[0.3px] opacity-80" />
              <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-emerald-400 blur-[0.4px] opacity-70" />
            </div>

            {/* 6. Active Live Status Indicator Dot */}
            <span className="absolute top-0 right-0 flex h-3 w-3 z-20">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white shadow-xs" />
            </span>
          </motion.button>
        )}
      </div>
    </>
  );
}
