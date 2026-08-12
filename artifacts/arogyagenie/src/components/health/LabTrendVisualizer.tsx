import { useGetLabTrends } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle } from "lucide-react";

export function LabTrendVisualizer() {
  const { data: trends, isLoading } = useGetLabTrends();

  if (isLoading || !trends || trends.length === 0) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">Lab Result Trends</CardTitle>
            <p className="text-xs text-slate-500">Multi-report quantitative trend analysis</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">{item.testName}</h4>
                <Badge
                  variant={
                    item.trendDirection === "increasing"
                      ? "destructive"
                      : item.trendDirection === "decreasing"
                      ? "default"
                      : "secondary"
                  }
                  className="gap-1 text-xs"
                >
                  {item.trendDirection === "increasing" && <TrendingUp className="h-3.5 w-3.5" />}
                  {item.trendDirection === "decreasing" && <TrendingDown className="h-3.5 w-3.5" />}
                  {item.trendDirection === "stable" && <Minus className="h-3.5 w-3.5" />}
                  {item.trendDirection}
                </Badge>
              </div>

              <p className="text-xs text-slate-600 font-medium">{item.summary}</p>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                {item.readings.map((r, rIdx) => (
                  <div key={rIdx} className={`text-xs px-2.5 py-1 rounded border font-mono ${r.isAbnormal ? "bg-red-50 text-red-700 border-red-200 font-semibold" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                    <span className="text-[10px] text-slate-400 block">{r.date}</span>
                    {r.value}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
