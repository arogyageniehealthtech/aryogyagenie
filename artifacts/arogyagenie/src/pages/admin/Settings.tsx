import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, ShieldCheck, Database, Key } from "lucide-react";

export function AdminSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Settings & Configuration</h1>
          <p className="text-slate-500 mt-1">Review AI Gateway status, authentication provider configuration, and security settings.</p>
        </div>

        {/* AI Gateway Settings */}
        <Card>
          <CardHeader className="bg-slate-50/50 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Ollama AI Gateway Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3 text-sm text-slate-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b gap-1 sm:gap-0">
              <span className="text-slate-500">Primary Provider:</span>
              <span className="font-semibold text-slate-900">Local Ollama REST API (llama3:8b)</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b gap-1 sm:gap-0">
              <span className="text-slate-500">Timeout Limit:</span>
              <span className="font-mono text-slate-900">15,000 ms</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b gap-1 sm:gap-0">
              <span className="text-slate-500">Emergency Redirection Bypasses:</span>
              <Badge variant="default" className="bg-green-600 self-start sm:self-auto">Active</Badge>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 gap-1 sm:gap-0">
              <span className="text-slate-500">Heuristic Engine Fallback:</span>
              <Badge variant="default" className="bg-blue-600 self-start sm:self-auto">Enabled</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Auth & DB Settings */}
        <Card>
          <CardHeader className="bg-slate-50/50 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Authentication & Database Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3 text-sm text-slate-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b gap-1 sm:gap-0">
              <span className="text-slate-500">Authentication Provider:</span>
              <span className="font-semibold text-slate-900">Clerk Auth (JIT Sync Middleware)</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b gap-1 sm:gap-0">
              <span className="text-slate-500">Database Engine:</span>
              <span className="font-semibold text-slate-900">PostgreSQL (Drizzle ORM)</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 gap-1 sm:gap-0">
              <span className="text-slate-500">API Standard:</span>
              <span className="font-semibold text-slate-900">OpenAPI 3.0 + Zod + Orval</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
