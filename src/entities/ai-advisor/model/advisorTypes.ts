/**
 * AI maslahatchi — ogohlantirishlar R1–R8 (60PWUbgC): API shartnomasi v0.3 (`openapi-fragment.json`) va backend dev
 * (#644, #651–#657 va review tuzatishlari: `libs/common/src/ai/advisor.contract.ts` — sozlamalar, `limits`, kodlar;
 * `finance-service/src/advisor/advisor-inputs.service.ts` — fakt va dalil shakllari; `FRONTEND_CHANGELOG.md`
 * «AI maslahatchi (BE-5 …)» yozuvlari — v0.4 eslatmalari). Maydon nomlari API'dagidek
 * (snake_case, 1:1) — suhbat tiplaridan (`types.ts`, camelCase) farqli ataylab: 9 ta dalil va 8 ta fakt shakli
 * nomini o'zgartirmasdan o'qiladi. Normallashtirish — `advisorNormalize.ts` (tekshiradi va sukut qo'yadi).
 *
 * Kelajakdagi qo'shimchalar (§13): noma'lum `rule_key` yoki buzilgan `facts` — `facts: null` (umumiy ko'rinish,
 * server `title`); noma'lum `evidence.kind` — `evidence: null` (dalil bloki chizilmaydi); noma'lum `links[].kind`
 * — satr sifatida qoladi (UI «Bo'limga o'tish»).
 */

export const AI_ADVISOR_RULE_KEYS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"] as const;
export type AiAdvisorRuleKey = (typeof AI_ADVISOR_RULE_KEYS)[number];

export const AI_ADVISOR_SEVERITIES = ["warning", "critical"] as const;
export type AiAdvisorSeverity = (typeof AI_ADVISOR_SEVERITIES)[number];

export const AI_ADVISOR_ALERT_STATUSES = ["new", "seen", "resolved", "dismissed"] as const;
export type AiAdvisorAlertStatus = (typeof AI_ADVISOR_ALERT_STATUSES)[number];

export const AI_ADVISOR_EXPLANATION_STATUSES = ["none", "pending", "ready", "failed"] as const;
export type AiAdvisorExplanationStatus = (typeof AI_ADVISOR_EXPLANATION_STATUSES)[number];

export const AI_ADVISOR_LINK_KINDS = [
  "shift_report",
  "operation",
  "courier_cashbox",
  "market_cashbox",
  "branch_cashbox",
  "main_cashbox",
  "financial_balance",
  "corrections",
] as const;
export type AiAdvisorLinkKind = (typeof AI_ADVISOR_LINK_KINDS)[number];

/** «Hal qilindi» izohi: trim'dan keyin 3–500 belgi; «Ahamiyatsiz» — ixtiyoriy, ≤ 500 (§7.5). */
export const AI_ADVISOR_NOTE_MIN = 3;
export const AI_ADVISOR_NOTE_MAX = 500;

/** Kodli xatolar (`PUBLIC_ERROR_CODES`, #644 `AI_ADVISOR_ERROR_CODES`). */
export const AI_ADVISOR_ERROR_CODES = {
  /** 404 */
  ALERT_NOT_FOUND: "AI_ADVISOR_ALERT_NOT_FOUND",
  /** 409 `{alert_status}` — boshqa superadmin yopgan (PATCH) yoki yopilganga izoh (explain). */
  ALERT_CLOSED: "AI_ADVISOR_ALERT_CLOSED",
  /** 400 `{reason: required|too_short|too_long, min_length, max_length}` */
  NOTE_INVALID: "AI_ADVISOR_NOTE_INVALID",
  /** 400 `{field, min, max}` — chegara `limits` dan tashqarida. */
  INVALID_RULE: "AI_ADVISOR_INVALID_RULE",
  /** 400 `{field}` — noma'lum kalit, `version` yo'q, `severity` (Q1), `telegram`/`budget`/`schedule`. */
  INVALID_SETTING: "AI_ADVISOR_INVALID_SETTING",
  /** 409 `{version}` — eskirgan `version` (optimistik qulf). */
  SETTINGS_CONFLICT: "AI_ADVISOR_SETTINGS_CONFLICT",
  /** 429 `{scope, period, reset_at, retry_after_seconds}` */
  BUDGET_EXCEEDED: "AI_ADVISOR_BUDGET_EXCEEDED",
  /** 503 `{reason}` */
  AI_DISABLED: "AI_ADVISOR_AI_DISABLED",
} as const;
export type AiAdvisorErrorCode = (typeof AI_ADVISOR_ERROR_CODES)[keyof typeof AI_ADVISOR_ERROR_CODES];

