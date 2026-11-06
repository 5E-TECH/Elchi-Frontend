import { describe, expect, it } from "vitest";
import { extraCostReasonText } from "./extraCostsView";

/**
 * GykuOz8f: rad sababi matni. Backend rad izohini «<sabab nomi> — <izoh>» qilib saqlaydi (bot bilan bir yozuv); sahifa
 * esa sabab nomini o'z tarjimasidan oladi — nom ikki marta chiqmasligi kerak (lokal e2e: «Juda qimmat: Summa juda katta
 * — izoh»).
 */
const rejected = (decision_comment: string | null, reject_reason_label: string | null = "Summa juda katta") => ({
  status: "rejected" as const,
  decision_comment,
  closed_reason: null,
  reject_reason_label,
});

describe("extraCostReasonText — rad etilgan", () => {
  it("⭐ backend qo'shgan sabab nomi izohdan olib tashlanadi", () => {
    expect(extraCostReasonText(rejected("Summa juda katta — E2E izoh"), "Juda qimmat")).toBe("Juda qimmat: E2E izoh");
  });

  it("izohsiz rad — faqat sabab nomi", () => {
    expect(extraCostReasonText(rejected("Summa juda katta"), "Juda qimmat")).toBe("Juda qimmat");
  });

  it("tarjima bo'lmasa — backend nomi, izoh bilan", () => {
    expect(extraCostReasonText(rejected("Summa juda katta — izoh"), null)).toBe("Summa juda katta: izoh");
  });

  it("eski yozuv (izohda sabab nomi yo'q) — izoh o'zgarmaydi", () => {
    expect(extraCostReasonText(rejected("Kuryer boshqa narx aytgan"), "Juda qimmat")).toBe("Juda qimmat: Kuryer boshqa narx aytgan");
  });

  it("yopilgan so'rov — yopilish sababi", () => {
    expect(
      extraCostReasonText({ status: "void", decision_comment: null, closed_reason: "Yangi so'rov eskisini almashtirdi", reject_reason_label: null }, null),
    ).toBe("Yangi so'rov eskisini almashtirdi");
  });
});
