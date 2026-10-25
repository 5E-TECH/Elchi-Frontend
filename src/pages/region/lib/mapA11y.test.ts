import { createInstance } from "i18next";
import en from "../../../locales/en/region.json";
import ru from "../../../locales/ru/region.json";
import uz from "../../../locales/uz/region.json";
import { buildMapA11yLang } from "./mapA11y";

/**
 * fYgDe3MW — xarita skrin-rider e'lonlari (Highcharts `lang.accessibility`) uz tarjima faylida (ru/en ham): sukutdagi
 * inglizcha matn qolmaydi, Highcharts o'rinbosarlari (`{title}`, `{series.name}` …) saqlanadi.
 */
const KEYS = ["chartContainerLabel", "svgContainerLabel", "endOfChartMarker", "seriesSummary", "nullPointValue"] as const;

const translator = async (lng: "uz" | "ru" | "en") => {
  const i18n = createInstance();
  await i18n.init({
    lng,
    ns: ["region"],
    defaultNS: "region",
    resources: { uz: { region: uz }, ru: { region: ru }, en: { region: en } },
    interpolation: { escapeValue: false },
  });
  return i18n.t.bind(i18n);
};

describe("xarita lang.accessibility (fYgDe3MW)", () => {
  it.each([
    ["uz", uz],
    ["ru", ru],
    ["en", en],
  ])("%s: region.json → v2.map.a11y va pointAria to'liq", (_lng, file) => {
    const map = file.v2.map as { pointAria?: string; a11y?: Record<string, string> };
    for (const key of KEYS) expect(map.a11y?.[key]?.trim(), key).toBeTruthy();
    expect(map.pointAria).toContain("{{name}}");
  });

  it("uz: e'lonlar o'zbekcha, o'rinbosarlar saqlanadi", async () => {
    const lang = buildMapA11yLang(await translator("uz"));
    expect(lang).toMatchObject({
      defaultChartTitle: "Viloyatlar xaritasi",
      chartContainerLabel: "{title}. Interaktiv xarita.",
      svgContainerLabel: "Interaktiv xarita",
      screenReaderSection: { endOfChartMarker: "Xarita oxiri." },
      series: { summary: { map: "{series.name}, {series.points.length} ta viloyat." }, nullPointValue: "Ma'lumot yo'q" },
    });
  });

  it("uz: viloyat tavsifi — maketdagi shakl", async () => {
    const t = await translator("uz");
    expect(t("v2.map.pointAria", { name: "Andijon viloyati", count: "21", rate: "71,4%", revenue: "3,0 mln so'm" })).toBe(
      "Andijon viloyati: 21 ta buyurtma, 71,4% muvaffaqiyat, 3,0 mln so'm tushum",
    );
  });
});
