/**
 * serperClient.ts
 *
 * High-precision Google Image Search integration via Serper.dev API
 * Features:
 * - L1 In-Memory Cache (0ms instant access)
 * - L2 Persistent localStorage Cache (Zero-quota repeat visits)
 * - Multi-lingual Key Aliasing (Thai, English, CJK share the same resolved photo)
 * - Dual-URL Resilience (Original image URL with Google CDN Thumbnail fallback)
 */

const SERPER_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SERPER_API_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_SERPER_API_KEY) ||
  "";

// In-Memory L1 Cache
const memoryImageCache = new Map<string, string>();

// LocalStorage prefix for L2 Cache
const CACHE_PREFIX = "img_cache:";

/**
 * Normalizes a place query into a clean, canonical cache key.
 */
export function normalizeImageQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  let q = rawQuery.toLowerCase().trim();

  // Strip action verbs and meal prefixes
  q = q.replace(/^(explore|visit|see|tour|check in|check out|breakfast at|lunch at|dinner at|stay at|eat at)\s+/i, "");
  q = q.replace(/^(เที่ยว|ชม|แวะ|ทานอาหารที่|กินข้าวที่|มื้อค่ำที่|มื้อกลางวันที|ร้าน)\s*/i, "");
  q = q.replace(/\s*[-–—|]\s*(day\s*\d+|morning|afternoon|evening|night).*$/i, "");
  q = q.replace(/^(&\s*)+/, "");
  q = q.replace(/(?:^|\b)(?:&|\+)\s*street food\b/gi, "street food");

  // Remove extra spaces and special characters for stable hashing
  return q.replace(/[\(\)\[\]\{\}]/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Retrieves a cached image URL for a given place query (L1 memory -> L2 localStorage).
 */
export function getPlaceImageFromCache(query: string): string | null {
  const key = normalizeImageQuery(query);
  if (!key) return null;

  // L1: In-memory map
  if (memoryImageCache.has(key)) {
    return memoryImageCache.get(key)!;
  }

  // L2: localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (stored && stored.startsWith("http")) {
        memoryImageCache.set(key, stored);
        return stored;
      }
    } catch {}
  }

  return null;
}

/**
 * Stores an image URL in both L1 (Memory) and L2 (LocalStorage),
 * automatically mirroring it to all provided multilingual aliases.
 */
export function setPlaceImageInCache(query: string, imageUrl: string, aliases: string[] = []): void {
  if (!imageUrl || !imageUrl.startsWith("http")) return;

  const allKeys = [query, ...aliases]
    .map(normalizeImageQuery)
    .filter((k) => k && k.length > 1);

  const uniqueKeys = Array.from(new Set(allKeys));

  for (const k of uniqueKeys) {
    memoryImageCache.set(k, imageUrl);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${CACHE_PREFIX}${k}`, imageUrl);
      } catch (e) {
        // localStorage full safe-guard
        console.warn("[serperClient] LocalStorage quota reached while caching image:", e);
        break;
      }
    }
  }
}

export interface SerperImageItem {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source?: string;
  domain?: string;
  link?: string;
}

export interface SerperSearchOptions {
  cityName?: string;
  num?: number;
  gl?: string; // Country code (e.g. "th", "jp", "us")
  hl?: string; // Language (e.g. "th", "en")
  aliases?: string[];
}

/**
 * Checks whether the Serper.dev API key is configured.
 */
export function isSerperConfigured(): boolean {
  return typeof SERPER_API_KEY === "string" && SERPER_API_KEY.trim().length > 5;
}

/**
 * Searches Google Images via Serper.dev API.
 * Returns an array of authentic, verified web images.
 */
export async function searchGoogleImagesViaSerper(
  query: string,
  options?: SerperSearchOptions
): Promise<SerperImageItem[]> {
  if (!query || !query.trim()) return [];

  // Check cache first
  const cached = getPlaceImageFromCache(query);
  if (cached) {
    return [
      {
        title: query,
        imageUrl: cached,
        thumbnailUrl: cached,
        source: "cache",
      },
    ];
  }

  if (!isSerperConfigured()) {
    return [];
  }

  const cleanQ = normalizeImageQuery(query);
  const city = options?.cityName?.trim() || "";
  const searchTarget = city && !cleanQ.toLowerCase().includes(city.toLowerCase())
    ? `${cleanQ} ${city}`
    : cleanQ;

  // Use Vite proxy in browser development or direct endpoint
  const isRealBrowser = typeof window !== "undefined" && Boolean(window.location?.protocol?.startsWith("http")) && !(typeof process !== "undefined" && process.env?.VITEST);
  const endpoint = isRealBrowser && window.location.hostname === "localhost"
    ? "/serper-api/images"
    : "https://google.serper.dev/images";

  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: searchTarget,
        num: options?.num || 5,
        gl: options?.gl || "th",
        hl: options?.hl || "th",
      }),
    };

    // Attach signal safely in browser environment (bypassing jsdom/undici mismatch in tests)
    const isTest = typeof process !== "undefined" && Boolean(process.env?.VITEST || process.env?.NODE_ENV === "test");
    if (controller && !isTest) {
      try {
        fetchOptions.signal = controller.signal;
      } catch {}
    }

    const res = await fetch(endpoint, fetchOptions);
    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        console.warn("[serperClient] Invalid or exhausted Serper API key.");
      }
      return [];
    }

    const data = await res.json();
    const rawImages = Array.isArray(data?.images) ? data.images : [];

    const items: SerperImageItem[] = [];

    for (const img of rawImages) {
      const imgUrl = (img.imageUrl || "").trim();
      const thumbUrl = (img.thumbnailUrl || imgUrl).trim();
      if (imgUrl.startsWith("http")) {
        items.push({
          title: img.title || query,
          imageUrl: imgUrl,
          thumbnailUrl: thumbUrl,
          source: img.source || img.domain || "Google Images",
          domain: img.domain,
          link: img.link,
        });
      }
    }

    // Auto-cache the top result with all multilingual aliases
    if (items.length > 0) {
      const topUrl = items[0].imageUrl;
      setPlaceImageInCache(query, topUrl, options?.aliases || []);
    }

    return items;
  } catch (err) {
    console.warn("[serperClient] Failed to search Google Images via Serper:", err);
    return [];
  }
}

/**
 * Fetches the single best Google Image URL for a place via Serper.dev.
 * Automatically checks L1/L2 cache first and records aliases on resolution.
 */
export async function fetchTopGoogleImage(
  placeName: string,
  cityName?: string,
  aliases?: string[]
): Promise<string | null> {
  const cached = getPlaceImageFromCache(placeName);
  if (cached) return cached;

  // Check aliases in cache
  if (aliases && aliases.length > 0) {
    for (const a of aliases) {
      const aCached = getPlaceImageFromCache(a);
      if (aCached) return aCached;
    }
  }

  if (!isSerperConfigured()) return null;

  const results = await searchGoogleImagesViaSerper(placeName, {
    cityName,
    num: 3,
    aliases,
  });

  return results[0]?.imageUrl || results[0]?.thumbnailUrl || null;
}
