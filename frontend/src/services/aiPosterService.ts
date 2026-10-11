import JSZip from "jszip";
import { TripPosterChunk } from "@/lib/export/aiPosterPrompt";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";

export interface GeneratedPosterImage {
  imageUrl: string;
  partIndex: number;
  totalParts: number;
  dayRangeLabel: string;
  prompt: string;
}

export interface PosterGenerationResult {
  success: boolean;
  images: GeneratedPosterImage[];
  error?: string;
  errorCode?: number;
}

/**
 * Calls backend /ai/generate-image to synthesize travel poster images with google/gemini-3-pro-image
 */
export async function generateTripPosterImages(
  chunks: TripPosterChunk[],
  options?: {
    model?: string;
    onProgress?: (current: number, total: number, message: string) => void;
    language?: "th" | "en";
  }
): Promise<PosterGenerationResult> {
  const model = options?.model || "google/gemini-3-pro-image";
  const language = options?.language || "th";
  const isThai = language === "th";
  const total = chunks.length;
  const results: GeneratedPosterImage[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const current = i + 1;

    options?.onProgress?.(
      current,
      total,
      isThai
        ? `กำลังสร้างโปสเตอร์ส่วนที่ ${current}/${total} ด้วย Gemini 3 Pro...`
        : `Generating poster part ${current}/${total} with Gemini 3 Pro...`
    );

    try {
      const res = await fetch(`${BACKEND_URL}/ai/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: chunk.prompt,
          aspect_ratio: chunk.aspectRatio || "16:9",
          resolution: "2K",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success || !data.images?.length) {
        let errMsg = data.error || `HTTP ${res.status}`;
        if (res.status === 402 || data.error?.includes("Insufficient credits")) {
          errMsg = isThai
            ? "เครดิตในบัญชี OpenRouter ไม่เพียงพอสำหรับโมเดลสร้างรูป กรุณาเติมเครดิตที่ openrouter.ai/settings/credits"
            : "Insufficient OpenRouter credits for image generation. Please add credits at openrouter.ai/settings/credits";
        }

        return {
          success: false,
          images: results,
          error: errMsg,
          errorCode: res.status,
        };
      }

      const imageUrl = data.images[0];
      results.push({
        imageUrl,
        partIndex: chunk.partIndex,
        totalParts: chunk.totalParts,
        dayRangeLabel: chunk.dayRangeLabel,
        prompt: chunk.prompt,
      });
    } catch (err: any) {
      console.error("[aiPosterService] Generation error:", err);
      return {
        success: false,
        images: results,
        error: err?.message || (isThai ? "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" : "Server connection error"),
      };
    }
  }

  return {
    success: true,
    images: results,
  };
}

/**
 * Downloads a single poster image file to the user's device
 */
export async function downloadPosterImage(imageUrl: string, filename: string) {
  try {
    const link = document.createElement("a");
    if (imageUrl.startsWith("data:")) {
      link.href = imageUrl;
    } else {
      // Fetch as blob to bypass cross-origin browser save issues
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      link.href = URL.createObjectURL(blob);
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.warn("Direct blob download failed, falling back to window open:", err);
    window.open(imageUrl, "_blank");
  }
}

/**
 * Bundles all generated images into a single ZIP archive and triggers download
 */
export async function downloadAllPosterImagesAsZip(
  images: GeneratedPosterImage[],
  baseFilename: string
) {
  const zip = new JSZip();
  const folder = zip.folder("pixinerary_posters") || zip;

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const fileName = `${baseFilename}_part${item.partIndex}.png`;

    if (item.imageUrl.startsWith("data:image/")) {
      const base64Data = item.imageUrl.split(",")[1];
      folder.file(fileName, base64Data, { base64: true });
    } else {
      try {
        const resp = await fetch(item.imageUrl);
        const arrayBuf = await resp.arrayBuffer();
        folder.file(fileName, arrayBuf);
      } catch (err) {
        console.error(`Failed to fetch image for ZIP: ${item.imageUrl}`, err);
      }
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = zipUrl;
  link.download = `${baseFilename}_posters.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(zipUrl);
}
