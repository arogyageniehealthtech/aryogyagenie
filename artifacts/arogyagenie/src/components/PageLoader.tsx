import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="h-12 w-12 rounded-2xl bg-violet-100/80 text-violet-600 flex items-center justify-center mb-3 shadow-xs animate-pulse">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">Loading ArogyaGenie...</p>
    </div>
  );
}
