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
