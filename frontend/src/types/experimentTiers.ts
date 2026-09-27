export type VPRTier = "tier1_iconic" | "tier2_longtail" | "tier3_nature" | "tier4_ugc";

export interface TierConfig {
  id: VPRTier;
  labelEn: string;
  shortName: string;
  badge: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  thesisNotes: string;
  detectionKeywords: string[];
}

export const TIER_CONFIGS: Record<VPRTier, TierConfig> = {
  tier1_iconic: {
    id: "tier1_iconic",
    labelEn: "Tier 1: Iconic Landmarks",
    shortName: "T1: Iconic",
    badge: "Head / Iconic",
    color: "#2563eb",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
    description: "Famous landmarks with distinctive architectural geometry and high representation in pre-training data.",
    thesisNotes: "Head distribution baseline. Expected accuracy > 90%.",
    detectionKeywords: ["t1", "tier1", "iconic", "landmark", "famous"],
  },
  tier2_longtail: {
    id: "tier2_longtail",
    labelEn: "Tier 2: Long-Tail Attractions",
    shortName: "T2: Long-Tail",
    badge: "Tail / Cultural",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    borderColor: "#ddd6fe",
    description: "Lesser-known local heritage, cultural districts, markets, and regional temples with limited web photos.",
    thesisNotes: "Fine-grained visual recognition & database coverage test.",
    detectionKeywords: ["t2", "tier2", "longtail", "tail", "cultural", "local", "market", "cafe"],
  },
  tier3_nature: {
    id: "tier3_nature",
    labelEn: "Tier 3: Natural Landscapes",
    shortName: "T3: Nature",
    badge: "A-geometric Nature",
    color: "#059669",
    bgColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    description: "Mountains, beaches, islands, and waterfalls lacking man-made geometry; relies on terrain and natural textures.",
    thesisNotes: "Spatial & environmental reasoning. Highlights geometric failure modes.",
    detectionKeywords: ["t3", "tier3", "nature", "mountain", "beach", "island", "waterfall", "park", "sea", "doy"],
  },
  tier4_ugc: {
    id: "tier4_ugc",
    labelEn: "Tier 4: In-The-Wild UGC",
    shortName: "T4: UGC / Social",
    badge: "Social / UGC",
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
    description: "Casual user-generated photos from IG, TikTok, or smartphones with occlusions (selfies, food), vertical aspect, or color filters.",
    thesisNotes: "Real-world domain shift & robustness under authentic user photography.",
    detectionKeywords: ["t4", "tier4", "ugc", "social", "ig", "tiktok", "selfie", "wild", "phone"],
  },
};

export const TIER_ORDER: VPRTier[] = [
  "tier1_iconic",
  "tier2_longtail",
  "tier3_nature",
  "tier4_ugc",
];

export const TIER_OPTIONS = TIER_ORDER.map((tier) => ({
  value: tier,
  label: TIER_CONFIGS[tier].labelEn,
  shortName: TIER_CONFIGS[tier].shortName,
  badge: TIER_CONFIGS[tier].badge,
  color: TIER_CONFIGS[tier].color,
}));

/**
 * Automatically detects the benchmark tier from a filename or text prompt.
 * Examples:
 *  "t1_watarun.jpg" -> "tier1_iconic"
 *  "[Tier 3] doi inthanon.png" -> "tier3_nature"
 *  "ig_story_cafe.webp" -> "tier4_ugc"
 */
export function detectTierFromFilename(filename: string): VPRTier {
  if (!filename) return "tier1_iconic";
  const lower = filename.toLowerCase();

  // 1. Direct explicit prefix patterns
  if (/^(\[?(t1|tier1|tier-1|tier_1)\]?[-_\s])/i.test(lower)) return "tier1_iconic";
  if (/^(\[?(t2|tier2|tier-2|tier_2)\]?[-_\s])/i.test(lower)) return "tier2_longtail";
  if (/^(\[?(t3|tier3|tier-3|tier_3)\]?[-_\s])/i.test(lower)) return "tier3_nature";
  if (/^(\[?(t4|tier4|tier-4|tier_4)\]?[-_\s])/i.test(lower)) return "tier4_ugc";

  // 2. Keyword scanning in filename
  for (const [tierKey, config] of Object.entries(TIER_CONFIGS)) {
    for (const kw of config.detectionKeywords) {
      const regex = new RegExp(`(^|[-_\\s.])${kw}([-_\\s.]|$)`, "i");
      if (regex.test(lower)) {
        return tierKey as VPRTier;
      }
    }
  }

  // Default fallback for unannotated images: Tier 1 (Iconic)
  return "tier1_iconic";
}

/**
 * Normalizes any string representation to a valid VPRTier.
 */
export function normalizeTier(rawTier?: string | null): VPRTier {
  if (!rawTier) return "tier1_iconic";
  const cleaned = rawTier.trim().toLowerCase();

  if (cleaned.includes("tier1") || cleaned.includes("t1") || cleaned.includes("iconic")) {
    return "tier1_iconic";
  }
  if (cleaned.includes("tier2") || cleaned.includes("t2") || cleaned.includes("longtail") || cleaned.includes("tail")) {
    return "tier2_longtail";
  }
  if (cleaned.includes("tier3") || cleaned.includes("t3") || cleaned.includes("nature") || cleaned.includes("mountain")) {
    return "tier3_nature";
  }
  if (cleaned.includes("tier4") || cleaned.includes("t4") || cleaned.includes("ugc") || cleaned.includes("social")) {
    return "tier4_ugc";
  }

  return "tier1_iconic";
}
