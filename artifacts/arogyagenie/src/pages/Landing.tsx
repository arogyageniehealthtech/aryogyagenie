import { Link } from "wouter";
import { Activity, Calendar, FileText, Pill, ShieldCheck, Stethoscope, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-4 sm:px-6 lg:px-12 py-4 sm:py-6 border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src={`${basePath}/logo.png`} alt="ArogyaGenie Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
          <span className="font-bold text-xl sm:text-2xl tracking-tight text-primary">ArogyaGenie</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#roles" className="hover:text-primary transition-colors">Who is it for?</a>
          <a href="#security" className="hover:text-primary transition-colors">Security</a>
          <Link href="/contact" className="hover:text-primary transition-colors">Support</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-primary text-xs sm:text-sm px-2.5 sm:px-4">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="bg-primary hover:bg-primary-dark text-white rounded-full px-3.5 sm:px-6 text-xs sm:text-sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-12 py-10 sm:py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        <div className="space-y-6 sm:space-y-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-xs sm:text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            India's AI-Powered Health Companion
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.15] sm:leading-[1.1]">
            Healthcare, <br />
            <span className="text-primary">intelligently connected.</span>
          </h1>
          <p className="text-sm sm:text-lg text-slate-600 leading-relaxed">
            ArogyaGenie brings patients, doctors, diagnostic centers, and pharmacies together on one unified, AI-driven platform. Trustworthy, secure, and designed for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-2 sm:pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white rounded-full h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-lg">
                Join ArogyaGenie <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-blue-100 rounded-3xl transform rotate-3 scale-105 opacity-50 blur-xl"></div>
          <img 
            src={`${basePath}/@assets/generated_images/hero-doctor-ai.png`} 
            alt="AI Healthcare" 
            className="relative rounded-3xl shadow-2xl object-cover w-full aspect-[4/3] border border-white/20"
          />
        </div>
      </section>

      {/* Stats / Trust */}
      <section className="bg-primary text-primary-foreground py-12 sm:py-16 px-4 sm:px-6 lg:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
          <div className="space-y-2">
            <h3 className="text-4xl font-bold">1M+</h3>
            <p className="text-blue-100 font-medium">Patients</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-4xl font-bold">10k+</h3>
            <p className="text-blue-100 font-medium">Doctors</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-4xl font-bold">5k+</h3>
            <p className="text-blue-100 font-medium">Diagnostic Centers</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-4xl font-bold">24/7</h3>
            <p className="text-blue-100 font-medium">AI Support</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="roles" className="py-24 px-6 lg:px-12 bg-slate-50">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 tracking-tight">One Platform. Five Experiences.</h2>
            <p className="text-lg text-slate-600">Tailored tools for every stakeholder in the healthcare journey.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Patient */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-6">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Patients</h3>
              <p className="text-slate-600 mb-6 line-clamp-3">Your complete medical timeline, digital prescriptions, lab reports, and AI health assistant in one secure place.</p>
              <ul className="space-y-2 text-sm font-medium text-slate-700">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />AI Health Companion</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Instant Doctor Booking</li>
              </ul>
            </div>

            {/* Doctor */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-6">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Doctors</h3>
              <p className="text-slate-600 mb-6 line-clamp-3">Streamlined practice management, digital prescription builder, longitudinal patient histories, and AI briefings.</p>
              <ul className="space-y-2 text-sm font-medium text-slate-700">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />AI Patient Briefings</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Smart Prescriptions</li>
              </ul>
            </div>

            {/* Diagnostic Center */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-6">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Diagnostic Centers</h3>
              <p className="text-slate-600 mb-6 line-clamp-3">Manage test appointments, upload digital lab reports, and connect directly with referring doctors and patients.</p>
              <ul className="space-y-2 text-sm font-medium text-slate-700">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Digital Lab Reports</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Online Booking Engine</li>
              </ul>
            </div>
            
            {/* Pharmacy */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-6">
                <Pill className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Pharmacies</h3>
              <p className="text-slate-600 mb-6 line-clamp-3">Receive digital prescriptions, manage orders, and deliver medications directly to patients' doorsteps.</p>
              <ul className="space-y-2 text-sm font-medium text-slate-700">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Digital Prescription Ingestion</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Order Delivery Management</li>
              </ul>
            </div>
            
             {/* Admin */}
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Administrators</h3>
              <p className="text-slate-600 mb-6 line-clamp-3">Complete platform oversight. Monitor platform health, manage user approvals, and track revenue and growth metrics.</p>
              <ul className="space-y-2 text-sm font-medium text-slate-700">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />Analytics Dashboard</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />User Verification</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      
      {/* Image Showcase */}
      <section className="py-24 px-6 lg:px-12 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
           <div className="flex-1 space-y-8">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight">AI at the Core</h2>
            <p className="text-lg text-slate-600">
              ArogyaGenie isn't just a management system. It's a proactive health companion. Our AI helps assess symptoms, summarizes complex lab reports into easy-to-understand language, and ensures you never miss a dose.
            </p>
            <div className="pt-4">
               <Link href="/sign-up">
                <Button variant="outline" className="rounded-full h-12 px-6 border-primary text-primary hover:bg-blue-50">
                  Explore AI Features
                </Button>
              </Link>
            </div>
           </div>
           <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-blue-50 rounded-full transform -translate-x-10 translate-y-10 blur-3xl opacity-50"></div>
              <img 
                src={`${basePath}/@assets/generated_images/ai-health-abstract.png`} 
                alt="AI Health Abstract" 
                className="relative z-10 rounded-2xl shadow-xl w-full max-w-md mx-auto"
              />
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-300 py-12 px-6 lg:px-12 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <img src={`${basePath}/logo.png`} alt="ArogyaGenie Logo" className="h-8 w-8 object-contain brightness-0 invert" />
              <span className="font-bold text-xl text-white tracking-tight">ArogyaGenie</span>
            </div>
            <p className="text-sm max-w-sm text-slate-400">
              Empowering India's healthcare ecosystem with intelligent, secure, and accessible tools for patients, doctors, labs, and pharmacies.
            </p>
            <div className="pt-2 text-xs text-slate-500">
              <p>Emergency Helplines: <strong>112 (National)</strong> • <strong>108 (Ambulance)</strong></p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/sign-up" className="hover:text-white transition-colors">Create Account</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Help & Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal & Privacy</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
          © {new Date().getFullYear()} ArogyaGenie. All rights reserved. Registered under Indian Digital Healthcare Guidelines.
        </div>
      </footer>
    </div>
  );
}
