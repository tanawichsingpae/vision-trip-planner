import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth, type UserRole } from "@/context/AuthContext";
import {
  fetchBlindTrips,
  submitBlindScore,
  submitScenarioComparison,
  syncScenarioFamiliarityToEvals,
  fetchBlindResults,
  deleteBlindTrip,
  checkDatabaseConnection,
  syncLocalToSupabase,
  getExpertDefaultName,
  resolveEvaluatorName,
  type DatabaseStatus,
  type BlindTrip,
  type EvaluationRecord,
  type ModelSummaryStat,
  type ExpertProfile,
  type DetailedDimensionScores,
  type ScenarioComparisonRecord,
} from "@/api/blindEvalApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import MapSection from "@/components/MapSection";
import type { LocationData } from "@/components/LocationDisplay";
import { DAY_COLORS, type Activity, typeConfig } from "@/components/TravelItinerary";
import { getPlaceImage } from "@/utils/getPlaceImage";
import EvaluationAnalytics from "@/components/EvaluationAnalytics";
import ClearEvaluationsModal from "@/components/ClearEvaluationsModal";
import {
  Plane,
  Eye,
  EyeOff,
  Star,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Utensils,
  Award,
  Users,
  ShieldCheck,
  Trash2,
  Sparkles,
  BarChart3,
  ListChecks,
  UserCheck,
  ArrowLeft,
  Info,
  DollarSign,
  User,
  Zap,
  Tag,
  Compass,
  CalendarRange,
  Hotel,
  PlaneTakeoff,
  Navigation,
  ExternalLink,
  Layers,
  Map as MapIcon,
  Camera,
  Image as ImageIcon,
  Trophy,
  Check,
  Edit3,
  HelpCircle,
  MessageSquareQuote,
  ChevronRight,
  Send,
  Save,
  Sliders,
  Cloud,
  Database,
  RefreshCw,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  BookOpen,
} from "lucide-react";

// ==========================================
// 6-DIMENSION EXPERT EVALUATION RUBRIC
// ==========================================
const DIMENSIONS = [
  {
    id: "fa",
    code: "FA",
    title: "ด้านที่ 1: ความถูกต้องของข้อมูล (Factual Accuracy)",
    shortTitle: "1. ความถูกต้อง",
    color: "text-sky-600 dark:text-sky-400",
    badgeBg: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200",
    items: [
      { id: "fa1", code: "FA1", text: "สถานที่ท่องเที่ยวที่แนะนำมีอยู่จริง (ไม่มีสถานที่มั่ว/Hallucination)" },
      { id: "fa2", code: "FA2", text: "ข้อมูลเวลาเปิด-ปิดของสถานที่ถูกต้องและสอดคล้องกับความเป็นจริง" },
      { id: "fa3", code: "FA3", text: "ข้อมูลราคา (ตั๋วเข้า, อาหาร, ที่พัก) สมเหตุสมผลและใกล้เคียงความเป็นจริง" },
      { id: "fa4", code: "FA4", text: "ข้อมูลการเดินทาง (เวลา, ระยะทาง, วิธีการเดินทาง) ถูกต้องและสามารถปฏิบัติได้จริง" },
      { id: "fa5", code: "FA5", text: "ไม่มีข้อมูลที่ผิดพลาดหรือขัดแย้งกันภายในแผน (เช่น สถานที่ปิดแต่แนะนำให้ไปเที่ยว)" },
    ],
  },
  {
    id: "cc",
    code: "CC",
    title: "ด้านที่ 2: การปฏิบัติตามข้อจำกัด (Constraint Compliance)",
    shortTitle: "2. ข้อจำกัด",
    color: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    items: [
      { id: "cc1", code: "CC1", text: "แผนปฏิบัติตามงบประมาณที่กำหนด (ไม่เกินงบ)" },
      { id: "cc2", code: "CC2", text: "แผนปฏิบัติตามระยะเวลาที่กำหนด (จำนวนวัน/คืน, เวลาเดินทางถึง-กลับ)" },
      { id: "cc3", code: "CC3", text: "แผนสอดคล้องกับสไตล์/ความสนใจที่ระบุ (เช่น วัฒนธรรม, อาหาร, ถ่ายรูป)" },
      { id: "cc4", code: "CC4", text: "แผนคำนึงถึงข้อจำกัดเฉพาะ (เช่น เวลาเปิด-ปิด, วันหยุด, ฤดูกาล)" },
      { id: "cc5", code: "CC5", text: "แผนเหมาะสมกับกลุ่มเป้าหมายที่ระบุ (เช่น คู่รัก, ครอบครัว, ผู้สูงอายุ)" },
      { id: "cc6", code: "CC6", text: "แผนตอบสนองและบูรณาการสถานที่/แรงบันดาลใจจากรูปภาพที่อัปโหลดได้ครบถ้วน (Vision-Plan Alignment)" },
    ],
  },
  {
    id: "pf",
    code: "PF",
    title: "ด้านที่ 3: ความเป็นไปได้ในทางปฏิบัติ (Practical Feasibility)",
    shortTitle: "3. ความเป็นไปได้",
    color: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    items: [
      { id: "pf1", code: "PF1", text: "ระยะเวลาที่จัดสรรให้แต่ละกิจกรรมเหมาะสม (ไม่แน่น/ไม่หลวมเกินไป)" },
      { id: "pf2", code: "PF2", text: "เวลาเดินทางระหว่างสถานที่สมเหตุสมผลและสอดคล้องกับความเป็นจริง" },
      { id: "pf3", code: "PF3", text: "แผนมีเวลาพักผ่อนและเวลาทานอาหารเพียงพอและเหมาะสม" },
      { id: "pf4", code: "PF4", text: "ลำดับการเที่ยวในแต่ละวันไม่เหนื่อยเกินไป (ไม่เดินทางไกลสลับที่บ่อย)" },
      { id: "pf5", code: "PF5", text: "แผนสามารถนำไปปฏิบัติได้จริงโดยไม่ต้องปรับแก้เยอะ" },
    ],
  },
  {
    id: "sr",
    code: "SR",
    title: "ด้านที่ 4: ความสมเหตุสมผลเชิงพื้นที่ (Spatial Rationality)",
    shortTitle: "4. เชิงพื้นที่",
    color: "text-purple-600 dark:text-purple-400",
    badgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200",
    items: [
      { id: "sr1", code: "SR1", text: "การจัดลำดับสถานที่ในแต่ละวันเป็นไปตามเส้นทางภูมิศาสตร์ (ไม่ย้อนไปย้อนมา)" },
      { id: "sr2", code: "SR2", text: "สถานที่ที่ใกล้กันถูกจัดให้อยู่ในวันเดียวกันหรือช่วงเวลาใกล้เคียงกัน" },
      { id: "sr3", code: "SR3", text: "ไม่มีกรณีเดินทางไกลข้ามเมือง/ข้ามพื้นที่โดยไม่จำเป็น" },
      { id: "sr4", code: "SR4", text: "จุดเริ่มต้นและจุดสิ้นสุดของแต่ละวันเหมาะสมกับตำแหน่งที่พัก" },
    ],
  },
  {
    id: "de",
    code: "DE",
    title: "ด้านที่ 5: ความหลากหลายและคุณภาพประสบการณ์ (Diversity & Experience Quality)",
    shortTitle: "5. ความหลากหลาย",
    color: "text-pink-600 dark:text-pink-400",
    badgeBg: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300 border-pink-200",
    items: [
      { id: "de1", code: "DE1", text: "แผนครอบคลุมประเภทกิจกรรมหลากหลาย (แลนด์มาร์ก, วัฒนธรรม, อาหาร, ช้อปปิ้ง, พักผ่อน)" },
      { id: "de2", code: "DE2", text: "แผนรวมสถานที่สำคัญที่ \"ต้องไป\" (Must-see) ของจุดหมายนั้นๆ" },
      { id: "de3", code: "DE3", text: "แผนมีสถานที่ใหม่ๆ ที่น่าสนใจ นอกเหนือจากแลนด์มาร์กยอดนิยม (Hidden Gems)" },
      { id: "de4", code: "DE4", text: "สัดส่วนเวลาเที่ยวเหมาะสมกับคุณภาพของสถานที่ (ใช้เวลาเยอะในที่ดีๆ)" },
      { id: "de5", code: "DE5", text: "แผนสร้างประสบการณ์ที่สมดุลและน่าจดจำสำหรับกลุ่มเป้าหมายที่ระบุ" },
    ],
  },
  {
    id: "ru",
    code: "RU",
    title: "ด้านที่ 6: ความแข็งแกร่งต่อความไม่แน่นอน (Robustness to Uncertainty)",
    shortTitle: "6. ความยืดหยุ่น",
    color: "text-teal-600 dark:text-teal-400",
    badgeBg: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200",
    items: [
      { id: "ru1", code: "RU1", text: "แผนมีเวลาสำรอง (Buffer Time) เพียงพอสำหรับความล่าช้าหรือเหตุไม่คาดฝัน" },
      { id: "ru2", code: "RU2", text: "แผนหลีกเลี่ยงเวลาที่มีคนพลุกพล่านเกินไป (ถ้าเป็นไปได้)" },
      { id: "ru3", code: "RU3", text: "แผนมีทางเลือกสำรอง (Plan B) กรณีสถานที่ปิดหรือไม่สามารถไปได้" },
      { id: "ru4", code: "RU4", text: "แผนมีความยืดหยุ่น สามารถปรับแก้ได้ง่ายหากมีเหตุเปลี่ยนแปลง" },
    ],
  },
];

const PRIORITY_IMPROVEMENT_OPTIONS = [
  "ความถูกต้องของข้อมูล (เวลาเปิด-ปิด, ราคา, สถานที่)",
  "การปฏิบัติตามข้อจำกัด (งบ, เวลา, สไตล์)",
  "ความเป็นไปได้ในทางปฏิบัติ (เวลาเที่ยว, เวลาเดินทาง)",
  "ความสมเหตุสมผลเชิงพื้นที่ (เส้นทางไม่ย้อน)",
  "ความหลากหลายของกิจกรรม",
  "เวลาสำรองและความยืดหยุ่น",
  "การรวมสถานที่สำคัญ (Must-see)",
  "ความสอดคล้องกับรูปภาพที่อัปโหลด (Vision-Plan Alignment)",
  "อื่นๆ (ระบุ)",
];

const DEFAULT_SCORES: DetailedDimensionScores = {
  fa1: 4, fa2: 4, fa3: 4, fa4: 4, fa5: 4, fa_avg: 4.0,
  cc1: 4, cc2: 4, cc3: 4, cc4: 4, cc5: 4, cc6: 4, cc_avg: 4.0,
  pf1: 4, pf2: 4, pf3: 4, pf4: 4, pf5: 4, pf_avg: 4.0,
  sr1: 4, sr2: 4, sr3: 4, sr4: 4, sr_avg: 4.0,
  de1: 4, de2: 4, de3: 4, de4: 4, de5: 4, de_avg: 4.0,
  ru1: 4, ru2: 4, ru3: 4, ru4: 4, ru_avg: 4.0,
  vision_alignment: 4,
  geographic_familiarity: 3,
  overall_percentage: 80,
  strengths: "",
  weaknesses: "",
  priority_improvement: "ความถูกต้องของข้อมูล (เวลาเปิด-ปิด, ราคา, สถานที่)",
  priority_improvement_other: "",
};

