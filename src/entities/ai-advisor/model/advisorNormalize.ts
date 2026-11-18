import {
  AI_ADVISOR_ALERT_STATUSES,
  AI_ADVISOR_CORRECTION_KINDS,
  AI_ADVISOR_EXPLANATION_STATUSES,
  AI_ADVISOR_RECEIPT_KINDS,
  AI_ADVISOR_RECEIPT_MISMATCHES,
  AI_ADVISOR_RULE_KEYS,
  AI_ADVISOR_SEVERITIES,
  AI_ADVISOR_THRESHOLD_FIELDS,
  type AiAdvisorAlertDetail,
  type AiAdvisorAlertListData,
  type AiAdvisorAlertListItem,
  type AiAdvisorAlertStatus,
  type AiAdvisorBranchRef,
  type AiAdvisorCashboxRef,
  type AiAdvisorCorrectionKind,
  type AiAdvisorEvidence,
  type AiAdvisorExplainResult,
  type AiAdvisorFactsByRule,
  type AiAdvisorFieldLimit,
  type AiAdvisorHistoryEvent,
  type AiAdvisorLink,
  type AiAdvisorNamedRef,
  type AiAdvisorOverview,
  type AiAdvisorOverviewBudget,
  type AiAdvisorRuleKey,
  type AiAdvisorRuleLimits,
  type AiAdvisorRuleSettings,
  type AiAdvisorRuleSnapshot,
  type AiAdvisorSettings,
  type AiAdvisorSubject,
  type AiAdvisorThresholds,
  type AiAdvisorUserRef,
} from "./advisorTypes";
import { DEFAULT_RULE_LIMITS, RULE_SEVERITY_DEFAULT, RULE_TELEGRAM_DEFAULT, isAlertId, isRuleKey } from "./advisorRules";
import { unwrapData } from "./normalize";

/**
 * API javoblari → `advisorTypes` (snake_case, nomlar o'zgarmaydi). Konvert `{statusCode, message, data}` olib
 * tashlanadi. Shakl qat'iy tekshiriladigan joylar — `AdvisorShapeError` tashlaydi: `overview` (mavjudlik zondi —
 * boshqa javob, masalan e2e mock'ining `{items, meta}`, «backend yo'q» deb o'qiladi), ro'yxat (`items` massiv emas),
 * tafsilot (ID / holat yo'q), izoh javobi va sozlamalar (`version`, `rules`). Qolgan joyda — himoyaviy: buzilgan
 * qator tashlanadi, ma'lum qoidaning fakti buzilgan bo'lsa — umumiy ko'rinish (`facts: null`), noma'lum dalil —
 * `evidence: null`, xavfli `href` (`javascript:`, `//host`) — havola tashlanadi.
 */

export class AdvisorShapeError extends Error {
  constructor(where: string) {
    super(`AI maslahatchi javobi kutilgan shaklda emas: ${where}`);
    this.name = "AdvisorShapeError";
  }
}

export const isAdvisorShapeError = (error: unknown): error is AdvisorShapeError =>
  error instanceof AdvisorShapeError || (error instanceof Error && error.name === "AdvisorShapeError");

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** ID: son yoki bo'sh bo'lmagan satr → satr. */
const idOf = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null);

const nonEmptyText = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/** Son (backend `numeric` ba'zan satr bo'lishi mumkin) — chekli bo'lmasa `null`. */
const numOf = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const countOf = (value: unknown, fallback = 0): number => {
  const num = numOf(value);
  return num === null ? fallback : Math.max(0, Math.trunc(num));
};

const boolOf = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

/** Uch qiymatli bayroq (backend `boolean | null`): boolean bo'lmasa — `null`. */
const flagOf = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

/** Valyuta kodi / yozuvi (server qiymati, faqat chetdagi bo'sh joysiz); bo'sh — `null`. Ko'rsatishda — katta harf. */
const currencyOf = (value: unknown): string | null => nonEmptyText(value)?.trim() ?? null;

const dateTimeOf = (value: unknown): string | null => nonEmptyText(value);

/** Toshkent kuni `YYYY-MM-DD` (vaqt qismi bo'lsa ham kun olinadi). */
const dayOf = (value: unknown): string | null => {
  const match = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})/.exec(value.trim()) : null;
  return match ? match[1] : null;
};

const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | null =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : null;

/**
 * Ilova ichidagi nisbiy yo'l: `/` bilan boshlanadi, `//` (boshqa sayt) va `/\` emas, bo'sh joy va boshqaruv belgisisiz.
 * Server oq ro'yxatidan keladi (`WEB_ROUTES`), lekin `<Link to>` ga tushgani uchun bu yerda ham tekshiriladi.
 */
export const safeAppHref = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/\\")) return null;
  for (const char of href) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return null;
  }
  return href;
};

/** Ism snapshoti: bo'sh / yo'q — `null` (backend ism olinmasa `null` yuboradi — FE «#id», xato emas). */
const nameOf = (value: unknown): string | null => nonEmptyText(value)?.trim() ?? null;

