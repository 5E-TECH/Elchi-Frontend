import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABEL,
  ROLE_META,
  type IntegrationCategory,
  type IntegrationRole,
} from "./index";

/**
 * ROL / KATEGORIYA TAKSONOMIYASI — UI qatlami.
 *
 * Ilgari modelda faqat `type` (`api`/`webhook`/`ftp`) bor edi — u TRANSPORT.
 * "NIMA QILADI" degan savol yozilmasdi, shuning uchun UI'da yetkazuvchi,
 * buyurtma manbasi va to'lov tizimi bir xil ko'rinardi.
 *
 * Bu test yorliqlar to'liq qolishini qulflaydi: yangi rol qo'shilib yorlig'i
 * yozilmasa, UI'da xom kalit ("payment") chiqib ketardi.
 */
describe("Integratsiya taksonomiyasi", () => {
  const ROLES: IntegrationRole[] = ["carrier", "source", "payment", "mirror"];
  const CATEGORIES: IntegrationCategory[] = [
    "marketplace",
    "crm",
    "cargo",
    "payment",
    "spreadsheet",
    "other",
  ];

  it("har bir rol uchun yorliq va IZOH bor", () => {
    for (const role of ROLES) {
      expect(ROLE_META[role]).toBeDefined();
      expect(ROLE_META[role].label.trim().length).toBeGreaterThan(0);
      // Izoh majburiy: "carrier" va "source" farqi foydalanuvchi uchun
      // o'z-o'zidan tushunarli EMAS — aynan shu chalkashgan edi.
      expect(ROLE_META[role].hint.trim().length).toBeGreaterThan(0);
    }
  });

  it("rol yorliqlari NOYOB (ikki rol bir xil ko'rinmasin)", () => {
    const labels = ROLES.map((r) => ROLE_META[r].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("har bir kategoriya uchun yorliq bor", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_LABEL[c]).toBeDefined();
      expect(CATEGORY_LABEL[c].trim().length).toBeGreaterThan(0);
    }
  });

  it("ROLE_META da ORTIQCHA kalit yo'q (backend bilan mos)", () => {
    // Backend `normalizeRole` aynan shu to'rttasini qabul qiladi; UI'da
    // qo'shimcha rol bo'lsa, u saqlanmay jimgina `carrier`ga tushardi.
    expect(Object.keys(ROLE_META).sort()).toEqual([...ROLES].sort());
  });

  it("CATEGORY_LABEL da ORTIQCHA kalit yo'q", () => {
    expect(Object.keys(CATEGORY_LABEL).sort()).toEqual([...CATEGORIES].sort());
  });

  it("to'lov tizimi uchun rol MAVJUD (yangi talab)", () => {
    // Foydalanuvchi talabi: marketplace VA to'lov tizimlari uchun joy.
    expect(ROLE_META.payment.label).toContain("To'lov");
    expect(CATEGORY_LABEL.marketplace).toBe("Marketplace");
  });
});
