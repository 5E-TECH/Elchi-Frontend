import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { AI_ASSISTANT_TOOL_NAMES, type AiSource } from "./types";
import { formatSourcePeriod, formatSourcesLine, sourceLabel, visibleSources } from "./sources";

const t = (lng: string) => i18n.getFixedT(lng, "aiAdvisor") as unknown as (key: string, options?: Record<string, unknown>) => string;

const source = (overrides: Partial<AiSource>): AiSource => ({
  tool: "get_cashbox_history",
  period: { from: "2026-10-01", to: "2026-10-23" },
  records: 1284,
  truncated: false,
  ok: true,
  ...overrides,
});

beforeAll(async () => {
  await i18n.loadLanguages(["ru", "en"]);
  await i18n.loadNamespaces("aiAdvisor");
});

describe("«Manba» qatori (F7PWp6cK, maket superadmin-ai-assistant)", () => {
  it("maketdagi qator: «Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv»", () => {
    expect(formatSourcesLine([source({})], t("uz"), "uz")).toBe("Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv");
    expect(
      formatSourcesLine([source({ tool: "get_receipt_checks", period: { from: "2026-10-19", to: "2026-10-23" }, records: 46 })], t("uz"), "uz"),
    ).toBe("Manba: chek tekshiruvlari 19.10–23.10.2026, 46 ta yozuv");
  });

  it("bir nechta manba (davri har xil), davrsiz — «(joriy holat)», `truncated` — «qisqartirilgan»", () => {
    expect(
      formatSourcesLine(
        [source({}), source({ tool: "get_courier_debts", period: null, records: 37, truncated: true })],
        t("uz"),
        "uz",
      ),
    ).toBe("Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv; kuryerlar qarzi (joriy holat), 37 ta yozuv, qisqartirilgan");
  });

  it("`ok: false` yashirin, takror bitta (eng ko'p yozuv), hammasi yashirin bo'lsa — qator yo'q", () => {
    expect(visibleSources([source({ records: 10 }), source({ records: 40, truncated: true }), source({ tool: "get_order_flow", ok: false })])).toEqual([
      source({ records: 40, truncated: true }),
    ]);
    expect(formatSourcesLine([source({ ok: false })], t("uz"), "uz")).toBeNull();
    expect(formatSourcesLine([], t("uz"), "uz")).toBeNull();
  });

  it("10 ta tool'ning hammasi uz/ru/en da nomlangan; noma'lum — «boshqa ma'lumot»", () => {
    for (const lng of ["uz", "ru", "en"]) {
      for (const tool of AI_ASSISTANT_TOOL_NAMES) {
        const label = sourceLabel(tool, t(lng));
        expect(label, `${lng}: ${tool}`).not.toContain("sources.tools");
        expect(label).not.toBe(tool);
        if (lng !== "uz") expect(label).not.toBe(sourceLabel(tool, t("uz")));
      }
    }
    expect(sourceLabel("get_future_tool", t("uz"))).toBe("boshqa ma'lumot");
  });

  it("davr satr sifatida (vaqt mintaqasi kunni surmaydi): bir yil, ikki yil, bitta kun", () => {
    expect(formatSourcePeriod({ from: "2026-10-01", to: "2026-10-23" })).toBe("01.10–23.10.2026");
    expect(formatSourcePeriod({ from: "2025-12-28", to: "2026-01-05" })).toBe("28.12.2025–05.01.2026");
    expect(formatSourcePeriod({ from: "2026-11-10", to: "2026-11-10" })).toBe("10.11.2026");
  });

  it("ruscha ko'plik: 1 запись, 3 записи, 1 284 записи / 5 записей", () => {
    const ru = t("ru");
    expect(formatSourcesLine([source({ records: 1 })], ru, "ru")).toBe("Источник: операции кассы 01.10–23.10.2026, 1 запись");
    expect(formatSourcesLine([source({ records: 3 })], ru, "ru")).toContain("3 записи");
    expect(formatSourcesLine([source({ records: 5 })], ru, "ru")).toContain("5 записей");
  });
});