/** Nomli havola (odam, filial, market, kategoriya, karta): `id` majburiy, `name` — `null` bo'lishi mumkin. */
const namedRefOf = (value: unknown): AiAdvisorNamedRef | null => {
  const raw = asRecord(value);
  const id = idOf(raw?.id);
  if (!raw || !id) return null;
  return { id, name: nameOf(raw.name) };
};

const userRefOf = (value: unknown): AiAdvisorUserRef | null => namedRefOf(value);

const branchRefOf = (value: unknown): AiAdvisorBranchRef | null => namedRefOf(value);

const CASHBOX_TYPES = ["main", "branch", "couriers", "markets"] as const;

/** Kassa: `type` majburiy; `name` olinmasa — `null` (`advisorCashboxName`). */
const cashboxRefOf = (value: unknown): AiAdvisorCashboxRef | null => {
  const raw = asRecord(value);
  const type = oneOf(raw?.type, CASHBOX_TYPES);
  if (!raw || !type) return null;
  return { type, owner_id: idOf(raw.owner_id) ?? "0", name: nameOf(raw.name) };
};

const SUBJECT_KINDS = ["branch", "courier", "market", "cashbox", "system"] as const;

const subjectOf = (value: unknown): AiAdvisorSubject => {
  const raw = asRecord(value);
  return {
    kind: oneOf(raw?.kind, SUBJECT_KINDS) ?? "system",
    id: idOf(raw?.id),
    name: nameOf(raw?.name),
  };
};

const linkOf = (value: unknown): AiAdvisorLink | null => {
  const raw = asRecord(value);
  const kind = nonEmptyText(raw?.kind)?.trim();
  const href = safeAppHref(raw?.href);
  if (!raw || !kind || !href) return null;
  return { kind, href, entity_id: idOf(raw.entity_id), primary: raw.primary === true };
};

const defined = <T>(value: T | null): value is T => value !== null;

// ── Faktlar ────────────────────────────────────────────────────────────────────────────────────────────────

type FactsNormalizer<R extends AiAdvisorRuleKey> = (raw: Raw) => AiAdvisorFactsByRule[R] | null;

