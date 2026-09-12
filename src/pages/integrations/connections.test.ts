import { describe, expect, it } from "vitest";
import {
  CONNECTION_TYPES,
  ROLE_ORDER,
  findConnectionType,
  type ConnectionTypeMeta,
} from "./connections";
import { ROLE_META, CATEGORY_LABEL } from "../../entities/integrations";

/**
 * ULANISH REGISTRI.
 *
 * Ilgari Elchi'da integratsiya IKKI xil sahifada boshqarilardi ("Hamkorlar
 * (API)" va "Tashqi tizimlar") — ikki forma, ikki terminologiya, foydalanuvchi
 * uchun esa bu BITTA ish. Registr shuni birlashtiradi: yangi tizim qo'shish =
 * massivga bitta yozuv, forma va panel o'zini maydon ro'yxatidan yasaydi.
 */
describe("Ulanish registri", () => {
  it("kalitlar NOYOB", () => {
    const keys = CONNECTION_TYPES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("har bir turda yorliq, tavsif va maydonlar bor", () => {
    for (const t of CONNECTION_TYPES) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      // Tavsif majburiy: "marketplace (bizga ulanadi)" va "(biz ulanamiz)"
      // farqi o'z-o'zidan tushunarli EMAS.
      expect(t.desc.trim().length).toBeGreaterThan(0);
      expect(t.fields.length).toBeGreaterThan(0);
    }
  });

  it("rol va kategoriya taksonomiyaga mos (yorliq topiladi)", () => {
    // Registrda ROLE_META da yo'q rol bo'lsa, UI'da xom kalit chiqardi.
    for (const t of CONNECTION_TYPES) {
      expect(ROLE_META[t.role]).toBeDefined();
      expect(CATEGORY_LABEL[t.category]).toBeDefined();
    }
  });

  it("har bir turda `name` maydoni bor (ro'yxatda ko'rsatiladi)", () => {
    for (const t of CONNECTION_TYPES) {
      expect(t.fields.some((f) => f.key === "name")).toBe(true);
    }
  });

  it("maydon kalitlari tur ichida NOYOB", () => {
    for (const t of CONNECTION_TYPES) {
      const keys = t.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("⭐ sir maydonlari `writeOnly` deb belgilangan", () => {
    /**
     * Sir qiymati serverdan HECH QACHON qaytmaydi (faqat shifrlangan holda
     * saqlanadi). `writeOnly` bo'lmasa UI uni bo'sh ko'rsatib, saqlashda
     * bo'sh yuborardi — ishlab turgan sekret o'chib ketardi.
     */
    for (const t of CONNECTION_TYPES) {
      for (const f of t.fields) {
        if (f.type === "secret") expect(f.writeOnly).toBe(true);
      }
    }
  });

  it("`select` maydonida variantlar bor", () => {
    for (const t of CONNECTION_TYPES) {
      for (const f of t.fields) {
        if (f.type === "select") {
          expect(f.options?.length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("inbound turlarida webhook maydonlari bor, outbound'da API manzili", () => {
    const inbound = CONNECTION_TYPES.filter((t) => t.kind === "partner");
    const outbound = CONNECTION_TYPES.filter((t) => t.kind === "integration");

    expect(inbound.length).toBeGreaterThan(0);
    expect(outbound.length).toBeGreaterThan(0);

    for (const t of inbound) {
      // Bizga ulanadiganlarda kalit BIZDAN chiqadi, biz esa ularga webhook
      // yuboramiz — shuning uchun webhook manzili majburiy tushuncha.
      expect(t.fields.some((f) => f.key === "webhook_url")).toBe(true);
    }
    for (const t of outbound) {
      // Biz ulanadiganlarda biz so'rov yuboramiz — API manzili kerak.
      expect(t.fields.some((f) => f.key === "base_url")).toBe(true);
    }
  });

  it("marketplace VA to'lov tizimi uchun tur bor (foydalanuvchi talabi)", () => {
    const cats = CONNECTION_TYPES.map((t) => t.category);
    expect(cats).toContain("marketplace");
    expect(cats).toContain("payment");
  });

  it("ROLE_ORDER barcha ishlatilgan rolni qamraydi", () => {
    // Aks holda ro'yxatda ba'zi ulanish guruhsiz qolib, ko'rinmasdi.
    const used = new Set(CONNECTION_TYPES.map((t) => t.role));
    for (const role of used) expect(ROLE_ORDER).toContain(role);
  });

  it("findConnectionType topadi va topilmasa undefined", () => {
    const first = CONNECTION_TYPES[0] as ConnectionTypeMeta;
    expect(findConnectionType(first.key)).toBe(first);
    expect(findConnectionType("yo-q-tur")).toBeUndefined();
  });
});
