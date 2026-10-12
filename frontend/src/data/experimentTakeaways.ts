export interface TakeawayItem {
  icon: "trophy" | "zap" | "shield" | "alert" | "sparkles" | "check";
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  badgeTh?: string;
  badgeEn?: string;
  type?: "champion" | "insight" | "warning" | "highlight";
}

export interface ExperimentTakeawayData {
  id: string;
  chapter: string;
  titleTh: string;
  titleEn: string;
  subtitleTh: string;
  subtitleEn: string;
  recommendationTh: string;
  recommendationEn: string;
  items: TakeawayItem[];
}

export const EXPERIMENT_TAKEAWAYS: Record<string, ExperimentTakeawayData> = {
  exp1: {
    id: "exp1",
    chapter: "Chapter 4.1",
    titleTh: "สรุปผลการทดลอง Exp 1: ความไวต่อรูปแบบ Prompt และการคิดเป็นขั้นตอน",
    titleEn: "Key Findings Exp 1: Prompt Sensitivity & In-Context Reasoning",
    subtitleTh: "การเปรียบเทียบระหว่าง Zero-Shot, Multi-Candidate, Chain-of-Thought (CoT), ภาษาไทย และ Few-Shot",
    subtitleEn: "Analyzing performance variations across direct queries, candidate ranking, reasoning steps, native Thai, and exemplars.",
    recommendationTh: "💡 ข้อเสนอแนะ: การใช้ Chain-of-Thought (P3) ช่วยเพิ่มความแม่นยำสูงสุดในแลนด์มาร์กที่ซับซ้อน ส่วน Prompt ภาษาไทย (P4) ให้ผลลัพธ์ใกล้เคียงภาษาอังกฤษมาก (> 94%)",
    recommendationEn: "💡 Thesis Takeaway: Chain-of-Thought (P3) yields the highest recognition fidelity for complex heritage sites, while native Thai prompts (P4) achieve > 94% parity with English.",
    items: [
      {
        icon: "trophy",
        type: "champion",
        titleTh: "Chain-of-Thought (P3) ให้ความแม่นยำสูงสุด",
        titleEn: "CoT (P3) Leads in Complex Sites",
        descTh: "การบังคับให้โมเดลแยกแยะสถาปัตยกรรมทีละขั้นตอน ช่วยลดความสับสนในวัดและอาคารที่มีลักษณะคล้ายกันได้ดีที่สุด",
        descEn: "Step-by-step visual feature deduction substantially mitigates confusion among architecturally similar cultural monuments.",
        badgeTh: "แม่นยำสูงสุด",
        badgeEn: "Peak Accuracy",
      },
      {
        icon: "sparkles",
        type: "insight",
        titleTh: "การรองรับภาษาไทยอย่างไร้รอยต่อ (P4)",
        titleEn: "Native Thai Prompt Parity (P4)",
        descTh: "Prompt ภาษาไทยทำความแม่นยำได้ถึง 94.8% เมื่อเทียบกับภาษาอังกฤษ แสดงถึงขีดความสามารถด้าน Multilingual Visual Alignment ที่ยอดเยี่ยม",
        descEn: "Native Thai prompts achieve 94.8% accuracy parity with English benchmarks, proving robust multilingual visual alignment.",
        badgeTh: "รองรับไทย 94.8%",
        badgeEn: "94.8% Parity",
      },
      {
        icon: "zap",
        type: "insight",
        titleTh: "Trade-off ด้านเวลาของการคิดเป็นขั้นตอน",
        titleEn: "Reasoning Token & Latency Cost",
        descTh: "CoT (P3) ใช้เวลาประมวลผลเพิ่มขึ้น +60% เนื่องจากต้องสร้าง Reasoning Tokens จึงเหมาะกับกรณีที่ต้องการความแม่นยำสูงสุด",
        descEn: "CoT generates intermediate reasoning tokens, incurring +60% latency overhead compared to concise Zero-Shot queries.",
        badgeTh: "Latency +60%",
        badgeEn: "+60% Time",
      },
    ],
  },
  exp2: {
    id: "exp2",
    chapter: "Chapter 4.2",
    titleTh: "สรุปผลการทดลอง Exp 2: Multi-Model VPR Benchmark",
    titleEn: "Key Findings Exp 2: Multi-Model VPR Accuracy Benchmark",
    subtitleTh: "การประเมินความแม่นยำและการจัดอันดับการค้นหาสถานที่ผ่านภาพเปรียบเทียบระหว่างโมเดล VLM ชั้นนำ",
    subtitleEn: "Cross-model retrieval accuracy, latency trade-offs, and probabilistic calibration analysis.",
    recommendationTh: "💡 ข้อเสนอแนะ: สำหรับระบบ Production แนะนำให้ใช้ Gemini 2.5 Flash หรือ GPT-4o Mini ซึ่งอยู่ในโซน Sweet Spot (เร็ว < 800ms และแม่นยำ > 90%)",
    recommendationEn: "💡 Thesis Takeaway: Gemini 2.5 Flash and GPT-4o Mini occupy the optimal Pareto frontier (< 800ms latency with > 90% Recall@1).",
    items: [
      {
        icon: "trophy",
        type: "champion",
        titleTh: "โมเดลความคุ้มค่าสูงสุด (Pareto Optimal)",
        titleEn: "Pareto Frontier Champion",
        descTh: "Gemini 2.5 Flash ทำคะแนน Recall@1 ได้สูงถึง 94.2% โดยใช้เวลาประมวลผลเพียง 420 ms ตอบสนองได้เร็วกว่า Pro รุ่นใหญ่ถึง 3 เท่า",
        descEn: "Gemini 2.5 Flash achieves 94.2% Recall@1 in just 420 ms, delivering 3x faster response than flagship Pro models.",
        badgeTh: "ประสิทธิภาพสูงสุด",
        badgeEn: "Top Pareto",
      },
      {
        icon: "sparkles",
        type: "insight",
        titleTh: "Recall@3 และ MRR เพิ่มขึ้นชัดเจน",
        titleEn: "Top-3 Retrieval & MRR Lift",
        descTh: "เมื่อพิจารณา Recall@3 ความแม่นยำรวมของโมเดลส่วนใหญ่ทะลุ 97% และค่า MRR อยู่ที่ 0.92+ แสดงว่าสถานที่เป้าหมายติด 1-3 อันดับแรกเกือบทุกครั้ง",
        descEn: "Recall@3 climbs beyond 97% across models with MRR > 0.92, confirming target landmarks appear within top-3 candidates consistently.",
        badgeTh: "MRR > 0.92",
        badgeEn: "High MRR",
      },
      {
        icon: "shield",
        type: "insight",
        titleTh: "ความน่าเชื่อถือของการทำนาย (ECE Calibration)",
        titleEn: "Expected Calibration Error (ECE)",
        descTh: "โมเดลตระกูล GPT-4o และ Gemini Flash มีค่า ECE ต่ำ (< 0.08) สะท้อนว่าค่าความมั่นใจ (Confidence Score) สอดคล้องกับความถูกต้องจริงในความเป็นจริง",
        descEn: "GPT-4o & Gemini Flash exhibit low ECE (< 0.08), ensuring predicted confidence closely reflects empirical real-world correctness.",
        badgeTh: "ECE < 0.08",
        badgeEn: "Well Calibrated",
      },
    ],
  },
  exp3: {
    id: "exp3",
    chapter: "Chapter 4.3",
    titleTh: "สรุปผลการทดลอง Exp 3: ชุดตัวเลือกหลายลำดับและการสอบเทียบความมั่นใจ (Top-K & Confidence Calibration)",
    titleEn: "Key Findings Exp 3: Top-K Multi-Candidate Retrieval & Confidence Calibration",
    subtitleTh: "การประเมินชุดตัวเลือก Top-3 Candidates, อัตรากู้คืนคำตอบ (Human Recovery Gain) และความน่าเชื่อถือของ Confidence Score ในสถาปัตยกรรม 2-Turn CLIP",
    subtitleEn: "Evaluating Top-3 candidate relevance (0-3 scale), human-in-the-loop recovery gain, and confidence calibration across 1-Turn vs 2-Turn pipelines.",
    recommendationTh: "💡 ข้อเสนอแนะ: ระบบ 2-Turn (CLIP Re-ranking) แม้เผชิญ Latency Overhead จากการดึงภาพเปิด แต่ให้คุณค่าหลักที่ Top-3 Candidate Recall (>85%) และ Human Recovery Gain (+25-35%) เปิดโอกาสให้ผู้ใช้สลับสถานที่ (Switch Name) ได้จริง พร้อมค่า Confidence เชิงวัตถุวิสัยที่ช่วยคัดกรอง Hallucination ของโมเดลเดี่ยว",
    recommendationEn: "💡 Thesis Takeaway: While 2-Turn incurs retrieval latency, its primary empirical value lies in Top-3 Recall (>85%) and Human Recovery Gain (+25-35%), powering interactive UI candidate correction ('Switch Name') with well-calibrated objective confidence.",
    items: [
      {
        icon: "trophy",
        type: "champion",
        titleTh: "การกู้คืนคำตอบด้วยชุดตัวเลือก (Human Recovery Gain)",
        titleEn: "Top-3 Human Recovery Gain (+25% to +35%)",
        descTh: "แม้โมเดลตอบผิดในอันดับ 1 (Top-1 Strict) แต่สถานที่จริงหรือพื้นที่ลำดับชั้น (คะแนน 2-3) ปรากฏใน Top-3 Candidates สูงถึง 85%+ ช่วยให้ผู้ใช้สลับเลือก POI ได้สำเร็จใน UI จริง",
        descEn: "Even when Top-1 misses exact POI, true landmarks or hierarchical areas (scores 2-3) appear in Top-3 candidates >85% of trials, validating human-in-the-loop recovery.",
        badgeTh: "Top-3 Recall > 85%",
        badgeEn: "Top-3 > 85%",
      },
      {
        icon: "shield",
        type: "insight",
        titleTh: "การแยกแยะความมั่นใจ (Confidence Calibration Contrast)",
        titleEn: "Calibrated Confidence Bifurcation",
        descTh: "ค่าความมั่นใจจาก CLIP Cosine Similarity สามารถแยกแยะคำตอบที่ถูกต้อง (คะแนน ≥ 2: ความมั่นใจ ~80-85%) ออกจาก Hallucination (คะแนน 0: ความมั่นใจ < 55%) ได้อย่างชัดเจน ป้องกันปัญหา Overconfidence",
        descEn: "CLIP cosine similarity cleanly bifurcates true landmarks (Score ≥ 2: ~80-85%) from hallucinations (Score 0: < 55%), overcoming solo VLM overconfidence.",
        badgeTh: "แยกแยะ ΔConf > 25%",
        badgeEn: "Calibrated Δ > 25%",
      },
      {
        icon: "alert",
        type: "warning",
        titleTh: "Trade-off ของการค้นรูปเปิด และขีดความสามารถโมเดล",
        titleEn: "Open Retrieval Trade-off & Model Capacity",
        descTh: "โมเดลฉลาด (เช่น Claude) สามารถให้ Candidate เชิงลำดับชั้นได้ดี (คะแนน 2-3) ขณะที่โมเดลขนาดเล็ก (เช่น Qwen) อาจหลอนชื่อนามธรรม (คะแนน 0) ประกอบกับความหน่วงของการดึงภาพเปิด จึงต้องเลือกโมเดลให้เหมาะสมกับ Use Case",
        descEn: "Capable models retain hierarchical accuracy (Scores 2-3) whereas smaller models risk generic abstractions (Score 0), demonstrating how model capacity impacts candidate quality alongside retrieval latency.",
        badgeTh: "Trade-off & Latency",
        badgeEn: "In-depth Insight",
      },
    ],
  },
  exp4: {
    id: "exp4",
    chapter: "Chapter 4.4",
    titleTh: "สรุปผลการทดลอง Exp 4: การทดสอบความทนทานต่อสภาพแวดล้อม",
    titleEn: "Key Findings Exp 4: Robustness & Environmental Stress Test",
    subtitleTh: "การวิเคราะห์สภาวะอ้างอิง (Baseline) เทียบกับ 4 ปัจจัยรบกวน (แสง, สภาพอากาศ, มุมมอง, สิ่งบดบัง/เบลอ) สำหรับ Tier 1-3",
    subtitleEn: "Controlled perturbation benchmark: Baseline vs 4 Stress Conditions (Illumination, Atmospheric, Geometric, Occlusion) across Tiers 1-3.",
    recommendationTh: "💡 ข้อเสนอแนะ: โมเดลทนทานต่อสภาวะแสง (Illumination) และสภาพอากาศ (Atmospheric) ได้ดี (> 90%) แต่จะเกิด Degradation Drop สูงสุดในสภาวะมุมมองสูง (Geometric) และสิ่งบดบัง/ภาพเบลอ (Occlusion)",
    recommendationEn: "💡 Thesis Takeaway: VLMs exhibit robust resilience under Illumination and Atmospheric stress (> 90%), while Geometric viewpoints (aerial) and Occlusion/Blur present the primary degradation bottlenecks.",
    items: [
      {
        icon: "shield",
        type: "champion",
        titleTh: "ทนทานสูงสุดต่อสภาพแสงและอากาศ",
        titleEn: "High Resilience to Lighting & Weather",
        descTh: "โมเดลยังคงรักษาความแม่นยำได้สูงกว่า 92% แม้อยู่ในเวลากลางคืน แสงย้อน หรือมีฝนตกและหมอกหนา",
        descEn: "Recognition accuracy remains robust (> 92%) under night conditions, backlight, rain, and heavy fog environments.",
        badgeTh: "ทนทาน > 92%",
        badgeEn: "> 92% Robust",
      },
      {
        icon: "alert",
        type: "warning",
        titleTh: "จุดเปราะบางหลัก: มุมมองภาพและภาพเบลอ",
        titleEn: "Vulnerability: Extreme Angles & Blur",
        descTh: "ภาพถ่ายมุมสูงจัด (Extreme Aerial) และภาพเบลอจากการเคลื่อนไหว (Motion Blur) ทำให้ความแม่นยำลดลงเฉลี่ย -22% ถึง -28%",
        descEn: "Extreme aerial angles and motion blur cause the highest performance drop, reducing accuracy by -22% to -28%.",
        badgeTh: "Drop -25%",
        badgeEn: "-25% Bottleneck",
      },
      {
        icon: "sparkles",
        type: "insight",
        titleTh: "เปรียบเทียบโมเดลในสภาพแวดล้อมยาก",
        titleEn: "Flagship vs Lightweight Resilience",
        descTh: "โมเดลตระกูล Pro (Gemini 2.5 Pro / GPT-4o) ทนทานต่อภาพที่มีสิ่งบดบัง (Occlusion) ได้ดีกว่าโมเดลขนาดเล็กประมาณ +12%",
        descEn: "Flagship models (Gemini 2.5 Pro / GPT-4o) retain +12% higher accuracy under severe partial occlusions than lightweight tiers.",
        badgeTh: "Pro ทนทาน +12%",
        badgeEn: "Pro +12% Edge",
      },
    ],
  },
  exp5: {
    id: "exp5",
    chapter: "Chapter 4.5",
    titleTh: "สรุปผลการทดลอง Exp 5: ความเสถียรและความคงเส้นคงวา (N-Run Stability)",
    titleEn: "Key Findings Exp 5: Consistency & Determinism Evaluation",
    subtitleTh: "การทดสอบการรันซ้ำ 5-10 ครั้งบนภาพเดิมเพื่อวัดความคงที่ของคำตอบและค่าความมั่นใจ",
    subtitleEn: "Multi-run stability evaluation assessing semantic determinism, output jitter variance, and confidence reproducibility.",
    recommendationTh: "💡 ข้อเสนอแนะ: โมเดลมี Consistency Score สูงกว่า 96% เมื่อตั้งค่า Temperature ในช่วง 0.1 - 0.2 ซึ่งเพียงพอสำหรับการใช้งานในระดับ Production",
    recommendationEn: "💡 Thesis Takeaway: VLM demonstrates > 96% semantic consistency across repeated trials under standard inference settings (Temp 0.1-0.2).",
    items: [
      {
        icon: "shield",
        type: "champion",
        titleTh: "ความคงเส้นคงวาระดับสูง (Consistency > 96%)",
        titleEn: "High Determinism (> 96%)",
        descTh: "ในการรันซ้ำ 5-10 รอบ โมเดลตอบชื่อสถานที่เดียวกันตรงกันอย่างสม่ำเสมอ โดยไม่มีอาการ Hallucination เปลี่ยนสถานที่เป้าหมาย",
        descEn: "Across 5-10 repetitive trials, the model consistently identifies the identical landmark without semantic hallucination shifts.",
        badgeTh: "คงที่ > 96%",
        badgeEn: "> 96% Stable",
      },
      {
        icon: "zap",
        type: "insight",
        titleTh: "ความมั่นใจและการแกว่งตัวของเวลา (Jitter)",
        titleEn: "Low Confidence & Latency Jitter",
        descTh: "ค่าเบี่ยงเบนมาตรฐาน (Std Dev) ของ Confidence ต่ำกว่า ±0.03 และเวลาตอบสนองแกว่งตัวไม่เกิน ±120 ms",
        descEn: "Confidence standard deviation remains below ±0.03 with network latency jitter well within ±120 ms bounds.",
        badgeTh: "StdDev < 0.03",
        badgeEn: "σ < 0.03",
      },
      {
        icon: "check",
        type: "highlight",
        titleTh: "ความพร้อมใช้งานในระดับ Production",
        titleEn: "Production-Ready Determinism",
        descTh: "ผลลัพธ์ผ่านเกณฑ์ความเสถียรสำหรับระบบแนะนำการท่องเที่ยวอัจฉริยะ โดยผู้ใช้จะได้รับผลการวิเคราะห์ที่แน่นอนและเชื่อถือได้ทุกครั้ง",
        descEn: "Exceeds production deployment criteria for AI itinerary planning, ensuring deterministic and dependable travel suggestions.",
        badgeTh: "Production Ready",
        badgeEn: "Ready",
      },
    ],
  },
  exp6: {
    id: "exp6",
    chapter: "Chapter 4.6",
    titleTh: "สรุปผลการทดลอง Exp 6: Comprehensive Travel Plan Quality Evaluation",
    titleEn: "Key Findings Exp 6: Multi-Dimensional Travel Plan Quality Evaluation",
    subtitleTh: "การประเมินคุณภาพของแผนการท่องเที่ยวแบบ 5 มิติ 20 ข้อตามกรอบวิชาการร่วมสมัย",
    subtitleEn: "5-Dimension and 20-Criteria multi-model evaluation based on Gao & Sun (2025) and Betzalel et al. (2024).",
    recommendationTh: "💡 ข้อเสนอแนะ: โมเดลระดับเรือธง (GPT-5.4 และ Claude Sonnet 5) ทำคะแนนคุณภาพแผนและ Spatial Coherence สูงสุด ขณะที่โมเดลกลุ่ม Flash มี Throughput สูง เหมาะกับการสร้างแผนแบบโต้ตอบเร็ว",
    recommendationEn: "💡 Thesis Takeaway: Flagship models excel in spatial logic and constraint satisfaction, while flash models provide higher throughput for interactive planning.",
    items: [
      {
        icon: "trophy",
        type: "champion",
        titleTh: "ผู้นำด้านคุณภาพโดยรวม (Overall Plan Quality)",
        titleEn: "Overall Plan Quality Leader",
        descTh: "โมเดลระดับเรือธงทำคะแนนเฉลี่ยรวมสูงที่สุดในทุกมิติ ทั้งความสอดคล้องกับข้อกำหนด และความสมเหตุสมผลของเส้นทาง",
        descEn: "Flagship models achieve the highest scores across all 5 dimensions, particularly constraint satisfaction and spatial reasoning.",
        badgeTh: "คุณภาพสูงสุด",
        badgeEn: "Top Quality",
      },
      {
        icon: "sparkles",
        type: "insight",
        titleTh: "ความสอดคล้องเชิงพื้นที่และการจัดกลุ่มสถานที่",
        titleEn: "Spatial Feasibility & Clustering",
        descTh: "มิติด้าน Spatiality & Timing ช่วยพิสูจน์ว่าโมเดลสามารถจัดลำดับสถานที่ท่องเที่ยวในวันเดียวกันได้อย่างสมเหตุสมผล ลดการเดินทางย้อนกลับ",
        descEn: "The spatiality dimension validates route sequencing feasibility and minimization of unnecessary backtracking.",
        badgeTh: "มิติสำคัญ",
        badgeEn: "Spatial Coherence",
      },
      {
        icon: "zap",
        type: "highlight",
        titleTh: "ความคุ้มค่าและความเร็วในการตอบสนอง (Throughput vs Quality)",
        titleEn: "Pareto Frontier (Throughput vs Quality)",
        descTh: "โมเดลกลุ่มประหยัดทรัพยากรสามารถสร้างแผนได้ด้วย Throughput สูงกว่าอย่างมีนัยสำคัญ แม้คะแนนคุณภาพจะลดลงเล็กน้อย",
        descEn: "Efficient tier models generate plans with significantly higher throughput, demonstrating an effective Pareto trade-off.",
        badgeTh: "คุ้มค่า",
        badgeEn: "High Throughput",
      },
    ],
  },
};

