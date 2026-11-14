import type {
  AiAdvisorAlertDetail,
  AiAdvisorAlertListData,
  AiAdvisorAlertListItem,
  AiAdvisorExplainResult,
  AiAdvisorOverview,
  AiAdvisorRuleLimits,
  AiAdvisorRuleKey,
  AiAdvisorSettings,
  AiAdvisorUserRef,
} from "../entities/ai-advisor";

/**
 * AI maslahatchi (60PWUbgC) — vitest va e2e uchun umumiy namunalar: shartnoma v0.3 openapi misollari + maket
 * `superadmin-ai-assistant-alerts` / `-alert-dialog*` qiymatlari. Sanalar «hozir» ga nisbatan (mahalliy vaqt — testlar
 * `TZ=Asia/Tashkent`): «Bugun, 14:00», «Kecha, 18:20», 2 kun oldin … — `formatDateTimeLocalized` maketdagidek nisbiy
 * ko'rsatadi. Faqat tip importi — runtime bog'liqlik yo'q (Playwright mock'i ham ishlatadi).
 *
 *   const fx = createAdvisorFixtures();            // yoki createAdvisorFixtures(new Date(2026, 9, 23, 15, 0))
 *   api.get.mockResolvedValue({ data: advisorEnvelope(fx.overview) });
 *   api.get.mockRejectedValue(advisorHttpError(404, fx.errors.notFound));
 */

/** Backend konverti `{ statusCode, message, data }`. */
export const advisorEnvelope = <T>(data: T, statusCode = 200, message = "OK") => ({ statusCode, message, data });

/** axios xatosi shaklidagi rad javobi (vitest): `response.status` + backend tanasi. */
export const advisorHttpError = (status: number, body: Record<string, unknown> = { statusCode: status, message: "Error" }) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    code: status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST",
    response: { status, data: body },
    request: {},
  });

/** Javobsiz tarmoq xatosi (zond — `transient`). */
export const advisorNetworkError = () =>
  Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK", request: {} });

