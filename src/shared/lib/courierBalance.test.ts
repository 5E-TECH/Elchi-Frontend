import { describe, expect, it } from "vitest";
import { courierAdvancePart, formatCourierBalance } from "./courierBalance";

const labels = { balance: "Qo'lingizda", advance: "Avans" };

describe("formatCourierBalance", () => {
  it("manfiy qoldiq — «Avans», summa musbat", () => {
    expect(formatCourierBalance(-200_000, labels)).toEqual({ label: "Avans", amount: 200_000, isAdvance: true });
  });

  it("musbat va nol qoldiq — oddiy yorliq, summa o'zgarmaydi", () => {
    expect(formatCourierBalance(350_000, labels)).toEqual({ label: "Qo'lingizda", amount: 350_000, isAdvance: false });
    expect(formatCourierBalance(0, labels)).toEqual({ label: "Qo'lingizda", amount: 0, isAdvance: false });
  });
});

describe("courierAdvancePart", () => {
  it("qoldiqdan ortig'i — avans", () => {
    expect(courierAdvancePart(500_000, 300_000)).toBe(200_000);
  });

  it("qoldiq yetsa — avans yo'q", () => {
    expect(courierAdvancePart(300_000, 300_000)).toBe(0);
    expect(courierAdvancePart(100_000, 300_000)).toBe(0);
  });

  it("qoldiq allaqachon manfiy (avans bor) — butun summa avans", () => {
    expect(courierAdvancePart(150_000, -50_000)).toBe(150_000);
  });
});
