import { describe, expect, it } from "vitest";
import { advisorEnvelope, createAdvisorFixtures } from "../../../test/aiAdvisorFixtures";
import {
  AdvisorShapeError,
  isAdvisorShapeError,
  normalizeAlertDetail,
  normalizeAlertList,
  normalizeEvidence,
  normalizeExplainResult,
  normalizeOverview,
  normalizeSettings,
  safeAppHref,
} from "./advisorNormalize";

/**
 * Shartnoma v0.3 / #644 javoblari → tiplar: shakl qat'iy joylar (`overview` zondi, ro'yxat, tafsilot, izoh,
 * sozlamalar) `AdvisorShapeError` tashlaydi; qolgani himoyaviy (noma'lum qoida — umumiy, noma'lum dalil — `null`).
 */

const fx = createAdvisorFixtures(new Date(2026, 9, 23, 15, 0));

describe("normalizeOverview — mavjudlik zondi shakli", () => {
  it("konvertdagi overview — o'zgarishsiz (budjet, tavsiyalar — null)", () => {
    expect(normalizeOverview(advisorEnvelope(fx.overview))).toEqual(fx.overview);
  });

  it("boshqa endpoint javobi (e2e mock'ining `{items, meta}`), bo'sh, sonsiz — AdvisorShapeError", () => {
    for (const payload of [
      advisorEnvelope({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
      advisorEnvelope(null),
      {},
      "<!doctype html>",
      advisorEnvelope({ alerts: { new: "uch", open: 6, critical: 2, critical_rule_keys: [] } }),
      advisorEnvelope({ alerts: { new: 3, open: 6, critical: null, critical_rule_keys: [] } }),
      advisorEnvelope({ alerts: { new: 3, open: 6, critical: 2 } }),
    ]) {
      let thrown: unknown;
      try {
        normalizeOverview(payload);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, JSON.stringify(payload)).toBeInstanceOf(AdvisorShapeError);
      expect(isAdvisorShapeError(thrown)).toBe(true);
    }
  });

  it("noma'lum qoida kalitlari tashlanadi, `critical_open*` yo'q bo'lsa — `critical*` dan", () => {
    const overview = normalizeOverview({ alerts: { new: 1, open: 2, critical: 1, critical_rule_keys: ["R2", "R99", "R2"] } });
    expect(overview.alerts).toEqual({
      new: 1,
      open: 2,
      critical: 1,
      critical_open: 1,
      critical_rule_keys: ["R2"],
      critical_open_rule_keys: ["R2"],
    });
    expect(overview.budget).toBeNull();
    expect(overview.recommendations).toBeNull();
  });
});

describe("normalizeAlertList", () => {
  it("maketdagi 8 qator, meta va holat sonlari — o'zgarishsiz", () => {
    expect(normalizeAlertList(advisorEnvelope(fx.list))).toEqual(fx.list);
  });

  it("`items` massiv emas — AdvisorShapeError", () => {
    expect(() => normalizeAlertList(advisorEnvelope({ alerts: {} }))).toThrow(AdvisorShapeError);
  });

  it("noma'lum qoida va buzilgan fakt — umumiy (`facts: null`, server title); ID raqamsiz va holatsiz qator tashlanadi", () => {
    const [r2] = fx.items;
    const data = normalizeAlertList({
      items: [
        { ...r2, id: "2001", rule_key: "R9", facts: { anything: 1 }, title: "Yangi qoida sarlavhasi" },
        { ...r2, id: "2002", facts: { trigger: "growth" } },
        { ...r2, id: "abc" },
        { ...r2, id: "2003", status: "archived" },
        { ...r2, id: "2004", severity: "info", explanation_status: "weird", occurrences: 0 },
      ],
      meta: { page: 1, limit: 10, total: 5, totalPages: 1 },
    });
    expect(data.items.map((item) => [item.id, item.rule_key, item.facts === null])).toEqual([
      ["2001", "R9", true],
      ["2002", "R2", true],
      ["2004", "R2", false],
    ]);
    expect(data.items[0].title).toBe("Yangi qoida sarlavhasi");
    expect(data.items[2]).toMatchObject({ severity: "warning", explanation_status: "none", occurrences: 1 });
    expect(data.counts.by_status).toEqual({ new: 0, seen: 0, resolved: 0, dismissed: 0 });
  });

  it("meta yo'q — qatorlardan; `totalPages` hisoblanadi", () => {
    const data = normalizeAlertList({ items: fx.items.slice(0, 2), meta: { total: 30, limit: 25 } });
    expect(data.meta).toEqual({ page: 1, limit: 25, total: 30, totalPages: 2 });
  });
});

describe("normalizeAlertDetail", () => {
  it("har qoida tafsiloti (R1–R8, R7 karta, R2 muddat, R6 hafta) — o'zgarishsiz", () => {
    for (const detail of Object.values(fx.detail)) {
      expect(normalizeAlertDetail(advisorEnvelope(detail)), detail.id).toEqual(detail);
    }
  });

  it("noma'lum dalil turi — `evidence: null`; xavfli havola tashlanadi; `history` faqat kelganda", () => {
    const detail = normalizeAlertDetail({
      ...fx.detail.r1,
      evidence: { kind: "future_kind", total_rows: 1, truncated: false },
      links: [
        { kind: "shift_report", href: "javascript:alert(1)", entity_id: "1", primary: true },
        { kind: "shift_report", href: "//evil.example/x", entity_id: "1", primary: false },
        { kind: "new_kind", href: "/payments/main-cashbox", entity_id: null, primary: false },
      ],
      history: [{ at: "2026-10-22T09:18:00.000Z", event: "seen", by: { id: "1", name: "Shodiyor Ergashev" }, note: null }],
    });
    expect(detail.evidence).toBeNull();
    expect(detail.links).toEqual([{ kind: "new_kind", href: "/payments/main-cashbox", entity_id: null, primary: false }]);
    expect(detail.history).toHaveLength(1);
    expect("history" in normalizeAlertDetail(fx.detail.r1)).toBe(false);
  });

  it("ID yoki holat yo'q — AdvisorShapeError", () => {
    expect(() => normalizeAlertDetail(advisorEnvelope({ ...fx.detail.r1, id: null }))).toThrow(AdvisorShapeError);
    expect(() => normalizeAlertDetail(advisorEnvelope({ ...fx.detail.r1, status: undefined }))).toThrow(AdvisorShapeError);
  });

  it("R1: sanalmagan karta qismi `null` qoladi, avtomatik yopilgan smena belgisi saqlanadi", () => {
    const evidence = normalizeEvidence({
      kind: "shifts",
      total_rows: 1,
      truncated: false,
      rows: [
        {
          shift_id: "900",
          closed_at: "2026-10-22T08:40:00.000Z",
          closed_by: null,
          closed_by_system: true,
          expected_cash: 100,
          expected_card: 50,
          counted_cash: 90,
          counted_card: null,
          expected: 100,
          counted: 90,
          difference: -10,
          href: "/payments/shifts/900",
        },
      ],
      totals: { count: 1, difference: -10 },
    });
    expect(evidence).toMatchObject({ kind: "shifts", rows: [{ counted_card: null, closed_by: null, closed_by_system: true }] });
  });
});

describe("normalizeExplainResult", () => {
  it("202 queued / cached", () => {
    expect(normalizeExplainResult(advisorEnvelope(fx.explain.queued, 202))).toEqual(fx.explain.queued);
    expect(normalizeExplainResult(advisorEnvelope(fx.explain.cached, 202))).toEqual(fx.explain.cached);
  });

  it("holat `pending | ready` emas — AdvisorShapeError", () => {
    expect(() => normalizeExplainResult(advisorEnvelope({ explanation_status: "failed" }, 202))).toThrow(AdvisorShapeError);
  });
});

describe("normalizeSettings (#644)", () => {
  it("v4 + limits — o'zgarishsiz; R7 — jiddiy, Telegram'siz", () => {
    const settings = normalizeSettings(advisorEnvelope(fx.settings));
    expect(settings).toEqual(fx.settings);
    expect(settings.rules.R7).toEqual({ enabled: true, severity: "critical", telegram: false });
  });

  it("qisman javob: `limits` yo'q — #644 zaxirasi, qiymati yo'q chegara — sukut, darajasi yo'q — qotirilgan", () => {
    const settings = normalizeSettings({ version: 2, rules: { R1: { enabled: false, shortage_uzs: 30_000 } } });
    expect(settings.rules.R1).toEqual({
      enabled: false,
      severity: "warning",
      telegram: true,
      shortage_uzs: 30_000,
      consecutive_negative: 3,
    });
    expect(settings.rules.R2.severity).toBe("critical");
    expect(settings.rules.R7).toEqual({ enabled: true, severity: "critical", telegram: false });
    expect(settings.rules.R8.ratio).toBe(2);
    expect(settings.limits.rules.R3.mad_multiplier).toEqual({ min: 1, max: 10, step: 0.1, unit: "multiplier", default: 3 });
    expect(settings.limits.rules.R6).toEqual({});
    expect(settings).toMatchObject({ telegram: null, budget: null, schedule: null, updated_at: null, updated_by: null });
  });

  it("`limits` bor — bitta manba (§7.6): server chegarasini bermagan maydon zaxirasiz qoladi (chizilmaydi, yuborilmaydi)", () => {
    const { shortage_uzs: _omit, ...r1Limits } = fx.settings.limits.rules.R1;
    void _omit;
    const settings = normalizeSettings(
      advisorEnvelope({ ...fx.settings, limits: { rules: { ...fx.settings.limits.rules, R1: r1Limits, R4: undefined } } }),
    );
    expect(settings.limits.rules.R1.shortage_uzs).toBeUndefined();
    expect(settings.limits.rules.R1.consecutive_negative).toEqual(fx.settings.limits.rules.R1.consecutive_negative);
    expect(settings.limits.rules.R4).toEqual({});
    expect(settings.rules.R1).not.toHaveProperty("shortage_uzs");
    expect(settings.rules.R4).toEqual({ enabled: true, severity: "warning", telegram: true });
  });

  it("`version` yo'q / butun emas yoki `rules` yo'q — AdvisorShapeError", () => {
    for (const payload of [{ rules: {} }, { version: 1.5, rules: {} }, { version: 0, rules: {} }, { version: 3 }]) {
      expect(() => normalizeSettings(payload), JSON.stringify(payload)).toThrow(AdvisorShapeError);
    }
  });
});

describe("safeAppHref", () => {
  it("faqat ilova ichidagi nisbiy yo'l", () => {
    expect(safeAppHref("/payments/shifts/818")).toBe("/payments/shifts/818");
    expect(safeAppHref("/financial-balance?tab=history&financialBalanceHistoryFrom=2026-10-20")).toBe(
      "/financial-balance?tab=history&financialBalanceHistoryFrom=2026-10-20",
    );
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/a b", "/a\nb", "", null, 5]) {
      expect(safeAppHref(bad), String(bad)).toBeNull();
    }
  });
});
