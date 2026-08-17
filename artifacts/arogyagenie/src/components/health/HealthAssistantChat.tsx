import { useState } from "react";
import { motion } from "framer-motion";
import {
  useAskHealthAssistant,
  useListSymptomAssessments,
  useGetMe,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  User,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  X,
  MessageSquareText,
  Activity,
  Lightbulb,
  HeartPulse,
  Phone,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Flame,
  Stethoscope,
  Building2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ChatMessage {
  id: string;
  sender: "patient" | "assistant";
  text: string;
  usedRag?: boolean;
  sources?: Array<{
    documentId?: string;
    title?: string;
    source?: string;
    publisher?: string;
    section?: string;
    page?: string;
  }>;
  retrieval?: {
    topK: number;
    resultsUsed: number;
  };
  disclaimer?: string;
  timestamp: string;
}

const HEALTH_FALLING_ELEMENTS = [
  { id: "pill-1", type: "pill", left: "10%", delay: 0, duration: 10, colorA: "#38bdf8", colorB: "#a855f7" },
  { id: "cross-1", type: "cross", left: "24%", delay: 2, duration: 13, color: "#818cf8" },
  { id: "sparkle-1", type: "sparkle", left: "38%", delay: 0.5, duration: 8, color: "#c084fc" },
  { id: "dna-1", type: "dna", left: "54%", delay: 3.5, duration: 14, color: "#34d399" },
  { id: "pulse-1", type: "pulse", left: "70%", delay: 1.2, duration: 11, color: "#f43f5e" },
  { id: "pill-2", type: "pill", left: "84%", delay: 4.5, duration: 9, colorA: "#c084fc", colorB: "#38bdf8" },
  { id: "sparkle-2", type: "sparkle", left: "16%", delay: 5.5, duration: 12, color: "#38bdf8" },
  { id: "cross-2", type: "cross", left: "46%", delay: 6.8, duration: 12, color: "#34d399" },
  { id: "sparkle-3", type: "sparkle", left: "64%", delay: 3.0, duration: 7, color: "#fbbf24" },
  { id: "pill-3", type: "pill", left: "30%", delay: 7.5, duration: 13, colorA: "#34d399", colorB: "#818cf8" },
  { id: "cross-3", type: "cross", left: "78%", delay: 2.8, duration: 11, color: "#38bdf8" },
  { id: "dna-2", type: "dna", left: "5%", delay: 6.0, duration: 15, color: "#a855f7" },
  { id: "sparkle-4", type: "sparkle", left: "92%", delay: 1.5, duration: 9, color: "#ffffff" },
];

function HealthcareFallingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none">
      <style>{`
        @keyframes healthFallAnim {
          0% {
            transform: translateY(-40px) translateX(0px) rotate(0deg);
            opacity: 0.3;
          }
          15% {
            opacity: 0.95;
          }
          50% {
            transform: translateY(280px) translateX(14px) rotate(180deg);
            opacity: 1;
          }
          85% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(620px) translateX(-10px) rotate(360deg);
            opacity: 0.2;
          }
        }
      `}</style>

      {/* Ambient background glow nebulas */}
      <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Shooting Star Arc & Star Cluster (Image 2 style) */}
      <div className="absolute top-2 right-4 sm:right-8 w-60 h-32 pointer-events-none opacity-95">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path
            d="M 10 90 Q 95 25 185 10"
            fill="none"
            stroke="url(#shooting-star-gradient)"
            strokeWidth="2.2"
            strokeDasharray="4 6"
          />
          <circle cx="185" cy="10" r="3.5" fill="#c084fc" className="animate-ping" />
          <circle cx="185" cy="10" r="2.5" fill="#ffffff" />
          <circle cx="140" cy="24" r="2.2" fill="#38bdf8" />
          <circle cx="75" cy="52" r="1.8" fill="#818cf8" />
          <defs>
            <linearGradient id="shooting-star-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="60%" stopColor="#818cf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating & Falling Healthcare Particles */}
      {HEALTH_FALLING_ELEMENTS.map((el) => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: el.left,
            top: 0,
            animation: `healthFallAnim ${el.duration}s linear infinite`,
            animationDelay: `${el.delay}s`,
            willChange: "transform, opacity",
          }}
        >
          {el.type === "pill" && (
            <svg viewBox="0 0 24 12" className="w-6 h-3 drop-shadow-[0_0_10px_rgba(56,189,248,1)]">
              <rect x="1" y="1" width="11" height="10" rx="5" fill={el.colorA} />
              <rect x="12" y="1" width="11" height="10" rx="5" fill={el.colorB} />
              <line x1="12" y1="1" x2="12" y2="11" stroke="#050716" strokeWidth="1" />
            </svg>
          )}

          {el.type === "cross" && (
            <svg viewBox="0 0 20 20" className="w-4 h-4 drop-shadow-[0_0_10px_rgba(129,140,248,1)]">
              <path
                d="M 7 2 L 13 2 L 13 7 L 18 7 L 18 13 L 13 13 L 13 18 L 7 18 L 7 13 L 2 13 L 2 7 L 7 7 Z"
                fill={el.color}
              />
            </svg>
          )}

          {el.type === "sparkle" && (
            <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_0_12px_rgba(192,132,252,1)]">
              <path
                d="M 12 0 Q 12 12 24 12 Q 12 12 12 24 Q 12 12 0 12 Q 12 12 12 0 Z"
                fill={el.color}
              />
            </svg>
          )}

          {el.type === "dna" && (
            <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_0_10px_rgba(52,211,153,1)]">
              <circle cx="6" cy="6" r="3.5" fill="#34d399" />
              <circle cx="18" cy="18" r="3.5" fill="#38bdf8" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="#818cf8" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
          )}

          {el.type === "pulse" && (
            <svg viewBox="0 0 28 14" className="w-7 h-3.5 drop-shadow-[0_0_10px_rgba(244,63,94,1)]">
              <path
                d="M 1 7 L 7 7 L 10 2 L 14 12 L 18 4 L 21 8 L 27 7"
                fill="none"
                stroke={el.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

const SAMPLE_PROMPTS = [
  "I have severe headaches and mild fever for 2 days.",
  "What does my low hemoglobin mean?",
  "What are common warning signs of iron-deficiency anemia?",
  "Did I ever face any health issue in my records?",
];

const QUICK_SYMPTOM_CATEGORIES = [
  { label: "Headache & Migraine", query: "I have a pulsating headache and sensitivity to light. What could be the causes?" },
  { label: "Fever & Chills", query: "I have a high fever with chills and body ache. What are the recommended next steps?" },
  { label: "Chest Discomfort", query: "I feel chest tightness and mild breathlessness. What should I check immediately?" },
  { label: "Cough & Throat", query: "I have a persistent dry cough and sore throat for 3 days." },
  { label: "Stomach Ache & Nausea", query: "I have sharp abdominal pain and nausea after eating." },
  { label: "Joint & Muscle Pain", query: "I have stiffness and pain in my knee joints in the morning." },
];

const HEALTH_TIPS = [
  {
    title: "Cardiovascular & Aerobic Fitness",
    category: "Vitals & Heart",
    desc: "Aim for 30 minutes of moderate aerobic activity 5 days a week to maintain endothelial flexibility and blood pressure regulation.",
    prompt: "What are the clinically proven benefits of 30-minute daily cardio on cardiovascular health?",
  },
  {
    title: "Hydration & Renal Filtration",
    category: "Kidney & Metabolism",
    desc: "Maintaining 2.5–3L of daily hydration optimizes glomerular filtration rate and prevents kidney stone formation.",
    prompt: "How does optimal daily water intake protect renal function and metabolic efficiency?",
  },
  {
    title: "Sleep Architecture & Immune Recovery",
    category: "Immunity & Brain",
    desc: "7–8 hours of consistent slow-wave sleep regulates natural killer cell activity and suppresses systemic inflammatory cytokines.",
    prompt: "Explain how deep restorative sleep strengthens immune resilience against infections.",
  },
  {
    title: "Iron & Vitamin C Absorption",
    category: "Nutrition",
    desc: "Pair non-heme plant-based iron sources (spinach, lentils) with Vitamin C (citrus, amla) for up to 3x higher bio-absorption.",
    prompt: "What dietary pairings maximize iron absorption to prevent nutritional anemia?",
  },
];

export interface HealthAssistantChatProps {
  className?: string;
  onClose?: () => void;
}

export function HealthAssistantChat({ className = "", onClose }: HealthAssistantChatProps = {}) {
  const [activeNavTab, setActiveNavTab] = useState<"chat" | "symptoms" | "health_tips" | "emergency">("chat");
  const [inputQuery, setInputQuery] = useState("");
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! 👋\nI'm your ArogyaGenie AI Health Assistant.\nHow can I help you today? Ask me medical questions, clinical guidelines, or questions about your personal health records.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const askAssistant = useAskHealthAssistant();
  const { data: user } = useGetMe();
  const { data: assessments } = useListSymptomAssessments();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSend = (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || askAssistant.isPending) return;

    // Switch to chat tab if sent from another tab
    if (activeNavTab !== "chat") {
      setActiveNavTab("chat");
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "patient",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInputQuery("");

    askAssistant.mutate(
      { data: { query: textToSend } },
      {
        onSuccess: (data) => {
          const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            sender: "assistant",
            text: data.answer,
            usedRag: data.usedRag ?? false,
            sources: (data.sources as any[]) ?? [],
            retrieval: (data.retrieval as any) ?? undefined,
            disclaimer: data.disclaimer ?? "⚠️ Informational clinical reference only.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };

          setMessages((prev) => [...prev, aiMessage]);
        },
        onError: (err) => {
          toast({
            title: "Assistant Error",
            description: err.message || "Failed to reach AI Assistant.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const toggleEvidence = (msgId: string) => {
    setExpandedMessageId(expandedMessageId === msgId ? null : msgId);
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col md:flex-row overflow-hidden select-none ${className}`}
      style={{
        background: "linear-gradient(145deg, #0b0e26 0%, #080a1c 50%, #050612 100%)",
      }}
    >
      {/* ── Background Atmospheric Light Effects ───────────────────────────── */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-20 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ── LEFT SIDEBAR (Matching Image 2) ────────────────────────────────── */}
      <aside className="w-full md:w-20 lg:w-[88px] shrink-0 bg-[#070918]/90 border-b md:border-b-0 md:border-r border-indigo-950/80 p-2 md:py-4 flex md:flex-col items-center justify-between md:justify-start gap-1.5 md:gap-3.5 z-20 backdrop-blur-xl">
        {/* Top AI Avatar (Image 2 style) */}
        <div className="hidden md:flex flex-col items-center mb-1 group">
          <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center">
            {/* Ambient Aura */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 blur-[4px] opacity-70 group-hover:opacity-90 transition-opacity" />
            
            {/* Inner Bot Visor Pod */}
            <div className="relative w-full h-full rounded-2xl bg-gradient-to-b from-[#1e1b4b] to-[#0d0f28] border border-cyan-400/50 flex items-center justify-center shadow-inner overflow-hidden">
              <svg viewBox="0 0 48 48" className="w-7 h-7 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">
                <rect x="8" y="10" width="32" height="28" rx="12" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.5" />
                <rect x="4" y="18" width="4" height="12" rx="2" fill="#38bdf8" />
                <rect x="40" y="18" width="4" height="12" rx="2" fill="#38bdf8" />
                <rect x="12" y="15" width="24" height="16" rx="7" fill="#070919" stroke="#38bdf8" strokeWidth="1.2" />
                <circle cx="18" cy="23" r="2.8" fill="#38bdf8" className={askAssistant.isPending ? "animate-ping" : ""} />
                <circle cx="30" cy="23" r="2.8" fill="#38bdf8" className={askAssistant.isPending ? "animate-ping" : ""} />
                <ellipse cx="24" cy="13" rx="8" ry="2" fill="rgba(255,255,255,0.4)" />
                <path d="M 21 27 Q 24 29 27 27" fill="none" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* 4 Required Sidebar Navigation Items */}
        <div className="flex md:flex-col items-center justify-around w-full gap-1.5 md:gap-2.5">
          {/* 1. Chat */}
          <button
            type="button"
            onClick={() => setActiveNavTab("chat")}
            className={`group w-14 h-12 md:w-16 md:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeNavTab === "chat"
                ? "bg-gradient-to-b from-purple-600 via-indigo-600 to-indigo-700 border border-purple-400/50 text-white shadow-[0_4px_20px_rgba(168,85,247,0.45)] scale-105"
                : "bg-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <MessageSquareText className={`h-4 w-4 md:h-5 md:w-5 ${activeNavTab === "chat" ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""}`} />
            <span className="text-[10px] font-semibold tracking-tight">Chat</span>
          </button>

          {/* 2. Symptoms */}
          <button
            type="button"
            onClick={() => setActiveNavTab("symptoms")}
            className={`group w-14 h-12 md:w-16 md:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeNavTab === "symptoms"
                ? "bg-gradient-to-b from-purple-600 via-indigo-600 to-indigo-700 border border-purple-400/50 text-white shadow-[0_4px_20px_rgba(168,85,247,0.45)] scale-105"
                : "bg-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Activity className={`h-4 w-4 md:h-5 md:w-5 ${activeNavTab === "symptoms" ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""}`} />
            <span className="text-[10px] font-semibold tracking-tight">Symptoms</span>
          </button>

          {/* 3. Health Tips */}
          <button
            type="button"
            onClick={() => setActiveNavTab("health_tips")}
            className={`group w-14 h-12 md:w-16 md:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeNavTab === "health_tips"
                ? "bg-gradient-to-b from-purple-600 via-indigo-600 to-indigo-700 border border-purple-400/50 text-white shadow-[0_4px_20px_rgba(168,85,247,0.45)] scale-105"
                : "bg-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Lightbulb className={`h-4 w-4 md:h-5 md:w-5 ${activeNavTab === "health_tips" ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""}`} />
            <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">Tips</span>
          </button>

          {/* 4. Emergency */}
          <button
            type="button"
            onClick={() => setActiveNavTab("emergency")}
            className={`group w-14 h-12 md:w-16 md:h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeNavTab === "emergency"
                ? "bg-gradient-to-b from-red-600 via-rose-600 to-red-700 border border-red-400/60 text-white shadow-[0_4px_20px_rgba(239,68,68,0.45)] scale-105"
                : "bg-transparent hover:bg-red-950/30 text-red-400 hover:text-red-300 border border-transparent"
            }`}
          >
            <HeartPulse className={`h-4 w-4 md:h-5 md:w-5 ${activeNavTab === "emergency" ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "animate-pulse"}`} />
            <span className="text-[10px] font-semibold tracking-tight">SOS</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* ── Falling Healthcare & AI Particles Background ────────────────────── */}
        <HealthcareFallingParticles />

        {/* Header (Matching Image 2) */}
        <header className="relative z-10 px-5 py-3.5 border-b border-indigo-950/80 flex items-center justify-between bg-[#080b20]/80 backdrop-blur-md shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent">
                Arogyagenie AI
              </h2>
              {/* Dynamic RAG / Thinking Status */}
              {askAssistant.isPending ? (
                <Badge className="bg-amber-950/80 text-amber-300 border border-amber-500/50 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-400 animate-spin" /> Neural Grounding...
                </Badge>
              ) : (
                <Badge className="bg-indigo-950/80 text-cyan-300 border border-cyan-500/40 text-[10px] font-semibold flex items-center gap-1 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" /> Verified Clinical RAG
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Your smart health companion</p>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="Close Assistant"
                aria-label="Close Assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        {/* ── Active Tab View ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
          {/* TAB 1: CHAT (Image 2 Main Chat Experience) */}
          {activeNavTab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-indigo-900/60 relative">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-[88%] ${
                      msg.sender === "patient" ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    {msg.sender === "patient" ? (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-indigo-950 border border-cyan-400/50 text-cyan-300 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.4)]">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div
                        className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed ${
                          msg.sender === "patient"
                            ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-lg shadow-purple-950/40 font-medium"
                            : msg.text.startsWith("🚨 EMERGENCY ALERT")
                            ? "bg-red-950/80 border-2 border-red-500/80 text-red-100 rounded-tl-xs shadow-xl"
                            : "bg-[#121636]/90 border border-indigo-900/60 text-slate-100 rounded-tl-xs shadow-md backdrop-blur-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {/* RAG Evidence Drawer */}
                        {msg.sender === "assistant" && msg.id !== "welcome" && (
                          <div className="mt-3 pt-2.5 border-t border-indigo-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              {msg.usedRag ? (
                                <Badge className="bg-emerald-950/70 text-emerald-300 border-emerald-500/40 text-[10px] gap-1 font-semibold">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  RAG Verified {msg.retrieval ? `(${msg.retrieval.resultsUsed}/${msg.retrieval.topK} Chunks)` : ""}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                                  Patient Context Grounded
                                </Badge>
                              )}
                            </div>

                            {msg.sources && msg.sources.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 gap-1 font-semibold"
                                onClick={() => toggleEvidence(msg.id)}
                              >
                                <BookOpen className="h-3 w-3" />
                                {expandedMessageId === msg.id ? "Hide Sources" : `Sources (${msg.sources.length})`}
                                {expandedMessageId === msg.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expandable Source Drawer */}
                      {msg.sender === "assistant" && expandedMessageId === msg.id && msg.sources && msg.sources.length > 0 && (
                        <div className="bg-[#0b0e24]/90 border border-indigo-500/30 p-3 rounded-xl text-xs space-y-2 animate-in fade-in-50 duration-200">
                          <span className="font-bold text-cyan-300 flex items-center gap-1.5 pb-1 border-b border-indigo-900/60">
                            <FileText className="h-3.5 w-3.5 text-cyan-400" />
                            Retrieved Clinical Guidelines & Attributed Sources
                          </span>
                          <div className="space-y-1.5">
                            {msg.sources.map((src, idx) => (
                              <div key={idx} className="bg-[#14183d] p-2.5 rounded-lg border border-indigo-500/20 text-slate-200 space-y-0.5">
                                <div className="font-bold text-white flex items-center justify-between">
                                  <span>{src.title || "Clinical Protocol"}</span>
                                  {src.documentId && <span className="font-mono text-[9px] text-cyan-300">{src.documentId}</span>}
                                </div>
                                {src.publisher && <p className="text-[11px] text-slate-400">Publisher: {src.publisher}</p>}
                                {src.section && (
                                  <p className="text-[11px] text-indigo-300">
                                    Section: {src.section} {src.page ? `• Page ${src.page}` : ""}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timestamp & Disclaimer */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                        <span>{msg.timestamp}</span>
                        {msg.disclaimer && <span className="italic text-slate-400">{msg.disclaimer}</span>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Thinking Indicator */}
                {askAssistant.isPending && (
                  <div className="flex items-center gap-3 mr-auto">
                    <div className="h-7 w-7 rounded-full bg-indigo-950 border border-cyan-400/50 text-cyan-300 flex items-center justify-center shrink-0">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                    </div>
                    <div className="bg-[#121636]/90 border border-indigo-900/60 p-3 rounded-2xl rounded-tl-xs text-xs text-cyan-300 flex items-center gap-2 shadow-md">
                      <Sparkles className="h-4 w-4 text-cyan-400 animate-spin" />
                      Retrieving medical guidelines & patient health records...
                    </div>
                  </div>
                )}
              </div>

              {/* Input Form (Image 2 style) */}
              <div className="p-3.5 border-t border-indigo-950/80 bg-[#070919]/90 relative z-10">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="bg-[#0c0f2a]/95 border border-indigo-500/35 focus-within:border-cyan-400/80 focus-within:ring-2 focus-within:ring-cyan-400/20 rounded-full p-1 pl-4 flex items-center gap-2 shadow-inner transition-all"
                >
                  <input
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Type your message..."
                    disabled={askAssistant.isPending}
                    className="bg-transparent border-0 text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 text-xs sm:text-sm flex-1"
                  />
                  <button
                    type="submit"
                    disabled={askAssistant.isPending || !inputQuery.trim()}
                    aria-label="Send message"
                    className="h-9 w-9 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-950/60 shrink-0 transition-transform active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: SYMPTOMS (Quick AI Symptom Assessment) */}
          {activeNavTab === "symptoms" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="bg-[#121638]/80 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" /> AI Symptom Intelligence
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Select a common symptom category to quickly consult the AI, or open the full 2-stage clinical symptom assessment.
                </p>
              </div>

              {/* Symptom Quick Launch Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_SYMPTOM_CATEGORIES.map((cat, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(cat.query)}
                    className="p-3 rounded-xl bg-[#101438]/90 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-cyan-400 text-left transition-all group cursor-pointer"
                  >
                    <span className="font-bold text-xs text-white group-hover:text-cyan-300 block mb-1">
                      {cat.label}
                    </span>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{cat.query}</p>
                  </button>
                ))}
              </div>

              {/* Shortcut to full symptom check page */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/50 to-indigo-950/50 border border-purple-500/40 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs text-white">Need a comprehensive assessment?</h4>
                  <p className="text-[11px] text-slate-400">Launch the 2-stage interactive body area symptom checker</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (onClose) onClose();
                    setLocation("/patient/symptom-check");
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shrink-0 gap-1"
                >
                  Open Checker <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Recent assessments summary if available */}
              {assessments && assessments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                    Recent AI Assessments ({assessments.length})
                  </span>
                  <div className="space-y-2">
                    {assessments.slice(0, 3).map((a: any) => (
                      <div key={a.id} className="p-2.5 rounded-xl bg-[#0f1230] border border-indigo-900/50 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">{a.symptoms}</p>
                          <span className="text-[10px] text-slate-400">{a.assessmentDate}</span>
                        </div>
                        <Badge className="bg-indigo-950 text-cyan-300 border-indigo-700 text-[10px]">
                          {a.severity || "Evaluated"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HEALTH TIPS (AI Daily Clinical Insights) */}
          {activeNavTab === "health_tips" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              <div className="bg-[#121638]/80 border border-indigo-500/30 rounded-2xl p-4 space-y-1">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400" /> AI Daily Health & Wellness Insights
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Personalized evidence-based health guidance grounded in verified medical literature.
                </p>
              </div>

              <div className="space-y-3">
                {HEALTH_TIPS.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#0e1233]/90 border border-indigo-500/30 hover:border-indigo-400 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white">{tip.title}</span>
                      <Badge className="bg-indigo-950 text-indigo-300 border-indigo-700 text-[9px]">
                        {tip.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{tip.desc}</p>
                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSend(tip.prompt)}
                        className="h-7 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 gap-1 font-semibold"
                      >
                        <Sparkles className="h-3 w-3" /> Ask AI about this
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: EMERGENCY (Emergency SOS & Safety Hub) */}
          {activeNavTab === "emergency" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Emergency Banner */}
              <div className="bg-red-950/80 border-2 border-red-500/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-300 font-bold text-sm">
                  <ShieldAlert className="h-5 w-5 text-red-400 animate-bounce" />
                  EMERGENCY MEDICAL ASSISTANCE
                </div>
                <p className="text-xs text-red-200 leading-relaxed">
                  If you or someone nearby is experiencing acute chest pain, severe breathing difficulty, sudden speech/facial paralysis, or uncontrollable bleeding, call emergency services immediately.
                </p>
              </div>

              {/* 1-Click Helpline Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="tel:108"
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white flex items-center justify-between shadow-lg shadow-red-950/50 transition-transform active:scale-95"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-red-200 block">Ambulance</span>
                    <span className="text-xl font-black">108</span>
                  </div>
                  <Phone className="h-5 w-5" />
                </a>

                <a
                  href="tel:112"
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 text-white flex items-center justify-between shadow-lg transition-transform active:scale-95"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-200 block">National SOS</span>
                    <span className="text-xl font-black">112</span>
                  </div>
                  <Phone className="h-5 w-5" />
                </a>
              </div>

              {/* Patient Emergency Contact */}
              {user?.emergencyContact && (
                <div className="p-3.5 rounded-2xl bg-[#121638] border border-indigo-500/30 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Your Emergency Contact</span>
                    <span className="font-bold text-white text-sm">{user.emergencyContact}</span>
                  </div>
                  <a
                    href={`tel:${user.emergencyContact}`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                </div>
              )}

              {/* Nearest Emergency Care Shortcut */}
              <Button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  setLocation("/patient/hospitals");
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs h-11 rounded-2xl gap-2 shadow-md cursor-pointer"
              >
                <Building2 className="h-4 w-4 text-emerald-400" /> Open Partner Hospital Discovery Map
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

