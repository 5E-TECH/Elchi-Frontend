import { describe, expect, it } from "vitest";
import { advisorEnvelope } from "../../../test/aiAdvisorFixtures";
import { normalizeAlertDetail, normalizeAlertListItem, normalizeSettings } from "./advisorNormalize";

/**
 * Backend dev javoblari (BE origin/dev — `finance-service/src/advisor/advisor-inputs.service.ts` nomzodlari,
 * `ai-service/src/advisor/advisor-alerts.service.ts` `toListItem` / tafsilot, `advisor-text.ts` havolalari,
 * `libs/common/src/ai/advisor.contract.ts` sozlamalari) — aynan backend quradigan shaklda, jumladan ism olinmagan
 * holat (`name: null` — «FE «#id» ko'rsatadi, xato emas»). Normalizator har maydonni o'zgartirmay saqlaydi
 * (`toMatchObject`) va ma'lum qoidani umumiy ko'rinishga tushirmaydi (`facts !== null`).
 */

const base = {
  status: "new",
  severity: "warning",
  occurrences: 1,
  first_at: "2026-11-16T09:00:00.000Z",
  last_at: "2026-11-16T09:00:00.000Z",
  first_fact_at: "2026-11-16T08:55:00.000Z",
  last_fact_at: "2026-11-16T08:55:00.000Z",
  explanation_status: "none",
  reopened_from_id: null,
};

const detailExtra = {
  links: [] as unknown[],
  explanation_md: null,
  explanation_error: null,
  explanation_error_scope: null,
  explanation_retry_at: null,
  explanation_requested_at: null,
  explanation_poll_after_ms: null,
  explained_at: null,
  seen_at: "2026-11-16T09:01:00.000Z",
  seen_by: { id: "1", name: null },
  resolved_at: null,
  resolved_by: null,
  resolution_note: null,
  reopened_from: null,
};

/** R1 — ochiq ogohlantirishga qo'shilgan smenalar (`mergeR1`): `streak_*`, ismlar olinmagan. */
const r1 = {
  ...base,
  id: "2001",
  rule_key: "R1",
  title: "#7 kassasida 3 smena ketma-ket kamomad: −445 000 so'm",
  branch: { id: "7", name: null },
  subject: { kind: "cashbox", id: "7", name: null },
  headline_amount: -545_000,
  facts: {
    trigger: "consecutive_negative",
    cashbox: { type: "branch", owner_id: "7", name: null },
    branch: { id: "7", name: null },
    shifts_count: 4,
    total_difference: -545_000,
    last_difference: -240_000,
    closed_by: [{ id: "214", name: null }],
    last_shift_id: "818",
    streak_length: 3,
    streak_total: -445_000,
  },
};

/** R3 — mediana 0, kategoriya nomi yo'q; dalil qatorlarida `cashbox_name: null`, `href` — ai-service'dan. */
const r3 = {
  ...base,
  id: "2003",
  rule_key: "R3",
  title: "Kassa · xarajat: 900 000 so'm",
  branch: null,
  subject: { kind: "cashbox", id: "0", name: "Asosiy kassa" },
  headline_amount: 900_000,
  facts: {
    history_id: "98877",
    amount: 900_000,
    category: { id: "4", name: null },
    cashbox: { type: "main", owner_id: "0", name: "Asosiy kassa" },
    branch: null,
    created_by: null,
    created_at: "2026-11-16T08:55:00.000Z",
    median: 0,
    mad: 0,
    threshold: 0,
    ratio_to_median: null,
    sample_size: 6,
    window_days: 30,
    scope: "category",
  },
  rule: { key: "R3", severity: "warning", thresholds: { mad_multiplier: 3 } },
  evidence: {
    kind: "expense_stats",
    stats: { window_days: 30, sample_size: 6, median: 0, mad: 0, multiplier: 3, threshold: 0, scope: "category" },
    total_rows: 2,
    truncated: false,
    rows: [
      {
        history_id: "98877",
        created_at: "2026-11-16T08:55:00.000Z",
        amount: 900_000,
        cashbox_name: "Asosiy kassa",
        created_by: null,
        is_trigger: true,
        href: "/payments/main-cashbox?history=98877",
      },
      {
        history_id: "98100",
        created_at: "2026-11-10T08:00:00.000Z",
        amount: 0,
        cashbox_name: null,
        created_by: { id: "391", name: null },
        is_trigger: false,
        href: "/payments/cash-detail/9?type=branch&history=98100",
      },
    ],
  },
};