// ── Havolalar (ID — bigint satr, `^\d{1,18}$`) ──────────────────────────────────────────────────────────────

/**
 * Nomli havola (odam, filial, market, kategoriya, karta). Backend ism snapshotini ochilish paytida oladi; olinmasa —
 * `name: null` («ism olinmasa name: null (FE «#id» ko'rsatadi) — xato emas», §3.5) — `advisorRefName`.
 */
export interface AiAdvisorNamedRef {
  id: string;
  name: string | null;
}

/** Odam; `name: null` — FE «#<id>» ko'rsatadi (§3.5). */
export type AiAdvisorUserRef = AiAdvisorNamedRef;

export type AiAdvisorBranchRef = AiAdvisorNamedRef;

export type AiAdvisorMarketRef = AiAdvisorNamedRef;

export type AiAdvisorCashboxType = "main" | "branch" | "couriers" | "markets";

/**
 * Kassa: `owner_id` — `cashboxes.user_id` (main va eski qatorlar — `"0"`). `name` — «Asosiy kassa», «Samarqand
 * filiali kassasi», kuryer/market ismi; olinmasa `null` (`advisorCashboxName`).
 */
export interface AiAdvisorCashboxRef {
  type: AiAdvisorCashboxType;
  owner_id: string;
  name: string | null;
}

export type AiAdvisorSubjectKind = "branch" | "courier" | "market" | "cashbox" | "system";

/**
 * Kim/nima haqida: R1/R3/R7 cashbox · R2 courier · R4 market · R5 branch · R6/R8 system (`name: "Butun tizim"`,
 * backend `AI_ADVISOR_SYSTEM_SUBJECT_NAME`). Ism olinmasa — `null`.
 */
export interface AiAdvisorSubject {
  kind: AiAdvisorSubjectKind;
  id: string | null;
  name: string | null;
}

/** Bo'limga havola (faqat navigatsiya): `href` — ilovaning nisbiy yo'li (`/` bilan, normallashtiruvchi tekshiradi). */
export interface AiAdvisorLink {
  /** `AiAdvisorLinkKind` yoki kelajakdagi yangi tur (UI — umumiy «Bo'limga o'tish»). */
  kind: string;
  href: string;
  entity_id: string | null;
  primary: boolean;
}

// ── Faktlar (`facts`) — `rule_key` bo'yicha (§5.3) ────────────────────────────────────────────────────────

export interface AiAdvisorFactsR1 {
  trigger: "single_shortage" | "consecutive_negative";
  cashbox: AiAdvisorCashboxRef;
  branch: AiAdvisorBranchRef | null;
  /** Ogohlantirishdagi barcha fakt-smenalar (ochiq ogohlantirishga qo'shilganlari bilan, #651 B1). */
  shifts_count: number;
  total_difference: number;
  last_difference: number;
  closed_by: AiAdvisorUserRef[];
  last_shift_id: string;
  /**
   * Uzluksiz manfiy qator — «N smena ketma-ket» va uning jami (birlashgan yakka kamomadlarsiz); faqat
   * `consecutive_negative`, aks holda `null` (#651 round-2).
   */
  streak_length: number | null;
  streak_total: number | null;
}

export interface AiAdvisorFactsR2 {
  trigger: "growth" | "no_handover" | "both";
  courier: AiAdvisorUserRef;
  branch: AiAdvisorBranchRef | null;
  balance: number;
  growth_days: number;
  days_without_handover: number | null;
  last_handover_at: string | null;
}

export type AiAdvisorExpenseScope = "category_branch" | "category";

