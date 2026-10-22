import { describe, expect, it } from "vitest";
import en from "../../../../../locales/en/region.json";
import ru from "../../../../../locales/ru/region.json";
import uz from "../../../../../locales/uz/region.json";

const fill = (template: string) => template.replace("{{count}}", "14");

/**
 * Viloyatlar filtri (SegmentedControl) 390 px telefonda uchta segmentga ~100 px dan bo'linadi: ru/en yorliqlari
 * ikki xonali son bilan 14 belgidan oshsa, son «…» ostida qoladi (LG-2 review: «Без логиста…», «Unassigned ·…»).
 * uz yorliqlari maketda 390 da tekshirilgan.
 */
describe("v2.logist.regions.filter — telefon eni", () => {
  it.each([
    ["ru", ru],
    ["en", en],
  ])("%s: har bir yorliq (son bilan) ≤ 14 belgi", (_locale, bundle) => {
    const labels = Object.values(bundle.v2.logist.regions.filter).map(fill);
    for (const label of labels) expect(label.length, label).toBeLessThanOrEqual(14);
  });

  it("uz/ru/en kalitlari bir xil", () => {
    // Faqat `v2.logist` daraxti solishtiriladi — boshqa daraxtlarda ru/en ko'plik shakllari uz dan farq qiladi (SA-1).
    const keys = (bundle: { v2: { logist: typeof uz.v2.logist } }) => Object.keys(bundle.v2.logist.regions.filter).sort();
    expect(keys(ru)).toEqual(keys(uz));
    expect(keys(en)).toEqual(keys(uz));
  });

  it("en: bo'sh holat matni rol kartasidagi «Logist» nomini ishlatadi", () => {
    expect(en.v2.logist.empty.text).toContain("«Logist» role");
  });
});