/** R4 / R5 — market va filial nomi olinmagan. */
const r4 = {
  ...base,
  id: "2004",
  rule_key: "R4",
  title: "#55: 9 kundan beri to'lov yo'q, qarz 3 120 000 so'm",
  branch: null,
  subject: { kind: "market", id: "55", name: null },
  headline_amount: 3_120_000,
  facts: { market: { id: "55", name: null }, debt: 3_120_000, days_without_payout: 9, last_payout_at: null, last_payout_amount: null },
};
const r5 = {
  ...base,
  id: "2005",
  rule_key: "R5",
  title: "#12 kassasida 6 400 000 so'm — HQ'ga 4 kundan beri o'tkazma yo'q",
  branch: { id: "12", name: null },
  subject: { kind: "branch", id: "12", name: null },
  headline_amount: 6_400_000,
  facts: {
    branch: { id: "12", name: null },
    balance: 6_400_000,
    days_without_transfer: 4,
    last_transfer_at: "2026-11-10T13:40:00.000Z",
    last_transfer_amount: 3_180_000,
  },
};

/** R7 chek — so'mda emas (`currency`), o'tkazma (`branch_to_hq`, jo'natuvchi — filial kassasi), dalil `date_day`. */
const r7Receipt = {
  ...base,
  id: "2007",
  rule_key: "R7",
  severity: "critical",
  title: "#12 · filial → HQ o'tkazma cheki: chek so'mda emas (100 USD), kiritilgan 1 250 000 so'm. Pul HQ kartasiga tushmagan",
  branch: { id: "12", name: null },
  subject: { kind: "cashbox", id: "12", name: null },
  headline_amount: null,
  facts: {
    source: "receipt",
    receipt_kind: "branch_to_hq",
    receipt_ai_enabled: null,
    mismatch: ["currency", "card"],
    cashbox: { type: "branch", owner_id: "12", name: null },
    branch: { id: "12", name: null },
    entered_amount: 1_250_000,
    read_amount: null,
    read_amount_original: 100,
    read_currency: "USD",
    difference: null,
    operation: { history_id: "99300", kind: "branch_to_hq", category_name: null },
    shift: null,
    card: null,
    created_by: { id: "402", name: null },
    created_at: "2026-11-16T08:55:00.000Z",
  },
  rule: { key: "R7", severity: "critical", thresholds: {} },
  evidence: {
    kind: "receipt_check",
    total_rows: 1,
    truncated: false,
    receipt: {
      id: "5540",
      kind: "branch_to_hq",
      ai_status: "mismatch",
      flags: ["card_mismatch"],
      date: "16.11.2026",
      date_at: null,
      date_day: null,
      amount: 100,
      currency: "USD",
      error_reason: "currency_not_uzs",
      recipient: null,
      recipient_last4: "1209",
      payer: null,
      payer_last4: null,
      bank: null,
      reference: null,
      confidence: 0.81,
    },
    week_summary: { from: "2026-11-16", to: "2026-11-22", checked: 12, match: 9, mismatch: 2, unreadable: 1 },
  },
  links: [{ kind: "operation", href: "/payments/cash-detail/12?type=branch&history=99300", entity_id: "99300", primary: true }],
};

