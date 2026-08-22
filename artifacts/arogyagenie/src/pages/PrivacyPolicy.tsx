import { Link } from "wouter";
import { ArrowLeft, Shield, Lock, Eye, Database, Cpu, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.png`} alt="ArogyaGenie Logo" className="h-7 w-7 object-contain" />
            <span className="font-bold text-lg text-primary">ArogyaGenie</span>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/30">
            <Shield className="h-3.5 w-3.5" /> DPDP Act 2023 & Clinical Data Governance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
            At ArogyaGenie, we consider your personal health data to be sacred. Learn how we safeguard your electronic health records, prescriptions, and AI interactions.
          </p>
          <p className="text-xs text-slate-400">Effective Date: January 1, 2026 | Last Updated: August 2026</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">End-to-End Encryption</h3>
            <p className="text-xs text-slate-600">All health data, lab reports, and vitals are encrypted in transit (TLS 1.3) and at rest (AES-256).</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Eye className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Zero Data Selling</h3>
            <p className="text-xs text-slate-600">We never sell, broker, or monetize your medical history or personally identifiable information.</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Patient Data Sovereignty</h3>
            <p className="text-xs text-slate-600">You maintain full control over who views your records and can export or delete your profile anytime.</p>
          </div>
        </div>

        <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-sm sm:text-base leading-relaxed text-slate-700">
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> 1. Information We Collect
            </h2>
            <p>
              To provide personalized medical services, intelligent health insights, and care coordination, ArogyaGenie collects:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-sm text-slate-600">
              <li><strong>Account Credentials:</strong> Full name, verified mobile number, email address, and demographic information.</li>
              <li><strong>Health & Clinical Records:</strong> Doctor prescriptions, diagnostic lab reports, uploaded medical imaging, allergy profiles, and health episode histories.</li>
              <li><strong>Real-Time Health Vitals:</strong> Blood pressure, blood glucose, heart rate, oxygen saturation (SpO2), body temperature, and weight tracking entries.</li>
              <li><strong>Operational & Transaction Data:</strong> Doctor appointments, medicine delivery requests, diagnostic test bookings, and pharmacy handshakes.</li>
            </ul>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> 2. AI Intelligence & Privacy Protection
            </h2>
            <p>
              ArogyaGenie uses advanced clinical Retrieval-Augmented Generation (RAG) and domain-specific LLMs (Google Gemini) to summarize longitudinal records and assist with triage.
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-sm text-slate-600">
              <li><strong>Context Isolation:</strong> Patient records are injected only when the inquiry directly concerns the logged-in user. Inquiries regarding third parties or general medical queries strictly omit personal EHR context.</li>
              <li><strong>No Training on Patient Records:</strong> Your private clinical records and identifiable health conversations are never used to train public foundation AI models.</li>
              <li><strong>Clinical Grounding:</strong> AI responses cite validated clinical guidelines and include mandatory medical disclaimers.</li>
            </ul>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> 3. Healthcare Provider Sharing
            </h2>
            <p>
              Your health data is shared strictly on a need-to-know, consent-driven basis:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-sm text-slate-600">
              <li><strong>Consulting Doctors:</strong> Access is limited to active consultations and issued prescriptions.</li>
              <li><strong>Partner Pharmacies:</strong> Access is restricted strictly to assigned medicine orders and delivery details.</li>
              <li><strong>Diagnostic Centers:</strong> Access is restricted to test booking requisition requirements and report uploads.</li>
            </ul>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">4. Your Rights Under Digital Personal Data Protection (DPDP)</h2>
            <p className="text-sm text-slate-600">
              You have the right to access your stored data, request corrections, withdraw consent, and request permanent erasure of your medical history. To exercise any of these rights, contact our Data Privacy Officer at <a href="mailto:privacy@arogyagenie.com" className="text-primary font-medium hover:underline">privacy@arogyagenie.com</a>.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-4 text-center text-xs border-t border-slate-800 mt-auto">
        <p>© {new Date().getFullYear()} ArogyaGenie HealthTech. All rights reserved. Registered under Indian Digital Healthcare Guidelines.</p>
      </footer>
    </div>
  );
}
export default PrivacyPolicy;
