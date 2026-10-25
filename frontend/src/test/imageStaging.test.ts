import { describe, it, expect } from "vitest";
import { MAX_STAGED_PHOTOS } from "@/components/ImageUpload";

interface StagedPhotoMock {
  id: string;
  name: string;
  size: number;
}

function stagePhotos(
  current: StagedPhotoMock[],
  incoming: Array<{ name: string; size: number; type: string }>,
  maxCapacity: number = MAX_STAGED_PHOTOS
): { updated: StagedPhotoMock[]; addedCount: number; duplicatesCount: number; overflowCount: number } {
  const validImages = incoming.filter((f) => f.type.startsWith("image/"));
  const nonDuplicates = validImages.filter(
    (item) => !current.some((c) => c.name === item.name && c.size === item.size)
  );
  const duplicatesCount = validImages.length - nonDuplicates.length;

  const remaining = Math.max(0, maxCapacity - current.length);
  const toAdd = nonDuplicates.slice(0, remaining);
  const overflowCount = nonDuplicates.length - toAdd.length;

  const newItems: StagedPhotoMock[] = toAdd.map((item) => ({
    id: `${item.name}-${item.size}-${Date.now()}`,
    name: item.name,
    size: item.size,
  }));

  return {
    updated: [...current, ...newItems],
    addedCount: newItems.length,
    duplicatesCount,
    overflowCount,
  };
}

describe("Image Staging Queue Logic (Multi-Batch Drop & Pre-Upload)", () => {
  it("should stage images from first batch correctly", () => {
    const batch1 = [
      { name: "photo1.jpg", size: 1024, type: "image/jpeg" },
      { name: "photo2.png", size: 2048, type: "image/png" },
    ];
    const res = stagePhotos([], batch1);
    expect(res.addedCount).toBe(2);
    expect(res.updated.length).toBe(2);
    expect(res.duplicatesCount).toBe(0);
    expect(res.updated[0].name).toBe("photo1.jpg");
    expect(res.updated[1].name).toBe("photo2.png");
  });

  it("should support adding multiple batches from different folders without replacing previous ones", () => {
    const batch1 = [
      { name: "folderA_beach.jpg", size: 1024, type: "image/jpeg" },
    ];
    const res1 = stagePhotos([], batch1);
    expect(res1.updated.length).toBe(1);

    // Second batch from Folder B
    const batch2 = [
      { name: "folderB_temple.jpg", size: 3048, type: "image/jpeg" },
      { name: "folderB_street.png", size: 4096, type: "image/png" },
    ];
    const res2 = stagePhotos(res1.updated, batch2);
    expect(res2.addedCount).toBe(2);
    expect(res2.updated.length).toBe(3);
    expect(res2.updated.map((p) => p.name)).toEqual([
      "folderA_beach.jpg",
      "folderB_temple.jpg",
      "folderB_street.png",
    ]);
  });

  it("should ignore duplicates if the same photo is dropped again", () => {
    const existing: StagedPhotoMock[] = [
      { id: "1", name: "wat_arun.jpg", size: 5000 },
    ];
    const incoming = [
      { name: "wat_arun.jpg", size: 5000, type: "image/jpeg" }, // Duplicate
      { name: "grand_palace.jpg", size: 6000, type: "image/jpeg" }, // New
    ];
    const res = stagePhotos(existing, incoming);
    expect(res.duplicatesCount).toBe(1);
    expect(res.addedCount).toBe(1);
    expect(res.updated.length).toBe(2);
    expect(res.updated[1].name).toBe("grand_palace.jpg");
  });

  it("should enforce maximum capacity limit (20 photos)", () => {
    expect(MAX_STAGED_PHOTOS).toBe(20);
    const existing: StagedPhotoMock[] = Array.from({ length: 18 }, (_, i) => ({
      id: `${i}`,
      name: `pic_${i}.jpg`,
      size: 1000 + i,
    }));

    const incoming = [
      { name: "new_1.jpg", size: 2001, type: "image/jpeg" },
      { name: "new_2.jpg", size: 2002, type: "image/jpeg" },
      { name: "new_3.jpg", size: 2003, type: "image/jpeg" }, // Should overflow
      { name: "new_4.jpg", size: 2004, type: "image/jpeg" }, // Should overflow
    ];

    const res = stagePhotos(existing, incoming, MAX_STAGED_PHOTOS);
    expect(res.addedCount).toBe(2);
    expect(res.overflowCount).toBe(2);
    expect(res.updated.length).toBe(20);
  });

  it("should filter out non-image files", () => {
    const incoming = [
      { name: "notes.txt", size: 500, type: "text/plain" },
      { name: "photo.jpg", size: 2000, type: "image/jpeg" },
    ];
    const res = stagePhotos([], incoming);
    expect(res.addedCount).toBe(1);
    expect(res.updated[0].name).toBe("photo.jpg");
  });
});