/** #644 `AI_ADVISOR_RULE_LIMITS` nusxasi (literal — fixture runtime importsiz). */
export const ADVISOR_FIXTURE_LIMITS: Record<AiAdvisorRuleKey, AiAdvisorRuleLimits> = {
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
  R8: { ratio: { min: 1.1, max: 10, step: 0.1, unit: "multiplier", default: 2 } },
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const SHODIYOR: AiAdvisorUserRef = { id: "1", name: "Shodiyor Ergashev" };
const SARDOR: AiAdvisorUserRef = { id: "214", name: "Sardor Mirzayev" };

const R1_EXPLANATION =
  "Uchala kamomad ham «Humo virtual» kartasida: naqd to'g'ri sanalgan, karta qoldig'i har gal kam kiritilgan. Ehtimol, kechki tushum smena yopilgandan keyin kartaga tushmoqda. Smena hisobotidagi karta rasmlarini solishtiring.";
const R2_EXPLANATION =
  "Jasur Tursunov 19.10 dan beri pul topshirmagan: kassasi har kuni 545 000–905 000 so'mga o'sib, 2 840 000 so'mga yetdi. Kuryer bilan bog'laning va pulni bugun asosiy kassaga topshirishini so'rang.";
const R7_EXPLANATION =
  "Chekdagi summa kiritilganidan 18 000 so'm kam, to'lov esa filial kartasidan emas, boshqa kartadan (··3307) qilingan. Xarajat summasini chek bo'yicha tekshiring va bu karta bilan to'lov sababini aniqlang.";
const R6_EXPLANATION =
  "Xarajatlar oldingi kunga nisbatan 570 000 so'mga oshdi, pochta foydasi esa 5,3% kamaydi. Zararning asosiy sababi — Samarqanddagi bir martalik mashina ta'miri va yoqilg'i.";

export const RESOLVE_NOTE = "Kartadagi tushum keyingi kuni kelgan, Sardor Mirzayev bilan tekshirildi.";

/** Bo'sh tafsilot qismi — har qoida o'zinikini ustiga yozadi. */
const detailDefaults = {
  links: [],
  explanation_md: null,
  explanation_error: null,
  explanation_error_scope: null,
  explanation_retry_at: null,
  explanation_requested_at: null,
  explanation_poll_after_ms: null,
  explained_at: null,
  seen_at: null,
  seen_by: null,
  resolved_at: null,
  resolved_by: null,
  resolution_note: null,
  reopened_from: null,
};

/** Barcha namunalar «hozir» ga nisbatan (sukut — haqiqiy vaqt). */
export const createAdvisorFixtures = (now: Date = new Date()) => {
  /** Bugundan `dayOffset` kun, `hh:mm` (mahalliy) → ISO. */
  const at = (dayOffset: number, hours: number, minutes: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes, 0, 0).toISOString();
  /** Bugundan `dayOffset` kun → `YYYY-MM-DD`. */
  const day = (dayOffset: number) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 12);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };
  /** Joriy haftaning dushanbasigacha kunlar (dushanba — 0). */
  const sinceMonday = (now.getDay() + 6) % 7;
  const thisMonday = -sinceMonday;
  const lastMonday = thisMonday - 7;
  const lastSunday = thisMonday - 1;
  /** Keyingi Toshkent yarim tuni va keyingi oyning 1-sanasi (budjet tiklanishi). */
  const nextMidnight = at(1, 0, 0);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).toISOString();

  // ── Ro'yxat qatorlari (maketdagi 8 ta, tartib — `last_at desc`) ──────────────────────────────────────

  const r2: AiAdvisorAlertListItem = {
    id: "1041",
    rule_key: "R2",
    severity: "critical",
    status: "new",
    title: "Jasur Tursunov kassasida 2 840 000 so'm — 4 kundan beri topshirilmagan",
    branch: { id: "1", name: "Toshkent HQ" },
    subject: { kind: "courier", id: "377", name: "Jasur Tursunov" },
    headline_amount: 2_840_000,
    facts: {
      trigger: "both",
      courier: { id: "377", name: "Jasur Tursunov" },
      branch: { id: "1", name: "Toshkent HQ" },
      balance: 2_840_000,
      growth_days: 4,
      days_without_handover: 4,
      last_handover_at: at(-4, 18, 20),
    },
    occurrences: 1,
    first_at: at(0, 14, 0),
    last_at: at(0, 14, 0),
    first_fact_at: at(-3, 0, 0),
    last_fact_at: at(0, 14, 0),
    explanation_status: "ready",
    reopened_from_id: null,
  };

  const r1: AiAdvisorAlertListItem = {
    id: "1040",
    rule_key: "R1",
    severity: "warning",
    status: "new",
    title: "Samarqand filiali kassasida 3 smena ketma-ket kamomad: −445 000 so'm",
    branch: { id: "7", name: "Samarqand filiali" },
    subject: { kind: "cashbox", id: "7", name: "Samarqand filiali kassasi" },
    headline_amount: -445_000,
    facts: {
      trigger: "consecutive_negative",
      cashbox: { type: "branch", owner_id: "7", name: "Samarqand filiali kassasi" },
      branch: { id: "7", name: "Samarqand filiali" },
      shifts_count: 3,
      total_difference: -445_000,
      last_difference: -240_000,
      closed_by: [SARDOR],
      last_shift_id: "818",
    },
    occurrences: 3,
    first_at: at(-2, 21, 0),
    last_at: at(0, 13, 45),
    first_fact_at: at(-2, 20, 50),
    last_fact_at: at(0, 13, 45),
    explanation_status: "ready",
    reopened_from_id: null,
  };

  const r7: AiAdvisorAlertListItem = {
    id: "1039",
    rule_key: "R7",
    severity: "critical",
    status: "new",
    title: "Chekda farq bor — Urgut filiali yoqilg'i xarajati, karta mos emas",
    branch: { id: "12", name: "Urgut filiali" },
    subject: { kind: "cashbox", id: "12", name: "Urgut filiali kassasi" },
    headline_amount: -18_000,
    facts: {
      source: "receipt",
      receipt_ai_enabled: true,
      mismatch: ["amount", "card"],
      cashbox: { type: "branch", owner_id: "12", name: "Urgut filiali kassasi" },
      branch: { id: "12", name: "Urgut filiali" },
      entered_amount: 320_000,
      read_amount: 302_000,
      difference: -18_000,
      operation: { history_id: "99120", kind: "manual_expense", category_name: "Yoqilg'i" },
      shift: null,
      card: null,
      created_by: { id: "402", name: "Ravshan Ortiqov" },
      created_at: at(0, 11, 5),
    },
    occurrences: 1,
    first_at: at(0, 11, 10),
    last_at: at(0, 11, 10),
    first_fact_at: at(0, 11, 5),
    last_fact_at: at(0, 11, 5),
    explanation_status: "ready",
    reopened_from_id: null,
  };

  const r3: AiAdvisorAlertListItem = {
    id: "1036",
    rule_key: "R3",
    severity: "warning",
    status: "seen",
    title: "Farg'ona filiali: yoqilg'i xarajati 1 450 000 so'm — odatdagidan 3,4 barobar",
    branch: { id: "9", name: "Farg'ona filiali" },
    subject: { kind: "cashbox", id: "9", name: "Farg'ona filiali kassasi" },
    headline_amount: 1_450_000,
    facts: {
      history_id: "98877",
      amount: 1_450_000,
      category: { id: "4", name: "Yoqilg'i" },
      cashbox: { type: "branch", owner_id: "9", name: "Farg'ona filiali kassasi" },
      branch: { id: "9", name: "Farg'ona filiali" },
      created_by: { id: "388", name: "Dilmurod Xasanov" },
      created_at: at(-1, 18, 5),
      median: 425_000,
      mad: 85_000,
      threshold: 680_000,
      ratio_to_median: 3.4,
      sample_size: 11,
      window_days: 30,
      scope: "category_branch",
    },
    occurrences: 1,
    first_at: at(-1, 18, 20),
    last_at: at(-1, 18, 20),
    first_fact_at: at(-1, 18, 5),
    last_fact_at: at(-1, 18, 5),
    explanation_status: "none",
    reopened_from_id: null,
  };

  const r4: AiAdvisorAlertListItem = {
    id: "1034",
    rule_key: "R4",
    severity: "warning",
    status: "seen",
    title: "Nur Elektronika — 9 kundan beri to'lov yo'q, qarz 3 120 000 so'm",
    branch: null,
    subject: { kind: "market", id: "55", name: "Nur Elektronika" },
    headline_amount: 3_120_000,
    facts: {
      market: { id: "55", name: "Nur Elektronika" },
      debt: 3_120_000,
      days_without_payout: 9,
      last_payout_at: at(-10, 16, 20),
      last_payout_amount: 2_450_000,
    },
    occurrences: 2,
    first_at: at(-2, 9, 0),
    last_at: at(-1, 9, 0),
    first_fact_at: at(-9, 0, 0),
    last_fact_at: at(-1, 9, 0),
    explanation_status: "none",
    reopened_from_id: null,
  };

  const r5: AiAdvisorAlertListItem = {
    id: "1033",
    rule_key: "R5",
    severity: "warning",
    status: "seen",
    title: "Urgut filiali kassasida 6 400 000 so'm — HQ'ga 4 kundan beri o'tkazma yo'q",
    branch: { id: "12", name: "Urgut filiali" },
    subject: { kind: "branch", id: "12", name: "Urgut filiali" },
    headline_amount: 6_400_000,
    facts: {
      branch: { id: "12", name: "Urgut filiali" },
      balance: 6_400_000,
      days_without_transfer: 4,
      last_transfer_at: at(-6, 18, 40),
      last_transfer_amount: 3_180_000,
    },
    occurrences: 1,
    first_at: at(-2, 10, 30),
    last_at: at(-2, 10, 30),
    first_fact_at: at(-5, 0, 0),
    last_fact_at: at(-2, 10, 30),
    explanation_status: "none",
    reopened_from_id: null,
  };

  const r6: AiAdvisorAlertListItem = {
    id: "1031",
    rule_key: "R6",
    severity: "critical",
    status: "resolved",
    title: `${day(-3).slice(8, 10)}.${day(-3).slice(5, 7)} kuni sof foyda −380 000 so'm`,
    branch: null,
    subject: { kind: "system", id: null, name: "Butun tizim" },
    headline_amount: -380_000,
    facts: { period: "day", from: day(-3), to: day(-3), income: 1_240_000, expense: 1_620_000, net: -380_000 },
    occurrences: 1,
    first_at: at(-2, 8, 0),
    last_at: at(-2, 8, 0),
    first_fact_at: at(-3, 0, 0),
    last_fact_at: at(-3, 23, 59),
    explanation_status: "ready",
    reopened_from_id: null,
  };

  const r8: AiAdvisorAlertListItem = {
    id: "1029",
    rule_key: "R8",
    severity: "warning",
    status: "dismissed",
    title: "O'tgan haftada 14 ta tuzatish — 30 kunlik o'rtachadan 2,3 barobar",
    branch: null,
    subject: { kind: "system", id: null, name: "Butun tizim" },
    headline_amount: null,
    facts: { from: day(lastMonday), to: day(lastSunday), count: 14, baseline_weekly_avg: 6.1, ratio: 2.3 },
    occurrences: 1,
    first_at: at(thisMonday, 8, 30),
    last_at: at(thisMonday, 8, 30),
    first_fact_at: at(lastMonday, 0, 0),
    last_fact_at: at(lastSunday, 23, 59),
    explanation_status: "none",
    reopened_from_id: null,
  };

  const items: AiAdvisorAlertListItem[] = [r2, r1, r7, r3, r4, r5, r6, r8];

  const overview: AiAdvisorOverview = {
    alerts: {
      new: 3,
      open: 6,
      critical: 2,
      critical_open: 2,
      critical_rule_keys: ["R2", "R7"],
      critical_open_rule_keys: ["R2", "R7"],
    },
    recommendations: null,
    budget: null,
    usd_uzs_rate: null,
    generated_at: now.toISOString(),
  };

  const list: AiAdvisorAlertListData = {
    items,
    meta: { page: 1, limit: 10, total: 22, totalPages: 3 },
    counts: { by_status: { new: 3, seen: 3, resolved: 12, dismissed: 4 } },
  };

  // ── Tafsilotlar (har qoida) ──────────────────────────────────────────────────────────────────────────

  const r1Detail: AiAdvisorAlertDetail = {
    ...r1,
    ...detailDefaults,
    status: "seen",
    rule: { key: "R1", severity: "warning", thresholds: { shortage_uzs: 50_000, consecutive_negative: 3 } },
    evidence: {
      kind: "shifts",
      total_rows: 3,
      truncated: false,
      rows: [
        {
          shift_id: "806",
          closed_at: at(-2, 20, 50),
          closed_by: SARDOR,
          closed_by_system: false,
          expected_cash: 3_200_000,
          expected_card: 1_660_000,
          counted_cash: 3_200_000,
          counted_card: 1_540_000,
          expected: 4_860_000,
          counted: 4_740_000,
          difference: -120_000,
          href: "/payments/shifts/806",
        },
        {
          shift_id: "811",
          closed_at: at(-1, 20, 55),
          closed_by: SARDOR,
          closed_by_system: false,
          expected_cash: 2_500_000,
          expected_card: 1_420_000,
          counted_cash: 2_500_000,
          counted_card: 1_335_000,
          expected: 3_920_000,
          counted: 3_835_000,
          difference: -85_000,
          href: "/payments/shifts/811",
        },
        {
          shift_id: "818",
          closed_at: at(0, 13, 40),
          closed_by: SARDOR,
          closed_by_system: false,
          expected_cash: 3_400_000,
          expected_card: 1_910_000,
          counted_cash: 3_400_000,
          counted_card: 1_670_000,
          expected: 5_310_000,
          counted: 5_070_000,
          difference: -240_000,
          href: "/payments/shifts/818",
        },
      ],
      totals: { count: 3, difference: -445_000 },
    },
    links: [
      { kind: "shift_report", href: "/payments/shifts/818", entity_id: "818", primary: true },
      { kind: "branch_cashbox", href: "/payments/cash-detail/7?type=branch", entity_id: "7", primary: false },
    ],
    explanation_md: R1_EXPLANATION,
    explanation_requested_at: at(0, 14, 19),
    explained_at: at(0, 14, 20),
    seen_at: at(0, 13, 50),
    seen_by: SHODIYOR,
  };

  const r2Detail: AiAdvisorAlertDetail = {
    ...r2,
    ...detailDefaults,
    status: "seen",
    rule: {
      key: "R2",
      severity: "critical",
      thresholds: { balance_uzs: 2_000_000, growth_days: 3, no_handover_days: 3 },
    },
    evidence: {
      kind: "courier_days",
      total_rows: 5,
      truncated: false,
      rows: [
        { date: day(-4), opening_balance: 380_000, income: 1_180_000, handed_over: 1_560_000, closing_balance: 0 },
        { date: day(-3), opening_balance: 0, income: 610_000, handed_over: 0, closing_balance: 610_000 },
        { date: day(-2), opening_balance: 610_000, income: 780_000, handed_over: 0, closing_balance: 1_390_000 },
        { date: day(-1), opening_balance: 1_390_000, income: 905_000, handed_over: 0, closing_balance: 2_295_000 },
        { date: day(0), opening_balance: 2_295_000, income: 545_000, handed_over: 0, closing_balance: 2_840_000 },
      ],
      last_handover: { at: at(-4, 18, 20), amount: 1_560_000, history_id: "97001" },
    },
    links: [{ kind: "courier_cashbox", href: "/payments/cash-detail/377?type=courier", entity_id: "377", primary: true }],
    explanation_md: R2_EXPLANATION,
    explanation_requested_at: at(0, 14, 0),
    explained_at: at(0, 14, 1),
    seen_at: at(0, 14, 5),
    seen_by: SHODIYOR,
  };

  /** R2 «Boshqa holatlar»: faqat muddat sharti, umumiy kunlik AI chegarasi tugagan — izohsiz. */
  const r2NoHandoverDetail: AiAdvisorAlertDetail = {
    ...r2Detail,
    id: "1042",
    title: "Farhod Ismoilov kassasida 860 000 so'm — 5 kundan beri topshirilmagan",
    branch: { id: "7", name: "Samarqand filiali" },
    subject: { kind: "courier", id: "390", name: "Farhod Ismoilov" },
    headline_amount: 860_000,
    facts: {
      trigger: "no_handover",
      courier: { id: "390", name: "Farhod Ismoilov" },
      branch: { id: "7", name: "Samarqand filiali" },
      balance: 860_000,
      growth_days: 1,
      days_without_handover: 5,
      last_handover_at: at(-5, 17, 40),
    },
    first_at: at(0, 9, 30),
    last_at: at(0, 9, 30),
    explanation_status: "failed",
    explanation_md: null,
    explained_at: null,
    explanation_error: "budget_exceeded",
    explanation_error_scope: "global",
    explanation_retry_at: nextMidnight,
    links: [{ kind: "courier_cashbox", href: "/payments/cash-detail/390?type=courier", entity_id: "390", primary: true }],
  } as AiAdvisorAlertDetail;

  const r7Detail: AiAdvisorAlertDetail = {
    ...r7,
    ...detailDefaults,
    status: "seen",
    rule: { key: "R7", severity: "critical", thresholds: {} },
    evidence: {
      kind: "receipt_check",
      total_rows: 1,
      truncated: false,
      receipt: {
        id: "5531",
        ai_status: "mismatch",
        flags: ["card_mismatch"],
        date: `${day(0)} 10:52`,
        date_at: at(0, 10, 52),
        recipient: "UzAuto Petrol, 12-shoxobcha",
        recipient_last4: "8840",
        payer: "Ravshan Ortiqov",
        payer_last4: "3307",
        bank: "Hamkorbank",
        reference: "512778940112",
        confidence: 0.89,
      },
      week_summary: { from: day(thisMonday), to: day(thisMonday + 6), checked: 46, match: 41, mismatch: 3, unreadable: 2 },
    },
    links: [
      { kind: "operation", href: "/payments/cash-detail/12?type=branch&history=99120", entity_id: "99120", primary: true },
    ],
    explanation_md: R7_EXPLANATION,
    explanation_requested_at: at(0, 11, 10),
    explained_at: at(0, 11, 10),
    seen_at: at(0, 11, 30),
    seen_by: SHODIYOR,
  };

  /** R7 «Karta qoldig'ida farq» — smena karta tekshiruvi (chek AI'sidan oldin ham). */
  const r7CardDetail: AiAdvisorAlertDetail = {
    ...detailDefaults,
    id: "1038",
    rule_key: "R7",
    severity: "critical",
    status: "new",
    title: "Karta qoldig'ida farq — Asosiy kassa",
    branch: null,
    subject: { kind: "cashbox", id: "0", name: "Asosiy kassa" },
    headline_amount: -40_000,
    facts: {
      source: "card_balance",
      receipt_ai_enabled: true,
      mismatch: ["amount"],
      cashbox: { type: "main", owner_id: "0", name: "Asosiy kassa" },
      branch: null,
      entered_amount: 2_350_000,
      read_amount: 2_310_000,
      difference: -40_000,
      operation: null,
      shift: { id: "9001", date: day(-1) },
      card: { id: "3", name: "Humo virtual" },
      created_by: SHODIYOR,
      created_at: at(-1, 21, 0),
    },
    occurrences: 1,
    first_at: at(-1, 21, 5),
    last_at: at(-1, 21, 5),
    first_fact_at: at(-1, 21, 0),
    last_fact_at: at(-1, 21, 0),
    explanation_status: "none",
    reopened_from_id: null,
    rule: { key: "R7", severity: "critical", thresholds: {} },
    evidence: {
      kind: "card_balance_check",
      total_rows: 1,
      truncated: false,
      shift: { id: "9001", date: day(-1), closed_at: at(-1, 21, 0) },
      card: { id: "3", name: "Humo virtual" },
      entered_balance: 2_350_000,
      ai_read_balance: 2_310_000,
      difference: -40_000,
      ai_confidence: 0.93,
    },
    links: [{ kind: "shift_report", href: "/payments/shifts/9001", entity_id: "9001", primary: true }],
  };

  const r3Detail: AiAdvisorAlertDetail = {
    ...r3,
    ...detailDefaults,
    rule: { key: "R3", severity: "warning", thresholds: { mad_multiplier: 3 } },
    evidence: {
      kind: "expense_stats",
      total_rows: 5,
      truncated: false,
      stats: { window_days: 30, sample_size: 11, median: 425_000, mad: 85_000, multiplier: 3, threshold: 680_000, scope: "category_branch" },
      rows: [
        {
          history_id: "98877",
          created_at: at(-1, 18, 5),
          amount: 1_450_000,
          cashbox_name: "Farg'ona filiali kassasi",
          created_by: { id: "388", name: "Dilmurod Xasanov" },
          is_trigger: true,
          href: "/payments/cash-detail/9?type=branch&history=98877",
        },
        {
          history_id: "98610",
          created_at: at(-4, 9, 40),
          amount: 410_000,
          cashbox_name: "Farg'ona filiali kassasi",
          created_by: { id: "388", name: "Dilmurod Xasanov" },
          is_trigger: false,
          href: "/payments/cash-detail/9?type=branch&history=98610",
        },
        {
          history_id: "98402",
          created_at: at(-8, 10, 15),
          amount: 440_000,
          cashbox_name: "Farg'ona filiali kassasi",
          created_by: { id: "388", name: "Dilmurod Xasanov" },
          is_trigger: false,
          href: "/payments/cash-detail/9?type=branch&history=98402",
        },
        {
          history_id: "98211",
          created_at: at(-12, 17, 30),
          amount: 395_000,
          cashbox_name: "Farg'ona filiali kassasi",
          created_by: { id: "391", name: "Dilshod Rahimov" },
          is_trigger: false,
          href: "/payments/cash-detail/9?type=branch&history=98211",
        },
        {
          history_id: "98004",
          created_at: at(-16, 12, 10),
          amount: 425_000,
          cashbox_name: "Farg'ona filiali kassasi",
          created_by: { id: "388", name: "Dilmurod Xasanov" },
          is_trigger: false,
          href: "/payments/cash-detail/9?type=branch&history=98004",
        },
      ],
    },
    links: [
      { kind: "operation", href: "/payments/cash-detail/9?type=branch&history=98877", entity_id: "98877", primary: true },
    ],
    seen_at: at(-1, 18, 30),
    seen_by: SHODIYOR,
  };

  /** R3 «Boshqa holatlar»: oylik AI budjeti tugagan — izoh olinmaydi. */
  const r3BudgetDetail: AiAdvisorAlertDetail = {
    ...r3Detail,
    explanation_status: "failed",
    explanation_error: "budget_exceeded",
    explanation_error_scope: "advisor",
    explanation_retry_at: nextMonth,
    explanation_requested_at: at(-1, 18, 40),
  };

  const r4Detail: AiAdvisorAlertDetail = {
    ...r4,
    ...detailDefaults,
    rule: { key: "R4", severity: "warning", thresholds: { days_without_payout: 7 } },
    evidence: {
      kind: "market_debt_days",
      total_rows: 14,
      truncated: false,
      rows: Array.from({ length: 14 }, (_, index) => {
        const offset = index - 14;
        const paid = offset === -14 ? 1_980_000 : offset === -10 ? 2_450_000 : 0;
        return { date: day(offset), debt: Math.round((3_120_000 * (index + 1)) / 14), paid };
      }),
      last_payout: { at: at(-10, 16, 20), amount: 2_450_000, history_id: "96550" },
    },
    links: [{ kind: "market_cashbox", href: "/payments/cash-detail/55?type=market", entity_id: "55", primary: true }],
    seen_at: at(-2, 9, 10),
    seen_by: SHODIYOR,
  };

  const r5Detail: AiAdvisorAlertDetail = {
    ...r5,
    ...detailDefaults,
    rule: { key: "R5", severity: "warning", thresholds: { balance_uzs: 5_000_000, days_without_transfer: 3 } },
    evidence: {
      kind: "branch_transfers",
      total_rows: 4,
      truncated: false,
      days: [
        { date: day(-5), closing_balance: 4_100_000 },
        { date: day(-4), closing_balance: 5_050_000 },
        { date: day(-3), closing_balance: 5_720_000 },
        { date: day(-2), closing_balance: 6_400_000 },
      ],
      transfers: [
        { at: at(-6, 18, 40), amount: 3_180_000, history_id: "97210", href: "/payments/cash-detail/12?type=branch&history=97210" },
        { at: at(-10, 18, 15), amount: 2_940_000, history_id: "96820", href: "/payments/cash-detail/12?type=branch&history=96820" },
        { at: at(-14, 19, 0), amount: 4_250_000, history_id: "96400", href: "/payments/cash-detail/12?type=branch&history=96400" },
        { at: at(-18, 18, 40), amount: 2_330_000, history_id: "96010", href: "/payments/cash-detail/12?type=branch&history=96010" },
      ],
    },
    links: [{ kind: "branch_cashbox", href: "/payments/cash-detail/12?type=branch", entity_id: "12", primary: true }],
    seen_at: at(-2, 10, 40),
    seen_by: SHODIYOR,
  };

  const r6Detail: AiAdvisorAlertDetail = {
    ...r6,
    ...detailDefaults,
    rule: { key: "R6", severity: "critical", thresholds: {} },
    evidence: {
      kind: "profit_days",
      total_rows: 2,
      truncated: false,
      rows: [
        { date: day(-4), income: 1_310_000, expense: 1_050_000, net: 260_000, is_trigger: false },
        { date: day(-3), income: 1_240_000, expense: 1_620_000, net: -380_000, is_trigger: true },
      ],
      totals: { income: 1_240_000, expense: 1_620_000, net: -380_000 },
    },
    links: [
      {
        kind: "financial_balance",
        href: `/financial-balance?tab=history&financialBalanceHistoryFrom=${day(-3)}&financialBalanceHistoryTo=${day(-3)}`,
        entity_id: null,
        primary: true,
      },
    ],
    explanation_md: R6_EXPLANATION,
    explanation_requested_at: at(-2, 8, 0),
    explained_at: at(-2, 8, 1),
    seen_at: at(-2, 9, 0),
    seen_by: SHODIYOR,
    resolved_at: at(-2, 10, 15),
    resolved_by: SHODIYOR,
    resolution_note: "Samarqanddagi mashina ta'miri bir martalik, yoqilg'i xarajati filiallar bilan tekshirildi.",
  };

  /** R6 haftalik zarar (o'tgan hafta). */
  const r6WeekDetail: AiAdvisorAlertDetail = {
    ...r6Detail,
    id: "1030",
    status: "seen",
    headline_amount: -1_150_000,
    facts: { period: "week", from: day(lastMonday), to: day(lastSunday), income: 8_640_000, expense: 9_790_000, net: -1_150_000 },
    first_at: at(thisMonday, 8, 0),
    last_at: at(thisMonday, 8, 0),
    evidence: {
      kind: "profit_days",
      total_rows: 7,
      truncated: false,
      rows: Array.from({ length: 7 }, (_, index) => ({
        date: day(lastMonday + index),
        income: 1_234_286,
        expense: 1_398_571,
        net: -164_285,
        is_trigger: false,
      })),
      totals: { income: 8_640_000, expense: 9_790_000, net: -1_150_000 },
    },
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
  } as AiAdvisorAlertDetail;

  const r8Detail: AiAdvisorAlertDetail = {
    ...r8,
    ...detailDefaults,
    rule: { key: "R8", severity: "warning", thresholds: { ratio: 2 } },
    evidence: {
      kind: "corrections",
      total_rows: 7,
      truncated: false,
      by_kind: { manual_correction: 0, order_rollback: 6, payment_reverse: 9, payment_edit: 5 },
      counted_kinds: ["manual_correction", "payment_reverse", "payment_edit"],
      days: Array.from({ length: 7 }, (_, index) => ({ date: day(lastMonday + index), count: [3, 1, 2, 4, 2, 1, 1][index] })),
      baseline: { window_days: 30, total: 26, weekly_avg: 6.1 },
    },
    links: [{ kind: "corrections", href: "/payments/main-cashbox", entity_id: null, primary: true }],
    seen_at: at(thisMonday, 9, 0),
    seen_by: SHODIYOR,
    resolved_at: at(thisMonday, 9, 10),
    resolved_by: SHODIYOR,
    resolution_note: "Hafta boshida 2 ta yangi kassir ishga kirdi, xatolar shundan. Ular bilan ko'rib chiqildi.",
  };

  /** R1 variantlari: izoh yozilmoqda (poll 2 s), so'ralmagan, «Hal qilindi», qaytgan muammo. */
  const r1Pending: AiAdvisorAlertDetail = {
    ...r1Detail,
    explanation_status: "pending",
    explanation_md: null,
    explained_at: null,
    explanation_requested_at: now.toISOString(),
    explanation_poll_after_ms: 2_000,
  };
  const r1None: AiAdvisorAlertDetail = { ...r1Pending, explanation_status: "none", explanation_requested_at: null, explanation_poll_after_ms: null };
  const r1Resolved: AiAdvisorAlertDetail = {
    ...r1Detail,
    status: "resolved",
    resolved_at: at(0, 15, 10),
    resolved_by: SHODIYOR,
    resolution_note: RESOLVE_NOTE,
  };
  const r1Reopened: AiAdvisorAlertDetail = {
    ...r1None,
    id: "1045",
    status: "new",
    occurrences: 1,
    reopened_from_id: "1040",
    reopened_from: { id: "1040", status: "resolved", resolved_at: at(0, 15, 10) },
    seen_at: null,
    seen_by: null,
  };

  const details: Record<string, AiAdvisorAlertDetail> = Object.fromEntries(
    [r2Detail, r1Detail, r7Detail, r3Detail, r4Detail, r5Detail, r6Detail, r8Detail, r7CardDetail, r2NoHandoverDetail, r6WeekDetail, r1Reopened].map(
      (detail) => [detail.id, detail],
    ),
  );

  // ── Izoh, xatolar, sozlamalar ────────────────────────────────────────────────────────────────────────

  const explain: Record<"queued" | "cached", AiAdvisorExplainResult> = {
    queued: { alert_id: "1040", explanation_status: "pending", explanation_md: null, explained_at: null, cached: false, poll_after_ms: 2_000 },
    cached: {
      alert_id: "1040",
      explanation_status: "ready",
      explanation_md: R1_EXPLANATION,
      explained_at: at(0, 14, 20),
      cached: true,
      poll_after_ms: null,
    },
  };

  const errors = {
    forbidden: { statusCode: 403, message: "Bu amal uchun ruxsat yo'q" },
    notFound: { statusCode: 404, message: "Ogohlantirish topilmadi", code: "AI_ADVISOR_ALERT_NOT_FOUND" },
    closed: { statusCode: 409, message: "Ogohlantirish allaqachon yopilgan", code: "AI_ADVISOR_ALERT_CLOSED", alert_status: "resolved" },
    explainClosed: {
      statusCode: 409,
      message: "Yopilgan ogohlantirishga izoh so'ralmaydi",
      code: "AI_ADVISOR_ALERT_CLOSED",
      alert_status: "dismissed",
    },
    noteRequired: {
      statusCode: 400,
      message: "«Hal qilindi» uchun izoh yozing",
      code: "AI_ADVISOR_NOTE_INVALID",
      reason: "required",
      min_length: 3,
      max_length: 500,
    },
    noteTooShort: {
      statusCode: 400,
      message: "Izoh kamida 3 belgi bo'lsin",
      code: "AI_ADVISOR_NOTE_INVALID",
      reason: "too_short",
      min_length: 3,
      max_length: 500,
    },
    noteTooLong: {
      statusCode: 400,
      message: "Izoh 500 belgidan oshmasin",
      code: "AI_ADVISOR_NOTE_INVALID",
      reason: "too_long",
      min_length: 3,
      max_length: 500,
    },
    budgetAdvisorMonth: {
      statusCode: 429,
      message: "AI maslahatchi budjeti tugadi",
      code: "AI_ADVISOR_BUDGET_EXCEEDED",
      scope: "advisor",
      period: "month",
      reset_at: nextMonth,
      retry_after_seconds: 86_400,
    },
    budgetAdvisorDay: {
      statusCode: 429,
      message: "Bugungi AI maslahatchi budjeti tugadi",
      code: "AI_ADVISOR_BUDGET_EXCEEDED",
      scope: "advisor",
      period: "day",
      reset_at: nextMidnight,
      retry_after_seconds: 34_200,
    },
    budgetGlobalDay: {
      statusCode: 429,
      message: "Bugungi umumiy AI shifti tugadi",
      code: "AI_ADVISOR_BUDGET_EXCEEDED",
      scope: "global",
      period: "day",
      reset_at: nextMidnight,
      retry_after_seconds: 34_200,
    },
    aiDisabled: { statusCode: 503, message: "AI xizmati o'chiq", code: "AI_ADVISOR_AI_DISABLED", reason: "ai_disabled" },
    invalidRule: {
      statusCode: 400,
      message: "Ketma-ket manfiy smenalar 1 dan katta bo'lsin",
      code: "AI_ADVISOR_INVALID_RULE",
      field: "rules.R1.consecutive_negative",
      min: 2,
      max: 30,
    },
    invalidSetting: {
      statusCode: 400,
      message: "Sozlamalar versiyasi yuborilmadi",
      code: "AI_ADVISOR_INVALID_SETTING",
      field: "version",
    },
    settingsConflict: {
      statusCode: 409,
      message: "Sozlamalar boshqa oynada o'zgargan",
      code: "AI_ADVISOR_SETTINGS_CONFLICT",
      version: 5,
    },
    timeout: { statusCode: 504, message: "AI service javob bermadi" },
  } as const;

  const settings: AiAdvisorSettings = {
    version: 4,
    rules: {
      R1: { enabled: true, severity: "warning", telegram: true, shortage_uzs: 50_000, consecutive_negative: 3 },
      R2: { enabled: true, severity: "critical", telegram: true, balance_uzs: 2_000_000, growth_days: 3, no_handover_days: 3 },
      R3: { enabled: true, severity: "warning", telegram: true, mad_multiplier: 3 },
      R4: { enabled: true, severity: "warning", telegram: true, days_without_payout: 7 },
      R5: { enabled: true, severity: "warning", telegram: true, balance_uzs: 5_000_000, days_without_transfer: 3 },
      R6: { enabled: true, severity: "critical", telegram: true },
      R7: { enabled: true, severity: "critical", telegram: false },
      R8: { enabled: true, severity: "warning", telegram: true, ratio: 2 },
    },
    limits: { rules: ADVISOR_FIXTURE_LIMITS },
    telegram: null,
    budget: null,
    schedule: null,
    updated_at: at(-2, 12, 0),
    updated_by: SHODIYOR,
  };

  return {
    now,
    at,
    day,
    overview,
    list,
    items,
    byRule: { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5, R6: r6, R7: r7, R8: r8 } as Record<AiAdvisorRuleKey, AiAdvisorAlertListItem>,
    details,
    detail: {
      r1: r1Detail,
      r1Pending,
      r1None,
      r1Resolved,
      r1Reopened,
      r2: r2Detail,
      r2NoHandover: r2NoHandoverDetail,
      r3: r3Detail,
      r3Budget: r3BudgetDetail,
      r4: r4Detail,
      r5: r5Detail,
      r6: r6Detail,
      r6Week: r6WeekDetail,
      r7: r7Detail,
      r7Card: r7CardDetail,
      r8: r8Detail,
    },
    explain,
    errors,
    settings,
  };
};

export type AdvisorFixtures = ReturnType<typeof createAdvisorFixtures>;