const FACTS: { [R in AiAdvisorRuleKey]: FactsNormalizer<R> } = {
  R1: (raw) => {
    const trigger = oneOf(raw.trigger, ["single_shortage", "consecutive_negative"] as const);
    const cashbox = cashboxRefOf(raw.cashbox);
    const total = numOf(raw.total_difference);
    const last = numOf(raw.last_difference);
    if (!trigger || !cashbox || total === null || last === null) return null;
    return {
      trigger,
      cashbox,
      branch: branchRefOf(raw.branch),
      shifts_count: countOf(raw.shifts_count, 1),
      total_difference: total,
      last_difference: last,
      closed_by: asArray(raw.closed_by).map(userRefOf).filter(defined),
      last_shift_id: idOf(raw.last_shift_id) ?? "",
      streak_length: numOf(raw.streak_length) === null ? null : countOf(raw.streak_length),
      streak_total: numOf(raw.streak_total),
    };
  },
  R2: (raw) => {
    const trigger = oneOf(raw.trigger, ["growth", "no_handover", "both"] as const);
    const courier = userRefOf(raw.courier);
    const balance = numOf(raw.balance);
    if (!trigger || !courier || balance === null) return null;
    const daysWithout = numOf(raw.days_without_handover);
    return {
      trigger,
      courier,
      branch: branchRefOf(raw.branch),
      balance,
      growth_days: countOf(raw.growth_days),
      days_without_handover: daysWithout === null ? null : Math.max(0, Math.trunc(daysWithout)),
      last_handover_at: dateTimeOf(raw.last_handover_at),
    };
  },
  R3: (raw) => {
    const amount = numOf(raw.amount);
    const category = namedRefOf(raw.category);
    const cashbox = cashboxRefOf(raw.cashbox);
    if (amount === null || !category || !cashbox) return null;
    return {
      history_id: idOf(raw.history_id) ?? "",
      amount,
      category,
      cashbox,
      branch: branchRefOf(raw.branch),
      created_by: userRefOf(raw.created_by),
      created_at: dateTimeOf(raw.created_at) ?? "",
      median: numOf(raw.median) ?? 0,
      mad: numOf(raw.mad) ?? 0,
      threshold: numOf(raw.threshold) ?? 0,
      ratio_to_median: numOf(raw.ratio_to_median),
      sample_size: countOf(raw.sample_size),
      window_days: countOf(raw.window_days, 30),
      scope: oneOf(raw.scope, ["category_branch", "category"] as const) ?? "category_branch",
    };
  },
  R4: (raw) => {
    const market = namedRefOf(raw.market);
    const debt = numOf(raw.debt);
    const days = numOf(raw.days_without_payout);
    if (!market || debt === null || days === null) return null;
    return {
      market,
      debt,
      days_without_payout: Math.max(0, Math.trunc(days)),
      last_payout_at: dateTimeOf(raw.last_payout_at),
      last_payout_amount: numOf(raw.last_payout_amount),
    };
  },
  R5: (raw) => {
    const branch = branchRefOf(raw.branch);
    const balance = numOf(raw.balance);
    const days = numOf(raw.days_without_transfer);
    if (!branch || balance === null || days === null) return null;
    return {
      branch,
      balance,
      days_without_transfer: Math.max(0, Math.trunc(days)),
      last_transfer_at: dateTimeOf(raw.last_transfer_at),
      last_transfer_amount: numOf(raw.last_transfer_amount),
    };
  },
  R6: (raw) => {
    const period = oneOf(raw.period, ["day", "week"] as const);
    const from = dayOf(raw.from);
    const to = dayOf(raw.to);
    const net = numOf(raw.net);
    if (!period || !from || !to || net === null) return null;
    return { period, from, to, income: numOf(raw.income) ?? 0, expense: numOf(raw.expense) ?? 0, net };
  },
  R7: (raw) => {
    const source = oneOf(raw.source, ["receipt", "card_balance"] as const);
    const cashbox = cashboxRefOf(raw.cashbox);
    if (!source || !cashbox) return null;
    const receiptKind = oneOf(raw.receipt_kind, AI_ADVISOR_RECEIPT_KINDS);
    const operation = asRecord(raw.operation);
    // `operation.kind` — chek turi (round-3); eski / boshqa qiymatda — `receipt_kind` zaxirasi (#654 round-2).
    const operationKind = oneOf(operation?.kind, AI_ADVISOR_RECEIPT_KINDS) ?? receiptKind;
    const shift = asRecord(raw.shift);
    const shiftId = idOf(shift?.id);
    return {
      source,
      receipt_kind: receiptKind,
      receipt_ai_enabled: flagOf(raw.receipt_ai_enabled),
      mismatch: [
        ...new Set(asArray(raw.mismatch).map((item) => oneOf(item, AI_ADVISOR_RECEIPT_MISMATCHES)).filter(defined)),
      ],
      cashbox,
      branch: branchRefOf(raw.branch),
      entered_amount: numOf(raw.entered_amount),
      read_amount: numOf(raw.read_amount),
      read_amount_original: numOf(raw.read_amount_original),
      read_currency: currencyOf(raw.read_currency),
      difference: numOf(raw.difference),
      expected_balance: numOf(raw.expected_balance),
      system_difference: numOf(raw.system_difference),
      entered_ok: flagOf(raw.entered_ok),
      operation:
        operation && operationKind
          ? {
              history_id: idOf(operation.history_id) ?? "",
              kind: operationKind,
              category_name: nonEmptyText(operation.category_name)?.trim() ?? null,
            }
          : null,
      shift: shift && shiftId ? { id: shiftId, date: dayOf(shift.date) ?? "" } : null,
      card: namedRefOf(raw.card),
      created_by: userRefOf(raw.created_by),
      created_at: dateTimeOf(raw.created_at),
    };
  },
  R8: (raw) => {
    const from = dayOf(raw.from);
    const to = dayOf(raw.to);
    const count = numOf(raw.count);
    if (!from || !to || count === null) return null;
    return {
      from,
      to,
      count: Math.max(0, Math.trunc(count)),
      baseline_weekly_avg: numOf(raw.baseline_weekly_avg) ?? 0,
      // Baza 0 (oldingi 30 kunda tuzatish bo'lmagan) — `null`, fakt tashlanmaydi (#653 review).
      ratio: numOf(raw.ratio),
    };
  },
};

/** Qoida fakti: tekshirilgan shakl yoki `null` (noma'lum qoida / buzilgan — umumiy ko'rinish). */
export const normalizeFacts = <R extends AiAdvisorRuleKey>(ruleKey: R, value: unknown): AiAdvisorFactsByRule[R] | null => {
  const raw = asRecord(value);
  return raw ? (FACTS[ruleKey] as FactsNormalizer<R>)(raw) : null;
};

// ── Ro'yxat qatori ─────────────────────────────────────────────────────────────────────────────────────────

/** Bitta qator yoki `null` (ID raqamli emas, holat noma'lum, sarlavha yo'q — ochib bo'lmaydi). */
export const normalizeAlertListItem = (value: unknown): AiAdvisorAlertListItem | null => {
  const raw = asRecord(value);
  const id = idOf(raw?.id);
  const status = oneOf(raw?.status, AI_ADVISOR_ALERT_STATUSES);
  const ruleKey = nonEmptyText(raw?.rule_key)?.trim();
  if (!raw || !isAlertId(id) || !status || !ruleKey) return null;
  const lastAt = dateTimeOf(raw.last_at) ?? "";
  const base = {
    id,
    severity: oneOf(raw.severity, AI_ADVISOR_SEVERITIES) ?? "warning",
    status,
    title: textOf(raw.title)?.trim() ?? "",
    branch: branchRefOf(raw.branch),
    subject: subjectOf(raw.subject),
    headline_amount: numOf(raw.headline_amount),
    occurrences: Math.max(1, countOf(raw.occurrences, 1)),
    first_at: dateTimeOf(raw.first_at) ?? lastAt,
    last_at: lastAt,
    first_fact_at: dateTimeOf(raw.first_fact_at) ?? dateTimeOf(raw.first_at) ?? lastAt,
    last_fact_at: dateTimeOf(raw.last_fact_at) ?? lastAt,
    explanation_status: oneOf(raw.explanation_status, AI_ADVISOR_EXPLANATION_STATUSES) ?? "none",
    reopened_from_id: idOf(raw.reopened_from_id),
  };
  if (isRuleKey(ruleKey)) {
    const facts = normalizeFacts(ruleKey, raw.facts);
    if (facts) return { ...base, rule_key: ruleKey, facts } as AiAdvisorAlertListItem;
  }
  return { ...base, rule_key: ruleKey, facts: null };
};

