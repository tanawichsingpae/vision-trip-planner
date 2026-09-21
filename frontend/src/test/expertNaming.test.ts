import { describe, it, expect, beforeEach } from "vitest";
import { getExpertDefaultName, resolveEvaluatorName } from "@/api/blindEvalApi";

describe("Expert Naming and Sequential Default", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should assign sequential Expert names for different emails", () => {
    const exp1 = getExpertDefaultName("expert@tourism.ac.th");
    expect(exp1).toBe("Expert 1");

    const exp2 = getExpertDefaultName("thanawich999@gmail.com");
    expect(exp2).toBe("Expert 2");

    // Same email should retain same identifier
    const exp1Again = getExpertDefaultName("expert@tourism.ac.th");
    expect(exp1Again).toBe("Expert 1");

    const exp3 = getExpertDefaultName("reviewer3@example.com");
    expect(exp3).toBe("Expert 3");
  });

  it("should respect existingList with predetermined Expert N labels", () => {
    const existing = [
      { email: "alpha@test.com", expert_name: "Expert 1" },
      { email: "beta@test.com", expert_name: "Expert 2" },
    ];

    const resultBeta = getExpertDefaultName("beta@test.com", existing);
    expect(resultBeta).toBe("Expert 2");

    const resultGamma = getExpertDefaultName("gamma@test.com", existing);
    expect(resultGamma).toBe("Expert 3");
  });

  it("should resolve custom names when provided and not legacy mock strings", () => {
    // Custom legitimate name
    expect(resolveEvaluatorName("อาจารย์กานต์", "any@test.com")).toBe("อาจารย์กานต์");
    expect(resolveEvaluatorName("Dr. Alex Walker", "any@test.com")).toBe("Dr. Alex Walker");

    // Legacy mock names should be superseded by Expert N
    expect(resolveEvaluatorName("ดร. สมชาย", "user1@test.com")).toBe("Expert 1");
    expect(resolveEvaluatorName("ดร. สมชาย (ผู้เชี่ยวชาญการท่องเที่ยว)", "user2@test.com")).toBe("Expert 2");

    // Empty or undefined should fall back to Expert N
    expect(resolveEvaluatorName("", "user1@test.com")).toBe("Expert 1");
    expect(resolveEvaluatorName(null, "user2@test.com")).toBe("Expert 2");
  });
});
