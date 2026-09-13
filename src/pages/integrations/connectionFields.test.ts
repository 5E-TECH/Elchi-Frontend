import { describe, expect, it } from "vitest";
import { buildChangedPayload } from "./ConnectionFields";
import type { ConnectionField } from "./connections";

/**
 * SAQLASH YUKI — faqat o'zgargan maydonlar.
 *
 * ⚠️ Backendda "berilmasa tegilmaydi" mantiqi bor. Sir maydoni bo'sh
 * yuborilsa, ishlab turgan kalit O'CHIB KETARDI. Tahrirlashda sirlar bo'sh
 * ko'rinadi (server ularni qaytarmaydi), shuning uchun ular faqat operator
 * YANGI qiymat yozgandagina yuborilishi kerak.
 */
const F = (over: Partial<ConnectionField>): ConnectionField => ({
  key: "x",
  label: "X",
  type: "text",
  ...over,
});

describe("buildChangedPayload", () => {
  it("TC1: o'zgarmagan maydon YUBORILMAYDI", () => {
    const fields = [F({ key: "name" })];
    const out = buildChangedPayload(fields, { name: "Uzum" }, { name: "Uzum" });
    expect(out).toEqual({});
  });

  it("TC2: o'zgargan maydon yuboriladi (trim bilan)", () => {
    const fields = [F({ key: "name" })];
    const out = buildChangedPayload(
      fields,
      { name: "  Uzum Market  " },
      { name: "Uzum" },
    );
    expect(out).toEqual({ name: "Uzum Market" });
  });

  it("TC3: ⭐ BO'SH sir YUBORILMAYDI (kalit o'chib ketmasin)", () => {
    const fields = [F({ key: "webhook_secret", type: "secret", writeOnly: true })];

    expect(buildChangedPayload(fields, { webhook_secret: "" }, {})).toEqual({});
    expect(buildChangedPayload(fields, { webhook_secret: "   " }, {})).toEqual({});
  });

  it("TC4: YANGI sir yuboriladi", () => {
    const fields = [F({ key: "webhook_secret", type: "secret", writeOnly: true })];
    const out = buildChangedPayload(fields, { webhook_secret: "s3cr3t" }, {});
    expect(out).toEqual({ webhook_secret: "s3cr3t" });
  });

  it("TC5: switch — faqat haqiqatan o'zgarganda", () => {
    const fields = [F({ key: "is_active", type: "switch" })];
    expect(
      buildChangedPayload(fields, { is_active: true }, { is_active: true }),
    ).toEqual({});
    expect(
      buildChangedPayload(fields, { is_active: false }, { is_active: true }),
    ).toEqual({ is_active: false });
  });

  it("TC6: tags — tartib bir xil bo'lsa o'zgarmagan hisoblanadi", () => {
    const fields = [F({ key: "ip_allowlist", type: "tags" })];
    expect(
      buildChangedPayload(
        fields,
        { ip_allowlist: ["1.1.1.1", "2.2.2.2"] },
        { ip_allowlist: ["1.1.1.1", "2.2.2.2"] },
      ),
    ).toEqual({});
    expect(
      buildChangedPayload(
        fields,
        { ip_allowlist: ["1.1.1.1"] },
        { ip_allowlist: ["1.1.1.1", "2.2.2.2"] },
      ),
    ).toEqual({ ip_allowlist: ["1.1.1.1"] });
  });

  it("TC7: tags BO'SHATILSA yuboriladi (cheklovni olib tashlash)", () => {
    // Bo'sh massiv "cheklov yo'q" degani va u YUBORILISHI kerak — aks holda
    // operator IP cheklovini olib tashlay olmasdi.
    const fields = [F({ key: "ip_allowlist", type: "tags" })];
    const out = buildChangedPayload(
      fields,
      { ip_allowlist: [] },
      { ip_allowlist: ["1.1.1.1"] },
    );
    expect(out).toEqual({ ip_allowlist: [] });
  });

  it("TC8: maydon ro'yxatida yo'q kalit yuborilmaydi", () => {
    // Forma boshqa turdan qolgan qiymatni tasodifan yubormasligi kerak.
    const fields = [F({ key: "name" })];
    const out = buildChangedPayload(
      fields,
      { name: "Uzum", begona: "qiymat" },
      { name: "Uzum" },
    );
    expect(out).toEqual({});
  });
});

