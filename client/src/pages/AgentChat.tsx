import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ChevronRight, Send, Loader2, MessageSquare, Users, Bot } from "lucide-react";
import { Streamdown } from "streamdown";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  timestamp: Date;
}

export default function AgentChat() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: agents } = trpc.agents.list.useQuery({ projectId }, { enabled: !!projectId });

  const chatMutation = trpc.agents.chat.useMutation({
    onSuccess: (data) => {
      const selectedAgent = agents?.find((a) => a.id === selectedAgentId);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data?.response || "",
          agentName: selectedAgent?.name || "Report Agent",
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    chatMutation.mutate({
      projectId,
      agentId: selectedAgentId || undefined,
      message: input.trim(),
      history: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedAgent = agents?.find((a) => a.id === selectedAgentId);

  return (
    <div className="min-h-screen nebula-bg flex flex-col">
      <TopNav />
      <div className="pt-16 flex flex-col flex-1" style={{ height: "100vh" }}>
        {/* Header */}
        <div className="glass-strong border-b border-[oklch(0.30_0.04_265_/_0.30)] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-cormorant text-[oklch(0.55_0.02_265)]">
            <Link href="/" className="hover:text-[oklch(0.65_0.30_280)] transition-colors">Dashboard</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/project/${projectId}`} className="hover:text-[oklch(0.65_0.30_280)] transition-colors">{project?.title || "Project"}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[oklch(0.97_0.005_265)]">Agent Chat</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass border border-[oklch(0.30_0.04_265_/_0.35)]">
            <Users className="w-3.5 h-3.5 text-[oklch(0.65_0.30_280)]" />
            <span className="font-jetbrains text-xs text-[oklch(0.75_0.02_265)]">
              {agents?.length || 0} agents
            </span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Agent Sidebar */}
          <div className="w-64 shrink-0 glass-strong border-r border-[oklch(0.30_0.04_265_/_0.25)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[oklch(0.20_0.02_265_/_0.40)]">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)]">SELECT AGENT</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {/* Report Agent (always available) */}
              <button
                onClick={() => { setSelectedAgentId(null); setMessages([]); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all text-left ${
                  selectedAgentId === null
                    ? "bg-[oklch(0.55_0.28_280_/_0.20)] border border-[oklch(0.55_0.28_280_/_0.35)]"
                    : "hover:bg-[oklch(0.10_0.02_265_/_0.60)] border border-transparent"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[oklch(0.78_0.18_75_/_0.20)] border border-[oklch(0.78_0.18_75_/_0.30)] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-[oklch(0.85_0.20_75)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-cinzel text-xs text-[oklch(0.97_0.005_265)] truncate">Report Agent</p>
                  <p className="font-jetbrains text-[9px] text-[oklch(0.50_0.02_265)]">AI Analyst</p>
                </div>
              </button>

              {/* Individual Agents */}
              {agents?.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => { setSelectedAgentId(agent.id); setMessages([]); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all text-left ${
                    selectedAgentId === agent.id
                      ? "bg-[oklch(0.55_0.28_280_/_0.20)] border border-[oklch(0.55_0.28_280_/_0.35)]"
                      : "hover:bg-[oklch(0.10_0.02_265_/_0.60)] border border-transparent"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[oklch(0.55_0.28_280_/_0.15)] border border-[oklch(0.55_0.28_280_/_0.25)] flex items-center justify-center shrink-0 text-[oklch(0.65_0.30_280)] font-cinzel text-xs">
                    {agent.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-cormorant text-sm text-[oklch(0.90_0.02_265)] truncate">{agent.name}</p>
                    <p className="font-jetbrains text-[9px] text-[oklch(0.45_0.02_265)] truncate">{agent.ideology || agent.platform}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-[oklch(0.20_0.02_265_/_0.40)] bg-[oklch(0.06_0.01_265_/_0.60)]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  selectedAgentId === null
                    ? "bg-[oklch(0.78_0.18_75_/_0.20)] border border-[oklch(0.78_0.18_75_/_0.30)]"
                    : "bg-[oklch(0.55_0.28_280_/_0.15)] border border-[oklch(0.55_0.28_280_/_0.25)]"
                }`}>
                  {selectedAgentId === null
                    ? <Bot className="w-4 h-4 text-[oklch(0.85_0.20_75)]" />
                    : <span className="text-[oklch(0.65_0.30_280)] font-cinzel text-sm">{selectedAgent?.name.charAt(0)}</span>
                  }
                </div>
                <div>
                  <p className="font-cinzel text-sm text-[oklch(0.97_0.005_265)]">
                    {selectedAgentId === null ? "Report Agent" : selectedAgent?.name}
                  </p>
                  <p className="font-jetbrains text-[10px] text-[oklch(0.45_0.02_265)]">
                    {selectedAgentId === null ? "AI Analyst — Simulation Expert" : (selectedAgent?.ideology || selectedAgent?.platform || "Simulation Agent")}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-10 h-10 text-[oklch(0.30_0.04_265)] mb-4" />
                  <p className="font-cinzel text-sm text-[oklch(0.55_0.02_265)] mb-2">
                    Start a conversation
                  </p>
                  <p className="font-cormorant text-sm text-[oklch(0.40_0.02_265)] max-w-xs">
                    {selectedAgentId === null
                      ? "Ask the Report Agent about simulation results, trends, and predictions."
                      : `Chat with ${selectedAgent?.name} about their perspective on the simulation topic.`}
                  </p>
                </div>
              )}

              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "user"
                        ? "bg-[oklch(0.55_0.28_280_/_0.25)] border border-[oklch(0.55_0.28_280_/_0.40)]"
                        : selectedAgentId === null
                        ? "bg-[oklch(0.78_0.18_75_/_0.20)] border border-[oklch(0.78_0.18_75_/_0.30)]"
                        : "bg-[oklch(0.55_0.28_280_/_0.15)] border border-[oklch(0.55_0.28_280_/_0.25)]"
                    }`}>
                      {msg.role === "user"
                        ? <span className="text-[oklch(0.65_0.30_280)] font-cinzel text-xs">U</span>
                        : selectedAgentId === null
                        ? <Bot className="w-3.5 h-3.5 text-[oklch(0.85_0.20_75)]" />
                        : <span className="text-[oklch(0.65_0.30_280)] font-cinzel text-xs">{msg.agentName?.charAt(0)}</span>
                      }
                    </div>
                    <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      {msg.role === "assistant" && (
                        <span className="font-cinzel text-[9px] tracking-wider text-[oklch(0.50_0.02_265)]">
                          {msg.agentName?.toUpperCase()}
                        </span>
                      )}
                      <div className={`px-4 py-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-[oklch(0.55_0.28_280_/_0.25)] border border-[oklch(0.55_0.28_280_/_0.35)] rounded-tr-sm"
                          : "glass border border-[oklch(0.30_0.04_265_/_0.35)] rounded-tl-sm"
                      }`}>
                        <div className="font-cormorant text-sm text-[oklch(0.90_0.02_265)] leading-relaxed">
                          {msg.role === "assistant" ? (
                            <Streamdown>{msg.content}</Streamdown>
                          ) : (
                            <p>{msg.content}</p>
                          )}
                        </div>
                      </div>
                      <span className="font-jetbrains text-[9px] text-[oklch(0.35_0.02_265)]">
                        {msg.timestamp.toLocaleTimeString("en", { hour12: false })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-[oklch(0.55_0.28_280_/_0.15)] border border-[oklch(0.55_0.28_280_/_0.25)] flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-[oklch(0.65_0.30_280)] animate-spin" />
                  </div>
                  <div className="glass border border-[oklch(0.30_0.04_265_/_0.35)] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-[oklch(0.55_0.28_280_/_0.60)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[oklch(0.20_0.02_265_/_0.40)] bg-[oklch(0.06_0.01_265_/_0.60)]">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedAgentId === null ? "Report Agent" : selectedAgent?.name || "agent"}...`}
                  rows={1}
                  className="flex-1 px-4 py-3 rounded-xl bg-[oklch(0.10_0.02_265)] border border-[oklch(0.25_0.03_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm placeholder:text-[oklch(0.40_0.02_265)] focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none transition-colors resize-none"
                  style={{ maxHeight: "120px" }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 p-0 rounded-xl bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo disabled:opacity-40 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="font-jetbrains text-[9px] text-[oklch(0.35_0.02_265)] mt-2 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
