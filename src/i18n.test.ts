import { describe, expect, it } from "vitest";
import i18n, { loadAppLocales } from "./i18n";
import uzRest from "./locales/uzRest";

/**
 * rzzxMItN — o'zbekcha tarjimalar ikkiga bo'lingan: yadro (entry ichida: login, yuklanish ekrani, xato sahifalari,
 * global qatlam) va qolgani (`locales/uzRest.ts`, alohida chunk). Ikkalasi birga — barcha uz fayllar, takrorsiz.
 */
const CORE = ["auth", "common", "notifications", "ui"];
const allUz = Object.keys(import.meta.glob("./locales/uz/*.json")).map((path) => path.replace(/^\.\/locales\/uz\/|\.json$/g, ""));

describe("o'zbekcha tarjimalar: yadro + qolgani", () => {
  it("yadro va qolgani birga barcha uz fayllarni qamraydi, kesishmasdan", () => {
    const rest = Object.keys(uzRest);
    expect(rest.filter((namespace) => CORE.includes(namespace))).toEqual([]);
    expect([...CORE, ...rest].sort()).toEqual([...allUz].sort());
  });

  it("yadro entry'da: ilova ishga tushganda (i18n init) shu nomlar fazosi bor", () => {
    for (const namespace of CORE) expect(i18n.hasResourceBundle("uz", namespace)).toBe(true);
  });

  it("qolgani chizishdan oldin yuklangan (`/login` dan boshqa yo'l) — sxemalardagi `i18n.t(\"ns:…\")` kalit qaytarmaydi", () => {
    for (const namespace of Object.keys(uzRest)) expect(i18n.hasResourceBundle("uz", namespace)).toBe(true);
    expect(i18n.t("branches:validation.name")).not.toBe("validation.name");
    expect(i18n.t("dashboard:v2Dashboard.period.today")).toBe("Bugun");
  });

  it("`loadAppLocales` — bitta yuklash (takroriy chaqiruv o'sha va'da)", async () => {
    const first = loadAppLocales();
    expect(loadAppLocales()).toBe(first);
    await expect(first).resolves.toBeUndefined();
  });
});
