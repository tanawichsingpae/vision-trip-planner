export type VPRTier = "tier1_iconic" | "tier2_longtail" | "tier3_nature" | "tier4_ugc";

export interface TierConfig {
  id: VPRTier;
  icon: string;
  shortLabel: string;
  label: string;
  labelEn: string;
  shortName: string;
  badge: string;
  badgeClass: string;
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
    icon: "🏛️",
    shortLabel: "Tier 1",
    label: "Tier 1: Famous Landmarks",
    labelEn: "Tier 1: Famous Landmarks",
    shortName: "Tier 1",
    badge: "Tier 1",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    color: "#2563eb",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
    description: "Famous landmarks with distinctive architecture",
    thesisNotes: "Head distribution baseline. Expected accuracy > 90%.",
    detectionKeywords: ["t1", "tier1", "iconic", "landmark", "famous", "architecture"],
  },
  tier2_longtail: {
    id: "tier2_longtail",
    icon: "🏮",
    shortLabel: "Tier 2",
    label: "Tier 2: Local Heritage & Markets",
    labelEn: "Tier 2: Local Heritage & Markets",
    shortName: "Tier 2",
    badge: "Tier 2",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    borderColor: "#ddd6fe",
    description: "Lesser-known local heritage, cultural districts, markets",
    thesisNotes: "Fine-grained visual recognition & database coverage test.",
    detectionKeywords: ["t2", "tier2", "longtail", "tail", "cultural", "local", "market", "cafe", "heritage"],
  },
  tier3_nature: {
    id: "tier3_nature",
    icon: "🏞️",
    shortLabel: "Tier 3",
    label: "Tier 3: Nature & Waterfalls",
    labelEn: "Tier 3: Nature & Waterfalls",
    shortName: "Tier 3",
    badge: "Tier 3",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    color: "#059669",
    bgColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    description: "Mountains, beaches, islands, and waterfalls",
    thesisNotes: "Spatial & environmental reasoning. Highlights geometric failure modes.",
    detectionKeywords: ["t3", "tier3", "nature", "mountain", "beach", "island", "waterfall", "park", "sea", "doy"],
  },
  tier4_ugc: {
    id: "tier4_ugc",
    icon: "📱",
    shortLabel: "Tier 4",
    label: "Tier 4: Casual UGC / Social",
    labelEn: "Tier 4: Casual UGC / Social",
    shortName: "Tier 4",
    badge: "Tier 4",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
    description: "Casual user-generated photos from IG, TikTok",
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
  label: `${TIER_CONFIGS[tier].shortLabel} (${TIER_CONFIGS[tier].description})`,
  shortLabel: TIER_CONFIGS[tier].shortLabel,
  shortName: TIER_CONFIGS[tier].shortName,
  icon: TIER_CONFIGS[tier].icon,
  badge: TIER_CONFIGS[tier].badge,
  badgeClass: TIER_CONFIGS[tier].badgeClass,
  color: TIER_CONFIGS[tier].color,
  description: TIER_CONFIGS[tier].description,
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

  // 1. Direct explicit prefix patterns (e.g. "tier 1", "tier-1", "t1", "[Tier 1]", "tier1")
  if (/^(\[?(t1|tier[\s-_]*1)\]?[-_\s])/i.test(lower)) return "tier1_iconic";
  if (/^(\[?(t2|tier[\s-_]*2)\]?[-_\s])/i.test(lower)) return "tier2_longtail";
  if (/^(\[?(t3|tier[\s-_]*3)\]?[-_\s])/i.test(lower)) return "tier3_nature";
  if (/^(\[?(t4|tier[\s-_]*4)\]?[-_\s])/i.test(lower)) return "tier4_ugc";

  // 2. Keyword scanning in filename
  for (const [tierKey, config] of Object.entries(TIER_CONFIGS)) {
    for (const kw of config.detectionKeywords) {
      const regex = new RegExp(`(^|[-_\\s.])${kw}([-_\\s.]|$)`, "i");
      if (regex.test(lower)) {
        return tierKey as VPRTier;
      }
    }
  }

  // Default fallback for unannotated images: Tier 1
  return "tier1_iconic";
}

/**
 * Normalizes any string representation (e.g. "Tier 1", "tier 2", "tier1_iconic", "T3", "Tier 4: Casual UGC") to a valid VPRTier.
 */
export function normalizeTier(rawTier?: string | null): VPRTier {
  if (!rawTier) return "tier1_iconic";
  const cleaned = rawTier.trim().toLowerCase();
  const normalized = cleaned.replace(/[\s-_]/g, "");

  // Tier 1 checks
  if (
    normalized.includes("tier1") ||
    normalized.includes("t1") ||
    cleaned.includes("iconic") ||
    cleaned.includes("landmark") ||
    cleaned.includes("architecture") ||
    cleaned.includes("famous")
  ) {
    return "tier1_iconic";
  }

  // Tier 2 checks
  if (
    normalized.includes("tier2") ||
    normalized.includes("t2") ||
    cleaned.includes("longtail") ||
    cleaned.includes("tail") ||
    cleaned.includes("heritage") ||
    cleaned.includes("market") ||
    cleaned.includes("cultural")
  ) {
    return "tier2_longtail";
  }

  // Tier 3 checks
  if (
    normalized.includes("tier3") ||
    normalized.includes("t3") ||
    cleaned.includes("nature") ||
    cleaned.includes("mountain") ||
    cleaned.includes("beach") ||
    cleaned.includes("island") ||
    cleaned.includes("waterfall")
  ) {
    return "tier3_nature";
  }

  // Tier 4 checks
  if (
    normalized.includes("tier4") ||
    normalized.includes("t4") ||
    cleaned.includes("ugc") ||
    cleaned.includes("social") ||
    cleaned.includes("tiktok") ||
    cleaned.includes("selfie") ||
    cleaned.includes("casual")
  ) {
    return "tier4_ugc";
  }

  return "tier1_iconic";
}
