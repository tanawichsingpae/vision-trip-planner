/**
 * A safe wrapper for fetch that handles non-JSON responses and provides better error logging.
 */
export async function safeFetch<T>(url: string, options?: RequestInit, retries: number = 2): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        const errLower = errorText.toLowerCase();
        const isRateLimit =
          response.status === 429 ||
          errLower.includes("429") ||
          errLower.includes("rate-limited") ||
          errLower.includes("rate limit") ||
          errLower.includes("temporarily") ||
          errLower.includes("busy") ||
          errLower.includes("upstream");

        if (isRateLimit && attempt < retries) {
          const waitMs = (attempt + 1) * 2000;
          console.warn(`[safeFetch] Upstream rate limit on ${url} (status ${response.status}). Retrying in ${waitMs}ms... (attempt ${attempt + 1}/${retries})`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        console.error(`API request failed [${response.status}] for URL: ${url}`, errorText);
        let errorMessage = `API request failed with status ${response.status}`;
        try {
          const parsedError = JSON.parse(errorText);
          if (parsedError && parsedError.error) {
            errorMessage = typeof parsedError.error === "string" ? parsedError.error : JSON.stringify(parsedError.error);
          }
        } catch {
          if (errorText) {
            errorMessage += `: ${errorText.substring(0, 150)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        console.error(`API returned invalid JSON for URL: ${url}`, text.substring(0, 1000));
        throw new Error("Invalid API response format");
      }
    } catch (err: any) {
      lastError = err;
      const errStr = (err?.message || "").toLowerCase();
      const isRateLimit =
        errStr.includes("429") ||
        errStr.includes("rate-limited") ||
        errStr.includes("rate limit") ||
        errStr.includes("temporarily");
      if (isRateLimit && attempt < retries) {
        const waitMs = (attempt + 1) * 2000;
        console.warn(`[safeFetch] Retrying after error on ${url} in ${waitMs}ms... (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Request failed after retries");
}

/**
 * Validates that an API key is present, otherwise throws 
 */
export function validateApiKey(key?: string, providerName?: string) {
  if (providerName === "Geoapify" && (!key || key.trim() === "")) {
    console.warn("Geoapify API key is missing or empty. Geocoding will use OpenStreetMap fallback.");
  }
}

/**
 * Safely converts an image File into an optimized Base64 data URL.
 * Automatically downscales images exceeding maxWidth/maxHeight (default 1600px)
 * or exceeding 3MB to prevent Anthropic Claude and OpenRouter 5MB payload errors (HTTP 400).
 */
export async function fileToBase64Optimized(
  file: File,
  maxDimension: number = 1600,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image or already smaller than 2MB, direct read
    if (!file.type.startsWith("image/") || file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