const byStatusOf = (value: unknown): Record<AiAdvisorAlertStatus, number> => {
  const raw = asRecord(value);
  return {
    new: countOf(raw?.new),
    seen: countOf(raw?.seen),
    resolved: countOf(raw?.resolved),
    dismissed: countOf(raw?.dismissed),
  };
};

/** `GET ai/advisor/alerts` → `{items, meta, counts}`; `items` massiv bo'lmasa — `AdvisorShapeError`. */
export const normalizeAlertList = (payload: unknown): AiAdvisorAlertListData => {
  const raw = asRecord(unwrapData(payload));
  if (!raw || !Array.isArray(raw.items)) throw new AdvisorShapeError("alerts.items");
  const items = raw.items.map(normalizeAlertListItem).filter(defined);
  const meta = asRecord(raw.meta);
  const limit = Math.max(1, countOf(meta?.limit, items.length || 10));
  const total = Math.max(items.length, countOf(meta?.total, items.length));
  return {
    items,
    meta: {
      page: Math.max(1, countOf(meta?.page, 1)),
      limit,
      total,
      totalPages: Math.max(1, countOf(meta?.totalPages, Math.ceil(total / limit))),
    },
    counts: { by_status: byStatusOf(asRecord(raw.counts)?.by_status) },
  };
};

// ── Tafsilot: qoida, dalillar ──────────────────────────────────────────────────────────────────────────────

const thresholdsOf = (value: unknown): AiAdvisorThresholds => {
  const raw = asRecord(value);
  const result: AiAdvisorThresholds = {};
  if (!raw) return result;
  for (const field of AI_ADVISOR_THRESHOLD_FIELDS) {
    const num = numOf(raw[field]);
    if (num !== null) result[field] = num;
  }
  return result;
};

const ruleSnapshotOf = (value: unknown, ruleKey: string, severity: AiAdvisorRuleSnapshot["severity"]): AiAdvisorRuleSnapshot => {
  const raw = asRecord(value);
  return {
    key: nonEmptyText(raw?.key)?.trim() ?? ruleKey,
    severity: oneOf(raw?.severity, AI_ADVISOR_SEVERITIES) ?? severity,
    thresholds: thresholdsOf(raw?.thresholds),
  };
};

const evidenceBase = (raw: Raw, rowCount: number) => ({
  total_rows: Math.max(rowCount, countOf(raw.total_rows, rowCount)),
  truncated: raw.truncated === true,
});

const payoutOf = (value: unknown) => {
  const raw = asRecord(value);
  const at = dateTimeOf(raw?.at);
  const amount = numOf(raw?.amount);
  if (!raw || !at || amount === null) return null;
  return { at, amount, history_id: idOf(raw.history_id) ?? "" };
};

const RECEIPT_AI_STATUSES = ["match", "mismatch", "unreadable", "pending", "error", "disabled"] as const;

const last4Of = (value: unknown): string | null => (typeof value === "string" && /^\d{4}$/.test(value) ? value : null);

type EvidenceNormalizer = (raw: Raw) => AiAdvisorEvidence | null;

