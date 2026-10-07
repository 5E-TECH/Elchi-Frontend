import { describe, expect, it } from "vitest";
import { countSmsSegments, fillTemplate, isGsm7, templateVars } from "./smsSegments";

/**
 * ⚠️ Backend testida (Elchi-Backend apps/notification-service/src/sms/
 * sms-segments.util.spec.ts) AYNI vektorlar — natija bir xil bo'lishi shart.
 */
const latin = (n: number) => "a".repeat(n);
const cyr = (n: number) => "ж".repeat(n);

describe("countSmsSegments (backend bilan bir xil vektorlar)", () => {
  it.each([
    ["empty", "", "GSM-7", 0],
    ["160 latin", latin(160), "GSM-7", 1],
    ["161 latin (153 rule)", latin(161), "GSM-7", 2],
    ["200 latin", latin(200), "GSM-7", 2],
    ["306 latin", latin(306), "GSM-7", 2],
    ["307 latin", latin(307), "GSM-7", 3],
    ["70 cyrillic", cyr(70), "UCS-2", 1],
    ["71 cyrillic (67 rule)", cyr(71), "UCS-2", 2],
    ["134 cyrillic", cyr(134), "UCS-2", 2],
    ["135 cyrillic", cyr(135), "UCS-2", 3],
  ] as const)("%s", (_, text, encoding, parts) => {
    const result = countSmsSegments(text);
    expect(result.encoding).toBe(encoding);
    expect(result.parts).toBe(parts);
  });

  it("one ё switches a latin text to UCS-2 and recounts the parts", () => {
    expect(countSmsSegments(latin(100))).toEqual({ encoding: "GSM-7", units: 100, parts: 1, perPart: 160 });
    const mixed = countSmsSegments(latin(100) + "ё");
    expect(mixed.encoding).toBe("UCS-2");
    expect(mixed.parts).toBe(2);
  });

  it("the Uzbek curly apostrophe (o‘) is not GSM-7, the ASCII one is", () => {
    expect(isGsm7("Buyurtma yo'lda")).toBe(true);
    expect(isGsm7("Buyurtma yo‘lda")).toBe(false);
  });

  it("GSM-7 extension characters take 2 septets and are never split", () => {
    expect(countSmsSegments("{}").units).toBe(4);
    expect(countSmsSegments(latin(158) + "€").parts).toBe(1);
    expect(countSmsSegments(latin(159) + "€").parts).toBe(2);
    expect(countSmsSegments(latin(152) + "€" + latin(10)).parts).toBe(2);
    expect(countSmsSegments(latin(152) + "€" + latin(152)).parts).toBe(3);
  });

  it("an emoji counts as 2 UCS-2 units and is not split", () => {
    expect(countSmsSegments("😀").units).toBe(2);
    expect(countSmsSegments(cyr(69) + "😀").parts).toBe(2);
    expect(countSmsSegments(cyr(68) + "😀").parts).toBe(1);
  });
});

describe("template helpers", () => {
  it("finds and fills {{vars}}, leaving empty ones visible", () => {
    expect(templateVars("#{{order_number}} {{ status }} {{order_number}}")).toEqual(["order_number", "status"]);
    expect(fillTemplate("#{{order_number}}: {{status}}", { order_number: "EL-1", status: " " })).toBe("#EL-1: {{status}}");
  });
});
