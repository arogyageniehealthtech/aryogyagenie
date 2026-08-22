import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Mail, Phone, MapPin, Clock, Send, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function ContactSupport() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name, email, and message.",
        variant: "destructive",
      });
      return;
    }
    setSubmitted(true);
    toast({
      title: "Support Ticket Created",
      description: "Our healthcare support team will respond within 24 hours.",
    });
  };

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
            <Clock className="h-3.5 w-3.5" /> 24/7 Patient & Provider Support
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Contact & Help Center</h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
            Have questions about doctor bookings, diagnostic reports, or provider onboarding? Our dedicated support team is here to assist you.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Support Channels & Emergency Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Email Support</h3>
            <p className="text-xs text-slate-600">For general inquiries, technical support, and account assistance:</p>
            <a href="mailto:support@arogyagenie.com" className="text-xs font-semibold text-primary hover:underline block pt-1">
              support@arogyagenie.com
            </a>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Provider Helpline</h3>
            <p className="text-xs text-slate-600">Dedicated assistance for Doctors, Pharmacies & Labs:</p>
            <a href="tel:+9118001234567" className="text-xs font-semibold text-emerald-600 hover:underline block pt-1">
              +91 (1800) 123-4567 (Toll-Free)
            </a>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/50 shadow-sm space-y-2">
            <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-red-900 text-sm">Emergency Hotlines</h3>
            <p className="text-xs text-red-700">Immediate critical care & ambulance assistance:</p>
            <div className="flex gap-2 pt-1 text-xs font-bold text-red-600">
              <span>National: 112</span>
              <span>•</span>
              <span>Ambulance: 108</span>
            </div>
          </div>
        </div>

        {/* Support Inquiry Form */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Send us a Message</h2>
              <p className="text-sm text-slate-600">We typically reply within a few hours during business days.</p>
            </div>

            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Message Received</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Thank you for reaching out, <strong>{formData.name}</strong>. A support ticket has been created and our team will follow up at <strong>{formData.email}</strong>.
                </p>
                <Button variant="outline" size="sm" onClick={() => setSubmitted(false)} className="mt-4">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Your Full Name</label>
                    <Input
                      placeholder="e.g. Rahul Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Email Address</label>
                    <Input
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Topic / Category</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="general">General Platform Inquiry</option>
                    <option value="patient">Patient Appointment or Lab Report Help</option>
                    <option value="doctor">Doctor Onboarding & Verification</option>
                    <option value="pharmacy">Pharmacy & Diagnostic Center Integration</option>
                    <option value="technical">Technical Support or Bug Report</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Your Message</label>
                  <Textarea
                    placeholder="Describe how we can help you..."
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white gap-2">
                  <Send className="h-4 w-4" /> Submit Inquiry
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-4 text-center text-xs border-t border-slate-800 mt-auto">
        <p>© {new Date().getFullYear()} ArogyaGenie HealthTech. All rights reserved.</p>
      </footer>
    </div>
  );
}
export default ContactSupport;