const EVIDENCE: Record<AiAdvisorEvidence["kind"], EvidenceNormalizer> = {
  shifts: (raw) => {
    const rows = asArray(raw.rows)
      .map((value) => {
        const row = asRecord(value);
        const shiftId = idOf(row?.shift_id);
        const difference = numOf(row?.difference);
        if (!row || !shiftId || difference === null) return null;
        return {
          shift_id: shiftId,
          closed_at: dateTimeOf(row.closed_at) ?? "",
          closed_by: userRefOf(row.closed_by),
          closed_by_system: row.closed_by_system === true,
          expected_cash: numOf(row.expected_cash) ?? 0,
          expected_card: numOf(row.expected_card) ?? 0,
          counted_cash: numOf(row.counted_cash),
          counted_card: numOf(row.counted_card),
          expected: numOf(row.expected) ?? 0,
          counted: numOf(row.counted) ?? 0,
          difference,
          href: safeAppHref(row.href),
        };
      })
      .filter(defined);
    const totals = asRecord(raw.totals);
    return {
      kind: "shifts",
      ...evidenceBase(raw, rows.length),
      rows,
      totals: {
        count: countOf(totals?.count, rows.length),
        difference: numOf(totals?.difference) ?? rows.reduce((sum, row) => sum + row.difference, 0),
      },
    };
  },
  courier_days: (raw) => {
    const rows = asArray(raw.rows)
      .map((value) => {
        const row = asRecord(value);
        const date = dayOf(row?.date);
        if (!row || !date) return null;
        return {
          date,
          opening_balance: numOf(row.opening_balance) ?? 0,
          income: numOf(row.income) ?? 0,
          handed_over: numOf(row.handed_over) ?? 0,
          closing_balance: numOf(row.closing_balance) ?? 0,
        };
      })
      .filter(defined);
    return { kind: "courier_days", ...evidenceBase(raw, rows.length), rows, last_handover: payoutOf(raw.last_handover) };
  },
  expense_stats: (raw) => {
    const stats = asRecord(raw.stats);
    if (!stats) return null;
    const rows = asArray(raw.rows)
      .map((value) => {
        const row = asRecord(value);
        const amount = numOf(row?.amount);
        if (!row || amount === null) return null;
        return {
          history_id: idOf(row.history_id) ?? "",
          created_at: dateTimeOf(row.created_at) ?? "",
          amount,
          cashbox_name: nameOf(row.cashbox_name),
          created_by: userRefOf(row.created_by),
          is_trigger: row.is_trigger === true,
          href: safeAppHref(row.href),
        };
      })
      .filter(defined);
    return {
      kind: "expense_stats",
      ...evidenceBase(raw, rows.length),
      stats: {
        window_days: countOf(stats.window_days, 30),
        sample_size: countOf(stats.sample_size),
        median: numOf(stats.median) ?? 0,
        mad: numOf(stats.mad) ?? 0,
        multiplier: numOf(stats.multiplier) ?? 0,
        threshold: numOf(stats.threshold) ?? 0,
        scope: oneOf(stats.scope, ["category_branch", "category"] as const) ?? "category_branch",
      },
      rows,
    };
  },
  market_debt_days: (raw) => {
    const rows = asArray(raw.rows)
      .map((value) => {
        const row = asRecord(value);
        const date = dayOf(row?.date);
        if (!row || !date) return null;
        return { date, debt: numOf(row.debt) ?? 0, paid: numOf(row.paid) ?? 0 };
      })
      .filter(defined);
    return { kind: "market_debt_days", ...evidenceBase(raw, rows.length), rows, last_payout: payoutOf(raw.last_payout) };
  },
  branch_transfers: (raw) => {
    const days = asArray(raw.days)
      .map((value) => {
        const row = asRecord(value);
        const date = dayOf(row?.date);
        return row && date ? { date, closing_balance: numOf(row.closing_balance) ?? 0 } : null;
      })
      .filter(defined);
    const transfers = asArray(raw.transfers)
      .map((value) => {
        const row = asRecord(value);
        const at = dateTimeOf(row?.at);
        const amount = numOf(row?.amount);
        if (!row || !at || amount === null) return null;
        return { at, amount, history_id: idOf(row.history_id) ?? "", href: safeAppHref(row.href) };
      })
      .filter(defined);
    return { kind: "branch_transfers", ...evidenceBase(raw, Math.max(days.length, transfers.length)), days, transfers };
  },
  profit_days: (raw) => {
    const rows = asArray(raw.rows)
      .map((value) => {
        const row = asRecord(value);
        const date = dayOf(row?.date);
        if (!row || !date) return null;
        return {
          date,
          income: numOf(row.income) ?? 0,
          expense: numOf(row.expense) ?? 0,
          net: numOf(row.net) ?? 0,
          is_trigger: row.is_trigger === true,
        };
      })
      .filter(defined);
    const totals = asRecord(raw.totals);
    const sum = (key: "income" | "expense" | "net") => rows.reduce((acc, row) => acc + row[key], 0);
    return {
      kind: "profit_days",
      ...evidenceBase(raw, rows.length),
      rows,
      totals: {
        income: numOf(totals?.income) ?? sum("income"),
        expense: numOf(totals?.expense) ?? sum("expense"),
        net: numOf(totals?.net) ?? sum("net"),
      },
    };
  },
  receipt_check: (raw) => {
    const receipt = asRecord(raw.receipt);
    const id = idOf(receipt?.id);
    if (!receipt || !id) return null;
    const week = asRecord(raw.week_summary);
    const weekFrom = dayOf(week?.from);
    const weekTo = dayOf(week?.to);
    const confidence = numOf(receipt.confidence);
    return {
      kind: "receipt_check",
      ...evidenceBase(raw, 1),
      receipt: {
        id,
        kind: oneOf(receipt.kind, AI_ADVISOR_RECEIPT_KINDS),
        ai_status: oneOf(receipt.ai_status, RECEIPT_AI_STATUSES) ?? "mismatch",
        flags: asArray(receipt.flags).filter((flag): flag is string => typeof flag === "string"),
        date: nonEmptyText(receipt.date),
        date_at: dateTimeOf(receipt.date_at),
        date_day: dayOf(receipt.date_day),
        amount: numOf(receipt.amount),
        currency: currencyOf(receipt.currency),
        error_reason: nonEmptyText(receipt.error_reason)?.trim() ?? null,
        recipient: nonEmptyText(receipt.recipient)?.trim() ?? null,
        recipient_last4: last4Of(receipt.recipient_last4),
        payer: nonEmptyText(receipt.payer)?.trim() ?? null,
        payer_last4: last4Of(receipt.payer_last4),
        bank: nonEmptyText(receipt.bank)?.trim() ?? null,
        reference: nonEmptyText(receipt.reference)?.trim() ?? null,
        confidence: confidence === null ? null : Math.min(1, Math.max(0, confidence)),
      },
      week_summary:
        week && weekFrom && weekTo
          ? {
              from: weekFrom,
              to: weekTo,
              checked: countOf(week.checked),
              match: countOf(week.match),
              mismatch: countOf(week.mismatch),
              unreadable: countOf(week.unreadable),
            }
          : null,
    };
  },
  card_balance_check: (raw) => {
    const shift = asRecord(raw.shift);
    const shiftId = idOf(shift?.id);
    const card = namedRefOf(raw.card);
    const entered = numOf(raw.entered_balance);
    const read = numOf(raw.ai_read_balance);
    if (!shift || !shiftId || !card || entered === null || read === null) return null;
    const confidence = numOf(raw.ai_confidence);
    return {
      kind: "card_balance_check",
      ...evidenceBase(raw, 1),
      shift: { id: shiftId, date: dayOf(shift.date) ?? "", closed_at: dateTimeOf(shift.closed_at) },
      card,
      entered_balance: entered,
      ai_read_balance: read,
      expected_balance: numOf(raw.expected_balance),
      difference: numOf(raw.difference) ?? read - entered,
      system_difference: numOf(raw.system_difference),
      ai_confidence: confidence === null ? null : Math.min(1, Math.max(0, confidence)),
    };
  },
  corrections: (raw) => {
    const byKind = asRecord(raw.by_kind);
    if (!byKind) return null;
    const baseline = asRecord(raw.baseline);
    const days = asArray(raw.days)
      .map((value) => {
        const row = asRecord(value);
        const date = dayOf(row?.date);
        return row && date ? { date, count: countOf(row.count) } : null;
      })
      .filter(defined);
    return {
      kind: "corrections",
      ...evidenceBase(raw, days.length),
      by_kind: Object.fromEntries(AI_ADVISOR_CORRECTION_KINDS.map((kind) => [kind, countOf(byKind[kind])])) as Record<
        AiAdvisorCorrectionKind,
        number
      >,
      counted_kinds: asArray(raw.counted_kinds)
        .map((kind) => oneOf(kind, AI_ADVISOR_CORRECTION_KINDS))
        .filter(defined),
      days,
      baseline: {
        window_days: countOf(baseline?.window_days, 30),
        total: countOf(baseline?.total),
        weekly_avg: numOf(baseline?.weekly_avg) ?? 0,
        min_count: numOf(baseline?.min_count),
        ratio: numOf(baseline?.ratio),
      },
    };
  },
};