/** R7 karta qoldig'i — haqiqiy farq (`system_difference`), karta nomi olinmagan. */
const r7Card = {
  ...base,
  id: "2008",
  rule_key: "R7",
  severity: "critical",
  title: "Asosiy kassa · karta: AI o'qigan 2 310 000 so'm, tizimda 2 350 000 so'm (−40 000 so'm)",
  branch: null,
  subject: { kind: "cashbox", id: "0", name: "Asosiy kassa" },
  headline_amount: -40_000,
  facts: {
    source: "card_balance",
    receipt_ai_enabled: true,
    mismatch: ["amount"],
    cashbox: { type: "main", owner_id: "0", name: "Asosiy kassa" },
    branch: null,
    entered_amount: 2_310_000,
    read_amount: 2_310_000,
    difference: 0,
    expected_balance: 2_350_000,
    system_difference: -40_000,
    entered_ok: true,
    operation: null,
    shift: { id: "9001", date: "2026-11-15" },
    card: { id: "3", name: null },
    created_by: null,
    created_at: "2026-11-15T16:00:00.000Z",
  },
  rule: { key: "R7", severity: "critical", thresholds: {} },
  evidence: {
    kind: "card_balance_check",
    total_rows: 1,
    truncated: false,
    shift: { id: "9001", date: "2026-11-15", closed_at: "2026-11-15T16:00:00.000Z" },
    card: { id: "3", name: null },
    entered_balance: 2_310_000,
    ai_read_balance: 2_310_000,
    expected_balance: 2_350_000,
    difference: 0,
    system_difference: -40_000,
    ai_confidence: 0.93,
  },
  links: [{ kind: "shift_report", href: "/payments/shifts/9001", entity_id: "9001", primary: true }],
};

/** R8 — baza 0 (`ratio: null`), «Butun tizim», `baseline.{min_count, ratio}`, `rule.thresholds.min_count`. */
const r8 = {
  ...base,
  id: "2009",
  rule_key: "R8",
  title: "09.11.2026–15.11.2026: 4 ta tuzatish",
  branch: null,
  subject: { kind: "system", id: null, name: "Butun tizim" },
  headline_amount: null,
  facts: { from: "2026-11-09", to: "2026-11-15", count: 4, baseline_weekly_avg: 0, ratio: null },
  rule: { key: "R8", severity: "warning", thresholds: { ratio: 2, min_count: 3 } },
  evidence: {
    kind: "corrections",
    total_rows: 7,
    truncated: false,
    by_kind: { manual_correction: 4, order_rollback: 1, payment_reverse: 0, payment_edit: 0 },
    counted_kinds: ["manual_correction", "payment_reverse", "payment_edit"],
    days: [
      { date: "2026-11-09", count: 0 },
      { date: "2026-11-10", count: 2 },
      { date: "2026-11-11", count: 0 },
      { date: "2026-11-12", count: 1 },
      { date: "2026-11-13", count: 0 },
      { date: "2026-11-14", count: 1 },
      { date: "2026-11-15", count: 0 },
    ],
    baseline: { window_days: 30, total: 0, weekly_avg: 0, min_count: 3, ratio: 2 },
  },
  links: [{ kind: "corrections", href: "/payments/main-cashbox", entity_id: null, primary: true }],
};

const LIST_KEYS = [
  "id",
  "rule_key",
  "severity",
  "status",
  "title",
  "branch",
  "subject",
  "headline_amount",
  "facts",
  "occurrences",
  "first_at",
  "last_at",
  "first_fact_at",
  "last_fact_at",
  "explanation_status",
  "reopened_from_id",
] as const;

const listItemOf = (alert: Record<string, unknown>) => Object.fromEntries(LIST_KEYS.map((key) => [key, alert[key]]));

describe("backend dev javobi — ro'yxat qatori va tafsilot maydonlari yo'qolmaydi", () => {
  it.each([r1, r3, r4, r5, r7Receipt, r7Card, r8])("ro'yxat qatori $id ($rule_key) — ma'lum qoida, maydonlar o'zgarishsiz", (alert) => {
    const item = normalizeAlertListItem(listItemOf(alert));
    expect(item?.facts).not.toBeNull();
    expect(item).toMatchObject(listItemOf(alert));
  });

  it.each([r3, r7Receipt, r7Card, r8])("tafsilot $id ($rule_key) — dalil va qoida snapshoti o'zgarishsiz", (alert) => {
    const payload = { ...detailExtra, ...alert };
    const detail = normalizeAlertDetail(advisorEnvelope(payload, 200, "AI advisor alert"));
    expect(detail.facts).not.toBeNull();
    expect(detail.evidence).not.toBeNull();
    expect(detail).toMatchObject(payload);
  });

  it("R7: `operation.kind` eski / noma'lum bo'lsa — `receipt_kind` zaxirasi (operatsiya qatori yo'qolmaydi)", () => {
    const item = normalizeAlertListItem({
      ...listItemOf(r7Receipt),
      facts: { ...r7Receipt.facts, operation: { history_id: "99300", kind: "branch_to_main", category_name: null } },
    });
    expect(item?.facts).toMatchObject({ operation: { history_id: "99300", kind: "branch_to_hq", category_name: null } });
  });

  it("R7: noma'lum `mismatch` qiymati tashlanadi, takror — bitta", () => {
    const item = normalizeAlertListItem({
      ...listItemOf(r7Receipt),
      facts: { ...r7Receipt.facts, mismatch: ["currency", "future", "currency"] },
    });
    expect(item?.facts).toMatchObject({ mismatch: ["currency"] });
  });
});

