import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, X, CheckCircle2, Maximize2, Minimize2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAI } from "@/context/AIProviderContext";
import { chatWithAssistant, type TripPreferences, fetchPlacePhoto } from "@/services/aiService";
import { type DayPlan, type Activity } from "@/components/TravelItinerary";
import { fetchPlaceDetails } from "@/api/places";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionSummary?: string;
}

const quickActions = [
  "แนะนำคาเฟ่บรรยากาศดีเพิ่มหน่อย",
  "ปรับงบประมาณเป็น 50,000 บาท",
  "สลับไปพักโรงแรม Marriott",
  "เปลี่ยนแผนเป็น 2 วัน",
  "ลบสถานที่ท่องเที่ยวราคาแพงออก",
];

interface ChatBotProps {
  locationName: string;
  onSuggestion?: (suggestion: string) => void;
  itinerary: DayPlan[];
  onUpdateItinerary: (itinerary: DayPlan[]) => void;
  preferences: TripPreferences | null;
  onUpdatePreferences?: (prefs: Partial<TripPreferences>) => void;
  onUpdateHotel?: (hotelName: string) => void;
  onUpdateFlight?: (flightCode: string) => void;
  messages?: Message[];
  onUpdateMessages?: (messages: Message[]) => void;
}

const ChatBot = ({
  locationName,
  onSuggestion,
  itinerary,
  onUpdateItinerary,
  preferences,
  onUpdatePreferences,
  onUpdateHotel,
  onUpdateFlight,
  messages: externalMessages,
  onUpdateMessages,
}: ChatBotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (externalMessages && externalMessages.length > 0) return externalMessages;
    return [
      {
        id: "1",
        role: "assistant",
        content: `สวัสดีครับ! พิกซ์ (Pix) เองครับ 😊 Your AI Travel Companion สำหรับทริป ${locationName} ✈️📸\n\nไม่ว่าจะอยากปรับตารางเดินทาง สลับโรงแรม เปลี่ยนงบประมาณ หรือส่องสถานที่จากรูปถ่าย พิกซ์พร้อมช่วยคิดช่วยจัดให้เสมอ บอกผมได้เลยนะครับ!`,
      },
    ];
  });

  // Synchronize when externalMessages changes
  useEffect(() => {
    if (externalMessages && externalMessages.length > 0) {
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  const updateAndNotifyMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      onUpdateMessages?.(next);
      return next;
    });
  };
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // ── Floating Window Position & Size State ──
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(16, window.innerWidth - 480),
    y: Math.max(16, window.innerHeight - 620),
  }));

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 440,
    height: 580,
  });

  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: 0,
    startH: 0,
    startX: 0,
    startY: 0,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const { model } = useAI();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Header Drag Move Logic ──
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (isMaximized) return;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  // ── Resize Handle Down Logic ──
  const handleResizeMouseDown = (e: React.MouseEvent, handleDirection: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMaximized) return;

    setActiveResizeHandle(handleDirection);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: size.width,
      startH: size.height,
      startX: position.x,
      startY: position.y,
    };
  };

  // ── Global Mouse Move & Mouse Up Listener ──
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, dragStartRef.current.startX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, dragStartRef.current.startY + dy));
        setPosition({ x: newX, y: newY });
      } else if (activeResizeHandle) {
        const dx = e.clientX - resizeStartRef.current.mouseX;
        const dy = e.clientY - resizeStartRef.current.mouseY;

        let newW = resizeStartRef.current.startW;
        let newH = resizeStartRef.current.startH;
        let newX = resizeStartRef.current.startX;
        let newY = resizeStartRef.current.startY;

        const minW = 320;
        const minH = 400;
        const maxW = Math.floor(window.innerWidth * 0.9);
        const maxH = Math.floor(window.innerHeight * 0.9);

        if (activeResizeHandle.includes("e")) {
          newW = Math.max(minW, Math.min(maxW, resizeStartRef.current.startW + dx));
        }
        if (activeResizeHandle.includes("s")) {
          newH = Math.max(minH, Math.min(maxH, resizeStartRef.current.startH + dy));
        }
        if (activeResizeHandle.includes("w")) {
          const possibleW = resizeStartRef.current.startW - dx;
          if (possibleW >= minW && possibleW <= maxW) {
            newW = possibleW;
            newX = resizeStartRef.current.startX + dx;
          }
        }
        if (activeResizeHandle.includes("n")) {
          const possibleH = resizeStartRef.current.startH - dy;
          if (possibleH >= minH && possibleH <= maxH) {
            newH = possibleH;
            newY = resizeStartRef.current.startY + dy;
          }
        }

        setSize({ width: newW, height: newH });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setActiveResizeHandle(null);
    };

    if (isDragging || activeResizeHandle) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, activeResizeHandle, size.width, size.height]);

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Helper to extract & parse JSON action object even if truncated or improperly fenced
  const parseActionJson = (responseText: string): { actionData: any; cleanText: string } => {
    let cleanText = responseText;
    let jsonString = "";

    // 1. Match code fence ```json ... ``` or ``` ... ``` (even if closing ``` is missing)
    const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (fenceMatch && fenceMatch[1]) {
      const candidate = fenceMatch[1].trim();
      if (candidate.startsWith("{")) {
        jsonString = candidate;
        cleanText = responseText.replace(fenceMatch[0], "").trim();
      }
    }

    // 2. Fallback: Find raw JSON starting at '{' with '"action"' or '"updated_itinerary"'
    if (!jsonString) {
      const firstBrace = responseText.indexOf("{");
      if (firstBrace !== -1 && (responseText.includes('"action"') || responseText.includes('"updated_itinerary"'))) {
        jsonString = responseText.slice(firstBrace).trim();
        cleanText = responseText.slice(0, firstBrace).trim();
      }
    }

    if (!jsonString) {
      return { actionData: null, cleanText: responseText };
    }

    // Attempt direct parse
    try {
      const parsed = JSON.parse(jsonString);
      return { actionData: parsed, cleanText };
    } catch (err) {
      // Attempt auto-repair for truncated JSON
      let repaired = jsonString.trim();
      repaired = repaired.replace(/,\s*$/, "");

      let openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
      let openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;

      const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        repaired += '"';
      }

      while (openBrackets > 0) {
        repaired += "]";
        openBrackets--;
      }
      while (openBraces > 0) {
        repaired += "}";
        openBraces--;
      }

      try {
        const parsed = JSON.parse(repaired);
        console.log("[ChatBot] Successfully repaired action JSON!");
        return { actionData: parsed, cleanText };
      } catch (repairErr) {
        console.error("[ChatBot] Action JSON repair failed:", repairErr);
        return { actionData: null, cleanText };
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    updateAndNotifyMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Build clean history without raw code blocks to ensure multi-turn context
      const historyPayload = messages
        .filter((m) => m.content && m.content.trim().length > 0)
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content.replace(/```(?:json)?[\s\S]*?```/gi, "").trim(),
        }));

      let rawResponse = await chatWithAssistant(text, locationName, model, itinerary, preferences, historyPayload);
      let actionSummaryText = "";

      const { actionData, cleanText } = parseActionJson(rawResponse);
      let response = cleanText || rawResponse;

      if (actionData) {
        try {
          const actionsTaken: string[] = [];

          // 1. Update Itinerary
          if (actionData.updated_itinerary && Array.isArray(actionData.updated_itinerary)) {
            const oldActivities = new Map<string, Activity>();
            itinerary.forEach((day) => (day.activities || []).forEach((act) => oldActivities.set(act.id, act)));

            const mergedItinerary: DayPlan[] = await Promise.all(
              actionData.updated_itinerary.map(async (day: DayPlan, dayIdx: number) => {
                const mergedActivities = await Promise.all(
                  (day.activities || []).map(async (act: any, actIdx: number) => {
                    const actId = act.id || `gen-${Date.now()}-${dayIdx}-${actIdx}`;
                    const oldAct = oldActivities.get(actId);
                    if (oldAct && (oldAct.image_url || oldAct.image)) {
                      return {
                        ...oldAct,
                        ...act,
                        id: actId,
                        image_url: oldAct.image_url,
                        photo_url: oldAct.photo_url || oldAct.image_url,
                        image: oldAct.image || oldAct.image_url,
                        lat: act.lat || oldAct.lat,
                        lng: act.lng || oldAct.lng,
                      };
                    } else {
                      // Newly added place: fetch real Place Details (coordinates, photos, hours, etc.)
                      const placeDetails = await fetchPlaceDetails(act.title);
                      return {
                        ...act,
                        id: actId,
                        image_url: placeDetails.photo_url || null,
                        photo_url: placeDetails.photo_url || null,
                        image: placeDetails.photo_url || null,
                        lat: act.lat && act.lat !== 0 ? act.lat : (placeDetails.lat || 0),
                        lng: act.lng && act.lng !== 0 ? act.lng : (placeDetails.lng || 0),
                        rating: placeDetails.rating ?? act.rating ?? null,
                        userRatingsTotal: placeDetails.userRatingsTotal ?? act.userRatingsTotal ?? null,
                        openingHours: placeDetails.openingHours ?? act.openingHours ?? null,
                        website: placeDetails.website ?? act.website ?? null,
                        phoneNumber: placeDetails.phoneNumber ?? act.phoneNumber ?? null,
                      };
                    }
                  })
                );
                const sortedActivities = [...mergedActivities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
                return {
                  ...day,
                  day: dayIdx + 1, // Renumber remaining days 1, 2, 3...
                  activities: sortedActivities,
                };
              })
            );

            onUpdateItinerary(mergedItinerary);
            actionsTaken.push("อัปเดตตารางเดินทาง (Itinerary)");
          }

          // 2. Update Preferences
          if (actionData.updated_preferences && onUpdatePreferences) {
            onUpdatePreferences(actionData.updated_preferences);
            actionsTaken.push("อัปเดตความต้องการเดินทาง (Preferences)");
          }

          // 3. Update Hotel
          if (actionData.updated_hotel?.hotelName) {
            if (onUpdateHotel) {
              onUpdateHotel(actionData.updated_hotel.hotelName);
            }
            if (onUpdatePreferences) {
              onUpdatePreferences({ selectedHotel: actionData.updated_hotel.hotelName });
            }
            actionsTaken.push(`สลับโรงแรมที่พักเป็น "${actionData.updated_hotel.hotelName}"`);
          }

          // 4. Update Flight
          if (actionData.updated_flight) {
            const flightInfo = actionData.updated_flight;
            if (onUpdatePreferences) {
              onUpdatePreferences({
                hasFlight: flightInfo.hasFlight || (flightInfo.flightCode ? "yes" : "no"),
                flightCode: flightInfo.flightCode,
                originIata: flightInfo.originIata,
              });
            }
            if (onUpdateFlight && flightInfo.flightCode) {
              onUpdateFlight(flightInfo.flightCode);
            }
            actionsTaken.push(`อัปเดตข้อมูลเที่ยวบิน (${flightInfo.flightCode || flightInfo.originIata || "ค้นหาตั๋ว"})`);
          }

          if (actionsTaken.length > 0) {
            actionSummaryText = `⚡ ดำเนินการอัปเดตสำเร็จ: ${actionsTaken.join(" • ")}`;
          }
        } catch (e) {
          console.error("Failed to execute AI actions:", e);
        }
      }

      updateAndNotifyMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response,
          actionSummary: actionSummaryText,
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      updateAndNotifyMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "ขออภัยครับ ระบบเชื่อมต่อขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะครับ",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Check if last message was from assistant asking for confirmation or choices
  const lastMessage = messages[messages.length - 1];
  const isPendingConfirmation =
    lastMessage?.role === "assistant" &&
    !lastMessage.actionSummary &&
    (lastMessage.content.includes("ไหมครับ") ||
      lastMessage.content.includes("ดีครับ") ||
      lastMessage.content.includes("ใช่ไหมครับ") ||
      lastMessage.content.includes("เห็นด้วยไหม") ||
      lastMessage.content.includes("สะดวกให้ผม") ||
      lastMessage.content.includes("หรืออยาก") ||
      lastMessage.content.includes("?"));

  const confirmationChips = [
    "ตกลงครับ บันทึกลงในแผนเลย",
    "ขอเลือกเป็นวันอื่นแทนครับ",
    "แนะนำตัวเลือกอื่นเพิ่มเติมหน่อยครับ",
    "ขอยกเลิกก่อนครับ ยังไม่เพิ่ม",
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full travel-gradient shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 ring-4 ring-primary/20 group overflow-hidden p-0.5"
        title="Open Pixinerary Concierge Chat"
      >
        <img
          src="/logos/chatbot_profile.png"
          alt="Pixinerary Concierge"
          className="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: "100vw", height: "100vh" }
    : {
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      };

  return (
    <div
      style={windowStyle}
      className={`fixed bg-background/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-75 ${
        isDragging || activeResizeHandle ? "select-none" : ""
      }`}
    >
      {/* ── Resizing Handles (All Sides & Corners) ── */}
      {!isMaximized && (
        <>
          <div onMouseDown={(e) => handleResizeMouseDown(e, "n")} className="absolute top-0 left-3 right-3 h-2 cursor-n-resize z-50 hover:bg-primary/30 transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "s")} className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize z-50 hover:bg-primary/30 transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "w")} className="absolute top-3 bottom-3 left-0 w-2 cursor-w-resize z-50 hover:bg-primary/30 transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "e")} className="absolute top-3 bottom-3 right-0 w-2 cursor-e-resize z-50 hover:bg-primary/30 transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "nw")} className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50 hover:bg-primary/40 rounded-tl-2xl transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "ne")} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50 hover:bg-primary/40 rounded-tr-2xl transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "sw")} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50 hover:bg-primary/40 rounded-bl-2xl transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "se")} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 hover:bg-primary/40 rounded-br-2xl transition-colors" />
        </>
      )}

      {/* ── Draggable Header ── */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="travel-gradient px-4 py-3 flex items-center justify-between shadow-md shrink-0 cursor-move select-none"
        title="Drag header to move floating window"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner overflow-hidden shrink-0">
            <img
              src="/logos/chatbot_profile.png"
              alt="Pix"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-white/70" />
                Pix (พิกซ์)
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Online
              </span>
            </div>
            <p className="text-[11px] text-white/80 font-medium">Your AI Travel Companion ✈️📸</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleMaximize}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title={isMaximized ? "Restore Window Size" : "Maximize Window"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Minimize to Floating Button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-xs mt-0.5 border border-white/20 bg-primary/20">
                <img
                  src="/logos/chatbot_profile.png"
                  alt="Bot Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="flex flex-col max-w-[85%] space-y-1">
              <div
                className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "travel-gradient text-white rounded-tr-xs font-medium"
                    : "bg-card border border-border/80 text-foreground rounded-tl-xs"
                }`}
              >
                {msg.content}
              </div>
              {msg.actionSummary && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl px-3 py-1.5 font-medium animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{msg.actionSummary}</span>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-xs border border-white/20 bg-primary/20">
              <img
                src="/logos/chatbot_profile.png"
                alt="Bot Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="bg-card border border-border/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-xs text-muted-foreground ml-2 font-medium">พิกซ์กำลังคิดให้แป๊บนึงนะครับ... ☕✨</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Actions / Confirmation Section */}
      <div className="px-4 py-2 border-t border-border/60 bg-muted/30">
        {isPendingConfirmation ? (
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              คำตอบด่วนเพื่อยืนยัน (Quick Confirmation)
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {confirmationChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="shrink-0 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary hover:text-white text-xs text-primary transition-all font-medium shadow-2xs"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">คำสั่งด่วนที่แนะนำ (Quick Actions)</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="shrink-0 px-3 py-1.5 rounded-full border border-border/80 bg-background/80 hover:bg-primary/10 hover:border-primary/50 text-xs text-foreground hover:text-primary transition-all font-medium shadow-2xs"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-border bg-card shrink-0">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="พิมพ์บอกความต้องการ เช่น เปลี่ยนโรงแรม, สลับวัน, หรือตอบยืนยัน..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            className="flex-1 rounded-full border-border/80 px-4 focus-visible:ring-primary"
          />
          <Button size="icon" className="rounded-full travel-gradient shrink-0 shadow-md hover:scale-105 transition-transform" onClick={() => sendMessage(input)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;