/** Dalil: `kind` bo'yicha; noma'lum tur yoki buzilgan shakl — `null` (blok chizilmaydi). */
export const normalizeEvidence = (value: unknown): AiAdvisorEvidence | null => {
  const raw = asRecord(value);
  const kind = typeof raw?.kind === "string" ? raw.kind : "";
  if (!raw || !Object.hasOwn(EVIDENCE, kind)) return null;
  return EVIDENCE[kind as AiAdvisorEvidence["kind"]](raw);
};

const HISTORY_EVENTS = ["opened", "occurred", "seen", "explained", "resolved", "dismissed"] as const;

const historyOf = (value: unknown): AiAdvisorHistoryEvent[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      const raw = asRecord(item);
      const at = dateTimeOf(raw?.at);
      const event = oneOf(raw?.event, HISTORY_EVENTS);
      if (!raw || !at || !event) return null;
      return { at, event, by: userRefOf(raw.by), note: nonEmptyText(raw.note) };
    })
    .filter(defined);
};

/** `GET/PATCH ai/advisor/alerts/:id` → tafsilot; qator qismi yaroqsiz bo'lsa — `AdvisorShapeError`. */
export const normalizeAlertDetail = (payload: unknown): AiAdvisorAlertDetail => {
  const raw = asRecord(unwrapData(payload));
  const base = normalizeAlertListItem(raw);
  if (!raw || !base) throw new AdvisorShapeError("alert");
  const reopened = asRecord(raw.reopened_from);
  const reopenedId = idOf(reopened?.id);
  const reopenedStatus = oneOf(reopened?.status, AI_ADVISOR_ALERT_STATUSES);
  const pollAfter = numOf(raw.explanation_poll_after_ms);
  const history = historyOf(raw.history);
  return {
    ...base,
    rule: ruleSnapshotOf(raw.rule, base.rule_key, base.severity),
    evidence: normalizeEvidence(raw.evidence),
    links: asArray(raw.links).map(linkOf).filter(defined),
    explanation_md: nonEmptyText(raw.explanation_md),
    explanation_error: oneOf(raw.explanation_error, ["budget_exceeded", "ai_disabled", "error"] as const),
    explanation_error_scope: oneOf(raw.explanation_error_scope, ["advisor", "global"] as const),
    explanation_retry_at: dateTimeOf(raw.explanation_retry_at),
    explanation_requested_at: dateTimeOf(raw.explanation_requested_at),
    explanation_poll_after_ms: pollAfter !== null && pollAfter > 0 ? Math.round(pollAfter) : null,
    explained_at: dateTimeOf(raw.explained_at),
    seen_at: dateTimeOf(raw.seen_at),
    seen_by: userRefOf(raw.seen_by),
    resolved_at: dateTimeOf(raw.resolved_at),
    resolved_by: userRefOf(raw.resolved_by),
    resolution_note: nonEmptyText(raw.resolution_note),
    reopened_from:
      reopened && reopenedId && reopenedStatus
        ? { id: reopenedId, status: reopenedStatus, resolved_at: dateTimeOf(reopened.resolved_at) }
        : null,
    ...(history ? { history } : {}),
  };
};