export interface AiAdvisorFactsR3 {
  history_id: string;
  amount: number;
  category: AiAdvisorNamedRef;
  cashbox: AiAdvisorCashboxRef;
  branch: AiAdvisorBranchRef | null;
  created_by: AiAdvisorUserRef | null;
  created_at: string;
  median: number;
  mad: number;
  threshold: number;
  /** `amount / median` (bir kasr); mediana 0 bo'lsa — `null` (nisbatni aytib bo'lmaydi). */
  ratio_to_median: number | null;
  sample_size: number;
  window_days: number;
  scope: AiAdvisorExpenseScope;
}

export interface AiAdvisorFactsR4 {
  market: AiAdvisorMarketRef;
  debt: number;
  days_without_payout: number;
  last_payout_at: string | null;
  last_payout_amount: number | null;
}

export interface AiAdvisorFactsR5 {
  branch: AiAdvisorBranchRef;
  balance: number;
  days_without_transfer: number;
  last_transfer_at: string | null;
  last_transfer_amount: number | null;
}

export interface AiAdvisorFactsR6 {
  period: "day" | "week";
  /** Toshkent kalendar kuni `YYYY-MM-DD`. */
  from: string;
  to: string;
  income: number;
  expense: number;
  net: number;
}

/**
 * R7 farq turi: `amount` — summa (> 1 so'm), `card` — karta (chekda: qo'lda chiqim — to'lov filial kartasidan emas,
 * o'tkazma — pul HQ kartasiga tushmagan; karta qoldig'ida — rasm boshqa kartaniki), `currency` — chek so'mda emas
 * (faqat chek; summa solishtirilmaydi). Karta qoldig'i ⊂ {amount, card}, chek ⊂ {amount, card, currency}; hech qachon
 * bo'sh emas (round-3).
 */
export const AI_ADVISOR_RECEIPT_MISMATCHES = ["amount", "card", "currency"] as const;
export type AiAdvisorReceiptMismatch = (typeof AI_ADVISOR_RECEIPT_MISMATCHES)[number];

/** Chek turi (`CASHBOX_RECEIPT_KINDS`): qo'lda chiqim yoki HQ'ga o'tkazma (kuryer / filial). */
export const AI_ADVISOR_RECEIPT_KINDS = ["manual_expense", "courier_to_hq", "branch_to_hq"] as const;
export type AiAdvisorReceiptKind = (typeof AI_ADVISOR_RECEIPT_KINDS)[number];
/** `facts.operation.kind` — chek turi (`source_type` emas, round-3). */
export type AiAdvisorOperationKind = AiAdvisorReceiptKind;

/**
 * R7 «Chek yoki karta farqi». Ikki manba bitta shaklda; manbaga xos maydonlar boshqasida `null`:
 *   chek (`receipt`) — `receipt_kind`, `read_amount_original` + `read_currency` (valyutali chek: `read_amount`,
 *     `difference`, `headline_amount` — `null`), `operation`; o'tkazmada `cashbox` — jo'natuvchi (kuryer / filial
 *     kassasi), `branch` — chek filiali;
 *   karta qoldig'i (`card_balance`) — `difference` = AI o'qigan − kiritilgan (kassir xatosi), `system_difference` =
 *     AI o'qigan − tizimdagi (`expected_balance`; haqiqiy farq), `entered_ok`, `shift`, `card`.
 */
export interface AiAdvisorFactsR7 {
  source: "receipt" | "card_balance";
  /** Chek turi (faqat chekda). */
  receipt_kind: AiAdvisorReceiptKind | null;
  /** Chek AI yoqiqmi; o'qib bo'lmasa — `null`. */
  receipt_ai_enabled: boolean | null;
  mismatch: AiAdvisorReceiptMismatch[];
  cashbox: AiAdvisorCashboxRef;
  branch: AiAdvisorBranchRef | null;
  entered_amount: number | null;
  read_amount: number | null;
  /** Valyutali chek: AI o'qigan summa o'z valyutasida (`read_currency`, «100 USD»). */
  read_amount_original: number | null;
  read_currency: string | null;
  difference: number | null;
  /** Karta qoldig'i: tizimdagi qoldiq; eski qatorda noma'lum — `null`. */
  expected_balance: number | null;
  /** Karta qoldig'i: AI o'qigan − tizimdagi (`null` — `expected_balance` noma'lum). */
  system_difference: number | null;
  /** Karta qoldig'i: kassir kiritgani AI o'qiganiga mosmi (AI bahosi). */
  entered_ok: boolean | null;
  operation: { history_id: string; kind: AiAdvisorOperationKind; category_name: string | null } | null;
  shift: { id: string; date: string } | null;
  card: AiAdvisorNamedRef | null;
  created_by: AiAdvisorUserRef | null;
  created_at: string | null;
}

