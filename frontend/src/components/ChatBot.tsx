import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAI } from "@/context/AIProviderContext";
import { chatWithAssistant } from "@/services/aiService";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const quickActions = [
  "Add more cafes to the plan",
  "Make the trip 2 days instead of 3",
  "Suggest cheaper attractions",
  "Add restaurant recommendations",
];

interface ChatBotProps {
  locationName: string;
  onSuggestion?: (suggestion: string) => void;
}

const ChatBot = ({ locationName, onSuggestion }: ChatBotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `Hi! I'm your AI travel assistant for ${locationName}. I can help you modify your itinerary, suggest new places, or answer travel questions. How can I help?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const { provider } = useAI();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await chatWithAssistant(text, locationName, provider);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full travel-gradient shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-50"
      >
        <MessageSquare className="w-6 h-6 text-primary-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[560px] glass-card rounded-2xl flex flex-col z-50 animate-slide-up shadow-2xl">
      {/* Header */}
      <div className="travel-gradient rounded-t-2xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
          <span className="font-semibold text-primary-foreground">AI Travel Assistant</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full travel-gradient flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "travel-gradient text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full travel-gradient flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        {quickActions.map((action) => (
          <button
            key={action}
            onClick={() => sendMessage(action)}
            className="shrink-0 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          placeholder="Ask about your trip..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          className="flex-1 rounded-full"
        />
        <Button size="icon" className="rounded-full travel-gradient shrink-0" onClick={() => sendMessage(input)}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatBot;