// ── Overview, izoh ─────────────────────────────────────────────────────────────────────────────────────────

const ruleKeysOf = (value: unknown): AiAdvisorRuleKey[] => [...new Set(asArray(value).filter(isRuleKey))];

const budgetOf = (value: unknown): AiAdvisorOverviewBudget | null => {
  const raw = asRecord(value);
  const scope = oneOf(raw?.scope, ["advisor", "global"] as const);
  const period = oneOf(raw?.period, ["month", "day"] as const);
  const ratio = numOf(raw?.ratio);
  if (!raw || !scope || !period || ratio === null) return null;
  return {
    scope,
    period,
    period_key: textOf(raw.period_key) ?? "",
    spent_usd: numOf(raw.spent_usd) ?? 0,
    spent_uzs: numOf(raw.spent_uzs) ?? 0,
    cap_usd: numOf(raw.cap_usd) ?? 0,
    override_usd: numOf(raw.override_usd) ?? 0,
    effective_cap_usd: numOf(raw.effective_cap_usd) ?? 0,
    ratio,
    warn_ratio: numOf(raw.warn_ratio) ?? 0,
    state: oneOf(raw.state, ["ok", "warn", "exceeded", "unknown"] as const) ?? "unknown",
    reset_at: dateTimeOf(raw.reset_at) ?? "",
    deep_used: numOf(raw.deep_used),
    deep_limit: numOf(raw.deep_limit),
  };
};

/**
 * `GET ai/advisor/overview` — mavjudlik zondi ham: `alerts.new/open/critical` son va `critical_rule_keys` massiv
 * bo'lmasa — `AdvisorShapeError` (javob boshqa endpoint'niki — «backend yo'q»).
 */
export const normalizeOverview = (payload: unknown): AiAdvisorOverview => {
  const raw = asRecord(unwrapData(payload));
  const alerts = asRecord(raw?.alerts);
  const counts = ["new", "open", "critical"].map((key) => numOf(alerts?.[key]));
  if (!raw || !alerts || counts.some((count) => count === null) || !Array.isArray(alerts.critical_rule_keys)) {
    throw new AdvisorShapeError("overview.alerts");
  }
  const [fresh, open, critical] = counts.map((count) => Math.max(0, Math.trunc(count as number)));
  const criticalRuleKeys = ruleKeysOf(alerts.critical_rule_keys);
  const recommendations = asRecord(raw.recommendations);
  return {
    alerts: {
      new: fresh,
      open,
      critical,
      critical_open: countOf(alerts.critical_open, critical),
      critical_rule_keys: criticalRuleKeys,
      critical_open_rule_keys: Array.isArray(alerts.critical_open_rule_keys)
        ? ruleKeysOf(alerts.critical_open_rule_keys)
        : criticalRuleKeys,
    },
    recommendations: recommendations && numOf(recommendations.new) !== null ? { new: countOf(recommendations.new) } : null,
    budget: budgetOf(raw.budget),
    usd_uzs_rate: numOf(raw.usd_uzs_rate),
    generated_at: dateTimeOf(raw.generated_at),
  };
};

/** `POST …/explain` → 202 `data`; `explanation_status` `pending | ready` bo'lmasa — `AdvisorShapeError`. */
export const normalizeExplainResult = (payload: unknown): AiAdvisorExplainResult => {
  const raw = asRecord(unwrapData(payload));
  const status = oneOf(raw?.explanation_status, ["pending", "ready"] as const);
  if (!raw || !status) throw new AdvisorShapeError("explain");
  const pollAfter = numOf(raw.poll_after_ms);
  return {
    alert_id: idOf(raw.alert_id) ?? "",
    explanation_status: status,
    explanation_md: nonEmptyText(raw.explanation_md),
    explained_at: dateTimeOf(raw.explained_at),
    cached: raw.cached === true,
    poll_after_ms: pollAfter !== null && pollAfter > 0 ? Math.round(pollAfter) : null,
  };
};

