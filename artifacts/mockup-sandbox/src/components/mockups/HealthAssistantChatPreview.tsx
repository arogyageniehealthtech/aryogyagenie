import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HealthAssistantChat } from "../../../../arogyagenie/src/components/health/HealthAssistantChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export default function HealthAssistantChatPreview() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="w-screen h-screen bg-[#030712] flex items-center justify-center p-4">
        <div className="w-full max-w-5xl h-[760px] rounded-3xl overflow-hidden shadow-2xl border border-indigo-500/40">
          <HealthAssistantChat />
        </div>
      </div>
    </QueryClientProvider>
  );
}
