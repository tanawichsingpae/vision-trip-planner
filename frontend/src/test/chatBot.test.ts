import { describe, it, expect } from "vitest";
import { inferContextualQuickActions, getInitialWelcomeMessage } from "@/components/ChatBot";

describe("ChatBot Bilingual Support", () => {
  describe("getInitialWelcomeMessage()", () => {
    it("generates Thai welcome message and quick actions for 'th'", () => {
      const msg = getInitialWelcomeMessage("โตเกียว", "th", "Gemini 2.5 Flash");
      expect(msg.id).toBe("welcome-th");
      expect(msg.role).toBe("assistant");
      expect(msg.content).toContain("สวัสดีครับ! พิกโซ่ (Pixo) เองครับ");
      expect(msg.content).toContain("โตเกียว");
      expect(msg.suggestedQuickActions).toBeDefined();
      expect(msg.suggestedQuickActions?.length).toBeGreaterThan(0);
      expect(msg.suggestedQuickActions?.[0]).toContain("โตเกียว");
    });

    it("generates English welcome message and quick actions for 'en'", () => {
      const msg = getInitialWelcomeMessage("Tokyo", "en", "Gemini 2.5 Flash");
      expect(msg.id).toBe("welcome-en");
      expect(msg.role).toBe("assistant");
      expect(msg.content).toContain("Hello! I'm Pixo");
      expect(msg.content).toContain("Tokyo");
      expect(msg.suggestedQuickActions).toBeDefined();
      expect(msg.suggestedQuickActions?.length).toBeGreaterThan(0);
      expect(msg.suggestedQuickActions?.[0]).toContain("Must-try restaurants in Tokyo");
    });
  });

  describe("inferContextualQuickActions() - Thai Mode", () => {
    it("suggests confirmation options when a quoted place is proposed with a question", () => {
      const actions = inferContextualQuickActions(
        'คุณสนใจเพิ่ม "วัดพระแก้ว" ลงในวันที่ 1 ไหมครับ?',
        undefined,
        "กรุงเทพมหานคร",
        [],
        null,
        "th"
      );
      expect(actions[0]).toBe('ตกลง เพิ่ม "วัดพระแก้ว" ลงในวันที่ 1เลยครับ');
      expect(actions[1]).toBe('ขอเปลี่ยน "วัดพระแก้ว" ไปวันอื่นแทนครับ');
      expect(actions[2]).toBe("ขอตัวเลือกสถานที่อื่นใกล้ๆ แทนครับ");
      expect(actions[3]).toBe("ขอยกเลิกก่อนครับ ยังไม่เพิ่ม");
    });

    it("extracts numbered options correctly", () => {
      const content = "ผมขอแนะนำ 2 ตัวเลือกครับ:\n1. Shibuya Sky\n2. Roppongi Hills";
      const actions = inferContextualQuickActions(content, undefined, "Tokyo", [], null, "th");
      expect(actions[0]).toBe("เลือกข้อ 1 (Shibuya Sky) ครับ");
      expect(actions[1]).toBe("เลือกข้อ 2 (Roppongi Hills) ครับ");
    });

    it("infers budget options", () => {
      const actions = inferContextualQuickActions("ทริปนี้ตั้งงบประมาณไว้เท่าไหร่ครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("งบประมาณ 20,000 - 30,000 บาทครับ");
      expect(actions).toContain("ขอแบบประหยัด คุ้มค่าครับ");
    });

    it("infers travel pace options", () => {
      const actions = inferContextualQuickActions("อยากได้จังหวะการเดินทางแบบชิลๆ หรือเน้นเก็บไฮไลท์ครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("ขอแบบชิลๆ เน้นพักผ่อนสบายๆ ไม่เร่งรีบครับ");
      expect(actions).toContain("เน้นเที่ยวแน่นๆ เก็บครบทุกไฮไลท์ครับ");
    });

    it("infers time slot options", () => {
      const actions = inferContextualQuickActions("สะดวกจัดลงในวันไหน หรือช่วงเวลาใดดีครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("จัดลงในวันที่ 1 เลยครับ");
      expect(actions).toContain("ขอเป็นช่วงบ่ายหรือเย็นครับ");
    });

    it("infers action completed follow-ups", () => {
      const actions = inferContextualQuickActions("อัปเดตตารางเดินทางให้เรียบร้อยแล้วครับ", "⚡ ดำเนินการอัปเดตสำเร็จ", "Tokyo", [], null, "th");
      expect(actions).toContain("ตารางเดินทางลงตัวมากครับ ขอบคุณครับ");
      expect(actions).toContain("ช่วยแนะนำร้านอาหารใกล้ๆ แผนวันนี้");
    });

    it("infers cafe & restaurant options", () => {
      const actions = inferContextualQuickActions("อยากได้ร้านอาหารหรือคาเฟ่แถวนี้ไหมครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("แนะนำร้านอาหารท้องถิ่นชื่อดังครับ");
      expect(actions).toContain("ขอคาเฟ่ถ่ายรูปสวย บรรยากาศดีครับ");
    });

    it("infers hotel options", () => {
      const actions = inferContextualQuickActions("ต้องการเปลี่ยนโรงแรมที่พักในโตเกียวไหมครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("สลับไปพักโรงแรมที่แนะนำเลยครับ");
      expect(actions).toContain("ขอโรงแรมราคาประหยัดใกล้สถานีรถไฟ");
    });

    it("infers weather options", () => {
      const actions = inferContextualQuickActions("พยากรณ์อากาศช่วงนี้อาจมีฝนตกเล็กน้อยครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("ช่วยปรับแผนเป็นสถานที่ในร่มหากฝนตก");
      expect(actions).toContain("ควรเตรียมตัวและแต่งกายอย่างไร");
    });

    it("infers flight options", () => {
      const actions = inferContextualQuickActions("มีข้อมูลเที่ยวบินหรือการเดินทางมาสนามบินแล้วหรือยังครับ", undefined, "Tokyo", [], null, "th");
      expect(actions).toContain("เช็คเวลาเดินทางไปสนามบินวันกลับ");
      expect(actions).toContain("มีพาสรถไฟหรือบัตรโดยสารแนะนำไหม");
    });
  });

  describe("inferContextualQuickActions() - English Mode", () => {
    it("suggests English confirmation options when a quoted place is proposed with a question", () => {
      const actions = inferContextualQuickActions(
        'Would you like me to schedule "Tokyo Tower" for Day 2?',
        undefined,
        "Tokyo",
        [],
        null,
        "en"
      );
      expect(actions[0]).toBe('Yes, add "Tokyo Tower" to Day 2');
      expect(actions[1]).toBe('Move "Tokyo Tower" to another day');
      expect(actions[2]).toBe("Show other nearby options instead");
      expect(actions[3]).toBe("Cancel for now, don't add");
    });

    it("extracts numbered options in English", () => {
      const content = "Here are 2 great viewpoints:\n1. Shibuya Sky\n2. Roppongi Hills";
      const actions = inferContextualQuickActions(content, undefined, "Tokyo", [], null, "en");
      expect(actions[0]).toBe("Choose Option 1 (Shibuya Sky)");
      expect(actions[1]).toBe("Choose Option 2 (Roppongi Hills)");
      expect(actions[2]).toBe("Show more options");
      expect(actions[3]).toBe("Please schedule this into the plan");
    });

    it("infers English budget options", () => {
      const actions = inferContextualQuickActions("What is your expected budget for this trip?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Moderate budget ($50 - $100/day)");
      expect(actions).toContain("Budget-friendly & economical");
      expect(actions).toContain("Luxury & premium experience");
      expect(actions).toContain("Estimate the total trip budget");
    });

    it("infers English travel pace options", () => {
      const actions = inferContextualQuickActions("Do you prefer a relaxed pace or packed with sights?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Relaxed & leisurely pace");
      expect(actions).toContain("Balanced & moderate pace");
      expect(actions).toContain("Active & packed with highlights");
    });

    it("infers English day / time options", () => {
      const actions = inferContextualQuickActions("Which day or what time would suit you best?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Schedule it for Day 1");
      expect(actions).toContain("Schedule it for Day 2 instead");
      expect(actions).toContain("Prefer afternoon or evening");
    });

    it("infers English deletion confirmation", () => {
      const actions = inferContextualQuickActions("Would you like me to delete this activity from your schedule?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Confirm and delete this item");
      expect(actions).toContain("Keep it in the plan for now");
    });

    it("infers English action completed follow-ups", () => {
      const actions = inferContextualQuickActions("I have updated your itinerary!", "⚡ Action completed", "Tokyo", [], null, "en");
      expect(actions).toContain("The plan looks great, thanks!");
      expect(actions).toContain("Recommend nearby food spots");
      expect(actions).toContain("Make the schedule more flexible");
      expect(actions).toContain("Check travel routes between spots");
    });

    it("infers English cafe & restaurant options", () => {
      const actions = inferContextualQuickActions("Looking for a cozy cafe or dining recommendations?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Recommend top local dishes");
      expect(actions).toContain("Find photogenic cafes nearby");
      expect(actions).toContain("Add a lunch stop to Day 1");
    });

    it("infers English hotel options", () => {
      const actions = inferContextualQuickActions("Would you like to explore hotel options or accommodation?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Switch to the suggested hotel");
      expect(actions).toContain("Budget hotel near public transit");
      expect(actions).toContain("Scenic resort or boutique hotel");
    });

    it("infers English weather options", () => {
      const actions = inferContextualQuickActions("The weather forecast suggests rain in the afternoon.", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("Indoor alternatives in case of rain");
      expect(actions).toContain("What to pack and wear?");
      expect(actions).toContain("Check weather forecast for Day 2");
    });

    it("infers English flight options", () => {
      const actions = inferContextualQuickActions("Do you have your flight or transit tickets booked?", undefined, "Tokyo", [], null, "en");
      expect(actions).toContain("How to get between these places?");
      expect(actions).toContain("Airport transit time on departure");
      expect(actions).toContain("Recommend transit passes or cards");
    });

    it("returns destination-tailored English default starters", () => {
      const actions = inferContextualQuickActions("", undefined, "Kyoto", [], null, "en");
      expect(actions).toContain("Must-try restaurants in Kyoto");
      expect(actions).toContain("Make the itinerary more relaxed");
      expect(actions).toContain("Top photo spots not to miss");
      expect(actions).toContain("Review our trip budget");
    });
  });
});