// ── Sozlamalar ─────────────────────────────────────────────────────────────────────────────────────────────

const LIMIT_UNITS = ["uzs", "days", "count", "multiplier"] as const;

const fieldLimitOf = (value: unknown, fallback: AiAdvisorFieldLimit | undefined): AiAdvisorFieldLimit | undefined => {
  const raw = asRecord(value);
  const min = numOf(raw?.min);
  const max = numOf(raw?.max);
  const step = numOf(raw?.step);
  const unit = oneOf(raw?.unit, LIMIT_UNITS);
  const def = numOf(raw?.default);
  if (min === null || max === null || step === null || step <= 0 || !unit || def === null || min > max) return fallback;
  return { min, max, step, unit, default: def };
};

/**
 * Qoida chegaralari. `useFallback` — server `limits` ni umuman bermagan (#644 dan oldingi / qisman javob): #644
 * zaxirasi. `limits` bor bo'lsa — u bitta manba (§7.6): server chegarasini bermagan (yoki noto'g'ri bergan) maydon
 * chegarasiz qoladi va sozlama oynasida chizilmaydi / PATCH ga kirmaydi (aks holda 400 `INVALID_SETTING`).
 */
const ruleLimitsOf = (key: AiAdvisorRuleKey, value: unknown, useFallback: boolean): AiAdvisorRuleLimits => {
  const raw = asRecord(value);
  const fallback: AiAdvisorRuleLimits = useFallback ? DEFAULT_RULE_LIMITS[key] : {};
  const result: AiAdvisorRuleLimits = {};
  for (const field of AI_ADVISOR_THRESHOLD_FIELDS) {
    const limit = fieldLimitOf(raw?.[field], fallback[field]);
    if (limit) result[field] = limit;
  }
  return result;
};

const ruleSettingsOf = (key: AiAdvisorRuleKey, value: unknown, limits: AiAdvisorRuleLimits): AiAdvisorRuleSettings => {
  const raw = asRecord(value);
  const rule: AiAdvisorRuleSettings = {
    enabled: boolOf(raw?.enabled, true),
    severity: oneOf(raw?.severity, AI_ADVISOR_SEVERITIES) ?? RULE_SEVERITY_DEFAULT[key],
    telegram: boolOf(raw?.telegram, RULE_TELEGRAM_DEFAULT[key]),
  };
  for (const field of AI_ADVISOR_THRESHOLD_FIELDS) {
    const limit = limits[field];
    if (!limit) continue;
    rule[field] = numOf(raw?.[field]) ?? limit.default;
  }
  return rule;
};

/**
 * `GET/PATCH ai/advisor/settings`. `version` (butun ≥ 1) va `rules` obyekti majburiy — aks holda `AdvisorShapeError`.
 * `limits` umuman yo'q — #644 zaxirasi; bor bo'lsa — faqat server bergan chegaralar (§7.6, bitta manba); qiymati yo'q
 * chegara — `limits.default`.
 */
export const normalizeSettings = (payload: unknown): AiAdvisorSettings => {
  const raw = asRecord(unwrapData(payload));
  const version = numOf(raw?.version);
  const rules = asRecord(raw?.rules);
  if (!raw || version === null || !Number.isInteger(version) || version < 1 || !rules) {
    throw new AdvisorShapeError("settings");
  }
  const limitRules = asRecord(asRecord(raw.limits)?.rules);
  const limits = {} as Record<AiAdvisorRuleKey, AiAdvisorRuleLimits>;
  const settingsRules = {} as Record<AiAdvisorRuleKey, AiAdvisorRuleSettings>;
  for (const key of AI_ADVISOR_RULE_KEYS) {
    limits[key] = ruleLimitsOf(key, limitRules?.[key], !limitRules);
    settingsRules[key] = ruleSettingsOf(key, rules[key], limits[key]);
  }
  const telegram = asRecord(raw.telegram);
  return {
    version,
    rules: settingsRules,
    limits: { rules: limits },
    telegram: telegram
      ? {
          enabled: telegram.enabled === true,
          ...(Array.isArray(telegram.recipients)
            ? {
                recipients: telegram.recipients
                  .map((item) => {
                    const row = asRecord(item);
                    const user = userRefOf(row?.user);
                    return row && user ? { user, telegram_connected: row.telegram_connected === true } : null;
                  })
                  .filter(defined),
              }
            : {}),
        }
      : null,
    budget: asRecord(raw.budget),
    schedule: asRecord(raw.schedule),
    updated_at: dateTimeOf(raw.updated_at),
    updated_by: userRefOf(raw.updated_by),
  };
};
