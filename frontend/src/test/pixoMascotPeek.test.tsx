import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PixoMascotPeek } from "../components/PixoMascotPeek";

describe("PixoMascotPeek Component", () => {
  it("renders trigger avatar with correct mascot asset", () => {
    render(<PixoMascotPeek pose="warning" alt="Pixo Warning" />);
    const img = screen.getByAltText("Pixo Warning");
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("/pixo_carton/pixo_warning_temple.jpg");
  });

  it("opens peek card with high-res mascot and speech bubble on click", async () => {
    render(
      <PixoMascotPeek
        pose="rainy"
        speechBubble="ฝนตกพกร่มด้วยนะ!"
        headline="Pixo Rain Alert"
        language="th"
      />
    );

    const trigger = screen.getByTitle("กดค้างเพื่อซูมดูรูป Pixo แบบ HD ✨");
    expect(trigger).toBeDefined();

    // Click trigger to toggle
    await act(async () => {
      fireEvent.click(trigger);
    });

    // Check modal content is rendered in Portal
    expect(screen.getByText("Pixo Rain Alert")).toBeDefined();
    expect(screen.getByText(/ฝนตกพกร่มด้วยนะ/)).toBeDefined();
    expect(screen.getByText("ลุยฝน")).toBeDefined();
  });

  it("triggers hold-to-zoom after 220ms pointerdown", async () => {
    vi.useFakeTimers();

    render(
      <PixoMascotPeek
        pose="foodie"
        speechBubble="สายกินห้ามพลาด!"
        language="th"
      />
    );

    const trigger = screen.getByTitle("กดค้างเพื่อซูมดูรูป Pixo แบบ HD ✨");

    // Pointer down
    act(() => {
      fireEvent.pointerDown(trigger, { button: 0 });
    });

    // Before 220ms, it should not be open yet
    expect(screen.queryByText(/สายกินห้ามพลาด/)).toBeNull();

    // Fast-forward 230ms
    act(() => {
      vi.advanceTimersByTime(230);
    });

    // Now it should be open
    expect(screen.getByText(/สายกินห้ามพลาด/)).toBeDefined();

    vi.useRealTimers();
  });
});