export interface AiAdvisorFactsR8 {
  from: string;
  to: string;
  count: number;
  baseline_weekly_avg: number;
  /** `count / baseline_weekly_avg` (bir kasr); oldingi 30 kunda tuzatish bo'lmagan (baza 0) — `null`. */
  ratio: number | null;
}

export interface AiAdvisorFactsByRule {
  R1: AiAdvisorFactsR1;
  R2: AiAdvisorFactsR2;
  R3: AiAdvisorFactsR3;
  R4: AiAdvisorFactsR4;
  R5: AiAdvisorFactsR5;
  R6: AiAdvisorFactsR6;
  R7: AiAdvisorFactsR7;
  R8: AiAdvisorFactsR8;
}

// ── Ro'yxat qatori va tafsilot (§5.1–5.2) ─────────────────────────────────────────────────────────────────

interface AiAdvisorAlertBase {
  id: string;
  severity: AiAdvisorSeverity;
  status: AiAdvisorAlertStatus;
  /** Server o'zbekcha sarlavhasi (≤ 200) — FE asosan `rule_key + facts` dan quradi, noma'lum qoida — shu matn. */
  title: string;
  branch: AiAdvisorBranchRef | null;
  subject: AiAdvisorSubject;
  /** Sarlavhadagi summa (R8 — null, son `facts.count`). */
  headline_amount: number | null;
  occurrences: number;
  /** Birinchi / oxirgi aniqlash (qoida ishlagan) — «Oxirgi marta» ustuni `last_at`. */
  first_at: string;
  last_at: string;
  /** Birinchi / oxirgi fakt hodisasi — tafsilot ost-sarlavhasi. */
  first_fact_at: string;
  last_fact_at: string;
  explanation_status: AiAdvisorExplanationStatus;
  reopened_from_id: string | null;
}

/** Ma'lum qoida: `rule_key` bo'yicha toraytiriladi (`alert.facts !== null` dan keyin). */
export type AiAdvisorKnownAlert = {
  [R in AiAdvisorRuleKey]: AiAdvisorAlertBase & { rule_key: R; facts: AiAdvisorFactsByRule[R] };
}[AiAdvisorRuleKey];

/** Noma'lum qoida yoki fakt shakli buzilgan — umumiy ko'rinish (`title`). */
export type AiAdvisorGenericAlert = AiAdvisorAlertBase & { rule_key: string; facts: null };

export type AiAdvisorAlertListItem = AiAdvisorKnownAlert | AiAdvisorGenericAlert;

/** Qoida chegaralari (`rule.thresholds`, `settings.rules.<R>.*`, `limits.rules.<R>.*` — kalitlar aynan bir xil). */
export const AI_ADVISOR_THRESHOLD_FIELDS = [
  "shortage_uzs",
  "consecutive_negative",
  "balance_uzs",
  "growth_days",
  "no_handover_days",
  "mad_multiplier",
  "days_without_payout",
  "days_without_transfer",
  "ratio",
  "min_count",
] as const;
export type AiAdvisorThresholdField = (typeof AI_ADVISOR_THRESHOLD_FIELDS)[number];
export type AiAdvisorThresholds = Partial<Record<AiAdvisorThresholdField, number>>;

/** Ochilgan paytdagi qoida (snapshot): R6/R7 — `thresholds: {}`. */
export interface AiAdvisorRuleSnapshot {
  key: string;
  severity: AiAdvisorSeverity;
  thresholds: AiAdvisorThresholds;
}

// ── Dalillar (`evidence`) — `kind` diskriminatori (§5.4); hammasida `total_rows`, `truncated` (≤ 15 qator) ──

interface AiAdvisorEvidenceBase {
  total_rows: number;
  truncated: boolean;
}

