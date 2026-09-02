import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, X, CheckCircle2, Maximize2, Minimize2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAI, getAIModelInfo } from "@/context/AIProviderContext";
import { chatWithAssistant, type TripPreferences, fetchPlacePhoto } from "@/services/aiService";
import { type DayPlan, type Activity } from "@/components/TravelItinerary";
import { fetchPlaceDetails } from "@/api/places";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionSummary?: string;
  suggestedQuickActions?: string[];
  aiModel?: string;
  ai_model?: string;
  timestamp?: number;
}

export function inferContextualQuickActions(
  content: string,
  actionSummary?: string,
  locationName: string = "ทริปนี้",
  itinerary: DayPlan[] = [],
  preferences?: TripPreferences | null
): string[] {
  const raw = content || "";
  const text = raw.toLowerCase();

  // ── 1. Extract Specific Quoted Entities or Place Names from Bot Message ──
  const quoteMatches = Array.from(raw.matchAll(/["'“「]([^"'”」\n]{2,30})["'”」]/g))
    .map((m) => m[1].trim())
    .filter((name) => name.length > 1 && !["action", "json", "updated_itinerary", "suggested_quick_actions"].includes(name.toLowerCase()));

  // Extract Day Number if mentioned (e.g. วันที่ 1, วันที่ 2)
  const dayMatch = raw.match(/วันที่\s*(\d+)/i);
  const mentionedDay = dayMatch ? `วันที่ ${dayMatch[1]}` : "";

  // ── 2. Extract Numbered / Bulleted Options from Bot Message ──
  const listMatches = Array.from(raw.matchAll(/(?:^|\n)\s*(?:[1-4]\.|\d+\)|\-\s*|\•\s*|ข้อ\s*[1-4]\s*[:\.]?)\s*([^\n:—–(]{2,35})/g))
    .map((m) => m[1].replace(/^[\*\-\s]+/, "").trim())
    .filter((item) => item.length >= 2 && !item.startsWith("http"));

  // ── A. If Bot Proposed / Asked Confirmation for Specific Places ──
  if (quoteMatches.length > 0 && (text.includes("ไหมครับ") || text.includes("ดีไหม") || text.includes("สะดวกไหม") || text.includes("ใช่ไหม") || text.includes("แนะนำให้เพิ่ม") || text.includes("บันทึก"))) {
    const primaryPlace = quoteMatches[0];
    const targetDayText = mentionedDay ? `ลงใน${mentionedDay}` : "ลงในแผน";
    return [
      `ตกลง เพิ่ม "${primaryPlace}" ${targetDayText}เลยครับ`,
      `ขอเปลี่ยน "${primaryPlace}" ไปวันอื่นแทนครับ`,
      `ขอตัวเลือกสถานที่อื่นใกล้ๆ แทนครับ`,
      "ขอยกเลิกก่อนครับ ยังไม่เพิ่ม",
    ];
  }

  // ── B. If Bot Gave a Numbered Choice / List of Recommendations ──
  if (listMatches.length >= 2) {
    const opt1 = listMatches[0].slice(0, 22);
    const opt2 = listMatches[1].slice(0, 22);
    const result = [
      `เลือกข้อ 1 (${opt1}) ครับ`,
      `เลือกข้อ 2 (${opt2}) ครับ`,
    ];
    if (listMatches[2]) {
      result.push(`เลือกข้อ 3 (${listMatches[2].slice(0, 22)}) ครับ`);
    } else {
      result.push("ขอตัวเลือกอื่นเพิ่มเติมครับ");
    }
    result.push("ช่วยจัดเวลาลงในแผนให้ด้วยครับ");
    return result.slice(0, 4);
  }

  // ── C. If Bot Asked Specific Preference Questions ──
  // Budget Question
  if (text.includes("งบ") || text.includes("ราคา") || text.includes("budget") || text.includes("ค่าใช้จ่าย")) {
    return [
      "งบประมาณ 20,000 - 30,000 บาทครับ",
      "ขอแบบประหยัด คุ้มค่าครับ",
      "ไม่จำกัดงบ ขอแบบพรีเมียมครับ",
      "ช่วยคำนวณงบประมาณตามแผนปัจจุบันให้หน่อย",
    ];
  }

  // Pace / Travel Style Question
  if (text.includes("ชิล") || text.includes("จังหวะ") || text.includes("กี่วัน") || text.includes("สไตล์") || text.includes("แน่น") || text.includes("ผ่อนคลาย") || text.includes("pace")) {
    return [
      "ขอแบบชิลๆ เน้นพักผ่อนสบายๆ ไม่เร่งรีบครับ",
      "ขอแบบปานกลาง เดินทางกำลังดีครับ",
      "เน้นเที่ยวแน่นๆ เก็บครบทุกไฮไลท์ครับ",
      "ขอเวลาแวะถ่ายรูปเยอะๆ ครับ",
    ];
  }

  // Day / Time Slot Question
  if (text.includes("วันไหน") || text.includes("กี่โมง") || text.includes("ช่วงเวลา") || text.includes("เช้าหรือบ่าย") || text.includes("วันใด")) {
    return [
      "จัดลงในวันที่ 1 เลยครับ",
      "จัดลงในวันที่ 2 แทนครับ",
      "ขอเป็นช่วงบ่ายหรือเย็นครับ",
      "ช่วยเลือกวันที่เดินทางสะดวกที่สุดให้เลยครับ",
    ];
  }

  // ── D. If Bot Asked a General Confirmation / Opinion Question ──
  if (
    text.includes("ไหมครับ") ||
    text.includes("ดีไหม") ||
    text.includes("สะดวกไหม") ||
    text.includes("ใช่ไหมครับ") ||
    text.includes("เห็นด้วยไหม") ||
    text.includes("ต้องการให้ผม") ||
    text.includes("สะดวกให้ผม")
  ) {
    if (text.includes("ลบ") || text.includes("ตัดออก")) {
      return [
        "ยืนยันลบรายการนี้ออกได้เลยครับ",
        "ยังไม่ขอลบครับ เก็บไว้ก่อน",
        "ช่วยหาที่เที่ยวอื่นมาแทนที่นี้หน่อยครับ",
        "ขอยกเลิกก่อนครับ",
      ];
    }
    return [
      "ตกลงตามนี้เลยครับ บันทึกได้เลย",
      "ขอปรับเปลี่ยนเวลาหรือวันแทนครับ",
      "ช่วยแนะนำตัวเลือกอื่นเพิ่มเติมหน่อยครับ",
      "ขอยกเลิกก่อนครับ ยังไม่เพิ่ม",
    ];
  }

  // ── E. If Bot Just Updated Itinerary / Executed Action ──
  if (actionSummary || text.includes("อัปเดต") || text.includes("เรียบร้อยแล้ว") || text.includes("ปรับแผนให้แล้ว") || text.includes("บันทึกแล้ว")) {
    return [
      "ตารางเดินทางลงตัวมากครับ ขอบคุณครับ",
      "ช่วยแนะนำร้านอาหารใกล้ๆ แผนวันนี้",
      "อยากปรับเวลาให้ยืดหยุ่นขึ้นอีกหน่อย",
      "ช่วยเช็คการเดินทางระหว่างแต่ละสถานที่",
    ];
  }

  // ── F. Cafe & Restaurant Topics ──
  if (text.includes("คาเฟ่") || text.includes("ร้านอาหาร") || text.includes("ของกิน") || text.includes("เมนู") || text.includes("ราเมง") || text.includes("กาแฟ") || text.includes("อาหาร")) {
    return [
      "แนะนำร้านอาหารท้องถิ่นชื่อดังครับ",
      "ขอคาเฟ่ถ่ายรูปสวย บรรยากาศดีครับ",
      "ช่วยจัดเวลาแวะทานลงในแผนวันแรกเลยครับ",
      "มีร้านอาหารมื้อค่ำวิวสวยแนะนำไหมครับ",
    ];
  }

  // ── G. Hotels & Accommodations ──
  if (text.includes("โรงแรม") || text.includes("ที่พัก") || text.includes("hotel") || text.includes("resort") || text.includes("ห้องพัก")) {
    return [
      "สลับไปพักโรงแรมที่แนะนำเลยครับ",
      "ขอโรงแรมราคาประหยัดใกล้สถานีรถไฟ",
      "แนะนำโรงแรมวิวสวยบรรยากาศดี",
      "ช่วยดูรายละเอียดการเดินทางไปโรงแรม",
    ];
  }

  // ── H. Weather & Season ──
  if (text.includes("อากาศ") || text.includes("ฝน") || text.includes("แดด") || text.includes("อุณหภูมิ") || text.includes("ฤดู") || text.includes("พยากรณ์")) {
    return [
      "ช่วยปรับแผนเป็นสถานที่ในร่มหากฝนตก",
      "ควรเตรียมตัวและแต่งกายอย่างไร",
      "เช็คสภาพอากาศวันที่ 2 ให้หน่อยครับ",
      "แนะนำกิจกรรมช่วงแดดร่มลมตก",
    ];
  }

  // ── I. Flight & Transport ──
  if (text.includes("เที่ยวบิน") || text.includes("สนามบิน") || text.includes("flight") || text.includes("รถไฟ") || text.includes("การเดินทาง") || text.includes("ตั๋ว")) {
    return [
      "แนะนำการเดินทางระหว่างแต่ละสถานที่",
      "เช็คเวลาเดินทางไปสนามบินวันกลับ",
      "มีพาสรถไฟหรือบัตรโดยสารแนะนำไหม",
      "จัดเวลาวันแรกให้พอดีกับเวลาเครื่องลง",
    ];
  }

  // ── J. Default Starters for Destination ──
  return [
    `แนะนำร้านอาหารเด็ดใน ${locationName}`,
    "ช่วยปรับแผนให้ชิลขึ้นหน่อย",
    "แนะนำจุดถ่ายรูปไฮไลท์ที่ไม่ควรพลาด",
    "ช่วยตรวจสอบงบประมาณของทริปนี้",
  ];
}

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
  const { model } = useAI();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (externalMessages && externalMessages.length > 0) return externalMessages;
    return [
      {
        id: "1",
        role: "assistant",
        content: `สวัสดีครับ! พิกซ์ (Pix) เองครับ 😊 Your AI Travel Companion สำหรับทริป ${locationName} ✈️📸\n\nไม่ว่าคุณอยากจะปรับตารางเดินทาง สลับโรงแรม เปลี่ยนงบประมาณ หรือส่องสถานที่จากรูปถ่าย พิกซ์พร้อมช่วยคุณคิดช่วยจัดให้เสมอ บอกผมได้เลยนะครับ!`,
        suggestedQuickActions: inferContextualQuickActions("", "", locationName, itinerary, preferences),
        aiModel: model,
        timestamp: Date.now(),
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

    // 2. Fallback: Find raw JSON starting at '{' with action or suggested_quick_actions
    if (!jsonString) {
      const firstBrace = responseText.indexOf("{");
      if (
        firstBrace !== -1 &&
        (responseText.includes('"action"') ||
          responseText.includes('"updated_itinerary"') ||
          responseText.includes('"suggested_quick_actions"') ||
          responseText.includes('"quick_actions"') ||
          responseText.includes('"quick_replies"'))
      ) {
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
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: Date.now() };
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

      // Resolve contextual quick actions for the new response
      let suggestedActions: string[] = [];
      if (actionData?.suggested_quick_actions && Array.isArray(actionData.suggested_quick_actions) && actionData.suggested_quick_actions.length > 0) {
        suggestedActions = actionData.suggested_quick_actions;
      } else if (actionData?.quick_actions && Array.isArray(actionData.quick_actions) && actionData.quick_actions.length > 0) {
        suggestedActions = actionData.quick_actions;
      } else if (actionData?.quick_replies && Array.isArray(actionData.quick_replies) && actionData.quick_replies.length > 0) {
        suggestedActions = actionData.quick_replies;
      } else {
        suggestedActions = inferContextualQuickActions(response, actionSummaryText, locationName, itinerary, preferences);
      }

      updateAndNotifyMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response,
          actionSummary: actionSummaryText,
          suggestedQuickActions: suggestedActions,
          aiModel: model,
          timestamp: Date.now(),
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
          suggestedQuickActions: [
            "ลองใหม่อีกครั้งครับ",
            "ช่วยแนะนำสถานที่ยอดนิยม",
            "ตรวจสอบตารางการเดินทาง",
          ],
          aiModel: model,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Find the last assistant message and its dynamic quick actions
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const activeQuickActions =
    lastAssistantMessage?.suggestedQuickActions && lastAssistantMessage.suggestedQuickActions.length > 0
      ? lastAssistantMessage.suggestedQuickActions
      : inferContextualQuickActions(
          lastAssistantMessage?.content || "",
          lastAssistantMessage?.actionSummary,
          locationName,
          itinerary,
          preferences
        );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 size-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl flex items-center justify-center hover:scale-110 transition-all z-50 ring-4 ring-primary/20 group overflow-hidden p-0.5 border border-white/20"
        title="Open Pixinerary Concierge Chat"
      >
        <img
          src="/logos/chatbot_profile.png"
          alt="Pixinerary Concierge"
          className="size-full rounded-full object-cover group-hover:scale-110 transition-transform"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <span className="absolute top-1 right-1 size-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
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
      className={`fixed bg-background/95 backdrop-blur-2xl border border-border/80 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-75 ${
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
          <div onMouseDown={(e) => handleResizeMouseDown(e, "nw")} className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50 hover:bg-primary/40 rounded-tl-3xl transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "ne")} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50 hover:bg-primary/40 rounded-tr-3xl transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "sw")} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50 hover:bg-primary/40 rounded-bl-3xl transition-colors" />
          <div onMouseDown={(e) => handleResizeMouseDown(e, "se")} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 hover:bg-primary/40 rounded-br-3xl transition-colors" />
        </>
      )}

      {/* ── Draggable Header ── */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0 cursor-move select-none shadow-xs"
        title="Drag header to move floating window"
      >
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/25 shadow-inner overflow-hidden shrink-0">
            <img
              src="/logos/chatbot_profile.png"
              alt="Pix"
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-white text-xs sm:text-sm tracking-tight flex items-center gap-1">
                <Move className="size-3 text-white/70" />
                <span>Pix Concierge</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-400/25 text-emerald-100 border border-emerald-300/30 px-2 py-0.2 rounded-full">
                <span className="size-1.5 rounded-full bg-emerald-300 animate-ping" />
                Online
              </span>
              {(() => {
                const modelInfo = getAIModelInfo(model);
                if (!modelInfo) return null;
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 text-white border border-white/25 px-2 py-0.2 rounded-full shadow-2xs">
                    <Sparkles className="size-2.5 text-[#ffe0a9]" />
                    <span>{modelInfo.label}</span>
                  </span>
                );
              })()}
            </div>
            <p className="text-[10px] text-white/80">Your AI Travel Companion ✈️📸</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleMaximize}
            className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title={isMaximized ? "Restore Window Size" : "Maximize Window"}
          >
            {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Minimize to Floating Button"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="size-7 rounded-xl overflow-hidden shrink-0 shadow-xs mt-0.5 border border-border/80 bg-secondary/80">
                <img
                  src="/logos/chatbot_profile.png"
                  alt="Bot Profile"
                  className="size-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="flex flex-col max-w-[85%] space-y-1">
              <div
                className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-2xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-xs font-medium"
                    : "bg-card border border-border/70 text-foreground rounded-tl-xs"
                }`}
              >
                {msg.content}
              </div>
              {msg.actionSummary && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1 font-medium animate-fade-in">
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                  <span>{msg.actionSummary}</span>
                </div>
              )}
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 pl-1 font-medium select-none">
                  <Sparkles className="size-2.5 text-primary" />
                  <span>โมเดล: {getAIModelInfo(msg.aiModel || msg.ai_model || model)?.label || "AI Model"}</span>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="size-7 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <User className="size-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="size-7 rounded-xl overflow-hidden shrink-0 shadow-xs border border-border/80 bg-secondary/80">
              <img
                src="/logos/chatbot_profile.png"
                alt="Bot Profile"
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="bg-card border border-border/70 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs">
              <div className="flex gap-1.5 items-center">
                <span className="size-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-xs text-muted-foreground ml-1.5 font-medium">พิกซ์กำลังวิเคราะห์ข้อมูล... ☕✨</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Dynamic Contextual Quick Actions Section */}
      {activeQuickActions && activeQuickActions.length > 0 && (
        <div className="px-3.5 py-2 border-t border-border/60 bg-secondary/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 select-none">
              <Sparkles className="size-3 text-primary animate-pulse" />
              คำสั่งด่วนที่แนะนำ (Quick Actions)
            </p>
            <span className="text-[9px] text-muted-foreground font-medium">บริบทสนทนา</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {activeQuickActions.map((action, idx) => (
              <button
                key={`${action}-${idx}`}
                onClick={() => sendMessage(action)}
                className="shrink-0 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-[11px] text-foreground transition-all font-medium shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-1 group"
              >
                <span className="size-1.5 rounded-full bg-primary group-hover:bg-primary-foreground transition-colors" />
                <span>{action}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-border/70 bg-card shrink-0">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="พิมพ์บอกความต้องการ เช่น เปลี่ยนโรงแรม, สลับวัน, หรือตอบยืนยัน..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            className="flex-1 rounded-full border-border/80 px-4 h-9 text-xs focus-visible:ring-primary"
          />
          <Button
            size="icon"
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-2xs hover:scale-105 transition-transform size-9"
            onClick={() => sendMessage(input)}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};



export default ChatBot;

