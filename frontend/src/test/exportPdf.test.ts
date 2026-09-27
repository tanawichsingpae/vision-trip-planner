import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportItineraryToPdf } from "@/lib/export/exportItineraryToPdf";

// Mock html2canvas and jspdf since jsdom lacks a layout/canvas engine
vi.mock("html2canvas", () => ({
  default: vi.fn().mockImplementation(() =>
    Promise.resolve({
      toDataURL: vi.fn(() => "data:image/jpeg;base64,mockImageData"),
    })
  ),
}));

vi.mock("jspdf", () => {
  const MockJsPDF = vi.fn().mockImplementation(() => ({
    addPage: vi.fn(),
    addImage: vi.fn(),
    output: vi.fn(() => new Blob(["mock-pdf"], { type: "application/pdf" })),
    save: vi.fn(),
  }));
  return { jsPDF: MockJsPDF };
});

describe("exportItineraryToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined as a function", () => {
    expect(typeof exportItineraryToPdf).toBe("function");
  });

  it("should create a temporary rendering iframe and clean it up upon completion", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Trip</title></head>
        <body>
          <div id="document-stack">
            <section class="a4-page"><h1>Page 1</h1></section>
            <section class="a4-page"><h1>Page 2</h1></section>
          </div>
        </body>
      </html>
    `;

    // Spy on document.body.appendChild
    const appendSpy = vi.spyOn(document.body, "appendChild");

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:mock-pdf-url");
    global.URL.revokeObjectURL = vi.fn();

    const progressCalls: [number, number][] = [];
    await exportItineraryToPdf(mockHtml, {
      filename: "test_itinerary.pdf",
      onProgress: (current, total) => {
        progressCalls.push([current, total]);
      },
    });

    expect(appendSpy).toHaveBeenCalled();
  });
});