export interface AiAdvisorShiftRow {
  shift_id: string;
  closed_at: string;
  closed_by: AiAdvisorUserRef | null;
  closed_by_system: boolean;
  expected_cash: number;
  expected_card: number;
  /** Sanalmagan qism — `null` (UI «—», «karta sanalmagan»). */
  counted_cash: number | null;
  counted_card: number | null;
  /** Faqat sanalgan qismlar bo'yicha: `counted − expected = difference`. */
  expected: number;
  counted: number;
  difference: number;
  href: string | null;
}

export interface AiAdvisorEvidenceShifts extends AiAdvisorEvidenceBase {
  kind: "shifts";
  rows: AiAdvisorShiftRow[];
  totals: { count: number; difference: number };
}

export interface AiAdvisorEvidenceCourierDays extends AiAdvisorEvidenceBase {
  kind: "courier_days";
  rows: Array<{ date: string; opening_balance: number; income: number; handed_over: number; closing_balance: number }>;
  last_handover: { at: string; amount: number; history_id: string } | null;
}

export interface AiAdvisorEvidenceExpenseStats extends AiAdvisorEvidenceBase {
  kind: "expense_stats";
  stats: {
    window_days: number;
    sample_size: number;
    median: number;
    mad: number;
    multiplier: number;
    threshold: number;
    scope: AiAdvisorExpenseScope;
  };
  rows: Array<{
    history_id: string;
    created_at: string;
    amount: number;
    /** Qator kassasi nomi (`scope: category` — har qator o'z kassasi); olinmasa `null`. */
    cashbox_name: string | null;
    created_by: AiAdvisorUserRef | null;
    is_trigger: boolean;
    href: string | null;
  }>;
}

export interface AiAdvisorEvidenceMarketDebtDays extends AiAdvisorEvidenceBase {
  kind: "market_debt_days";
  rows: Array<{ date: string; debt: number; paid: number }>;
  last_payout: { at: string; amount: number; history_id: string } | null;
}

export interface AiAdvisorEvidenceBranchTransfers extends AiAdvisorEvidenceBase {
  kind: "branch_transfers";
  days: Array<{ date: string; closing_balance: number }>;
  transfers: Array<{ at: string; amount: number; history_id: string; href: string | null }>;
}

export interface AiAdvisorEvidenceProfitDays extends AiAdvisorEvidenceBase {
  kind: "profit_days";
  rows: Array<{ date: string; income: number; expense: number; net: number; is_trigger: boolean }>;
  totals: { income: number; expense: number; net: number };
}

export type AiAdvisorReceiptAiStatus = "match" | "mismatch" | "unreadable" | "pending" | "error" | "disabled";

export interface AiAdvisorEvidenceReceiptCheck extends AiAdvisorEvidenceBase {
  kind: "receipt_check";
  receipt: {
    id: string;
    ai_status: AiAdvisorReceiptAiStatus;
    flags: string[];
    /** Chek turi (`facts.receipt_kind` bilan bir xil). */
    kind: AiAdvisorReceiptKind | null;
    /** Xom OCR matni (mintaqasiz) — UI `date_at` ni, keyin `date_day` ni afzal ko'radi. */
    date: string | null;
    /** Sana va vaqt o'qilgan bo'lsa (ISO); faqat sana yoki valyutali chek — `null`. */
    date_at: string | null;
    /** Faqat sana o'qilgan bo'lsa — `YYYY-MM-DD` (Toshkent kuni). */
    date_day: string | null;
    /** AI o'qigan summa chek valyutasida (`currency`). */
    amount: number | null;
    currency: string | null;
    /** `currency_not_uzs` va boshqalar (`entities/payments/receipt.ts`). */
    error_reason: string | null;
    /** PII: backend doim `null` yuboradi (faqat `*_last4`). */
    recipient: string | null;
    recipient_last4: string | null;
    payer: string | null;
    payer_last4: string | null;
    bank: string | null;
    reference: string | null;
    /** 0…1 */
    confidence: number | null;
  };
  week_summary: { from: string; to: string; checked: number; match: number; mismatch: number; unreadable: number } | null;
}

