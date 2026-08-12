import { useListHealthEpisodes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Calendar, ChevronRight, Activity } from "lucide-react";

export function HealthEpisodeTracker() {
  const { data: episodes, isLoading } = useListHealthEpisodes();

  if (isLoading || !episodes || episodes.length === 0) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">Health Episodes</CardTitle>
            <p className="text-xs text-slate-500">Grouped health journeys connecting symptoms, doctors, and lab tests</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {episodes.map((ep) => (
            <div key={ep.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900 text-sm">{ep.title}</h4>
                <Badge variant={ep.status === "confirmed" ? "default" : ep.status === "resolved" ? "secondary" : "outline"}>
                  {ep.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                <span>Started {ep.startDate}</span>
              </div>
              {ep.summary && <p className="text-xs text-slate-600 leading-relaxed pt-1">{ep.summary}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
