import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface ExportToPdfOptions {
  filename?: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Inlines all cross-origin images as base64 Data URLs before html2canvas runs.
 * If any image fails CORS or is blocked by redirects (e.g. Wikimedia Special:FilePath),
 * it is resolved to direct thumb URL or safely replaced with the category fallback,
 * ensuring html2canvas NEVER fails on CORS or aborts PDF export.
 */
async function sanitizeAndInlineImages(doc: Document): Promise<void> {
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(
    images.map(async (img) => {
      let src = img.src || img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;

      // 1. Rewrite Wikimedia Special:FilePath to direct CORS-enabled thumb URL
      if (src.includes("commons.wikimedia.org/wiki/Special:FilePath/")) {
        try {
          const match = src.match(/Special:FilePath\/([^?#]+)/);
          if (match && match[1]) {
            const rawFileName = decodeURIComponent(match[1]);
            const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(
              rawFileName
            )}&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json&origin=*`;
            const apiRes = await fetch(infoUrl, {
              headers: { "User-Agent": "PixineraryTravelApp/2.0" },
            });
            if (apiRes.ok) {
              const apiData = await apiRes.json();
              const pageObj = Object.values(apiData?.query?.pages || {})[0] as any;
              const directThumb =
                pageObj?.imageinfo?.[0]?.thumburl || pageObj?.imageinfo?.[0]?.url;
              if (directThumb && typeof directThumb === "string") {
                src = directThumb;
                img.src = directThumb;
              }
            }
          }
        } catch {
          // ignore rewrite error and proceed
        }
      }

      // 2. Try fetching and inlining as Base64 data URL
      try {
        const response = await fetch(src, { mode: "cors" });
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
          return;
        }
      } catch {
        // Fetch failed due to CORS or network error
      }

      // 3. Fallback: If image cannot be converted due to CORS or fails to load,
      // hide the broken image element and show the fallback category icon so html2canvas doesn't fail
      try {
        img.style.display = "none";
        const sibling = img.nextElementSibling as HTMLElement | null;
        if (sibling && sibling.classList.contains("hidden")) {
          sibling.style.display = "flex";
        }
      } catch {
        // ignore
      }
    })
  );
}

/**
 * Automatically converts an exported HTML itinerary string into a high-quality multi-page PDF document.
 * This runs completely client-side in the background without requiring user manual print actions,
 * ensuring seamless PDF downloads across iOS (iPhone/iPad), Android, and desktop browsers.
 */
export async function exportItineraryToPdf(
  htmlContent: string,
  options: ExportToPdfOptions = {}
): Promise<void> {
  const { filename = "itinerary.pdf", onProgress } = options;

  // 1. Create a hidden rendering iframe in the DOM
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "0";
  iframe.style.top = "0";
  iframe.style.width = "1024px";
  iframe.style.height = "1200px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  try {
    // 2. Load the HTML content into the iframe
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const onDone = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      iframe.onload = onDone;
      iframe.onerror = (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      };

      iframe.srcdoc = htmlContent;
      // Fallback timeout in case onload is slow or delayed
      setTimeout(onDone, 3000);
    });

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Unable to access iframe content document");
    }

    // 3. Inject print/PDF styling overrides into iframe to ensure clean A4 page cuts
    const pdfStyle = iframeDoc.createElement("style");
    pdfStyle.textContent = `
      header, .leaflet-control-container, #preview-controls, [data-hide-print] {
        display: none !important;
      }
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .document-stack {
        width: 794px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        display: block !important;
      }
      .document-stack > * + * {
        margin-top: 0 !important;
      }
      .a4-page {
        width: 794px !important;
        height: 1123px !important;
        min-height: 1123px !important;
        max-height: 1123px !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 42px 46px 34px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .a4-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    `;
    iframeDoc.head.appendChild(pdfStyle);

    // 4. Ensure fonts are loaded
    if (iframeDoc.fonts && iframeDoc.fonts.ready) {
      try {
        await iframeDoc.fonts.ready;
      } catch {
        // Continue even if font loading observer fails
      }
    }

    // 5. Sanitize and inline all images to base64 Data URLs (completely eliminates CORS failures)
    await sanitizeAndInlineImages(iframeDoc);

    // Brief stabilization pause for Leaflet markers and polyline rendering
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 6. Find all .a4-page elements
    const pageElements = Array.from(
      iframeDoc.querySelectorAll<HTMLElement>(".a4-page")
    );

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    if (pageElements.length > 0) {
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        if (onProgress) {
          onProgress(i + 1, pageElements.length);
        }

        let canvas: HTMLCanvasElement;
        try {
          canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: "#ffffff",
            windowWidth: 1024,
            imageTimeout: 5000,
          });
        } catch (pageErr) {
          console.warn(`[exportItineraryToPdf] Page ${i + 1} html2canvas retry without CORS:`, pageErr);
          canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: false,
            logging: false,
            allowTaint: true,
            backgroundColor: "#ffffff",
            windowWidth: 1024,
            imageTimeout: 5000,
          });
        }

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
    } else {
      // Fallback: capture document-stack or body if no .a4-page elements found
      const fallbackTarget =
        iframeDoc.getElementById("document-stack") || iframeDoc.body;
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(fallbackTarget, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: "#ffffff",
          windowWidth: 1024,
          imageTimeout: 5000,
        });
      } catch {
        canvas = await html2canvas(fallbackTarget, {
          scale: 2,
          useCORS: false,
          logging: false,
          allowTaint: true,
          backgroundColor: "#ffffff",
          windowWidth: 1024,
          imageTimeout: 5000,
        });
      }
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    // 7. Trigger file download via Blob (100% compatible with iOS and Android)
    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  } finally {
    // 8. Always cleanup the iframe
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