export interface AiAdvisorEvidenceCardBalanceCheck extends AiAdvisorEvidenceBase {
  kind: "card_balance_check";
  shift: { id: string; date: string; closed_at: string | null };
  card: AiAdvisorNamedRef;
  entered_balance: number;
  ai_read_balance: number;
  expected_balance: number | null;
  /** AI o'qigan − kiritilgan. */
  difference: number;
  /** AI o'qigan − tizimdagi. */
  system_difference: number | null;
  ai_confidence: number | null;
}

export const AI_ADVISOR_CORRECTION_KINDS = ["manual_correction", "order_rollback", "payment_reverse", "payment_edit"] as const;
export type AiAdvisorCorrectionKind = (typeof AI_ADVISOR_CORRECTION_KINDS)[number];

export interface AiAdvisorEvidenceCorrections extends AiAdvisorEvidenceBase {
  kind: "corrections";
  by_kind: Record<AiAdvisorCorrectionKind, number>;
  counted_kinds: AiAdvisorCorrectionKind[];
  days: Array<{ date: string; count: number }>;
  /** `min_count`, `ratio` — ochilgan paytdagi qoida chegaralari (`count ≥ max(min_count, ratio × weekly_avg)`). */
  baseline: { window_days: number; total: number; weekly_avg: number; min_count: number | null; ratio: number | null };
}

export type AiAdvisorEvidence =
  | AiAdvisorEvidenceShifts
  | AiAdvisorEvidenceCourierDays
  | AiAdvisorEvidenceExpenseStats
  | AiAdvisorEvidenceMarketDebtDays
  | AiAdvisorEvidenceBranchTransfers
  | AiAdvisorEvidenceProfitDays
  | AiAdvisorEvidenceReceiptCheck
  | AiAdvisorEvidenceCardBalanceCheck
  | AiAdvisorEvidenceCorrections;

export type AiAdvisorEvidenceKind = AiAdvisorEvidence["kind"];

export type AiAdvisorExplanationError = "budget_exceeded" | "ai_disabled" | "error";
export type AiAdvisorBudgetScope = "advisor" | "global";
export type AiAdvisorBudgetPeriod = "month" | "day";

export interface AiAdvisorHistoryEvent {
  at: string;
  event: "opened" | "occurred" | "seen" | "explained" | "resolved" | "dismissed";
  by: AiAdvisorUserRef | null;
  note: string | null;
}

interface AiAdvisorAlertDetailExtra {
  rule: AiAdvisorRuleSnapshot;
  /** `null` — noma'lum `kind` yoki buzilgan shakl (dalil bloki chizilmaydi). */
  evidence: AiAdvisorEvidence | null;
  links: AiAdvisorLink[];
  explanation_md: string | null;
  explanation_error: AiAdvisorExplanationError | null;
  explanation_error_scope: AiAdvisorBudgetScope | null;
  explanation_retry_at: string | null;
  explanation_requested_at: string | null;
  /** Faqat `pending`: poll oralig'i (ms). */
  explanation_poll_after_ms: number | null;
  explained_at: string | null;
  seen_at: string | null;
  seen_by: AiAdvisorUserRef | null;
  /** «Hal qilindi» YOKI «Ahamiyatsiz» vaqti va kim (`status` farqlaydi). */
  resolved_at: string | null;
  resolved_by: AiAdvisorUserRef | null;
  resolution_note: string | null;
  reopened_from: { id: string; status: AiAdvisorAlertStatus; resolved_at: string | null } | null;
  /** Faqat `?include=history` (FE v1 so'ramaydi). */
  history?: AiAdvisorHistoryEvent[];
}

/** `GET ai/advisor/alerts/:id` (ochilganda «Ko'rildi»!) va `PATCH` javobi. */
export type AiAdvisorAlertDetail = AiAdvisorAlertListItem & AiAdvisorAlertDetailExtra;

export interface AiAdvisorPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** `GET ai/advisor/alerts` → `data`. `counts.by_status` — `status` filtrisiz (segment sonlari). */
export interface AiAdvisorAlertListData {
  items: AiAdvisorAlertListItem[];
  meta: AiAdvisorPaginationMeta;
  counts: { by_status: Record<AiAdvisorAlertStatus, number> };
}

