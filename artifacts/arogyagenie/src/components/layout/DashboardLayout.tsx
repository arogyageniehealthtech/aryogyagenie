import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { FloatingHealthAssistant } from "../health/FloatingHealthAssistant";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background relative">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto px-6 py-6 max-w-6xl">
          {children}
        </div>
      </main>
      {user?.role === "patient" && <FloatingHealthAssistant />}
    </div>
  );
}