describe("backend dev sozlamalari — R8 `min_count` (Q12: UI'da yo'q, lekin saqlanadi)", () => {
  /** `GET /ai/advisor/settings` — qator yo'q: `version: 1`, sukutlar (`aiAdvisorDefaultRules`, `AI_ADVISOR_RULE_LIMITS`). */
  const settings = {
    version: 1,
    rules: {
      R1: { enabled: true, severity: "warning", telegram: true, shortage_uzs: 50_000, consecutive_negative: 3 },
      R2: { enabled: true, severity: "critical", telegram: true, balance_uzs: 2_000_000, growth_days: 3, no_handover_days: 3 },
      R3: { enabled: true, severity: "warning", telegram: true, mad_multiplier: 3 },
      R4: { enabled: true, severity: "warning", telegram: true, days_without_payout: 7 },
      R5: { enabled: true, severity: "warning", telegram: true, balance_uzs: 5_000_000, days_without_transfer: 3 },
      R6: { enabled: true, severity: "critical", telegram: true },
      R7: { enabled: true, severity: "critical", telegram: false },
      R8: { enabled: true, severity: "warning", telegram: true, ratio: 2, min_count: 3 },
    },
    limits: {
      rules: {
        R1: {
          shortage_uzs: { min: 1, max: 1_000_000_000, step: 1, unit: "uzs", default: 50_000 },
          consecutive_negative: { min: 2, max: 30, step: 1, unit: "count", default: 3 },
        },
        R2: {
          balance_uzs: { min: 1, max: 1_000_000_000, step: 1, unit: "uzs", default: 2_000_000 },
          growth_days: { min: 1, max: 60, step: 1, unit: "days", default: 3 },
          no_handover_days: { min: 1, max: 60, step: 1, unit: "days", default: 3 },
        },
        R3: { mad_multiplier: { min: 1, max: 10, step: 0.1, unit: "multiplier", default: 3 } },
        R4: { days_without_payout: { min: 1, max: 60, step: 1, unit: "days", default: 7 } },
        R5: {
          balance_uzs: { min: 1, max: 1_000_000_000, step: 1, unit: "uzs", default: 5_000_000 },
          days_without_transfer: { min: 1, max: 60, step: 1, unit: "days", default: 3 },
        },
        R6: {},
        R7: {},
        R8: {
          ratio: { min: 1.1, max: 10, step: 0.1, unit: "multiplier", default: 2 },
          min_count: { min: 1, max: 50, step: 1, unit: "count", default: 3 },
        },
      },
    },
    telegram: null,
    budget: null,
    schedule: null,
    updated_at: null,
    updated_by: null,
  };

  it("GET — har maydon o'zgarishsiz (R8 `min_count` qiymati va chegarasi ham)", () => {
    expect(normalizeSettings(advisorEnvelope(settings, 200, "AI advisor settings"))).toEqual(settings);
  });

  it("`limits` yo'q (eski javob) — R8 `min_count` zaxirasi va sukuti (3)", () => {
    const { limits: _limits, ...rest } = settings;
    void _limits;
    const normalized = normalizeSettings({ ...rest, rules: { ...settings.rules, R8: { enabled: false } } });
    expect(normalized.rules.R8).toEqual({ enabled: false, severity: "warning", telegram: true, ratio: 2, min_count: 3 });
    expect(normalized.limits.rules.R8.min_count).toEqual({ min: 1, max: 50, step: 1, unit: "count", default: 3 });
  });
});