/** So'rov parametrlari: `limit` doim aniq yuboriladi (10 · 25 · 50 · 100). */
export interface AiAdvisorAlertListParams {
  status?: AiAdvisorAlertStatus | "open";
  severity?: AiAdvisorSeverity;
  rule_key?: AiAdvisorRuleKey;
  page: number;
  limit: number;
}

/** `GET ai/advisor/overview` → `data.alerts`. Banner (Q8) — `critical` + `critical_rule_keys` (faqat `new`). */
export interface AiAdvisorOverviewAlerts {
  new: number;
  /** `new + seen`, filtrsiz — «Hammasi joyida» bo'sh holati uchun. */
  open: number;
  critical: number;
  critical_open: number;
  critical_rule_keys: AiAdvisorRuleKey[];
  critical_open_rule_keys: AiAdvisorRuleKey[];
}

/** x-owner BE-1 (hozircha `null`). */
export interface AiAdvisorOverviewBudget {
  scope: AiAdvisorBudgetScope;
  period: AiAdvisorBudgetPeriod;
  period_key: string;
  spent_usd: number;
  spent_uzs: number;
  cap_usd: number;
  override_usd: number;
  effective_cap_usd: number;
  ratio: number;
  warn_ratio: number;
  state: "ok" | "warn" | "exceeded" | "unknown";
  reset_at: string;
  deep_used: number | null;
  deep_limit: number | null;
}

export interface AiAdvisorOverview {
  alerts: AiAdvisorOverviewAlerts;
  /** x-owner BE-4 (hozircha `null`). */
  recommendations: { new: number } | null;
  budget: AiAdvisorOverviewBudget | null;
  usd_uzs_rate: number | null;
  generated_at: string | null;
}

/** `POST ai/advisor/alerts/:id/explain` → 202 `data`. */
export interface AiAdvisorExplainResult {
  alert_id: string;
  explanation_status: "pending" | "ready";
  explanation_md: string | null;
  explained_at: string | null;
  cached: boolean;
  poll_after_ms: number | null;
}

export interface AiAdvisorAlertPatchRequest {
  status: "resolved" | "dismissed";
  note?: string | null;
}

// ── Sozlamalar (§7.6–7.7, #644) ───────────────────────────────────────────────────────────────────────────

export type AiAdvisorLimitUnit = "uzs" | "days" | "count" | "multiplier";

/** Forma chegarasi — FE validatsiyasi va ai-service tekshiruvi bitta manbadan (`GET settings.limits`). */
export interface AiAdvisorFieldLimit {
  min: number;
  max: number;
  /** 1 — butun son; 0.1 — bir kasr xona. */
  step: number;
  unit: AiAdvisorLimitUnit;
  default: number;
}

/** Bitta qoida: umumiy kalitlar + shu qoidaning chegaralari (yassi, API'dagidek). `severity` — qotirilgan (Q1). */
export type AiAdvisorRuleSettings = {
  enabled: boolean;
  severity: AiAdvisorSeverity;
  telegram: boolean;
} & AiAdvisorThresholds;

export type AiAdvisorRuleLimits = Partial<Record<AiAdvisorThresholdField, AiAdvisorFieldLimit>>;

export interface AiAdvisorSettings {
  version: number;
  rules: Record<AiAdvisorRuleKey, AiAdvisorRuleSettings>;
  limits: { rules: Record<AiAdvisorRuleKey, AiAdvisorRuleLimits> };
  /** x-owner BE-1 — hozircha `null` (UI faqat «Qoidalar»). */
  telegram: { enabled: boolean; recipients?: Array<{ user: AiAdvisorUserRef; telegram_connected: boolean }> } | null;
  budget: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
  updated_at: string | null;
  updated_by: AiAdvisorUserRef | null;
}

/** PATCH qoida bo'lagi: faqat `enabled` va chegaralar — `severity` (400, Q1) va `telegram` yuborilmaydi. */
export type AiAdvisorRulePatch = { enabled?: boolean } & AiAdvisorThresholds;

/** `PATCH ai/advisor/settings`: qisman, hammasi yoki hech narsa; `version` majburiy. */
export interface AiAdvisorSettingsPatch {
  version: number;
  rules?: Partial<Record<AiAdvisorRuleKey, AiAdvisorRulePatch>>;
}