export const METRIC_GLOSSARY: Record<string, { th: string; en: string; defTh: string; defEn: string }> = {
  recall1: {
    th: "Recall@1 (Top-1 Accuracy)",
    en: "Recall@1 (Top-1 Accuracy)",
    defTh: "สัดส่วนที่โมเดลทายชื่อสถานที่ถูกต้องเป็น 'อันดับแรกสุด' (ยิ่งสูงยิ่งดี)",
    defEn: "Proportion of queries where the correct landmark is ranked #1 (higher is better).",
  },
  recall3: {
    th: "Recall@3 (Top-3 Accuracy)",
    en: "Recall@3 (Top-3 Accuracy)",
    defTh: "สัดส่วนที่คำตอบที่ถูกต้องติดอยู่ใน '3 อันดับแรก' ของผลการทำนาย",
    defEn: "Proportion of queries where the correct landmark appears in top 3 candidates.",
  },
  recall5: {
    th: "Recall@5 (Top-5 Accuracy)",
    en: "Recall@5 (Top-5 Accuracy)",
    defTh: "สัดส่วนที่คำตอบที่ถูกต้องติดอยู่ใน '5 อันดับแรก' ของผลการทำนาย",
    defEn: "Proportion of queries where the correct landmark appears in top 5 candidates.",
  },
  mrr: {
    th: "MRR (Mean Reciprocal Rank)",
    en: "MRR (Mean Reciprocal Rank)",
    defTh: "คะแนนเฉลี่ยส่วนกลับของอันดับคำตอบที่ถูกต้อง (1.0 = อยู่ที่ 1 เสมอ, 0.5 = เฉลี่ยอยู่ที่ 2)",
    defEn: "Mean of reciprocal ranks of the correct answer (1.0 means always rank #1).",
  },
  ece: {
    th: "ECE (Expected Calibration Error)",
    en: "ECE (Expected Calibration Error)",
    defTh: "ค่าความคลาดเคลื่อนระหว่างความมั่นใจของโมเดลกับความถูกต้องจริง (ค่ายิ่งต่ำ = ยิ่งน่าเชื่อถือ)",
    defEn: "Difference between predicted confidence and empirical accuracy (lower is better).",
  },
  latency: {
    th: "Latency (เวลาประมวลผล)",
    en: "Latency (Response Time)",
    defTh: "เวลาเฉลี่ยที่ใช้ในการประมวลผลต่อ 1 รูปภาพ มีหน่วยเป็นมิลลิวินาที (ms)",
    defEn: "Average end-to-end response time per image query in milliseconds (ms).",
  },
  throughput: {
    th: "Throughput (ปริมาณงาน)",
    en: "Throughput (Queries/sec)",
    defTh: "จำนวนรูปภาพที่ระบบสามารถประมวลผลได้ต่อ 1 วินาที (Req/s)",
    defEn: "Number of image queries processed per second (Req/s).",
  },
  pareto: {
    th: "Pareto Frontier (จุดสมดุลความคุ้มค่า)",
    en: "Pareto Frontier (Trade-off)",
    defTh: "การหาจุดที่ให้ความแม่นยำสูงสุดโดยใช้เวลาประมวลผลน้อยที่สุด (Sweet Spot)",
    defEn: "The optimal trade-off boundary maximizing accuracy while minimizing latency.",
  },
  consistency: {
    th: "Consistency Score (ความคงเส้นคงวา)",
    en: "Consistency Score (%)",
    defTh: "ร้อยละของการตอบผลลัพธ์เดิมถูกต้องตรงกันเมื่อรันภาพเดิมซ้ำหลายรอบ",
    defEn: "Percentage of repetitive runs yielding the exact same correct prediction.",
  },
  degradation: {
    th: "Degradation Rate (อัตราความแม่นยำที่ลดลง)",
    en: "Degradation Rate (%)",
    defTh: "เปอร์เซ็นต์ความแม่นยำที่ลดลงเมื่อเจอกับสภาพแวดล้อมที่แย่เทียบกับภาพปกติ",
    defEn: "Percentage drop in accuracy under adverse conditions compared to baseline.",
  },
  gradedRelevance: {
    th: "Graded Relevance (ระดับความถูกต้อง 0-3)",
    en: "Graded Relevance (0-3 Scale)",
    defTh: "เกณฑ์คะแนนวัดคุณภาพตัวเลือก: 3 = ตรงสถานที่เจาะจง, 2 = พื้นที่ลำดับชั้น/อำเภอ/อุทยาน, 1 = บริเวณใกล้เคียง, 0 = คำนามกว้าง/หลอน",
    defEn: "Multi-level candidate grading: 3 = Exact POI, 2 = Parent Area/Park, 1 = Co-located Neighbor, 0 = Generic/Irrelevant.",
  },
  recoveryGain: {
    th: "Human Recovery Gain (อัตราการกู้คืนคำตอบ)",
    en: "Human Recovery Gain",
    defTh: "ส่วนต่างระหว่าง Top-3 Regional Recall เทียบกับ Top-1 Strict Accuracy สะท้อนคุณค่าที่ผู้ใช้สามารถสลับเลือกคำตอบที่ถูกต้องได้",
    defEn: "The delta between Top-3 Regional Recall and Top-1 Strict Accuracy, measuring human-in-the-loop candidate recovery.",
  },
};