describe("Xarita (mapping) maydoni — payload solishtiruvi", () => {
  const field = { key: "field_mapping", label: "Xarita", type: "mapping" as const };

  it("⭐ o'zgarmagan xarita YUBORILMAYDI", () => {
    const val = { id_field: "order_id", phone_field: "tel" };
    const out = buildChangedPayload([field], { field_mapping: val }, {
      field_mapping: { ...val },
    });
    expect(out).toEqual({});
  });

  it("⭐ kalitlar TARTIBI farq qilsa ham o'zgarmagan hisoblanadi", () => {
    /**
     * Aks holda ayni xarita "o'zgargan" bo'lib ko'rinib, har saqlashda
     * keraksiz yozuv ketardi.
     */
    const out = buildChangedPayload(
      [field],
      { field_mapping: { b: "2", a: "1" } },
      { field_mapping: { a: "1", b: "2" } },
    );
    expect(out).toEqual({});
  });

  it("o'zgargan xarita yuboriladi", () => {
    const out = buildChangedPayload(
      [field],
      { field_mapping: { id_field: "uuid" } },
      { field_mapping: { id_field: "order_id" } },
    );
    expect(out).toEqual({ field_mapping: { id_field: "uuid" } });
  });

  it("⭐ bo'shatilgan xarita `{}` bo'lib yuboriladi — o'chirish ishlaydi", () => {
    const out = buildChangedPayload(
      [field],
      { field_mapping: {} },
      { field_mapping: { id_field: "order_id" } },
    );
    expect(out).toEqual({ field_mapping: {} });
  });

  it("boshlang'ich qiymat yo'q bo'lsa ham to'g'ri ishlaydi", () => {
    const out = buildChangedPayload([field], { field_mapping: { a: "1" } }, {});
    expect(out).toEqual({ field_mapping: { a: "1" } });
  });
});

describe("⭐ ICHMA-ICH sozlama TO'LIQ yuboriladi", () => {
  /**
   * Backend `Object.assign(row, dto)` ishlatadi — jsonb ustun butunlay
   * ALMASHTIRILADI, birlashtirilmaydi. Faqat o'zgargan kalitni yuborsak:
   *
   *   operator `stage_path` ni tahrirlaydi
   *     → { inbound_order_config: { stage_path: 'x' } }
   *     → bazada: { stage_path: 'x' }   ← `enabled` va darvozalar YO'QOLDI
   *     → CRM'dan buyurtma kelishi JIMGINA to'xtaydi
   *
   * Xuddi shu tuzoq `dispatch_config` da ham bor edi: `method` ni
   * o'zgartirish `endpoint` ni o'chirib, kargoga posilka jo'natishni buzardi.
   */
  const funnel = [
    F({ key: "inbound_order_config.enabled", type: "switch" }),
    F({ key: "inbound_order_config.stage_path" }),
    F({ key: "inbound_order_config.create_on_stages", type: "tags" }),
  ];

  const initial = {
    "inbound_order_config.enabled": true,
    "inbound_order_config.stage_path": "status_id",
    "inbound_order_config.create_on_stages": ["142"],
  };

  it("bitta kalit o'zgarsa ham BUTUN obyekt ketadi", () => {
    const out = buildChangedPayload(
      funnel,
      { ...initial, "inbound_order_config.stage_path": "stage_id" },
      initial,
    );

    expect(out).toEqual({
      inbound_order_config: {
        enabled: true,
        stage_path: "stage_id",
        create_on_stages: ["142"],
      },
    });
  });

  it("hech narsa o'zgarmasa ichma-ich obyekt YUBORILMAYDI", () => {
    // Aks holda har "Saqlash" bosilishi keraksiz yozuv qilardi.
    expect(buildChangedPayload(funnel, initial, initial)).toEqual({});
  });

  it("BOSHQA ildiz tegilmaydi", () => {
    /**
     * Voronka tahrirlansa `dispatch_config` yuborilmasligi kerak — aks holda
     * bir tabda ishlagan operator boshqa tabdagi sozlamani ustiga yozardi.
     */
    const mixed = [
      ...funnel,
      F({ key: "dispatch_config.endpoint" }),
      F({ key: "dispatch_config.method" }),
    ];
    const init2 = {
      ...initial,
      "dispatch_config.endpoint": "/orders",
      "dispatch_config.method": "POST",
    };

    const out = buildChangedPayload(
      mixed,
      { ...init2, "inbound_order_config.enabled": false },
      init2,
    );

    expect(out).toHaveProperty("inbound_order_config");
    expect(out).not.toHaveProperty("dispatch_config");
  });

  it("tegilmagan kalit `undefined` bo'lsa bo'sh qiymat ketadi", () => {
    /**
     * `undefined` JSON'da yo'qoladi, ya'ni kalit tushib qolardi — aynan
     * qutulmoqchi bo'lgan holat. Tur bo'yicha bo'sh qiymat beriladi.
     */
    const out = buildChangedPayload(
      funnel,
      { "inbound_order_config.stage_path": "status_id" },
      {},
    );

    expect(out).toEqual({
      inbound_order_config: {
        enabled: false,
        stage_path: "status_id",
        create_on_stages: [],
      },
    });
  });

  it("sir maydoni ichma-ich bo'lsa TO'LDIRILMAYDI", () => {
    /**
     * Sir server javobida qaytmaydi, ya'ni joriy holatda bo'sh turadi.
     * Uni to'liq obyekt bilan yuborsak ishlab turgan kalitni O'CHIRARDI.
     * Bugun ichma-ich sir yo'q, lekin qo'shilsa bu himoya ishlashi kerak.
     */
    const withSecret = [
      ...funnel,
      F({ key: "inbound_order_config.token", type: "secret", writeOnly: true }),
    ];

    const out = buildChangedPayload(
      withSecret,
      { ...initial, "inbound_order_config.stage_path": "s2" },
      initial,
    );

    expect(out.inbound_order_config).not.toHaveProperty("token");
  });
});
