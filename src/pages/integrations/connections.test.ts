import { describe, expect, it } from "vitest";
import {
  CONNECTION_TYPES,
  ROLE_ORDER,
  fieldsInGroup,
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

/**
 * QUYIDAGI TESTLAR UCHTA HAQIQIY BUG'NI QULFLAB QO'YADI.
 *
 * Uchtasi ham bir xil turdagi xato edi: forma qiymat so'raydi, "Saqlandi"
 * deb yozadi, lekin qiymat backendga YETMAYDI yoki boshqa ma'noda yoziladi.
 * Bunday xato eng yomoni — sahifa ishlayotgandek ko'rinadi.
 */
describe("Registr ↔ backend mosligi (bug qulflari)", () => {
  const outbound = CONNECTION_TYPES.find((t) => t.kind === "integration")!;
  const inbound = CONNECTION_TYPES.find((t) => t.kind === "partner")!;

  it("⭐ `is_active` registrda YO'Q — u alohida amal", () => {
    /**
     * Sabab: gateway'da `whitelist: true`, `UpdatePartnerRequestDto` esa
     * `is_active` ni e'lon qilmaydi. Umumiy forma bilan yuborilsa qiymat
     * jimgina tashlanardi va hamkor ulanishi o'chmasdi.
     */
    for (const type of CONNECTION_TYPES) {
      expect(type.fields.map((f) => f.key)).not.toContain("is_active");
    }
  });

  it("⭐ chiquvchi kalit `api_key` deb nomlangan — `token` EMAS", () => {
    // `token` backend DTO'sida yo'q → `whitelist: true` uni tashlaydi.
    const keys = outbound.fields.map((f) => f.key);
    expect(keys).toContain("api_key");
    expect(keys).not.toContain("token");
  });

  it("⭐ `auth_type` variantlari backend qabul qiladigan qiymatlar", () => {
    /**
     * Backend faqat `api_key` va `login` ni biladi; qolgan hamma qiymatni
     * `api_key` ga aylantiradi. Ilgari bu yerda `bearer`/`basic`/`none`
     * turardi — "Yo'q" tanlansa ham kalitli rejim yozilardi.
     */
    const authType = outbound.fields.find((f) => f.key === "auth_type");
    expect(authType).toBeDefined();
    expect(authType!.options?.map((o) => o.value).sort()).toEqual([
      "api_key",
      "login",
    ]);
  });

  it("kirishni cheklaydigan maydonlar `security` guruhida", () => {
    // IP ro'yxati xato kiritilsa hamkorni butunlay to'sib qo'yadi.
    const ip = inbound.fields.find((f) => f.key === "ip_allowlist");
    expect(ip?.group).toBe("security");
  });

  it("fieldsInGroup ajratadi va guruhsiz maydon `connection`ga tushadi", () => {
    const fields = [
      { key: "a", label: "A", type: "text" as const },
      { key: "b", label: "B", type: "text" as const, group: "security" as const },
    ];
    expect(fieldsInGroup(fields, "connection").map((f) => f.key)).toEqual(["a"]);
    expect(fieldsInGroup(fields, "security").map((f) => f.key)).toEqual(["b"]);
  });

  it("ikki guruh birgalikda BARCHA maydonni qamraydi (hech biri yo'qolmaydi)", () => {
    /**
     * Eng xavfli xato: maydon hech qaysi tabga tushmasa, u sahifadan
     * butunlay yo'qoladi va buni hech kim sezmaydi.
     */
    for (const type of CONNECTION_TYPES) {
      const split = [
        ...fieldsInGroup(type.fields, "connection"),
        ...fieldsInGroup(type.fields, "security"),
      ].map((f) => f.key);
      expect(split.sort()).toEqual(type.fields.map((f) => f.key).sort());
    }
  });
});

describe("Katalog ma'lumoti", () => {
  it("⭐ har bir turda `prereqs` bor va bo'sh emas", () => {
    /**
     * Katalog kartasi va ustaning 1-qadami shu ro'yxatni chizadi. Bo'sh
     * bo'lsa karta yarim ko'rinardi va operator "menda bu bormi?" degan
     * savolga javob olmasdi — ya'ni ustaga kirib, o'rtada to'xtardi.
     */
    for (const type of CONNECTION_TYPES) {
      expect(type.prereqs.length).toBeGreaterThan(0);
      for (const item of type.prereqs) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("usta 1-qadamida so'raydigan maydon HAR turda mavjud", () => {
    // Usta `name` (va outbound'da `slug`) ni 1-qadamda so'raydi.
    for (const type of CONNECTION_TYPES) {
      const keys = type.fields.map((f) => f.key);
      expect(keys).toContain("name");
      if (type.kind === "integration") expect(keys).toContain("slug");
    }
  });
});

describe("Rol va tur formada tahrirlanadi (bug qulfi)", () => {
  const outbound = CONNECTION_TYPES.find((t) => t.kind === "integration")!;

  it("⭐ `role` maydoni FORMADA bor", () => {
    /**
     * Ilgari yo'q edi va buni foydalanuvchi topdi: "Donoxon nega yetkazuvchi
     * kargo sifatida belgilangan?". Sabab — migratsiya mavjud yozuvlarga
     * sukut `carrier` yozgan, forma esa bu maydonni so'ramagani uchun
     * noto'g'ri tasnifni TUZATIB BO'LMASDI.
     */
    expect(outbound.fields.map((f) => f.key)).toContain("role");
  });

  it("⭐ `role` variantlari backend `@IsIn` ro'yxati bilan AYNAN bir xil", () => {
    // Mos kelmasa backend 400 qaytaradi va forma "saqlab bo'lmadi" deydi.
    const role = outbound.fields.find((f) => f.key === "role");
    expect(role?.options?.map((o) => o.value).sort()).toEqual([
      "carrier",
      "mirror",
      "payment",
      "source",
    ]);
  });

  it("⭐ `category` variantlari ham backend ro'yxatiga mos", () => {
    const category = outbound.fields.find((f) => f.key === "category");
    expect(category?.options?.map((o) => o.value).sort()).toEqual([
      "cargo",
      "crm",
      "marketplace",
      "other",
      "payment",
      "spreadsheet",
    ]);
  });

  it("rol/tur `connection` guruhida — Sozlamalar tabida ko'rinadi", () => {
    for (const key of ["role", "category"]) {
      const f = outbound.fields.find((x) => x.key === key);
      // Guruhi belgilanmagan = `connection` (sukut).
      expect(f?.group ?? "connection").toBe("connection");
    }
  });
});