export default function BlindEvaluation() {
  const { role, setRole, userEmail, userRolesList, updateUserRole, refreshUserRoles, isDev } = useAuth();

  // Active Main Tab (Dev only can switch tabs; Expert stays in 'eval')
  const [activeTab, setActiveTab] = useState<"eval" | "results" | "users">("eval");

  // Trips & Evaluation data
  const [trips, setTrips] = useState<BlindTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [selectedTripId, setSelectedTripId] = useState<string>("");

  // Sub-view in Arena: "inspect" (examine a candidate plan) or "compare" (Part 3 & 4 ranking)
  const [evalMode, setEvalMode] = useState<"inspect" | "compare">("inspect");

  // Map & Itinerary interactive state
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(true);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isPhotosOpen, setIsPhotosOpen] = useState(false);

  // Active Dimension Tab inside the Rubric
  const [activeDimTab, setActiveDimTab] = useState<string>("fa");

  // Dev: Clear Evaluations Modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Dev: Delete Trip Dialog state (non-blocking, resolves INP issue)
  const [tripToDelete, setTripToDelete] = useState<{ id: string; label: string } | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);

  // -------------------------------------------------------------
  // PART 1: EXPERT PROFILE PERSISTENCE (localStorage)
  // -------------------------------------------------------------
  const PROFILE_STORAGE_KEY = `pixinerary_expert_profile_${(userEmail || "default").toLowerCase()}`;

  const defaultExpertName = useMemo(() => {
    return getExpertDefaultName(userEmail, userRolesList);
  }, [userEmail, userRolesList]);

  const [expertProfile, setExpertProfile] = useState<ExpertProfile>(() => {
    try {
      const cached = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem("pixinerary_expert_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        const rawName = (parsed.name || "").trim();
        const cleanedName =
          rawName === "ดร. สมชาย" ||
          rawName === "ดร. สมชาย (ผู้เชี่ยวชาญการท่องเที่ยว)" ||
          rawName.startsWith("ผู้ประเมินผู้เชี่ยวชาญ")
            ? ""
            : rawName;
        return {
          name: cleanedName,
          role: parsed.role || "อาจารย์/นักวิชาการด้านการท่องเที่ยว",
          role_other: parsed.role_other || "",
          experience: parsed.experience || "3–5 ปี",
          ai_familiarity: parsed.ai_familiarity || "เคยใช้บ้าง (เช่น Google Trips, TripAdvisor, Klook)",
          saved_at: parsed.saved_at,
        };
      }
    } catch (e) {
      console.warn("Failed to load expert profile from localStorage:", e);
    }
    return {
      name: "",
      role: "อาจารย์/นักวิชาการด้านการท่องเที่ยว",
      role_other: "",
      experience: "3–5 ปี",
      ai_familiarity: "เคยใช้บ้าง (เช่น Google Trips, TripAdvisor, Klook)",
    };
  });

  const effectiveExpertName = useMemo(() => {
    return resolveEvaluatorName(expertProfile.name, userEmail, userRolesList);
  }, [expertProfile.name, userEmail, userRolesList]);

  const [isProfileSaved, setIsProfileSaved] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem("pixinerary_expert_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        return !!(parsed && (parsed.saved_at || parsed.role));
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem("pixinerary_expert_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        return !(parsed && (parsed.saved_at || parsed.role));
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [showOptionalName, setShowOptionalName] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem("pixinerary_expert_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        const rawName = (parsed.name || "").trim();
        const hasCustom =
          rawName &&
          rawName !== "ดร. สมชาย" &&
          rawName !== "ดร. สมชาย (ผู้เชี่ยวชาญการท่องเที่ยว)" &&
          !rawName.startsWith("ผู้ประเมินผู้เชี่ยวชาญ");
        return !!hasCustom;
      }
    } catch {
      // ignore
    }
    return false;
  });

  const handleSaveProfile = () => {
    if (expertProfile.role === "อื่นๆ" && !expertProfile.role_other?.trim()) {
      toast.error("กรุณาระบุตำแหน่งหรือบทบาทของท่านในช่อง 'อื่นๆ'");
      return;
    }
    const updated = {
      ...expertProfile,
      name: expertProfile.name?.trim() || "",
      saved_at: new Date().toISOString(),
    };
    setExpertProfile(updated);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem("pixinerary_expert_profile", JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save profile to localStorage:", e);
    }
    setIsProfileSaved(true);
    setIsEditingProfile(false);
    toast.success("บันทึกข้อมูลเรียบร้อยแล้ว (ระบบจะจดจำไว้ ไม่ต้องกรอกซ้ำ)");
  };

  // -------------------------------------------------------------
  // PART 1.5: GEOGRAPHIC FAMILIARITY PER SCENARIO (Control Variable 1-5)
  // -------------------------------------------------------------
  const FAMILIARITY_STORAGE_KEY = `pixinerary_geo_fam_${(userEmail || "default").toLowerCase()}`;
  const [scenarioFamiliarityMap, setScenarioFamiliarityMap] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem(FAMILIARITY_STORAGE_KEY) || localStorage.getItem("pixinerary_geo_fam");
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Re-synchronize cached familiarity when userEmail resolves
  useEffect(() => {
    if (userEmail) {
      try {
        const userKey = `pixinerary_geo_fam_${userEmail.toLowerCase()}`;
        const cached = localStorage.getItem(userKey) || localStorage.getItem("pixinerary_geo_fam");
        if (cached) {
          const parsed = JSON.parse(cached);
          setScenarioFamiliarityMap((prev) => ({ ...parsed, ...prev }));
        }
      } catch {}
    }
  }, [userEmail]);

  const currentScenarioFamiliarity = useMemo(() => {
    if (!selectedScenarioId) return 3;
    return scenarioFamiliarityMap[selectedScenarioId] ?? 3;
  }, [selectedScenarioId, scenarioFamiliarityMap]);

  const handleSetScenarioFamiliarity = (level: number) => {
    if (!selectedScenarioId) return;
    setScenarioFamiliarityMap((prev) => {
      const updated = { ...prev, [selectedScenarioId]: level };
      try {
        localStorage.setItem(FAMILIARITY_STORAGE_KEY, JSON.stringify(updated));
        if (userEmail) {
          localStorage.setItem(`pixinerary_geo_fam_${userEmail.toLowerCase()}`, JSON.stringify(updated));
        }
        localStorage.setItem("pixinerary_geo_fam", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Immediately update candidate trip scores in-memory
    setModelScoresMap((prev) => {
      const updated = { ...prev };
      for (const trip of trips) {
        if (trip.scenario_id === selectedScenarioId && updated[trip.id]) {
          updated[trip.id] = {
            ...updated[trip.id],
            geographic_familiarity: level,
          };
        }
      }
      return updated;
    });

    // Synchronize to Supabase immediately if this user already submitted evaluations for this scenario
    if (userEmail) {
      syncScenarioFamiliarityToEvals(selectedScenarioId, userEmail, level).then(() => {
        loadResults();
      });
    }
  };

  // -------------------------------------------------------------
  // PART 2: MODEL-BY-MODEL EVALUATION SCORES (keyed by tripId)
  // -------------------------------------------------------------
  const [modelScoresMap, setModelScoresMap] = useState<Record<string, DetailedDimensionScores>>({});
  const [submittingModelScore, setSubmittingModelScore] = useState(false);

  // -------------------------------------------------------------
  // PART 3: SCENARIO QUALITATIVE FEEDBACK
  // -------------------------------------------------------------
  const [qualitativeFeedback, setQualitativeFeedback] = useState({
    q1_real_travel: "",
    q2_tourism_context: "",
    q3_value_experience: "",
    q4_distinct_differences: "",
  });
  const [submittingComparison, setSubmittingComparison] = useState(false);

  // Dev view: Reveal true models toggle
  const [revealModels, setRevealModels] = useState(false);
  const [resultsData, setResultsData] = useState<{
    evaluations: EvaluationRecord[];
    comparisons?: ScenarioComparisonRecord[];
    summary: ModelSummaryStat[];
    total_trips: number;
  }>({ evaluations: [], summary: [], total_trips: 0 });

  // Dev view: New user role input
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("expert");
  const [newUserName, setNewUserName] = useState("");

  // Database Connection Status & Cloud Sync
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const checkDb = async () => {
    try {
      const st = await checkDatabaseConnection();
      setDbStatus(st);
    } catch {
      // ignore
    }
  };

  const handleSyncToCloud = async () => {
    setSyncingCloud(true);
    try {
      const res = await syncLocalToSupabase();
      toast.success(
        `ซิงก์ข้อมูลขึ้น Supabase Cloud สำเร็จ! (${res.tripsCount} แผนทริป, ${res.evalsCount} ผลคะแนน, ${res.compsCount} การประเมินเชิงคุณภาพ)`
      );
      await checkDb();
      await loadTrips();
      await loadResults();
    } catch (err: any) {
      toast.error(`การซิงก์ล้มเหลว: ${err.message || err}`);
    } finally {
      setSyncingCloud(false);
    }
  };

  // Load Trips
  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await fetchBlindTrips(role);
      setTrips(data);
      if (data.length > 0) {
        const firstSc = data[0].scenario_id;
        setSelectedScenarioId((prev) => prev || firstSc);
        const matchInSc = data.find((t) => t.scenario_id === (selectedScenarioId || firstSc));
        if (matchInSc) setSelectedTripId((prev) => prev || matchInSc.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load blind trips");
    } finally {
      setLoading(false);
    }
  };

  // Load Dev Results & Users
  const loadResults = async () => {
    try {
      const data = await fetchBlindResults();
      setResultsData(data);

      // Pre-fill modelScoresMap if current user already evaluated some trips
      if (data.evaluations && userEmail) {
        const myEvals = data.evaluations.filter(
          (ev) => ev.expert_id.toLowerCase() === userEmail.toLowerCase()
        );
        setModelScoresMap((prev) => {
          const updated = { ...prev };
          for (const ev of myEvals) {
            if (ev.detailed_scores) {
              updated[ev.trip_id] = ev.detailed_scores;
            }
          }
          return updated;
        });
      }

      // Pre-fill scenarioFamiliarityMap from existing comparisons and evaluations
      if (userEmail) {
        setScenarioFamiliarityMap((prev) => {
          const updated = { ...prev };
          // 1. From comparisons (authoritative qualitative records)
          for (const c of data.comparisons || []) {
            if (c.scenario_id && c.expert_id?.toLowerCase() === userEmail.toLowerCase()) {
              const fam = c.geographic_familiarity ?? c.expert_profile?.geographic_familiarity;
              if (fam !== undefined && fam !== null) {
                updated[c.scenario_id] = Number(fam);
              }
            }
          }
          // 2. From evaluations (fallback)
          for (const ev of data.evaluations || []) {
            if (ev.scenario_id && ev.expert_id?.toLowerCase() === userEmail.toLowerCase() && !updated[ev.scenario_id]) {
              const fam = ev.geographic_familiarity ?? ev.expert_profile?.geographic_familiarity ?? ev.detailed_scores?.geographic_familiarity;
              if (fam !== undefined && fam !== null) {
                updated[ev.scenario_id] = Number(fam);
              }
            }
          }
          try {
            const userKey = `pixinerary_geo_fam_${userEmail.toLowerCase()}`;
            localStorage.setItem(userKey, JSON.stringify(updated));
            localStorage.setItem("pixinerary_geo_fam", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (err: any) {
      console.warn("Failed to load results:", err);
    }
  };

  useEffect(() => {
    checkDb();
    loadTrips();
    loadResults();
    if (role === "dev") {
      refreshUserRoles();
    }
  }, [role, userEmail]);

  // Unique Scenarios list
  const scenarios = useMemo(() => {
    const map = new Map<string, { id: string; title: string; notes: string; count: number }>();
    for (const t of trips) {
      const existing = map.get(t.scenario_id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(t.scenario_id, {
          id: t.scenario_id,
          title: t.scenario_title || t.scenario_id,
          notes: t.scenario_notes || "",
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [trips]);

  // Candidate plans in current scenario
  const candidateTrips = useMemo(() => {
    return trips.filter((t) => t.scenario_id === selectedScenarioId);
  }, [trips, selectedScenarioId]);

  // Active selected trip
  const activeTrip = useMemo(() => {
    return candidateTrips.find((t) => t.id === selectedTripId) || candidateTrips[0] || null;
  }, [candidateTrips, selectedTripId]);

  // Current trip score state helper
  const currentTripScores: DetailedDimensionScores = useMemo(() => {
    if (!activeTrip) return DEFAULT_SCORES;
    return modelScoresMap[activeTrip.id] || DEFAULT_SCORES;
  }, [activeTrip, modelScoresMap]);

  // Helper to update active trip scores
  const updateActiveScore = (key: keyof DetailedDimensionScores, value: any) => {
    if (!activeTrip) return;
    setModelScoresMap((prev) => {
      const curr = prev[activeTrip.id] || { ...DEFAULT_SCORES };
      const updated = { ...curr, [key]: value };

      // Keep cc6 and vision_alignment synchronized
      if (key === "cc6") {
        updated.vision_alignment = Number(value);
      } else if (key === "vision_alignment") {
        updated.cc6 = Number(value);
      }

      // Recalculate dimension averages
      const fa_avg = (Number(updated.fa1) + Number(updated.fa2) + Number(updated.fa3) + Number(updated.fa4) + Number(updated.fa5)) / 5.0;
      const cc_vals = [updated.cc1, updated.cc2, updated.cc3, updated.cc4, updated.cc5, updated.cc6].filter(
        (v) => v !== undefined && !isNaN(Number(v))
      );
      const cc_avg = cc_vals.reduce((s, c) => s + Number(c), 0) / (cc_vals.length || 1);
      const pf_avg = (Number(updated.pf1) + Number(updated.pf2) + Number(updated.pf3) + Number(updated.pf4) + Number(updated.pf5)) / 5.0;
      const sr_avg = (Number(updated.sr1) + Number(updated.sr2) + Number(updated.sr3) + Number(updated.sr4)) / 4.0;
      const de_avg = (Number(updated.de1) + Number(updated.de2) + Number(updated.de3) + Number(updated.de4) + Number(updated.de5)) / 5.0;
      const ru_avg = (Number(updated.ru1) + Number(updated.ru2) + Number(updated.ru3) + Number(updated.ru4)) / 4.0;

      updated.fa_avg = Math.round(fa_avg * 10) / 10;
      updated.cc_avg = Math.round(cc_avg * 10) / 10;
      updated.pf_avg = Math.round(pf_avg * 10) / 10;
      updated.sr_avg = Math.round(sr_avg * 10) / 10;
      updated.de_avg = Math.round(de_avg * 10) / 10;
      updated.ru_avg = Math.round(ru_avg * 10) / 10;

      return {
        ...prev,
        [activeTrip.id]: updated,
      };
    });
  };

  // Filtered Itinerary based on selected day tab
  const displayItinerary = useMemo(() => {
    if (!activeTrip?.itinerary) return [];
    if (selectedDayFilter === "all") return activeTrip.itinerary;
    return activeTrip.itinerary.filter((d) => d.day === selectedDayFilter);
  }, [activeTrip, selectedDayFilter]);

  // Map Location calculation
  const mapLocation: LocationData = useMemo(() => {
    const acts = activeTrip?.itinerary?.flatMap((d) => d.activities) || [];
    const valid = acts.filter((a) => a.lat && a.lng);
    if (valid.length > 0) {
      const avgLat = valid.reduce((sum, a) => sum + a.lat!, 0) / valid.length;
      const avgLng = valid.reduce((sum, a) => sum + a.lng!, 0) / valid.length;
      return {
        place: activeTrip?.scenario_title || "Destination",
        coordinates: { lat: avgLat, lng: avgLng },
      };
    }
    return {
      place: "Bangkok",
      coordinates: { lat: 13.7563, lng: 100.5018 },
    };
  }, [activeTrip]);

  // Total stops and meals summary
  const tripMetrics = useMemo(() => {
    const days = activeTrip?.itinerary || [];
    const allActivities = days.flatMap((d) => d.activities || []);
    const lunchCount = allActivities.filter(
      (a) => a.type === "food" && (a.time.startsWith("11:") || a.time.startsWith("12:") || a.time.startsWith("13:"))
    ).length;
    const dinnerCount = allActivities.filter(
      (a) => (a.type === "food" || a.type === "nightlife") && (a.time.startsWith("18:") || a.time.startsWith("19:") || a.time.startsWith("20:"))
    ).length;

    return {
      totalDays: days.length,
      totalStops: allActivities.length,
      lunchCount,
      dinnerCount,
      hasCoordinates: allActivities.filter((a) => a.lat && a.lng).length,
    };
  }, [activeTrip]);

  // Handle Scenario Change
  const handleScenarioChange = (scId: string) => {
    setSelectedScenarioId(scId);
    setSelectedDayFilter("all");
    setSelectedActivity(null);
    setEvalMode("inspect");
    const firstInSc = trips.find((t) => t.scenario_id === scId);
    if (firstInSc) setSelectedTripId(firstInSc.id);
  };

  // Handle Plan Change
  const handlePlanChange = (tripId: string) => {
    setSelectedTripId(tripId);
    setSelectedActivity(null);
    setEvalMode("inspect");
  };

  // Check if active user evaluated a trip
  const isTripEvaluatedByUser = (tripId: string) => {
    return resultsData.evaluations.some(
      (ev) => ev.trip_id === tripId && ev.expert_id.toLowerCase() === (userEmail || "").toLowerCase()
    );
  };

  // Submit Single Model Evaluation
  const handleSubmitModelScore = async () => {
    if (!activeTrip) return;
    if (!isProfileSaved) {
      toast.error("กรุณากดบันทึกข้อมูลในส่วนที่ 1 ก่อนทำการประเมิน");
      setIsEditingProfile(true);
      return;
    }

    setSubmittingModelScore(true);
    try {
      const vaScore = currentTripScores.cc6 ?? currentTripScores.vision_alignment ?? 4;
      await submitBlindScore({
        scenario_id: activeTrip.scenario_id,
        trip_id: activeTrip.id,
        blind_label: activeTrip.blind_label,
        expert_id: userEmail || "expert",
        expert_name: effectiveExpertName,
        expert_profile: {
          ...expertProfile,
          geographic_familiarity: currentScenarioFamiliarity,
        },
        geographic_familiarity: currentScenarioFamiliarity,
        vision_alignment: vaScore,
        scores: {
          spatial_feasibility: Math.round(currentTripScores.sr_avg),
          temporal_pacing: Math.round(currentTripScores.pf_avg),
          persona_alignment: Math.round(currentTripScores.cc_avg),
          attraction_quality: Math.round(currentTripScores.de_avg),
          information_accuracy: Math.round(currentTripScores.fa_avg),
        },
        detailed_scores: {
          ...currentTripScores,
          geographic_familiarity: currentScenarioFamiliarity,
          vision_alignment: vaScore,
          cc6: vaScore,
        },
        overall_pick: false,
        feedback: currentTripScores.strengths || currentTripScores.weaknesses,
      });

      toast.success(`บันทึกผลการประเมินสำหรับ "${activeTrip.blind_label}" เรียบร้อยแล้ว!`);
      loadResults();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit model score");
    } finally {
      setSubmittingModelScore(false);
    }
  };

  // Submit Scenario Qualitative Feedback
  const handleSubmitComparison = async () => {
    if (!selectedScenarioId) return;
    if (!isProfileSaved) {
      toast.error("กรุณากรอกและบันทึกข้อมูลผู้เชี่ยวชาญในส่วนที่ 1 ก่อนทำการประเมิน");
      setIsEditingProfile(true);
      return;
    }

    setSubmittingComparison(true);
    try {
      await submitScenarioComparison({
        scenario_id: selectedScenarioId,
        expert_id: userEmail || "expert",
        expert_name: effectiveExpertName,
        expert_profile: {
          ...expertProfile,
          geographic_familiarity: currentScenarioFamiliarity,
        },
        geographic_familiarity: currentScenarioFamiliarity,
        qualitative_feedback: qualitativeFeedback,
      });

      // Synchronize scenario familiarity to any evaluations previously saved for this scenario
      if (userEmail) {
        await syncScenarioFamiliarityToEvals(selectedScenarioId, userEmail, currentScenarioFamiliarity);
      }

      toast.success("บันทึกคำถามเชิงคุณภาพเรียบร้อยแล้ว!");
      loadResults();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit scenario comparison");
    } finally {
      setSubmittingComparison(false);
    }
  };

  // Pre-fill qualitativeFeedback if this expert already answered for this scenario
  useEffect(() => {
    if (selectedScenarioId && userEmail && resultsData.comparisons) {
      const existingComp = resultsData.comparisons.find(
        (c) =>
          c.scenario_id === selectedScenarioId &&
          c.expert_id?.toLowerCase() === userEmail.toLowerCase()
      );
      if (existingComp?.qualitative_feedback) {
        setQualitativeFeedback({
          q1_real_travel: existingComp.qualitative_feedback.q1_real_travel || "",
          q2_tourism_context: existingComp.qualitative_feedback.q2_tourism_context || "",
          q3_value_experience: existingComp.qualitative_feedback.q3_value_experience || "",
          q4_distinct_differences: existingComp.qualitative_feedback.q4_distinct_differences || "",
        });
      } else {
        setQualitativeFeedback({
          q1_real_travel: "",
          q2_tourism_context: "",
          q3_value_experience: "",
          q4_distinct_differences: "",
        });
      }
    }
  }, [selectedScenarioId, userEmail, resultsData.comparisons]);

  // Dev: Confirm and execute trip deletion (non-blocking)
  const handleConfirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    setIsDeletingTrip(true);
    try {
      await deleteBlindTrip(tripToDelete.id);
      toast.success(`ลบ ${tripToDelete.label} สำเร็จ`);
      setSelectedTripId("");
      await loadTrips();
      await loadResults();
      setTripToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถลบทริปได้");
    } finally {
      setIsDeletingTrip(false);
    }
  };

  // Dev: Add / Update User Role
  const handleAddUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    try {
      await updateUserRole(newUserEmail, newUserRole, newUserName || undefined);
      toast.success(`อัปเดตสิทธิ์ของ ${newUserEmail} เป็น "${newUserRole}" สำเร็จ`);
      setNewUserEmail("");
      setNewUserName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 group-hover:scale-105 transition-transform shadow-2xs">
                <Plane className="size-4" />
              </div>
              <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">pixinerary</span>
            </Link>
            <div className="h-4 w-px bg-border mx-1" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300">
                Blind Evaluation Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Database Status Indicator */}
            {dbStatus && (
              <Badge
                variant="outline"
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs ${
                  dbStatus.provider === "supabase"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : dbStatus.provider === "backend_local"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                }`}
                title={dbStatus.message}
              >
                {dbStatus.provider === "supabase" ? (
                  <Cloud className="size-3 text-emerald-500" />
                ) : (
                  <Database className="size-3 text-amber-500" />
                )}
                <span className="hidden md:inline">
                  {dbStatus.provider === "supabase"
                    ? "Cloud DB (Supabase)"
                    : dbStatus.provider === "backend_local"
                      ? "Local Storage"
                      : "Offline"}
                </span>
              </Badge>
            )}

            {/* Active Role Badge & Quick Role Switcher */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">บทบาทปัจจุบัน:</span>
              <Badge
                variant="outline"
                className={`text-xs capitalize font-semibold px-2.5 py-0.5 rounded-full ${role === "dev"
                    ? "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                    : role === "expert"
                      ? "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
              >
                {role}
              </Badge>

              {/* Only show role switcher dropdown to Dev accounts to prevent experts from changing roles */}
              {isDev && (
                <Select
                  value={role}
                  onValueChange={(v) => {
                    setRole(v as UserRole);
                    toast.success(`สลับโหมดมุมมองเป็น: ${v.toUpperCase()}`);
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px] rounded-lg px-2 border-border/80 bg-secondary/50 gap-1">
                    <SelectValue placeholder="สลับบทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Dev (สิทธิ์เต็ม / จัดการ Role)</SelectItem>
                    <SelectItem value="expert">Expert (มุมมองผู้เชี่ยวชาญ)</SelectItem>
                    <SelectItem value="user">User (มุมมองผู้ใช้ทั่วไป)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Link to="/">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs rounded-full">
                <ArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">กลับหน้าหลัก</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-8 space-y-6">
        {/* Role Tabs for Dev (Expert only sees Evaluation Arena) */}
        {isDev && role === "dev" ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto p-1 bg-secondary/80 rounded-2xl">
              <TabsTrigger value="eval" className="rounded-xl text-xs gap-1.5">
                <ListChecks className="size-3.5" />
                <span>ประเมินแผน (Arena)</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="rounded-xl text-xs gap-1.5">
                <BarChart3 className="size-3.5" />
                <span>ผลคะแนน & เฉลย</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-xl text-xs gap-1.5">
                <Users className="size-3.5" />
                <span>จัดการ Role</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eval" className="space-y-6">
              {renderEvaluationSection()}
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              {renderResultsSection()}
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              {renderUsersSection()}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {isDev && role !== "dev" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-amber-600 shrink-0" />
                  <span>
                    กำลังดูตัวอย่างในมุมมอง <strong>{role === "expert" ? "Expert (ผู้เชี่ยวชาญ)" : "User (ผู้ใช้ทั่วไป)"}</strong> (แท็บผลเฉลยและการจัดการ Role จะถูกซ่อนตามสิทธิ์จริง)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRole("dev");
                    toast.success("สลับกลับสู่มุมมอง Dev เรียบร้อยแล้ว");
                  }}
                  className="h-7 text-xs rounded-full border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 shrink-0"
                >
                  สลับกลับสู่โหมด Dev
                </Button>
              </div>
            )}
            {renderEvaluationSection()}
          </div>
        )}
      </main>

      {/* Delete Trip Confirmation Dialog (Non-blocking, fixes INP issue) */}
      <AlertDialog
        open={Boolean(tripToDelete)}
        onOpenChange={(open) => !open && !isDeletingTrip && setTripToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-md p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              <span>ยืนยันการลบแผนการเดินทาง</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              คุณต้องการลบ <strong>{tripToDelete?.label}</strong> ออกจากระบบ Blind Evaluation ใช่หรือไม่?
              ข้อมูลผลการประเมินที่เกี่ยวข้องกับแผนนี้จะถูกลบออกด้วยเพื่อความถูกต้องของฐานข้อมูล
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-3">
            <AlertDialogCancel disabled={isDeletingTrip} className="h-9 rounded-full text-xs">
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingTrip}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteTrip();
              }}
              className="h-9 rounded-full text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
            >
              {isDeletingTrip ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>กำลังลบทริป...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>ยืนยันการลบ</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // -------------------------------------------------------------
  // 1. EVALUATION ARENA SECTION
  // -------------------------------------------------------------
  function renderEvaluationSection() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Sparkles className="size-8 animate-spin text-purple-500" />
          <p className="text-sm">กำลังโหลดคลังแผนการเดินทางสำหรับ Blind Evaluation...</p>
        </div>
      );
    }

    if (trips.length === 0) {
      return (
        <Card className="border-dashed border-2 border-border/80 bg-background/50 rounded-3xl p-8 text-center">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Info className="size-10 text-muted-foreground/60" />
            <CardTitle className="text-lg">ยังไม่มีแผนการเดินทางในคลัง Blind Evaluation</CardTitle>
            <CardDescription className="max-w-md text-xs sm:text-sm">
              เมื่อนักพัฒนา (Dev) สร้างแผนการเดินทางในหน้าหลักแล้วคลิกปุ่ม{" "}
              <span className="font-semibold text-purple-600">"Save to Blind Eval"</span> แผนการเดินทางจะถูกส่งเข้ามาเก็บไว้ที่นี่เพื่อทำการทดสอบ
            </CardDescription>
            {role === "dev" && (
              <Link to="/" className="mt-2">
                <Button size="sm" className="rounded-full gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
                  <Plane className="size-3.5" />
                  ไปสร้างแผนเที่ยวในหน้าหลัก
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      );
    }

    const currentScenarioObj = scenarios.find((s) => s.id === selectedScenarioId);

    return (
      <div className="space-y-6">
        {/* OFFICIAL THESIS HEADER BANNER */}
        <Card className="rounded-3xl border-2 border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50/90 via-indigo-50/40 to-background dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-background shadow-sm overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1 max-w-3xl">
                <Badge className="bg-purple-600 text-white rounded-full text-xs font-semibold px-3 py-0.5">
                  Comparative Model Evaluation
                </Badge>
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground pt-1">
                  แบบประเมินคุณภาพโมเดลโดยผู้เชี่ยวชาญด้านการท่องเที่ยว
                </h1>
                <p className="text-xs sm:text-sm font-medium text-purple-800 dark:text-purple-300">
                  Model Quality Assessment by Tourism Experts - Comparative Evaluation
                </p>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-background/80 border border-border/60 text-xs text-muted-foreground shrink-0 shadow-2xs">
                <Clock className="size-4 text-purple-600 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground block">เวลาโดยประมาณ: 45–60 นาที</span>
                  <span className="text-[10px] text-muted-foreground">รวมการอ่านและเปรียบเทียบทุกแผน</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3.5 border-t border-purple-200/60 dark:border-purple-900/40 text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                <strong className="text-foreground">คำชี้แจง:</strong> แบบประเมินนี้จัดทำขึ้นเพื่อเปรียบเทียบคุณภาพของแผนการเดินทางที่สร้างโดยโมเดล AI ต่างกัน (จำนวน {candidateTrips.length} โมเดล) โดยใช้โจทย์การวางแผนการท่องเที่ยวชุดเดียวกัน โปรดประเมินแต่ละแผนตามหลักวิชาการและประสบการณ์ของท่าน ข้อมูลทั้งหมดจะนำไปวิเคราะห์เพื่อสรุปผลในงานวิทยานิพนธ์
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-foreground/90 bg-background/60 p-2.5 rounded-xl border border-border/40">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600" /> ได้รับแผนจาก {candidateTrips.length} โมเดลจากโจทย์เดียวกัน
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600" /> ประเมินเกณฑ์เดียวกันทุกแผน
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600" /> ตอบคำถามเชิงคุณภาพภาพรวม
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* SECTION 1: EXPERT PROFILE CARD (With One-time Persistence) */}
        <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-5 bg-secondary/30 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground">
              <UserCheck className="size-4 text-purple-600" />
              <span>ส่วนที่ 1: ข้อมูลผู้เชี่ยวชาญ (Expert Profile)</span>
              {isProfileSaved ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] rounded-full gap-1">
                  <CheckCircle2 className="size-3" /> บันทึกแล้ว (พร้อมประเมิน)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] rounded-full gap-1">
                  <AlertCircle className="size-3 text-amber-600" /> ยังไม่ได้บันทึก
                </Badge>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className={`h-7 text-xs rounded-full gap-1 px-3 transition-colors ${
                isEditingProfile
                  ? "border-border/80 bg-background hover:bg-secondary text-muted-foreground hover:text-foreground"
                  : isProfileSaved
                    ? "border-purple-300/80 bg-purple-50/50 hover:bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    : "border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {isEditingProfile ? (
                <>
                  <ChevronUp className="size-3.5 text-purple-600" />
                  <span>ยุบฟอร์ม</span>
                </>
              ) : isProfileSaved ? (
                <>
                  <Edit3 className="size-3 text-purple-600" />
                  <span>แก้ไขข้อมูล</span>
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5 text-amber-600" />
                  <span>ขยายฟอร์ม</span>
                </>
              )}
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            {!isEditingProfile ? (
              /* Collapsed Views */
              isProfileSaved ? (
                /* Verified Compact Summary View */
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs flex-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">ตำแหน่ง/บทบาทหลัก</span>
                      <span className="font-semibold text-foreground block mt-0.5 truncate">
                        {expertProfile.role === "อื่นๆ" ? expertProfile.role_other || "อื่นๆ" : expertProfile.role}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">ประสบการณ์ในวงการท่องเที่ยว</span>
                      <span className="font-semibold text-foreground block mt-0.5">{expertProfile.experience}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">ความคุ้นเคยกับเทคโนโลยี AI</span>
                      <span className="font-semibold text-foreground block mt-0.5 truncate">{expertProfile.ai_familiarity}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/70 border border-border/60">
                      <User className="size-3 text-purple-600 shrink-0" />
                      <span className="font-medium text-foreground truncate max-w-[150px]">{effectiveExpertName}</span>
                    </div>

                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="size-3.5" />
                      <span>ใช้ข้อมูลนี้กับทุกการประเมิน</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Unsaved Collapsed Notice */
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <AlertCircle className="size-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>ข้อมูลผู้เชี่ยวชาญยังไม่ได้บันทึก</strong> — กรุณาเลือกข้อมูลตำแหน่งและประสบการณ์ก่อนส่งผลการประเมิน (ระบบจะจดจำไว้ตลอดการใช้งาน)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsEditingProfile(true)}
                    className="h-7 text-xs rounded-full gap-1.5 px-3.5 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                  >
                    <Edit3 className="size-3" />
                    <span>กรอกข้อมูลผู้เชี่ยวชาญ</span>
                  </Button>
                </div>
              )
            ) : (
              /* Expanded Edit Form */
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    ข้อมูลส่วนนี้กรอกเพียงครั้งเดียว ระบบจะบันทึกไว้ในเบราว์เซอร์อัตโนมัติ และจะนำไปเชื่อมต่อกับทุกการประเมินของท่าน
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Role */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">
                      1. ตำแหน่ง/บทบาทหลัก:
                    </Label>
                    <div className="space-y-1.5">
                      {[
                        "อาจารย์/นักวิชาการด้านการท่องเที่ยว",
                        "ผู้ประกอบการธุรกิจท่องเที่ยว (ทัวร์เอเจนซี่, โรงแรม, สายการบิน)",
                        "มัคคุเทศก์/ผู้นำเที่ยวมืออาชีพ",
                        "ผู้ชื่นชอบการท่องเที่ยวเชิงลึก (Travel Enthusiast/Influencer/Blogger)",
                        "อื่นๆ",
                      ].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setExpertProfile((p) => ({ ...p, role: opt }))}
                          className={`w-full text-left text-xs p-2 rounded-xl border transition-all flex items-center justify-between ${
                            expertProfile.role === opt
                              ? "bg-purple-50 border-purple-500 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-semibold"
                              : "bg-secondary/30 hover:bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="truncate">{opt}</span>
                          {expertProfile.role === opt && <Check className="size-3 text-purple-600 shrink-0 ml-1" />}
                        </button>
                      ))}

                      {expertProfile.role === "อื่นๆ" && (
                        <Input
                          placeholder="โปรดระบุตำแหน่งหรือบทบาท..."
                          value={expertProfile.role_other || ""}
                          onChange={(e) => setExpertProfile((p) => ({ ...p, role_other: e.target.value }))}
                          className="text-xs h-8 rounded-xl mt-1.5"
                        />
                      )}
                    </div>
                  </div>

                  {/* 2. Experience */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">
                      2. ประสบการณ์ในวงการท่องเที่ยว:
                    </Label>
                    <div className="space-y-1.5">
                      {["ต่ำกว่า 3 ปี", "3–5 ปี", "6–10 ปี", "มากกว่า 10 ปี"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setExpertProfile((p) => ({ ...p, experience: opt }))}
                          className={`w-full text-left text-xs p-2 rounded-xl border transition-all flex items-center justify-between ${
                            expertProfile.experience === opt
                              ? "bg-purple-50 border-purple-500 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-semibold"
                              : "bg-secondary/30 hover:bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>{opt}</span>
                          {expertProfile.experience === opt && <Check className="size-3 text-purple-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. AI Familiarity */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">
                      3. ความคุ้นเคยกับ AI/ระบบแนะนำการท่องเที่ยว:
                    </Label>
                    <div className="space-y-1.5">
                      {[
                        "ไม่เคยใช้เลย",
                        "เคยใช้บ้าง (เช่น Google Trips, TripAdvisor, Klook)",
                        "ใช้เป็นประจำ (เช่น ChatGPT, Gemini, Copilot สำหรับวางแผนเที่ยว)",
                      ].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setExpertProfile((p) => ({ ...p, ai_familiarity: opt }))}
                          className={`w-full text-left text-xs p-2 rounded-xl border transition-all flex items-center justify-between ${
                            expertProfile.ai_familiarity === opt
                              ? "bg-purple-50 border-purple-500 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-semibold"
                              : "bg-secondary/30 hover:bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="leading-tight">{opt}</span>
                          {expertProfile.ai_familiarity === opt && <Check className="size-3 text-purple-600 shrink-0 ml-1" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Optional Evaluator Name (Hidden/Subtle toggle by default) */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOptionalName((v) => !v)}
                    className="text-[11px] text-muted-foreground/75 hover:text-muted-foreground flex items-center gap-1.5 transition-colors py-1 px-1.5 rounded-lg hover:bg-secondary/40"
                  >
                    <User className="size-3 opacity-60 text-purple-600" />
                    <span>
                      {showOptionalName || (expertProfile.name && expertProfile.name.trim().length > 0)
                        ? "ซ่อนช่องระบุชื่อผู้ประเมิน"
                        : `+ ระบุชื่อ-นามสกุล / นามแฝง (ค่าเริ่มต้น: ${defaultExpertName} — ไม่บังคับกรอก)`}
                    </span>
                    {showOptionalName || (expertProfile.name && expertProfile.name.trim().length > 0) ? (
                      <ChevronUp className="size-3 opacity-60" />
                    ) : (
                      <ChevronDown className="size-3 opacity-60" />
                    )}
                  </button>

                  {(showOptionalName || (expertProfile.name && expertProfile.name.trim().length > 0)) && (
                    <div className="mt-2 p-3 rounded-2xl bg-secondary/30 border border-border/50 space-y-1.5 max-w-md animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="expert-name-input" className="text-xs font-medium text-foreground flex items-center gap-1">
                          <User className="size-3 text-purple-600" />
                          <span>ชื่อ-นามสกุล / นามแฝงผู้ประเมิน:</span>
                          <span className="text-[10px] text-muted-foreground font-normal">(ไม่บังคับกรอก)</span>
                        </Label>
                      </div>
                      <Input
                        id="expert-name-input"
                        placeholder={`ระบุชื่อหรือไม่ระบุก็ได้ (เช่น ${defaultExpertName}, คุณกานต์ หรือเว้นว่างไว้เพื่อใช้ชื่อ ${defaultExpertName})`}
                        value={expertProfile.name || ""}
                        onChange={(e) => setExpertProfile((p) => ({ ...p, name: e.target.value }))}
                        className="text-xs h-8 rounded-xl bg-background border-border/80"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingProfile(false)}
                    className="h-8 px-3.5 rounded-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <ChevronUp className="size-3.5" />
                    <span>ยุบฟอร์ม</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSaveProfile}
                    className="h-8 px-5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                  >
                    <Save className="size-3.5" />
                    <span>บันทึกข้อมูลผู้เชี่ยวชาญ</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SCENARIO HEADER & SELECTOR */}
        <Card className="rounded-3xl border border-border/80 bg-background/90 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">
                  โจทย์การทดสอบ (Scenario Benchmark)
                </span>
                <CardTitle className="text-base sm:text-lg mt-0.5 flex items-center gap-2">
                  {currentScenarioObj?.title || selectedScenarioId}
                  <Badge variant="secondary" className="rounded-full text-[11px]">
                    {candidateTrips.length} แผนเปรียบเทียบ
                  </Badge>
                </CardTitle>
              </div>

              {/* Scenario Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Select value={selectedScenarioId} onValueChange={handleScenarioChange}>
                  <SelectTrigger className="h-8 rounded-full text-xs min-w-[210px] border-border/80 bg-secondary/50">
                    <SelectValue placeholder="เลือก Scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id} className="text-xs">
                        {sc.id}: {sc.title} ({sc.count} แผน)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Geographic Familiarity Control Variable (Research Covariate) */}
            <div className="mt-3 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                      ระดับความคุ้นเคยกับพื้นที่ของโจทย์ (Geographic Familiarity)
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-background/80 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                      ระดับ {currentScenarioFamiliarity} / 5
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ตัวแปรควบคุมตามระเบียบวิธีวิจัย: โปรดระบุระดับความคุ้นเคยหรือประสบการณ์ของท่านต่อจุดหมายปลายทางใน Scenario นี้
                  </p>
                </div>
              </div>

              {/* 1-5 Likert Level Buttons */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-x-auto pb-1 md:pb-0">
                {[
                  { level: 1, label: "1: ไม่เคยไป", desc: "Never visited" },
                  { level: 2, label: "2: เคยไปนานแล้ว", desc: "Visited long ago" },
                  { level: 3, label: "3: เคยไป 1-2 ครั้ง", desc: "Visited 1-2 times" },
                  { level: 4, label: "4: เดินทางบ่อย", desc: "Frequent traveler" },
                  { level: 5, label: "5: เชี่ยวชาญพื้นที่", desc: "Local Expert" },
                ].map((item) => {
                  const isSelected = currentScenarioFamiliarity === item.level;
                  return (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => handleSetScenarioFamiliarity(item.level)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap flex flex-col items-center ${
                        isSelected
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs font-bold scale-102"
                          : "bg-background/90 hover:bg-secondary/70 border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                      title={item.desc}
                    >
                      <span className="text-[11px] leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Constraints Card */}
            <div className="mt-3 rounded-2xl border border-purple-200/90 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-background dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-background p-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 border-b border-purple-200/60 dark:border-purple-900/40 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-purple-950 dark:text-purple-200 uppercase tracking-wider">
                    เงื่อนไขและข้อมูลความต้องการที่ระบุในโจทย์ (Traveler Constraints)
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-background/80 font-medium">
                  {activeTrip?.scenario_id || "SC-01"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-background/90 border border-border/50">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <User className="size-2.5 text-purple-500" /> ประเภทผู้เดินทาง
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {activeTrip?.preferences?.travelerType || "Solo (เดี่ยว)"}
                  </span>
                </div>

                {(() => {
                  const p = activeTrip?.preferences;
                  const min = p?.budgetMinTHB ?? (Array.isArray(p?.budgetRange) ? p.budgetRange[0] : undefined);
                  const max = p?.budgetMaxTHB ?? (Array.isArray(p?.budgetRange) ? p.budgetRange[1] : undefined);
                  const rawTier = p?.budget || "";
                  const tier = rawTier ? rawTier.charAt(0).toUpperCase() + rawTier.slice(1) : "";

                  let rangeStr = "";
                  if (min !== undefined && max !== undefined && min !== null && max !== null) {
                    rangeStr = min === max ? `฿${min.toLocaleString()}` : `฿${min.toLocaleString()} - ฿${max.toLocaleString()}`;
                  } else if (min !== undefined && min !== null) {
                    rangeStr = `≥ ฿${min.toLocaleString()}`;
                  } else if (max !== undefined && max !== null) {
                    rangeStr = `≤ ฿${max.toLocaleString()}`;
                  }

                  const tooltipText = rangeStr
                    ? (tier ? `งบประมาณ: ${rangeStr} (${tier})` : `งบประมาณ: ${rangeStr}`)
                    : `งบประมาณ: ${tier || "ไม่ได้ระบุ"}`;

                  return (
                    <div className="p-2 rounded-xl bg-background/90 border border-border/50" title={tooltipText}>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <DollarSign className="size-2.5 text-emerald-500" /> งบประมาณ
                      </span>
                      <span className="font-semibold text-foreground mt-0.5 block truncate">
                        {rangeStr ? (
                          <>
                            {rangeStr}
                            {tier && (
                              <span className="text-muted-foreground font-normal text-[10px] ml-1">
                                ({tier})
                              </span>
                            )}
                          </>
                        ) : (
                          tier || "Budget"
                        )}
                      </span>
                    </div>
                  );
                })()}

                <div className="p-2 rounded-xl bg-background/90 border border-border/50">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Zap className="size-2.5 text-amber-500" /> จังหวะเวลา (Pace)
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {activeTrip?.preferences?.pace || "Fast-paced"}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-background/90 border border-border/50">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CalendarRange className="size-2.5 text-sky-500" /> ระยะเวลา
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {tripMetrics.totalDays} วัน
                    {activeTrip?.preferences?.startDate ? ` (${activeTrip.preferences.startDate})` : ""}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-background/90 border border-border/50 col-span-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Tag className="size-2.5 text-indigo-500" /> กิจกรรมที่เน้น
                  </span>
                  <div className="flex gap-1 flex-wrap mt-0.5">
                    {(activeTrip?.preferences?.activities && activeTrip.preferences.activities.length > 0
                      ? activeTrip.preferences.activities
                      : ["Culture", "Food", "Nightlife", "Shopping"]
                    ).map((act, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                        {act}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-purple-200/40 dark:border-purple-900/30 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {activeTrip?.preferences?.destination && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-red-500" />
                    จุดหมาย: <strong className="text-foreground">{activeTrip.preferences.destination}</strong>
                  </span>
                )}
                {activeTrip?.preferences?.hotelName && (
                  <span className="flex items-center gap-1">
                    <Hotel className="size-3 text-purple-600" />
                    ที่พัก: <strong className="text-foreground">{activeTrip.preferences.hotelName}</strong>
                  </span>
                )}
                {activeTrip?.preferences?.flightCode && (
                  <span className="flex items-center gap-1">
                    <PlaneTakeoff className="size-3 text-sky-600" />
                    เที่ยวบิน: <strong className="text-foreground">{activeTrip.preferences.flightCode}</strong>
                  </span>
                )}
                {activeTrip?.scenario_notes && (
                  <span className="text-foreground/90 italic">
                    📌 หมายเหตุโจทย์: {activeTrip.scenario_notes}
                  </span>
                )}
              </div>
            </div>

            {/* Input Locations from Uploaded Photos */}
            {(() => {
              const normalize = (str?: string) => (str || "").trim().toLowerCase();

              const isSameImage = (urlA?: string, urlB?: string) => {
                if (!urlA || !urlB) return false;
                const a = urlA.trim();
                const b = urlB.trim();
                if (a === b) return true;
                if (a.startsWith("http") && b.startsWith("http")) {
                  const cleanA = a.split("?")[0];
                  const cleanB = b.split("?")[0];
                  if (cleanA === cleanB) return true;
                }
                return false;
              };

              const isSameLocation = (a: any, b: any) => {
                // 1. Same image URL or image source data (primary check)
                if (isSameImage(a.uploadedImageUrl, b.uploadedImageUrl)) {
                  return true;
                }

                // 2. Same place name (primary, th, en)
                const aPlace = normalize(a.place);
                const bPlace = normalize(b.place);
                if (aPlace && bPlace && aPlace === bPlace) return true;

                const aTh = normalize(a.place_th);
                const bTh = normalize(b.place_th);
                if (aTh && bTh && aTh === bTh) return true;

                const aEn = normalize(a.place_en);
                const bEn = normalize(b.place_en);
                if (aEn && bEn && aEn === bEn) return true;

                // Cross match Thai and English place names
                if (aPlace && (aPlace === bTh || aPlace === bEn)) return true;
                if (bPlace && (bPlace === aTh || bPlace === aEn)) return true;

                // 3. Proximity coordinates (< 300 meters)
                if (
                  a.lat !== undefined &&
                  a.lng !== undefined &&
                  b.lat !== undefined &&
                  b.lng !== undefined
                ) {
                  const latDiff = Math.abs(Number(a.lat) - Number(b.lat));
                  const lngDiff = Math.abs(Number(a.lng) - Number(b.lng));
                  if (latDiff < 0.003 && lngDiff < 0.003) return true;
                }

                return false;
              };

              const tripsToScan = candidateTrips.length > 0 ? candidateTrips : (activeTrip ? [activeTrip] : []);
              const rawLocs = tripsToScan.flatMap(
                (t) => (t as any).uploaded_locations || (t as any).detected_locations || []
              );

              const uploadedLocs = rawLocs.reduce<Array<any>>((acc, loc) => {
                if (!loc) return acc;
                const existingIndex = acc.findIndex((item) => isSameLocation(item, loc));
                if (existingIndex >= 0) {
                  const existing = acc[existingIndex];
                  const existingConf = typeof existing.confidence === "number" ? existing.confidence : 0;
                  const newConf = typeof loc.confidence === "number" ? loc.confidence : 0;

                  // Keep higher confidence entry and merge supplementary metadata
                  if (newConf > existingConf) {
                    acc[existingIndex] = {
                      ...loc,
                      place_th: loc.place_th || existing.place_th,
                      place_en: loc.place_en || existing.place_en,
                      city_th: loc.city_th || existing.city_th,
                      city: loc.city || existing.city,
                      country_th: loc.country_th || existing.country_th,
                      country: loc.country || existing.country,
                      uploadedImageUrl: loc.uploadedImageUrl || existing.uploadedImageUrl,
                    };
                  } else {
                    acc[existingIndex] = {
                      ...existing,
                      place_th: existing.place_th || loc.place_th,
                      place_en: existing.place_en || loc.place_en,
                      city_th: existing.city_th || loc.city_th,
                      city: existing.city || loc.city,
                      country_th: existing.country_th || loc.country_th,
                      country: existing.country || loc.country,
                      uploadedImageUrl: existing.uploadedImageUrl || loc.uploadedImageUrl,
                    };
                  }
                } else {
                  acc.push({ ...loc });
                }
                return acc;
              }, []);

              return (
                <div className="mt-3 rounded-2xl border border-sky-200/80 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/60 via-indigo-50/30 to-background dark:from-sky-950/25 dark:via-indigo-950/10 dark:to-background p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-3 border-b border-sky-200/60 dark:border-sky-900/40 pb-2.5">
                    <Camera className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wider leading-tight">
                        จุดหมายที่ระบุจากรูปที่ผู้ใช้อัปโหลด
                      </span>
                      <span className="text-[10px] text-sky-700/70 dark:text-sky-400/70 font-normal">
                        Input Locations (ผ่าน Vision AI + Outlier Filter)
                      </span>
                    </div>
                    {uploadedLocs.length > 0 && (
                      <Badge variant="outline" className="ml-auto text-[10px] bg-background/80 font-medium border-sky-300/60 shrink-0">
                        {uploadedLocs.length} สถานที่
                      </Badge>
                    )}
                  </div>

                  {uploadedLocs.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {uploadedLocs.map((loc: any, idx: number) => (
                          <div
                            key={idx}
                            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xs flex flex-col"
                          >
                            <div className="relative h-20 w-full overflow-hidden bg-muted">
                              {loc.uploadedImageUrl ? (
                                <img
                                  src={loc.uploadedImageUrl}
                                  alt={loc.place}
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-sky-100 dark:bg-sky-950/40">
                                  <Camera className="size-6 text-sky-400" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                              <div className="absolute bottom-1.5 right-1.5">
                                <span className="text-[9px] font-semibold bg-black/60 text-white rounded-full px-1.5 py-0.5 backdrop-blur-sm">
                                  {Math.round(loc.confidence * 100)}%
                                </span>
                              </div>
                            </div>

                            <div className="p-2 flex flex-col gap-0.5">
                              <div className="flex items-center gap-1">
                                <MapPin className="size-2.5 text-sky-500 shrink-0" />
                                <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
                                  {loc.place_th || loc.place}
                                </span>
                              </div>
                              {(loc.city_th || loc.city || loc.country_th || loc.country) && (
                                <span className="text-[10px] text-muted-foreground truncate pl-3.5">
                                  {loc.city_th || loc.city}
                                  {(loc.city_th || loc.city) && (loc.country_th || loc.country) ? ", " : ""}
                                  {loc.country_th || loc.country}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-sky-700/70 dark:text-sky-400/60 mt-2.5 italic">
                        📍 นี่คือสถานที่จริงที่ผู้ใช้อัปโหลดรูปมา — ใช้เป็นเกณฑ์หลักในการพิจารณาว่าแผนครอบคลุมจุดหมายที่ต้องการหรือไม่
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <div className="size-9 rounded-xl bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center shrink-0">
                        <ImageIcon className="size-4 text-sky-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/80">ไม่มีข้อมูลรูปที่อัปโหลด</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          ทริปนี้บันทึกก่อนระบบเก็บข้อมูล input locations — ดูจุดหมายได้จาก <strong>จุดหมาย</strong> ใน Traveler Constraints ด้านบน
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Switcher: Model Candidates OR Comparative Ranking View */}
            <div className="flex items-center justify-between gap-2 pt-3 flex-wrap border-t border-border/40 mt-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs text-muted-foreground mr-1 shrink-0">เลือกตรวจแผน:</span>
                {candidateTrips.map((candidate) => {
                  const isActive = evalMode === "inspect" && activeTrip?.id === candidate.id;
                  const isEvaluated = isTripEvaluatedByUser(candidate.id);
                  return (
                    <Button
                      key={candidate.id}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => handlePlanChange(candidate.id)}
                      className={`rounded-2xl text-xs h-8 px-3.5 transition-all gap-1.5 ${
                        isActive
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-xs font-semibold"
                          : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Award className="size-3.5" />
                      <span>{candidate.blind_label}</span>

                      {isEvaluated ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="size-2.5" /> ประเมินแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] opacity-70">
                          (รอประเมิน)
                        </span>
                      )}

                      {role === "dev" && candidate.actual_model && (
                        <span className="text-[10px] opacity-70 border-l border-white/30 pl-1 font-mono">
                          ({candidate.actual_model.split("/").pop()})
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Special Button: Summary Matrix & Qualitative View */}
              <Button
                size="sm"
                variant={evalMode === "compare" ? "default" : "outline"}
                onClick={() => setEvalMode("compare")}
                className={`rounded-2xl text-xs h-8 px-4 gap-1.5 shadow-xs ${
                  evalMode === "compare"
                    ? "bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    : "border-amber-400/70 text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100"
                }`}
              >
                <MessageSquareQuote className="size-3.5 text-amber-500" />
                <span>ส่วนที่ 3: สรุปภาพรวม & คำถามเชิงคุณภาพ</span>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* CONDITIONAL DISPLAY: MODE "inspect" (Left Itinerary + Right Rubric) vs MODE "compare" (Part 3 & 4) */}
        {evalMode === "inspect" ? (
          /* 2-Column Split: Left = Interactive Map & Itinerary (7 cols), Right = 6-Dimension Rubric (5 cols) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Map, Day Overview & Itinerary Details (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Header info bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 text-xs px-2.5 py-0.5 rounded-full">
                    กำลังตรวจสอบ: {activeTrip?.blind_label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({tripMetrics.totalDays} วัน • {tripMetrics.totalStops} จุดกิจกรรม • {tripMetrics.lunchCount} มื้อเที่ยง • {tripMetrics.dinnerCount} มื้อค่ำ)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsMapVisible((prev) => !prev)}
                    className="h-7 text-xs rounded-full gap-1"
                  >
                    <MapIcon className="size-3 text-purple-600" />
                    <span>{isMapVisible ? "ซ่อนแผนที่" : "แสดงแผนที่"}</span>
                  </Button>

                  {role === "dev" && activeTrip && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTripToDelete({ id: activeTrip.id, label: activeTrip.blind_label })}
                      className="h-7 text-destructive hover:bg-destructive/10 text-xs rounded-full gap-1"
                    >
                      <Trash2 className="size-3" />
                      ลบทริป
                    </Button>
                  )}
                </div>
              </div>

              {/* Map View */}
              {isMapVisible && (
                <Card className="rounded-3xl border border-border/80 bg-background shadow-sm overflow-hidden">
                  <CardHeader className="py-2.5 px-4 bg-secondary/30 border-b border-border/50 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Navigation className="size-3.5 text-purple-600" />
                      <span>แผนที่เส้นทางท่องเที่ยว (Interactive Route Map)</span>
                      <Badge variant="outline" className="text-[10px] rounded-full">
                        {tripMetrics.hasCoordinates} หมุดพิกัด
                      </Badge>
                      {selectedDayFilter !== "all" && (
                        <Badge
                          className="text-[10px] rounded-full text-white font-semibold flex items-center gap-1 shadow-2xs border-0"
                          style={{
                            backgroundColor:
                              DAY_COLORS[
                                ((typeof selectedDayFilter === "number" ? selectedDayFilter : 1) - 1) %
                                  DAY_COLORS.length
                              ],
                          }}
                        >
                          <span className="size-1.5 rounded-full bg-white animate-pulse" />
                          กำลังดู Day {selectedDayFilter}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedDayFilter === "all"
                        ? "สีหมุดแยกตามวัน (คลิกหมุดเพื่อดูข้อมูล)"
                        : `แสดงเฉพาะเส้นทางวันที่ ${selectedDayFilter}`}
                    </span>
                  </CardHeader>
                  <CardContent className="p-0 h-[380px] relative">
                    <MapSection
                      location={mapLocation}
                      itinerary={activeTrip?.itinerary || []}
                      selectedDay={selectedDayFilter}
                      onSelectDay={(day) => setSelectedDayFilter(day)}
                      dayColors={DAY_COLORS}
                      selectedActivity={selectedActivity}
                      onSelectActivity={(act) => setSelectedActivity(act)}
                      hoveredActivityId={hoveredActivityId}
                      mapOnly={true}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Day Filter Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-purple-500" />
                    ภาพรวมตารางกิจกรรม (Itinerary Overview)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    เลือกวันเพื่อโฟกัสตารางและเส้นทาง
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <Button
                    size="sm"
                    variant={selectedDayFilter === "all" ? "default" : "outline"}
                    onClick={() => setSelectedDayFilter("all")}
                    className={`h-7 rounded-xl text-xs px-3 ${
                      selectedDayFilter === "all"
                        ? "bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ดูทุกวัน ({tripMetrics.totalStops} จุด)
                  </Button>

                  {activeTrip?.itinerary?.map((d, idx) => {
                    const isSelected = selectedDayFilter === d.day;
                    const dayIndex = typeof d.day === "number" && !isNaN(d.day) ? d.day - 1 : idx;
                    const dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length];
                    return (
                      <Button
                        key={d.day || idx}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => setSelectedDayFilter(d.day)}
                        className={`h-7 rounded-xl text-xs px-3 gap-1.5 ${
                          isSelected
                            ? "bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: dayColor }}
                        />
                        <span>Day {d.day || idx + 1}</span>
                        <span className="opacity-70 text-[10px]">({d.activities?.length || 0})</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Itinerary Cards */}
              <div className="space-y-4">
                {displayItinerary.map((dayPlan, dIdx) => {
                  const dayIndex = dayPlan.day ? dayPlan.day - 1 : dIdx;
                  const dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length];

                  return (
                    <Card
                      key={dayPlan.day || dIdx}
                      className="rounded-3xl border border-border/80 bg-background/90 shadow-xs overflow-hidden"
                    >
                      <CardHeader className="py-3 px-5 bg-secondary/40 border-b border-border/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="size-3 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: dayColor }}
                            />
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <Calendar className="size-4 text-purple-600" />
                              Day {dayPlan.day || dIdx + 1}
                              {dayPlan.date && (
                                <span className="text-xs font-normal text-muted-foreground">
                                  • {dayPlan.date}
                                </span>
                              )}
                            </CardTitle>
                          </div>
                          <Badge variant="outline" className="text-[11px] rounded-full">
                            {dayPlan.activities?.length || 0} จุดกิจกรรม
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3">
                        {dayPlan.activities?.map((act, aIdx) => {
                          const isSelected = selectedActivity?.id === act.id;
                          const placeImage = getPlaceImage({
                            name: act.title,
                            image_url: act.image_url || act.photo_url || act.image,
                            type: act.type,
                            english_name: act.english_name || act.title_en,
                          });

                          const isLunch =
                            act.type === "food" &&
                            (act.time.startsWith("11:") || act.time.startsWith("12:") || act.time.startsWith("13:"));
                          const isDinner =
                            (act.type === "food" || act.type === "nightlife") &&
                            (act.time.startsWith("18:") || act.time.startsWith("19:") || act.time.startsWith("20:"));

                          const typeStyle = typeConfig[act.type] || {
                            label: act.type,
                            color: "bg-slate-100 text-slate-700 border-slate-200",
                          };

                          return (
                            <div
                              key={act.id || aIdx}
                              onClick={() => setSelectedActivity(act)}
                              onMouseEnter={() => setHoveredActivityId(act.id)}
                              onMouseLeave={() => setHoveredActivityId(null)}
                              className={`flex gap-3.5 p-3 rounded-2xl transition-all border cursor-pointer ${
                                isSelected
                                  ? "bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 shadow-xs"
                                  : "bg-secondary/20 hover:bg-secondary/40 border-border/50"
                              }`}
                            >
                              <div className="relative size-16 sm:size-20 rounded-xl overflow-hidden shrink-0 bg-muted border border-border/60">
                                <img
                                  src={placeImage}
                                  alt={act.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute top-1 left-1">
                                  <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                                    #{aIdx + 1}
                                  </span>
                                </div>
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/70 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/60">
                                    <Clock className="size-2.5" />
                                    {act.time || "--:--"}
                                  </span>

                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] uppercase font-mono px-2 py-0 rounded-md ${typeStyle.color}`}
                                  >
                                    {act.type}
                                  </Badge>

                                  {isLunch && (
                                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-[10px] gap-1 px-1.5 py-0 rounded-md">
                                      <Utensils className="size-2.5" /> มื้อกลางวัน (Lunch)
                                    </Badge>
                                  )}

                                  {isDinner && (
                                    <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 border-indigo-300 text-[10px] gap-1 px-1.5 py-0 rounded-md">
                                      <Utensils className="size-2.5" /> มื้อค่ำ (Dinner)
                                    </Badge>
                                  )}
                                </div>

                                <div>
                                  <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                                    {act.title_th || act.title}
                                  </h4>
                                  {act.title_en && act.title_en !== act.title && (
                                    <span className="text-[11px] text-muted-foreground font-normal">
                                      {act.title_en}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {act.description_th || act.description}
                                </p>

                                <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground/80 flex-wrap">
                                  {act.openingHours && act.openingHours.length > 0 && (
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <Clock className="size-2.5" />
                                      เวลาเปิด: {act.openingHours[0]}
                                    </span>
                                  )}
                                  {act.lat && act.lng && (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lng}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline"
                                    >
                                      <MapPin className="size-2.5" />
                                      <span>
                                        {act.lat.toFixed(4)}, {act.lng.toFixed(4)}
                                      </span>
                                      <ExternalLink className="size-2" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Section 2 - Model-by-Model 6-Dimension Rubric (5 cols Sticky) */}
            <div className="lg:col-span-5 sticky top-20 space-y-4">
              <Card className="rounded-3xl border-2 border-purple-200 dark:border-purple-900/60 bg-background shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border-b border-border/60 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                        ส่วนที่ 2: การประเมินแต่ละโมเดล
                      </span>
                      <CardTitle className="text-sm sm:text-base flex items-center gap-1.5 text-foreground mt-0.5">
                        <Star className="size-4 text-purple-600 fill-purple-500" />
                        ประเมิน: <strong className="text-purple-700 dark:text-purple-300">{activeTrip?.blind_label}</strong>
                      </CardTitle>
                    </div>
                    <Badge className="bg-purple-600 text-white rounded-full text-[10px]">
                      Double-Blind
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    คำชี้แจง: โปรดประเมินเกณฑ์ทั้ง 6 ด้าน (1 = น้อยที่สุด, 5 = มากที่สุด)
                  </p>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Dedicated Academic Indicator: Vision-Plan Alignment (ความสอดคล้องกับรูปภาพ) */}
                  <div className="p-3.5 rounded-2xl border border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="flex size-7.5 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400 mt-0.5">
                          <Camera className="size-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs font-bold text-sky-950 dark:text-sky-100 leading-snug block">
                            Vision-Plan Alignment (ความสอดคล้องกับรูปภาพ)
                          </span>
                          <p className="text-[11px] text-muted-foreground leading-normal">
                            แผนบูรณาการสถานที่และแรงบันดาลใจจากรูปภาพที่อัปโหลดได้ครบถ้วนเพียงใด
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900 border border-sky-300/60 dark:border-sky-800 shrink-0 whitespace-nowrap">
                        {currentTripScores.cc6 || currentTripScores.vision_alignment || 4} / 5
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const isSelected = (currentTripScores.cc6 || currentTripScores.vision_alignment || 4) === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              updateActiveScore("cc6", num);
                            }}
                            className={`h-7.5 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-sky-600 text-white shadow-xs font-bold scale-102"
                                : "bg-background/90 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dimension Tabs */}
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-1 p-1 bg-secondary/50 rounded-2xl">
                    {DIMENSIONS.map((dim) => {
                      const avg = currentTripScores[`${dim.id}_avg` as keyof DetailedDimensionScores] || 4.0;
                      const isActive = activeDimTab === dim.id;
                      return (
                        <button
                          key={dim.id}
                          type="button"
                          onClick={() => setActiveDimTab(dim.id)}
                          className={`py-1.5 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                            isActive
                              ? "bg-purple-600 text-white shadow-2xs font-bold"
                              : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="text-[11px]">{dim.code}</span>
                          <span className={`text-[10px] ${isActive ? "text-purple-100" : "text-muted-foreground"}`}>
                            {avg}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setActiveDimTab("overall")}
                      className={`py-1.5 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                        activeDimTab === "overall"
                          ? "bg-purple-600 text-white shadow-2xs font-bold"
                          : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-[11px]">สรุป</span>
                      <span className={`text-[10px] ${activeDimTab === "overall" ? "text-purple-100" : "text-muted-foreground"}`}>
                        {currentTripScores.overall_percentage}%
                      </span>
                    </button>
                  </div>

                  {/* Active Dimension Items */}
                  {DIMENSIONS.map((dim) => {
                    if (activeDimTab !== dim.id) return null;
                    const dimAvg = currentTripScores[`${dim.id}_avg` as keyof DetailedDimensionScores] || 4.0;

                    return (
                      <div key={dim.id} className="space-y-3.5">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span className={`size-2 rounded-full ${dim.id === 'fa' ? 'bg-sky-500' : dim.id === 'cc' ? 'bg-emerald-500' : dim.id === 'pf' ? 'bg-amber-500' : dim.id === 'sr' ? 'bg-purple-500' : dim.id === 'de' ? 'bg-pink-500' : 'bg-teal-500'}`} />
                            {dim.title}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            เฉลี่ย: {dimAvg} / 5
                          </span>
                        </div>

                        <div className="space-y-3">
                          {dim.items.map((item) => {
                            const val = (currentTripScores as any)[item.id] || 4;
                            return (
                              <div key={item.id} className="space-y-1.5 pb-2.5 border-b border-border/40 last:border-0">
                                <div className="flex items-start justify-between gap-2">
                                  <Label className="text-xs leading-snug font-medium text-foreground/90">
                                    <span className="font-bold text-purple-600 mr-1">{item.code}:</span>
                                    {item.text}
                                  </Label>
                                  <span className="text-xs font-bold text-purple-600 shrink-0 ml-1">
                                    {val} / 5
                                  </span>
                                </div>

                                {/* 1 - 5 Likert Buttons */}
                                <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                                  {[1, 2, 3, 4, 5].map((num) => {
                                    const isSelected = val === num;
                                    return (
                                      <button
                                        key={num}
                                        type="button"
                                        onClick={() => updateActiveScore(item.id as any, num)}
                                        className={`h-7 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                                          isSelected
                                            ? "bg-purple-600 text-white shadow-xs scale-105"
                                            : "bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        {num}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Navigation between tabs */}
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const idx = DIMENSIONS.findIndex((d) => d.id === dim.id);
                              if (idx > 0) setActiveDimTab(DIMENSIONS[idx - 1].id);
                            }}
                            className="h-7 text-xs rounded-full"
                          >
                            ย้อนกลับ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const idx = DIMENSIONS.findIndex((d) => d.id === dim.id);
                              if (idx < DIMENSIONS.length - 1) {
                                setActiveDimTab(DIMENSIONS[idx + 1].id);
                              } else {
                                setActiveDimTab("overall");
                              }
                            }}
                            className="h-7 text-xs rounded-full gap-1"
                          >
                            <span>ถัดไป</span>
                            <ChevronRight className="size-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Overall Evaluation Tab */}
                  {activeDimTab === "overall" && (
                    <div className="space-y-4">
                      {/* 1. Slider 0-100% */}
                      <div className="space-y-2 p-3.5 rounded-2xl bg-secondary/30 border border-border/60">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-foreground">
                            1. คะแนนภาพรวมของโมเดลนี้ (Overall 0–100%):
                          </Label>
                          <span className="text-xs font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2.5 py-0.5 rounded-full">
                            {currentTripScores.overall_percentage}%
                          </span>
                        </div>

                        <Slider
                          value={[currentTripScores.overall_percentage]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(val) => updateActiveScore("overall_percentage", val[0])}
                          className="py-2"
                        />

                        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                          <span>0% (แย่มาก)</span>
                          <span>50% (พอใช้)</span>
                          <span>100% (ดีมาก)</span>
                        </div>
                      </div>

                      {/* 2. Strengths */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          2. จุดเด่นของแผนจากโมเดลนี้:
                        </Label>
                        <Textarea
                          value={currentTripScores.strengths || ""}
                          onChange={(e) => updateActiveScore("strengths", e.target.value)}
                          placeholder="ระบุจุดที่โมเดลนี้ทำได้ดี เช่น การเลือกสถานที่, จังหวะเวลา, ความน่าสนใจ..."
                          className="text-xs min-h-[60px] rounded-2xl"
                        />
                      </div>

                      {/* 3. Weaknesses */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          3. จุดอ่อน/ข้อควรปรับปรุงของแผนจากโมเดลนี้:
                        </Label>
                        <Textarea
                          value={currentTripScores.weaknesses || ""}
                          onChange={(e) => updateActiveScore("weaknesses", e.target.value)}
                          placeholder="ระบุข้อผิดพลาด เช่น เส้นทางอ้อม, เวลาไม่สอดคล้อง, ขาดสถานที่สำคัญ..."
                          className="text-xs min-h-[60px] rounded-2xl"
                        />
                      </div>

                      {/* 4. Priority Improvement */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          4. ท่านจะแนะนำให้ปรับปรุงอะไรเป็นอันดับแรกในแผนนี้?
                        </Label>
                        <Select
                          value={currentTripScores.priority_improvement || PRIORITY_IMPROVEMENT_OPTIONS[0]}
                          onValueChange={(v) => updateActiveScore("priority_improvement", v)}
                        >
                          <SelectTrigger className="text-xs h-8 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_IMPROVEMENT_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {currentTripScores.priority_improvement === "อื่นๆ (ระบุ)" && (
                          <Input
                            placeholder="ระบุสิ่งที่ควรปรับปรุง..."
                            value={currentTripScores.priority_improvement_other || ""}
                            onChange={(e) => updateActiveScore("priority_improvement_other", e.target.value)}
                            className="text-xs h-8 rounded-xl mt-1"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Submit Model Score Button */}
                  <Button
                    onClick={handleSubmitModelScore}
                    disabled={submittingModelScore || !activeTrip}
                    className="w-full h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md gap-2 mt-2"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>{submittingModelScore ? "กำลังบันทึก..." : `บันทึกคะแนน ${activeTrip?.blind_label}`}</span>
                  </Button>

                  {/* Hint to jump to comparison */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setEvalMode("compare")}
                      className="text-xs text-purple-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>ไปที่ส่วนที่ 3: สรุปภาพรวม & คำถามเชิงคุณภาพ</span>
                      <ChevronRight className="size-3" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* =============================================================
             PART 3: SUMMARY MATRIX & QUALITATIVE FEEDBACK VIEW
             ============================================================= */
          <div className="space-y-6">
            {/* Back button to plan inspector */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEvalMode("inspect")}
                className="rounded-full text-xs gap-1"
              >
                <ArrowLeft className="size-3.5" />
                <span>กลับไปดูรายละเอียดแผน ({activeTrip?.blind_label})</span>
              </Button>
            </div>

            {/* Summary Comparison Table Card */}
            <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                      ส่วนที่ 3: สรุปภาพรวม & การเปรียบเทียบโมเดล (Summary Matrix)
                    </span>
                    <CardTitle className="text-base font-bold mt-0.5">
                      ตารางเปรียบเทียบภาพรวม (Summary Matrix)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      คำนวณคะแนนเฉลี่ยจากแต่ละด้าน และคะแนนรวมที่ท่านให้ในส่วนที่ 2 โดยอัตโนมัติ
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs rounded-full">
                    {candidateTrips.length} โมเดลใน Scenario นี้
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">โมเดล</TableHead>
                      <TableHead className="text-xs text-center">ความถูกต้อง (FA)</TableHead>
                      <TableHead className="text-xs text-center">ตามข้อจำกัด (CC)</TableHead>
                      <TableHead className="text-xs text-center">ความเป็นไปได้ (PF)</TableHead>
                      <TableHead className="text-xs text-center">เชิงพื้นที่ (SR)</TableHead>
                      <TableHead className="text-xs text-center">ความหลากหลาย (DE)</TableHead>
                      <TableHead className="text-xs text-center">ความยืดหยุ่น (RU)</TableHead>
                      <TableHead className="text-xs text-center font-bold text-purple-600">คะแนนรวม (0-100%)</TableHead>
                      <TableHead className="text-xs text-right">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateTrips.map((candidate) => {
                      const scores = modelScoresMap[candidate.id];
                      const isEvaluated = isTripEvaluatedByUser(candidate.id);

                      return (
                        <TableRow key={candidate.id} className="text-xs">
                          <TableCell className="font-bold">
                            <div className="flex items-center gap-1.5">
                              <Award className="size-3.5 text-purple-600" />
                              <span>{candidate.blind_label}</span>
                              {role === "dev" && candidate.actual_model && (
                                <span className="text-[10px] text-muted-foreground font-mono font-normal">
                                  ({candidate.actual_model})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {scores?.fa_avg ? `${scores.fa_avg} / 5` : "-"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {scores?.cc_avg ? `${scores.cc_avg} / 5` : "-"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {scores?.pf_avg ? `${scores.pf_avg} / 5` : "-"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {scores?.sr_avg ? `${scores.sr_avg} / 5` : "-"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {scores?.de_avg ? `${scores.de_avg} / 5` : "-"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {scores?.ru_avg ? `${scores.ru_avg} / 5` : "-"}
                          </TableCell>
                          <TableCell className="text-center font-black text-purple-600">
                            {scores?.overall_percentage !== undefined ? `${scores.overall_percentage}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEvaluated ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] gap-1">
                                <CheckCircle2 className="size-2.5" /> บันทึกแล้ว
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePlanChange(candidate.id)}
                                className="h-6 text-[10px] text-purple-600 hover:underline p-0"
                              >
                                กดประเมินแผนนี้ →
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Part 3: Qualitative Feedback */}
            <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MessageSquareQuote className="size-4 text-purple-600" />
                  คำถามเชิงคุณภาพ (Qualitative Feedback)
                </CardTitle>
                <CardDescription className="text-xs">
                  คำตอบของท่านจะนำไปใช้วิเคราะห์เชิงลึกสำหรับงานวิทยานิพนธ์
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground leading-snug">
                    1. จากแผนทั้งหมดที่ท่านประเมิน แผนจากโมเดลใดที่ท่านจะนำไปใช้เดินทางจริงมากที่สุด? เพราะเหตุใด?
                  </Label>
                  <Textarea
                    value={qualitativeFeedback.q1_real_travel}
                    onChange={(e) => setQualitativeFeedback((prev) => ({ ...prev, q1_real_travel: e.target.value }))}
                    placeholder="เช่น เลือกแผน B เพราะจังหวะเวลาพอดี มีร้านอาหารท้องถิ่นน่าสนใจ..."
                    className="text-xs min-h-[70px] rounded-2xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground leading-snug">
                    2. โมเดลใดที่ทำได้ดีที่สุดในด้าน "ความเข้าใจบริบทการท่องเที่ยว"? (เช่น เข้าใจวัฒนธรรมท้องถิ่น, เข้าใจพฤติกรรมนักท่องเที่ยว, เข้าใจข้อจำกัดจริง)
                  </Label>
                  <Textarea
                    value={qualitativeFeedback.q2_tourism_context}
                    onChange={(e) => setQualitativeFeedback((prev) => ({ ...prev, q2_tourism_context: e.target.value }))}
                    placeholder="ระบุชื่อโมเดลและเหตุผล..."
                    className="text-xs min-h-[70px] rounded-2xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground leading-snug">
                    3. โมเดลใดที่ทำได้ดีที่สุดในด้าน "การให้ประสบการณ์ที่คุ้มค่า"? (เช่น ใช้งบได้คุ้มค่า, ได้เที่ยวที่ดีๆ คุ้มค่าเวลา)
                  </Label>
                  <Textarea
                    value={qualitativeFeedback.q3_value_experience}
                    onChange={(e) => setQualitativeFeedback((prev) => ({ ...prev, q3_value_experience: e.target.value }))}
                    placeholder="ระบุชื่อโมเดลและเหตุผล..."
                    className="text-xs min-h-[70px] rounded-2xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground leading-snug">
                    4. ข้อแตกต่างที่ชัดเจนที่สุดระหว่างโมเดลที่ท่านประเมินคืออะไร? (เช่น โมเดล A เน้นสถานที่ดัง, โมเดล B เน้นอาหาร, โมเดล C เน้นประหยัด)
                  </Label>
                  <Textarea
                    value={qualitativeFeedback.q4_distinct_differences}
                    onChange={(e) => setQualitativeFeedback((prev) => ({ ...prev, q4_distinct_differences: e.target.value }))}
                    placeholder="อธิบายข้อแตกต่างหลักของแต่ละโมเดล..."
                    className="text-xs min-h-[70px] rounded-2xl"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSubmitComparison}
                    disabled={submittingComparison}
                    className="w-full h-11 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md gap-2"
                  >
                    <Send className="size-4" />
                    <span>
                      {submittingComparison
                        ? "กำลังบันทึกผล..."
                        : "บันทึกคำถามเชิงคุณภาพ (ส่วนที่ 3)"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. RESULTS & ANALYTICS SECTION (Dev only)
  // -------------------------------------------------------------
  function renderResultsSection() {
    return (
      <div className="space-y-6">
        {/* Cloud Sync & Database Status Banner for Dev */}
        <Card className="rounded-3xl border border-purple-200/80 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-background dark:from-purple-950/30 dark:via-indigo-950/15 dark:to-background p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-purple-600/10 text-purple-600 flex items-center justify-center shrink-0">
                <Cloud className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">ระบบจัดเก็บฐานข้อมูล (Supabase Cloud Database)</h3>
                  {dbStatus && (
                    <Badge
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        dbStatus.provider === "supabase"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {dbStatus.provider === "supabase" ? "Online / Connected" : "Local Storage Mode"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dbStatus?.provider === "supabase"
                    ? `เชื่อมต่อตาราง blind_trips, blind_evaluations, blind_comparisons บน Supabase พร้อมรองรับผู้เชี่ยวชาญประเมินระยะไกล`
                    : `กำลังใช้ข้อมูลจาก Local Backend สามารถกดซิงก์เพื่อนำเข้าข้อมูลขึ้น Supabase Cloud สำหรับ Deploy ได้ทันที`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0 self-end sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={syncingCloud}
                onClick={handleSyncToCloud}
                className="h-9 px-4 rounded-full gap-2 text-xs font-semibold bg-background hover:bg-purple-50 hover:text-purple-700 border-purple-300 shadow-2xs"
              >
                <RefreshCw className={`size-3.5 ${syncingCloud ? "animate-spin text-purple-600" : ""}`} />
                <span>{syncingCloud ? "กำลังซิงก์ข้อมูลขึ้น Cloud..." : "ซิงก์ข้อมูล Local ขึ้น Supabase Cloud"}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsClearModalOpen(true)}
                className="h-9 px-3.5 rounded-full gap-2 text-xs font-semibold bg-background hover:bg-red-50 hover:text-red-700 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 shadow-2xs"
                title="ล้างข้อมูลคะแนนและคำถามเชิงคุณภาพที่ใช้ทดสอบ (เก็บแผนการเดินทาง Benchmark ไว้)"
              >
                <Trash2 className="size-3.5 text-red-500" />
                <span>ล้างข้อมูลประเมินทดสอบ</span>
              </Button>
            </div>
          </div>
        </Card>

        <EvaluationAnalytics
          resultsData={resultsData}
          trips={trips}
          revealModels={revealModels}
          setRevealModels={setRevealModels}
          onRefreshResults={loadResults}
          onOpenClearModal={() => setIsClearModalOpen(true)}
        />

        <ClearEvaluationsModal
          open={isClearModalOpen}
          onOpenChange={setIsClearModalOpen}
          resultsData={resultsData}
          onCleared={loadResults}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. USER & ROLE MANAGEMENT SECTION (Dev only)
  // -------------------------------------------------------------
  function renderUsersSection() {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-purple-600" />
              กำหนดสิทธิ์ผู้ใช้งานใหม่ (Assign User Role)
            </CardTitle>
            <CardDescription className="text-xs">
              กำหนดให้ผู้ใช้เป็น <strong>Expert</strong> เพื่อให้สามารถเข้าสู่ระบบประเมิน Blind Evaluation ได้ หรือ <strong>Dev</strong> เพื่อจัดการระบบ
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleAddUserRole} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">อีเมลผู้ใช้ (User Email)</Label>
                <Input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. expert@tourism.ac.th"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">กำหนดบทบาท (Role)</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expert">Expert (ผู้เชี่ยวชาญ)</SelectItem>
                    <SelectItem value="dev">Dev (ผู้ดูแลระบบ)</SelectItem>
                    <SelectItem value="user">User (ผู้ใช้ทั่วไป)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
              >
                บันทึกสิทธิ์
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Users Table */}
        <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
          <CardHeader className="py-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-purple-600" />
                รายชื่อผู้ใช้งานและบทบาทในระบบ ({userRolesList.length} บัญชี)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshUserRoles()}
                className="h-7 text-xs rounded-full"
              >
                รีเฟรชรายชื่อ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">อีเมล</TableHead>
                  <TableHead className="text-xs">ชื่อที่แสดง</TableHead>
                  <TableHead className="text-xs">บทบาทปัจจุบัน</TableHead>
                  <TableHead className="text-xs">อัปเดตล่าสุด</TableHead>
                  <TableHead className="text-xs text-right">ปรับเปลี่ยนบทบาท</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRolesList.map((u) => (
                  <TableRow key={u.email} className="text-xs">
                    <TableCell className="font-semibold text-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${u.role === "dev"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                            : u.role === "expert"
                              ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                              : "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">{u.updated_at || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={u.role}
                        onValueChange={async (newRole) => {
                          try {
                            await updateUserRole(u.email, newRole as UserRole, u.name);
                            toast.success(`เปลี่ยนสิทธิ์ ${u.email} เป็น ${newRole.toUpperCase()} เรียบร้อยแล้ว`);
                          } catch (err: any) {
                            toast.error(`ไม่สามารถเปลี่ยนสิทธิ์ได้: ${err.message || err}`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-[11px] rounded-lg w-[110px] ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dev">Dev</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }
}
