import { describe, expect, it } from "vitest";
import {
  CONNECTION_TYPES,
  ROLE_ORDER,
  TYPE_CHANGE_FIELDS,
  fieldsInGroup,
  findConnectionType,
  visibleFields,
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

describe("Rol va tur — ALOHIDA amalda tahrirlanadi (bug qulfi)", () => {
  it("⭐ `role` maydoni MAVJUD — Donoxon kabi noto'g'ri tasnifni tuzatish uchun", () => {
    /**
     * Migratsiya mavjud yozuvlarga sukut `carrier` qo'ygan. Bu maydon
     * bo'lmasa noto'g'ri tasniflangan ulanish abadiy "yetkazuvchi" bo'lib
     * qolardi.
     */
    expect(TYPE_CHANGE_FIELDS.map((f) => f.key)).toContain("role");
    expect(TYPE_CHANGE_FIELDS.map((f) => f.key)).toContain("category");
  });

  it("⭐ lekin TUR RO'YXATLARIDA YO'Q — katalog tanlovi ma'nosizlanmasin", () => {
    /**
     * Ilgari `role` oddiy maydon bo'lib asosiy formada turardi: ustada
     * ko'rinib qiymati JIMGINA tashlanardi (usta uni kartadan oladi), va
     * "Marketplace" kartasini tanlab ichida "Yetkazuvchi" qilish mumkin
     * bo'lardi (audit FE-04, FE-05).
     */
    for (const type of CONNECTION_TYPES) {
      const keys = type.fields.map((f) => f.key);
      expect(keys).not.toContain("role");
      expect(keys).not.toContain("category");
    }
  });

  it("⭐ `role` variantlari backend `@IsIn` ro'yxati bilan AYNAN bir xil", () => {
    const role = TYPE_CHANGE_FIELDS.find((f) => f.key === "role");
    expect(role?.options?.map((o) => o.value).sort()).toEqual([
      "carrier",
      "mirror",
      "payment",
      "source",
    ]);
  });

  it("⭐ `category` variantlari ham backend ro'yxatiga mos", () => {
    const category = TYPE_CHANGE_FIELDS.find((f) => f.key === "category");
    expect(category?.options?.map((o) => o.value).sort()).toEqual([
      "cargo",
      "crm",
      "marketplace",
      "other",
      "payment",
      "spreadsheet",
    ]);
  });
});

describe("4-bosqich — turlar HAQIQATAN farq qiladi", () => {
  const byKey = (k: string) => CONNECTION_TYPES.find((t) => t.key === k)!;
  const keysOf = (k: string) => byKey(k).fields.map((f) => f.key);

  it("⭐ hech ikki tur AYNI massiv obyektini ulashmaydi", () => {
    /**
     * Foydalanuvchi shikoyatining ildizi: 6 turdan 5 tasi
     * `fields: OUTBOUND_FIELDS` deb AYNI obyektga ishora qilardi, ya'ni
     * katalogda 6 karta, ichida bitta forma (audit FE-01).
     */
    for (let i = 0; i < CONNECTION_TYPES.length; i += 1) {
      for (let j = i + 1; j < CONNECTION_TYPES.length; j += 1) {
        expect(CONNECTION_TYPES[i].fields).not.toBe(CONNECTION_TYPES[j].fields);
      }
    }
  });

  it("⭐ maydon to'plamlari farq qiladi — BITTA ataylab istisno bilan", () => {
    /**
     * Boshqa obyekt, lekin ayni tarkib bo'lsa foydalanuvchi uchun farq yo'q.
     *
     * ⚠️ ISTISNO: `crm` va `marketplace_outbound` bugun AYNI maydonlarni
     * so'raydi va bu HALOL holat — ikkisi ham "biz ularning API'sidan
     * buyurtma tortib olamiz" naqshida ishlaydi. CRM'ni farqlaydigan narsa
     * voronka/bosqich triggeri bo'lardi, lekin u KODDA YO'Q (audit P7).
     * Hech narsa o'qimaydigan maydon qo'shish yolg'on bo'lardi — shu bois
     * istisno ochiq yozildi va CRM oqimi 6-bosqichda qurilganda yopiladi.
     */
    const KNOWN_SAME = new Set(["crm", "marketplace_outbound"]);
    const sets = CONNECTION_TYPES.filter((t) => !KNOWN_SAME.has(t.key)).map(
      (t) => t.fields.map((f) => f.key).sort().join("|"),
    );
    expect(new Set(sets).size).toBe(sets.length);

    // Istisno JUFTLIGI haqiqatan ayni ekanini ham qulflaymiz — kelajakda
    // biri o'zgarsa test bu izohni eskirganini ko'rsatadi.
    const crm = CONNECTION_TYPES.find((t) => t.key === "crm")!;
    const mp = CONNECTION_TYPES.find((t) => t.key === "marketplace_outbound")!;
    expect(crm.fields.map((f) => f.key)).toEqual(mp.fields.map((f) => f.key));
  });

  it("⭐ POSILKA JO'NATISH sozlamasi FAQAT yetkazuvchida", () => {
    /**
     * `dispatch_config` posilka jo'natish shabloni. To'lov tizimida yoki
     * ko'zguda u ma'nosiz — u yerda posilka yo'q.
     */
    const hasDispatch = (k: string) =>
      keysOf(k).some((key) => key.startsWith("dispatch_config"));
    expect(hasDispatch("carrier")).toBe(true);
    for (const k of ["payment", "mirror", "crm", "marketplace_outbound"]) {
      expect(hasDispatch(k)).toBe(false);
    }
  });

  it("⭐ MARKET bog'lanishi faqat buyurtma KELADIGAN turlarda", () => {
    // Kargo buyurtma bermaydi — market hisobi kerak emas.
    expect(keysOf("marketplace_outbound")).toContain("market_id");
    expect(keysOf("crm")).toContain("market_id");
    for (const k of ["carrier", "payment", "mirror"]) {
      expect(keysOf(k)).not.toContain("market_id");
    }
  });

  it("KIRUVCHI webhook sozlamasi faqat status QAYTARADIGAN turlarda", () => {
    for (const k of ["carrier", "payment"]) {
      expect(keysOf(k)).toContain("webhook_secret");
    }
    expect(keysOf("mirror")).not.toContain("webhook_secret");
  });

  it("KO'ZGU faqat chiquvchi — kiruvchi sozlama yo'q", () => {
    const keys = keysOf("mirror");
    expect(keys.some((k) => k.startsWith("webhook_payload_paths"))).toBe(false);
    expect(keys.some((k) => k.startsWith("status_sync_config"))).toBe(true);
  });

  it("⭐ 0-bosqichda ochilgan maydonlar formada ISHLATILADI", () => {
    /**
     * Backend DTO'siga qo'shilgan 8 maydon formada so'ralmasa, 0-bosqich
     * behuda ketardi.
     */
    const all = new Set(
      CONNECTION_TYPES.flatMap((t) => t.fields.map((f) => f.key)),
    );
    for (const key of [
      "webhook_secret",
      "webhook_signature_header",
      "webhook_signature_prefix",
      "webhook_algorithm",
      "webhook_id_header",
      "inbound_status_mapping",
    ]) {
      expect(all.has(key)).toBe(true);
    }
    // Ichma-ich kalitlar prefiks bilan tekshiriladi.
    const flat = [...all];
    expect(flat.some((k) => k.startsWith("webhook_payload_paths"))).toBe(true);
    expect(flat.some((k) => k.startsWith("dispatch_config"))).toBe(true);
  });
});

describe("visibleFields — shartli maydonlar", () => {
  const fields = [
    { key: "auth_type", label: "Kirish", type: "select" as const },
    {
      key: "api_key",
      label: "Kalit",
      type: "secret" as const,
      showWhen: { key: "auth_type", equals: "api_key" },
    },
    {
      key: "password",
      label: "Parol",
      type: "secret" as const,
      showWhen: { key: "auth_type", equals: "login" },
    },
  ];

  it("⭐ faqat mos maydon ko'rinadi", () => {
    /**
     * Ilgari to'rttasi BIRGA ko'rinardi va operator qaysi ikkitasini
     * to'ldirish kerakligini taxmin qilardi (audit FE-07).
     */
    expect(
      visibleFields(fields, { auth_type: "api_key" }).map((f) => f.key),
    ).toEqual(["auth_type", "api_key"]);
    expect(
      visibleFields(fields, { auth_type: "login" }).map((f) => f.key),
    ).toEqual(["auth_type", "password"]);
  });

  it("⭐ sharti YO'Q maydon HAR DOIM ko'rinadi", () => {
    // Yangi maydon qo'shganda unutib qoldirsak yashirinib qolmasin.
    expect(visibleFields(fields, {}).map((f) => f.key)).toEqual(["auth_type"]);
    expect(visibleFields([fields[0]], {}).map((f) => f.key)).toEqual([
      "auth_type",
    ]);
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

