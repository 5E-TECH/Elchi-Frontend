import { describe, expect, it } from "vitest";
import i18n from "../../../../i18n";
import enUsers from "../../../../locales/en/users.json";
import ruUsers from "../../../../locales/ru/users.json";
import { buildRoleChangeConfirm, RELEASED_REGION_NAMES_LIMIT } from "./roleChangeConfirm";

const t = i18n.getFixedT("uz", ["users", "common"]);

/** FY-2: tasdiq oynasi mazmuni (to'liq oqim — `UpdateUserModal.role.test.tsx`). */
describe("buildRoleChangeConfirm", () => {
  it("sarlavha, izoh va tugma — maketdagidek", () => {
    const options = buildRoleChangeConfirm({ t, name: "Nilufar Rashidova", from: "admin", to: "manager" });
    expect(options.title).toBe("Rolni o'zgartirasizmi?");
    expect(options.description).toBe("Nilufar Rashidova endi menejer sifatida ishlaydi.");
    expect(options.confirmLabel).toBe("Rolni o'zgartirish");
    expect(options.tone).toBe("primary");
  });

  it(`ko'p viloyat — ${RELEASED_REGION_NAMES_LIMIT} tasi nomi bilan, qolgani «va yana N ta»`, () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const options = buildRoleChangeConfirm({ t, name: "Aziz", from: "logist", to: "admin", releasedRegions: names });
    const html = JSON.stringify(options.children, (key, value) => (key === "_owner" || key === "_store" ? undefined : value));
    expect(html).toContain("8 ta viloyat bo'shatiladi: A, B, C, D, E, F va yana 2 ta");
  });

  it("viloyati yo'q logist — viloyat qatori chiqmaydi", () => {
    const options = buildRoleChangeConfirm({ t, name: "Aziz", from: "logist", to: "registrator", releasedRegions: [] });
    const html = JSON.stringify(options.children, (key, value) => (key === "_owner" || key === "_store" ? undefined : value));
    expect(html).not.toContain("viloyat bo'shatiladi");
    expect(html).toContain("bo'shatilgan viloyatlar faoliyat jurnaliga yoziladi");
  });

  it("en — bitta viloyat ham grammatik («1 regions» emas)", () => {
    i18n.addResourceBundle("en", "users", enUsers, true, true);
    const en = i18n.getFixedT("en", ["users", "common"]);
    const options = buildRoleChangeConfirm({ t: en, name: "Aziz", from: "logist", to: "admin", releasedRegions: ["Navoiy"] });
    const html = JSON.stringify(options.children, (key, value) => (key === "_owner" || key === "_store" ? undefined : value));
    expect(html).toContain("Regions to be released (1): Navoiy");
    expect(html).not.toMatch(/\b1 regions\b/);
  });

  it("ru — logist viloyatlari «регионы» (v2.logist matnlaridagidek), «области» emas", () => {
    i18n.addResourceBundle("ru", "users", ruUsers, true, true);
    const ru = i18n.getFixedT("ru", ["users", "common"]);
    const texts = [
      ru("v2.role.descriptions.logist"),
      ru("v2.role.confirm.regions", { n: 2, names: "A, B" }),
      ru("v2.role.confirm.regionsUnknown"),
      ru("v2.role.confirm.journalLogist"),
    ];
    for (const text of texts) {
      expect(text).toMatch(/регион/i);
      expect(text).not.toMatch(/област/i);
    }
  });
});
