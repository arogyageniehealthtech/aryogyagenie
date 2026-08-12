import { useState } from "react";
import { useAskHealthAssistant } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Sparkles, BookOpen, AlertTriangle, ChevronDown, ChevronUp, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const SAMPLE_PROMPTS = [
  "Did I ever face any health issue?",
  "What does my low hemoglobin mean?",
  "What are common causes and warning signs of iron-deficiency anemia?",
  "I have severe chest pain and difficulty breathing.",
];

export function HealthAssistantChat() {
  const [inputQuery, setInputQuery] = useState("");
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am your ArogyaGenie AI Health Assistant. Ask me medical questions, guidelines, or questions about your personal health records.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const askAssistant = useAskHealthAssistant();
  const { toast } = useToast();

  const handleSend = (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || askAssistant.isPending) return;

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
            disclaimer: data.disclaimer ?? "⚠️ Informational reference only.",
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
    <Card className="border-primary/20 bg-white shadow-sm overflow-hidden flex flex-col h-[620px]">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/70 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              AI Health Assistant
              <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5">
                <Sparkles className="h-3 w-3 mr-1 text-primary animate-pulse" /> Hybrid Patient & Vector RAG
              </Badge>
            </CardTitle>
            <p className="text-xs text-slate-500">Grounded in verified clinical guidelines & your medical records</p>
          </div>
        </div>
      </CardHeader>

      {/* Messages Thread */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[85%] ${
              msg.sender === "patient" ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.sender === "patient"
                  ? "bg-primary text-primary-foreground"
                  : "bg-teal-600 text-white shadow-xs"
              }`}
            >
              {msg.sender === "patient" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Message Bubble */}
            <div className="space-y-2 flex-1">
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "patient"
                    ? "bg-primary text-primary-foreground rounded-tr-none shadow-xs font-medium"
                    : msg.text.startsWith("🚨 EMERGENCY ALERT")
                    ? "bg-red-50 border-2 border-red-200 text-red-950 rounded-tl-none font-medium"
                    : "bg-white border border-slate-200 text-slate-900 rounded-tl-none shadow-xs"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Grounding & Evidence Badge Section */}
                {msg.sender === "assistant" && msg.id !== "welcome" && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {msg.usedRag ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          RAG Grounded {msg.retrieval ? `(${msg.retrieval.resultsUsed}/${msg.retrieval.topK} Chunks)` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          Patient Context Grounded
                        </Badge>
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 gap-1 font-semibold"
                        onClick={() => toggleEvidence(msg.id)}
                      >
                        <BookOpen className="h-3 w-3" />
                        {expandedMessageId === msg.id ? "Hide Evidence" : `View Evidence (${msg.sources.length})`}
                        {expandedMessageId === msg.id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Expandable Evidence Drawer */}
              {msg.sender === "assistant" && expandedMessageId === msg.id && msg.sources && msg.sources.length > 0 && (
                <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-xl text-xs space-y-2.5 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between font-bold text-blue-900 border-b border-blue-200/60 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      Retrieved Clinical Evidence & Attributed Sources
                    </span>
                  </div>

                  <div className="space-y-2">
                    {msg.sources.map((src, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-blue-100/80 shadow-2xs space-y-1">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>{src.title || "Clinical Guideline"}</span>
                          {src.documentId && (
                            <Badge variant="outline" className="text-[9px] font-mono text-slate-500">
                              {src.documentId}
                            </Badge>
                          )}
                        </div>
                        {src.publisher && <p className="text-[11px] text-slate-600 font-medium">Publisher: {src.publisher}</p>}
                        {src.source && <p className="text-[11px] text-slate-500 italic">Source: {src.source}</p>}
                        {src.section && (
                          <p className="text-[11px] text-slate-700">
                            <span className="font-semibold">Section:</span> {src.section}
                            {src.page ? ` • Page ${src.page}` : ""}
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
                {msg.disclaimer && <span className="italic">{msg.disclaimer}</span>}
              </div>
            </div>
          </div>
        ))}

        {askAssistant.isPending && (
          <div className="flex items-center gap-3 mr-auto">
            <div className="h-8 w-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-xs text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-spin" />
              Retrieving patient context & medical RAG knowledge base...
            </div>
          </div>
        )}
      </CardContent>

      {/* Suggested Prompts */}
      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] font-bold text-slate-500 shrink-0">Try asking:</span>
        {SAMPLE_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={askAssistant.isPending}
            className="shrink-0 px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-full text-slate-700 font-medium transition-colors text-[11px] text-left"
          >
            {prompt.length > 45 ? `${prompt.slice(0, 45)}...` : prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a medical question or search clinical guidelines..."
            disabled={askAssistant.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={askAssistant.isPending || !inputQuery.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </form>
      </div>
    </Card>
  );
}
