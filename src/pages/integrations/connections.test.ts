import { describe, expect, it } from "vitest";
import {
  CONNECTION_TYPES,
  ROLE_ORDER,
  TYPE_CHANGE_FIELDS,
  fieldsInGroup,
  findConnectionType,
  isFieldDisabled,
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
/**
 * Maydon guruhlari VA ularni chizadigan joylar.
 *
 *   `connection` → `panels/ConnectionSettings.tsx` (Sozlamalar tabi)
 *   `security`   → `panels/ConnectionSecurity.tsx` (Xavfsizlik tabi)
 *   `sandbox`    → `panels/ConnectionSettings.tsx` ichidagi ALOHIDA karta
 *
 * ⚠️ Yangi guruh qo'shsang, uni chizadigan panel ham yozilishi SHART —
 * aks holda maydonlar sahifadan jimgina yo'qoladi.
 */
const RENDERED_GROUPS = ["connection", "security", "sandbox"] as const;

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
    expect(authType!.options?.map((o) => o.value).sort()).toEqual(["api_key", "login"]);
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

  it("guruhlar birgalikda BARCHA maydonni qamraydi (hech biri yo'qolmaydi)", () => {
    /**
     * Eng xavfli xato: maydon hech qaysi guruhga tushmasa, u sahifadan
     * butunlay yo'qoladi va buni hech kim sezmaydi — xato ham chiqmaydi.
     *
     * ⚠️ RO'YXAT QO'LDA YURITILADI VA BU ATAYLAB. Yangi guruh qo'shgan
     * odam uni CHIZADIGAN panel ham borligini tekshirishi kerak; test
     * shuni majburlaydi (`RENDERED_GROUPS` izohiga qarang).
     */
    for (const type of CONNECTION_TYPES) {
      const split = RENDERED_GROUPS.flatMap((g) => fieldsInGroup(type.fields, g)).map((f) => f.key);
      expect(split.sort()).toEqual(type.fields.map((f) => f.key).sort());
    }
  });

  it("⭐ har bir guruhni CHIZADIGAN panel bor", () => {
    /**
     * Yuqoridagi test guruhlar ro'yxatiga tayanadi. Agar kimdir ro'yxatga
     * guruh qo'shib, panel yozishni unutsa — test o'tardi, maydonlar esa
     * ekranda ko'rinmasdi. Shu bois ro'yxatning O'ZI ham tekshiriladi:
     *
     *   `connection` → ConnectionSettings (Sozlamalar tabi)
     *   `security`   → ConnectionSecurity (Xavfsizlik tabi)
     *   `sandbox`    → ConnectionSettings ichidagi ALOHIDA karta
     */
    const declared = new Set<string>();
    for (const type of CONNECTION_TYPES) {
      for (const f of type.fields) declared.add(f.group ?? "connection");
    }
    for (const group of declared) {
      expect(RENDERED_GROUPS).toContain(group);
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
     * ✅ ISTISNO YOPILDI (6-bosqich). 4-bosqichda `crm` va
     * `marketplace_outbound` AYNI maydonlarni so'rardi va bu halol holat
     * deb yozilgan edi: CRM'ni farqlaydigan voronka/bosqich triggeri kodda
     * YO'Q edi (audit P7), hech narsa o'qimaydigan maydon qo'shish esa
     * yolg'on bo'lardi.
     *
     * Endi trigger bor: `inbound_order_config` — qaysi voronka va
     * bosqichda bitim buyurtmaga aylanadi — va uni webhook haqiqatan
     * o'qiydi. Shu bois istisno olib tashlandi va hamma tur farq qiladi.
     */
    const sets = CONNECTION_TYPES.map((t) =>
      t.fields
        .map((f) => f.key)
        .sort()
        .join("|"),
    );
    expect(new Set(sets).size).toBe(sets.length);
  });

  it("⭐ VORONKA darvozasi faqat CRM'da", () => {
    /**
     * Bitim voronkada yurishi — CRM'ga XOS tushuncha. Marketplace buyurtmani
     * tayyor holda beradi, kargo esa umuman buyurtma bermaydi. Shu maydon
     * boshqa turda chiqsa, operator to'ldirib qo'yadi va hech narsa
     * o'qimaydi — ya'ni sozlangandek ko'rinib ishlamaydi.
     */
    const hasFunnel = (k: string) =>
      keysOf(k).some((key) => key.startsWith("inbound_order_config"));
    expect(hasFunnel("crm")).toBe(true);
    for (const k of ["marketplace_outbound", "carrier", "payment", "mirror"]) {
      expect(hasFunnel(k)).toBe(false);
    }
  });

  it("⭐ CRM kiruvchi webhookni ham sozlaydi", () => {
    /**
     * Audit P5: CRM turida FAQAT chiquvchi kirish bor edi, ya'ni CRM bizga
     * hodisa yubora olmasdi — imzo sekretini sozlaydigan joy yo'qligi
     * uchun. Voronka darvozasi webhook orqali ishlaydi, shuning uchun
     * ikkisi birga kelishi shart.
     */
    expect(keysOf("crm")).toContain("webhook_secret");
    expect(keysOf("crm")).toContain("webhook_signature_header");
  });

  it("⭐ POSILKA JO'NATISH sozlamasi FAQAT yetkazuvchida", () => {
    /**
     * `dispatch_config` posilka jo'natish shabloni. To'lov tizimida yoki
     * ko'zguda u ma'nosiz — u yerda posilka yo'q.
     */
    const hasDispatch = (k: string) => keysOf(k).some((key) => key.startsWith("dispatch_config"));
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
    const all = new Set(CONNECTION_TYPES.flatMap((t) => t.fields.map((f) => f.key)));
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
    expect(visibleFields(fields, { auth_type: "api_key" }).map((f) => f.key)).toEqual([
      "auth_type",
      "api_key",
    ]);
    expect(visibleFields(fields, { auth_type: "login" }).map((f) => f.key)).toEqual([
      "auth_type",
      "password",
    ]);
  });

  it("⭐ BOOLEAN shart — switch yoqilganda ko'rinadi", () => {
    /**
     * Voronka maydonlari `inbound_order_config.enabled` switch'iga bog'liq.
     * Solishtirishda faqat chap tomonni satrga aylantirgan edik —
     * `'true' === true` yolg'on chiqib, switch yoqilganda ham maydonlar
     * KO'RINMAY qolardi va operator voronkani sozlay olmasdi.
     *
     * Kalit NUQTALI: forma holati yassi saqlanadi (`nestPayload` faqat
     * yuborishda ichma-ich qiladi), shuning uchun to'g'ridan-to'g'ri
     * o'qish ishlaydi.
     */
    const gated = [
      {
        key: "inbound_order_config.enabled",
        label: "Yoqish",
        type: "switch" as const,
      },
      {
        key: "inbound_order_config.stage_path",
        label: "Bosqich",
        type: "text" as const,
        showWhen: { key: "inbound_order_config.enabled", equals: true },
      },
    ];

    expect(
      visibleFields(gated, { "inbound_order_config.enabled": true }).map((f) => f.key),
    ).toEqual(["inbound_order_config.enabled", "inbound_order_config.stage_path"]);
    // O'chirilgan va umuman tegilmagan — ikkisida ham yashiringan.
    expect(
      visibleFields(gated, { "inbound_order_config.enabled": false }).map((f) => f.key),
    ).toEqual(["inbound_order_config.enabled"]);
    expect(visibleFields(gated, {}).map((f) => f.key)).toEqual(["inbound_order_config.enabled"]);
  });

  it("⭐ sharti YO'Q maydon HAR DOIM ko'rinadi", () => {
    // Yangi maydon qo'shganda unutib qoldirsak yashirinib qolmasin.
    expect(visibleFields(fields, {}).map((f) => f.key)).toEqual(["auth_type"]);
    expect(visibleFields([fields[0]], {}).map((f) => f.key)).toEqual(["auth_type"]);
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

describe("⭐ ICHMA-ICH ildiz bitta GURUHDA turishi shart", () => {
  /**
   * `buildChangedPayload` ichma-ich sozlamani TO'LIQ yuboradi, chunki
   * backend jsonb ustunni almashtiradi (birlashtirmaydi). Lekin u faqat
   * O'ZIGA BERILGAN maydonlarni ko'radi — Sozlamalar tabi `connection`
   * guruhini, Xavfsizlik tabi `security` guruhini beradi.
   *
   * Agar bitta ildiz (masalan `dispatch_config`) ikki guruhga bo'linsa,
   * bir tabdan saqlash ikkinchi tabdagi yarmini O'CHIRIB yuborardi — va
   * buni hech kim sezmasdi, chunki xato chiqmaydi.
   *
   * Shu bois qoida test bilan qulflanadi: yangi ichma-ich maydon qo'shgan
   * odam guruhni ham to'g'ri qo'yishi kerak.
   */
  it("har bir nuqtali ildiz faqat bitta guruhda", () => {
    const groupsByRoot = new Map<string, Set<string>>();

    for (const type of CONNECTION_TYPES) {
      for (const f of type.fields) {
        if (!f.key.includes(".")) continue;
        const root = f.key.split(".")[0];
        const group = f.group ?? "connection";
        if (!groupsByRoot.has(root)) groupsByRoot.set(root, new Set());
        groupsByRoot.get(root)!.add(group);
      }
    }

    // Kamida bitta ichma-ich ildiz borligiga ishonch — test bo'shab qolmasin.
    expect(groupsByRoot.size).toBeGreaterThan(0);

    for (const [root, groups] of groupsByRoot) {
      expect(groups.size, `${root} ikki guruhga bo'lingan`).toBe(1);
    }
  });

  it("ichma-ich maydon SIR bo'lmasligi kerak", () => {
    /**
     * To'liq obyekt yuborilganda sir bo'sh ketardi va ishlab turgan kalitni
     * o'chirardi. `buildChangedPayload` da himoya bor (writeOnly o'tkazib
     * yuboriladi), lekin bu holat umuman yuzaga kelmasligi to'g'riroq:
     * sir YASSI maydon bo'lsin, shunda `sanitizeIntegrationRow` ham uni
     * javobdan o'chira oladi.
     */
    for (const type of CONNECTION_TYPES) {
      for (const f of type.fields) {
        if (f.key.includes(".")) expect(f.writeOnly).toBeFalsy();
      }
    }
  });
});

describe("⭐ `webhook_payload_paths` — UI kalitlari backend bilan MOS", () => {
  /**
   * BACKEND AYNAN SHU UCHTASINI O'QIYDI (`applyWebhookToShipment`,
   * `integration-service.service.ts`): `status`, `external_ref`,
   * `tracking_number`. Boshqa kalit yozilsa DTO uni tekshirmaydi
   * (`@IsObject()`), ya'ni jimgina saqlanadi va hech qachon o'qilmaydi.
   *
   * Ilgari nomuvofiqlik ikki tomonlama edi:
   *   • UI `order_id` ni so'rardi — backend uni o'qimaydi (o'lik maydon);
   *   • `tracking_number` UI'da taklif qilinmasdi — ya'ni kuzatuv raqami
   *     bo'yicha moslashni sozlash imkoni yo'q edi.
   *
   * Xato chiqmagani uchun bu uzoq sezilmadi. Test shuning uchun kerak:
   * yangi kalit qo'shgan odam backendni ham yangilashi shart.
   */
  const BACKEND_READS = new Set(["status", "external_ref", "tracking_number"]);

  it("UI faqat backend o'qiydigan kalitlarni so'raydi", () => {
    const asked = new Set<string>();
    for (const type of CONNECTION_TYPES) {
      for (const f of type.fields) {
        if (f.key.startsWith("webhook_payload_paths.")) {
          asked.add(f.key.slice("webhook_payload_paths.".length));
        }
      }
    }

    // Test bo'shab qolmasin — kamida bitta kalit so'ralishi kerak.
    expect(asked.size).toBeGreaterThan(0);
    for (const key of asked) {
      expect(BACKEND_READS.has(key), `${key} backendda o'qilmaydi`).toBe(true);
    }
  });

  it("posilkani TOPISH uchun kamida bitta yo'l taklif qilinadi", () => {
    /**
     * `status` yolg'iz yetmaydi: qaysi posilka haqida ekanini bilmasak,
     * hodisa `no_shipment` bo'lib to'xtaydi.
     */
    const withPaths = CONNECTION_TYPES.filter((t) =>
      t.fields.some((f) => f.key.startsWith("webhook_payload_paths.")),
    );
    expect(withPaths.length).toBeGreaterThan(0);

    for (const type of withPaths) {
      const keys = type.fields.map((f) => f.key);
      const hasLocator =
        keys.includes("webhook_payload_paths.external_ref") ||
        keys.includes("webhook_payload_paths.tracking_number");
      expect(hasLocator, `${type.key} da posilkani topish yo'li yo'q`).toBe(true);
    }
  });
});

describe("⭐ TO'LOV TIZIMI formasi (7-bosqich)", () => {
  const payment = () => CONNECTION_TYPES.find((t) => t.key === "payment")!;
  const keys = () => payment().fields.map((f) => f.key);

  it("⭐ TIYIN bayrog'i BOR", () => {
    /**
     * Payme/Click summani tiyinda yuboradi: 100 000 so'm → 10 000 000.
     * Bayroq bo'lmasa summa buyurtma narxidan 100 baravar oshib, ortiqcha
     * to'lov darvozasiga urilardi — ya'ni HAR BIR to'lov rad etilardi va
     * sabab uzoq izlanardi. Shu bois maydon formada turishi SHART.
     */
    expect(keys()).toContain("payment_config.amount_in_tiyin");
  });

  it("⭐ HOLAT XARITASI bor", () => {
    /**
     * Provayderlarning qiymatlari butunlay boshqacha ("paid", 2,
     * "CONFIRMED"). Backend xaritasiz hech bir hodisani qo'llamaydi —
     * sozlaydigan joy bo'lmasa to'lov yo'li umuman ishlamasdi.
     */
    expect(keys()).toContain("payment_config.status_map");
  });

  it("tranzaksiya id va buyurtma havolasi so'raladi", () => {
    // Ikkisi ham majburiy: biri dublikatni to'sadi, ikkinchisi buyurtmani
    // topadi. Bittasi bo'lmasa to'lov qo'llanmaydi.
    expect(keys()).toContain("payment_config.transaction_id_path");
    expect(keys()).toContain("payment_config.order_ref_path");
  });

  it("⭐ POSILKA yo'llari SO'RALMAYDI", () => {
    /**
     * To'lov hodisasida posilka YO'Q. Ilgari bu maydonlar shu yerda turardi
     * va chalg'itardi: operator ularni to'ldirardi, hech narsa bo'lmasdi.
     */
    expect(keys().some((k) => k.startsWith("webhook_payload_paths"))).toBe(false);
  });

  it("⭐ KIRUVCHI webhook sekreti so'raladi", () => {
    // To'lov faqat kiruvchi yo'l bilan keladi — imzo sekreti busiz
    // `not_configured` bilan 401 qaytadi.
    expect(keys()).toContain("webhook_secret");
  });

  it("⭐ to'lov maydonlari FAQAT to'lov turida", () => {
    /**
     * Boshqa turda chiqsa operator to'ldirib qo'yadi va hech narsa
     * o'qimaydi — "sozlangandek ko'rinib ishlamaydi" holati.
     */
    for (const type of CONNECTION_TYPES) {
      if (type.key === "payment") continue;
      expect(
        type.fields.some((f) => f.key.startsWith("payment_config")),
        `${type.key} da to'lov maydoni bo'lmasligi kerak`,
      ).toBe(false);
    }
  });
});

describe("⭐ HAMKOR maydonlari backend DTO'sida BOR", () => {
  /**
   * ⚠️ NEGA BU TEST KERAK. `ConnectionSettings` hamkorni yangilashda
   * `dto: payload as never` yozadi — ya'ni tip tekshiruvi CHETLAB
   * O'TILGAN. Gateway'da esa `whitelist: true, forbidNonWhitelisted: true`,
   * ya'ni DTO'da yo'q maydon 400 beradi.
   *
   * Aynan shu kombinatsiya bir marta ishlagan: `sandbox_webhook_url`
   * faqat `UpdatePartnerRequestDto` da bor edi, `Create` da yo'q — usta
   * "Sandbox manzili" ni to'ldirib "Yakunlash" bosganda butun ulanish
   * YARATILMASDI, xato sababi esa maydon nomi bo'lib UI'da ko'rinmasdi.
   * Typecheck jim turardi, chunki `as never` uni o'chirgan.
   *
   * Ro'yxat QO'LDA yuritiladi va bu ataylab: backend DTO'si TypeScript
   * interfeysi emas, u boshqa repozitoriyada yashaydi. Yangi maydon
   * qo'shgan odam ikki tomonni ham yangilashi kerak.
   */
  const PARTNER_DTO_KEYS = new Set([
    // CreatePartnerRequestDto + UpdatePartnerRequestDto
    // (Elchi-Backend/apps/api-gateway/src/dto/partner.swagger.dto.ts)
    "name",
    "webhook_url",
    "webhook_secret",
    "sandbox_webhook_url",
    "sandbox_webhook_secret",
    "sandbox_enabled",
    "ip_allowlist",
    // `POST partners/:id/status` alohida amal — forma yubormaydi.
    "is_active",
  ]);

  it("har bir hamkor maydoni DTO'da mavjud", () => {
    const partnerTypes = CONNECTION_TYPES.filter((t) => t.kind === "partner");
    // Test bo'shliqda ishlamasin.
    expect(partnerTypes.length).toBeGreaterThan(0);

    for (const type of partnerTypes) {
      for (const f of type.fields) {
        expect(
          PARTNER_DTO_KEYS.has(f.key),
          `${type.key}.${f.key} backend DTO'sida yo'q — 400 beradi`,
        ).toBe(true);
      }
    }
  });

  it("⭐ sandbox KALITI hamkor formasida bor", () => {
    /**
     * Kalit bo'lmasa sandbox'ni yoqish/o'chirish imkoni yo'q — foydalanuvchi
     * aynan shuni so'ragan ("o'chirib yoqadigan qil").
     */
    const partner = CONNECTION_TYPES.find((t) => t.kind === "partner")!;
    expect(partner.fields.map((f) => f.key)).toContain("sandbox_enabled");
  });

  it("⭐ sandbox maydonlari `sandbox` guruhida", () => {
    /**
     * Ular `connection` guruhida qolsa, prodakshn sekreti bilan YONMA-YON
     * chiziladi — aynan shikoyat qilingan aralashish.
     */
    const partner = CONNECTION_TYPES.find((t) => t.kind === "partner")!;
    for (const f of partner.fields) {
      if (f.key.startsWith("sandbox")) {
        expect(f.group, `${f.key} noto'g'ri guruhda`).toBe("sandbox");
      }
    }
  });
});

describe("⭐ `disabledWhen` — ko'rinadi, lekin tahrirlanmaydi", () => {
  /**
   * ⚠️ `showWhen` DAN FARQI MUHIM. Yashirish ma'lumotni ham yashiradi:
   * sandbox kaliti o'chirilganda saqlangan manzil ko'rinmay qolardi va
   * operator nima sozlanganini BILMASDI — "o'chirdim, endi qayerga
   * yozilganini eslay olmayman" holati.
   */
  const field = {
    key: "sandbox_webhook_url",
    label: "Sandbox manzili",
    type: "url" as const,
    disabledWhen: { key: "sandbox_enabled", equals: false },
  };

  it("shart bajarilsa O'CHIRILADI", () => {
    expect(isFieldDisabled(field, { sandbox_enabled: false })).toBe(true);
  });

  it("shart bajarilmasa tahrirlanadi", () => {
    expect(isFieldDisabled(field, { sandbox_enabled: true })).toBe(false);
  });

  it("⭐ tegilmagan qiymat (undefined) — `false` deb o'qiladi", () => {
    /**
     * Yangi hamkorda `sandbox_enabled` hali yo'q. `undefined` ni "yoqilgan"
     * deb o'qisak maydonlar tahrirlanardi-yu, saqlashda 400 kelardi.
     */
    expect(isFieldDisabled(field, {})).toBe(true);
  });

  it("sharti YO'Q maydon hech qachon o'chirilmaydi", () => {
    expect(isFieldDisabled({ ...field, disabledWhen: undefined }, {})).toBe(false);
  });

  it("⭐ sandbox maydonlari YASHIRILMAYDI, o'chiriladi", () => {
    /**
     * Registrda `showWhen` ishlatilsa maydon butunlay yo'qolardi. Bu test
     * qarorni qulflaydi: qiymat KO'RINISHI kerak.
     */
    const partner = CONNECTION_TYPES.find((t) => t.kind === "partner")!;
    const sandbox = partner.fields.filter(
      (f) => f.key.startsWith("sandbox") && f.type !== "switch",
    );
    expect(sandbox.length).toBeGreaterThan(0);

    for (const f of sandbox) {
      expect(f.showWhen, `${f.key} yashirilmasligi kerak`).toBeUndefined();
      expect(f.disabledWhen, `${f.key} da disabledWhen yo'q`).toBeTruthy();
    }
  });
});
