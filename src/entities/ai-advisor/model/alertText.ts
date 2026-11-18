import { RELATIVE_DAY_LABEL, toValidDate } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { DEFAULT_RULE_LIMITS, isRuleKey } from "./advisorRules";
import type {
  AiAdvisorAlertListItem,
  AiAdvisorBranchRef,
  AiAdvisorCashboxRef,
  AiAdvisorFactsR7,
  AiAdvisorKnownAlert,
  AiAdvisorNamedRef,
  AiAdvisorReceiptKind,
  AiAdvisorRuleKey,
  AiAdvisorThresholdField,
  AiAdvisorThresholds,
} from "./advisorTypes";

/**
 * Ogohlantirish matnlari — `rule_key + facts` dan, uchala tilda (`aiAdvisor:rules.*`, `aiAdvisor:alerts.*`). Server
 * `title` faqat o'zbekcha (Telegram/inbox bilan bir xil) — FE uni faqat noma'lum qoida yoki buzilgan faktda ko'rsatadi.
 * Maket matnlari (`superadmin-ai-assistant-alerts`, `-alert-dialog*`, `-alert-resolve-confirm`):
 *   ro'yxat   «Samarqand filiali kassasida 3 smena ketma-ket kamomad: −445 000 so'm»
 *   oyna      «Samarqand filiali kassasida 3 smena ketma-ket kamomad»
 *   ost-qator «Smena kamomadi · Samarqand filiali» (R6 «Zarar · butun tizim», R4/R8 — faqat qoida nomi)
 *   qisqa     «Samarqand filiali · smena kamomadi» (toast va tasdiq)
 *   qoida     «Bir smenada 50 000 so'mdan ko'p yoki 3 smena ketma-ket kamomad»
 * Pul — `formatMoneyLocalized` (minus U+2212), nisbat — `formatNumberLocalized` («3,4»), kun — satrdan
 * (`YYYY-MM-DD`, vaqt mintaqasi kunni surmaydi).
 */

export type AdvisorTranslate = (key: string, options?: Record<string, unknown>) => string;

type Unit = "days" | "daysOver" | "shifts" | "corrections";

const money = (value: number, language?: string | null) => formatMoneyLocalized(value, { language });

const ratioText = (value: number, language?: string | null) => formatNumberLocalized(value, { language, fractionDigits: 1 });

/** «Yoqilg'i» → «yoqilg'i» (gap ichida, maketdagidek). */
const lowerFirst = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);

const unit = (t: AdvisorTranslate, key: Unit, count: number) => t(`alerts.units.${key}`, { count });

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** `2026-10-20` → «20.10.2026». */
export const formatAdvisorDay = (value: string): string => {
  const match = DAY_RE.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
};

/** `2026-10-20` → «20.10» (ro'yxat sarlavhasida yilsiz). */
export const formatAdvisorDayMonth = (value: string): string => {
  const match = DAY_RE.exec(value);
  return match ? `${match[3]}.${match[2]}` : value;
};

/** Hafta: «12–18 oktabr»; oy almashsa — «28 sentyabr – 4 oktabr» (en «October 12–18»). */
export const formatAdvisorWeekRange = (from: string, to: string, t: AdvisorTranslate): string => {
  const a = DAY_RE.exec(from);
  const b = DAY_RE.exec(to);
  if (!a || !b) return `${from}–${to}`;
  const month = (m: string) => t(`alerts.months.${Number(m)}`);
  const fromDay = String(Number(a[3]));
  const toDay = String(Number(b[3]));
  if (a[1] === b[1] && a[2] === b[2]) return t("alerts.range.sameMonth", { from: fromDay, to: toDay, month: month(b[2]) });
  return t("alerts.range.crossMonth", { from: fromDay, fromMonth: month(a[2]), to: toDay, toMonth: month(b[2]) });
};

const dayParts = (value: string) => {
  const match = DAY_RE.exec(value);
  return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

/** UTC yarim tuni (kunlar farqi uchun — mintaqa va yozgi vaqt kunni surmaydi). */
const dayEpoch = (value: string): number | null => {
  const parts = dayParts(value);
  return parts ? Date.UTC(parts.y, parts.m - 1, parts.d) : null;
};

const DAY_MS = 86_400_000;

/** Kalendar kuni `YYYY-MM-DD` ga `days` kun qo'shadi (manfiy — ayiradi); yaroqsiz — o'zicha. */
export const addAdvisorDays = (value: string, days: number): string => {
  const epoch = dayEpoch(value);
  if (epoch === null) return value;
  const date = new Date(epoch + days * DAY_MS);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

/** Ikki kalendar kuni orasidagi to'liq kunlar (`to − from`); yaroqsiz — `null`. */
export const advisorDaysBetween = (from: string, to: string): number | null => {
  const a = dayEpoch(from);
  const b = dayEpoch(to);
  return a === null || b === null ? null : Math.round((b - a) / DAY_MS);
};

/** Lahzaning kalendar kuni (ilova vaqti — Toshkent) `YYYY-MM-DD`; yaroqsiz — `null`. */
export const advisorDayOf = (value: string | Date | null | undefined): string | null => {
  const date = toValidDate(value);
  return date ? `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` : null;
};

/** Hafta kuni (ISO: dushanba — 1, yakshanba — 7); yaroqsiz — `null`. */
export const advisorIsoWeekday = (value: string): number | null => {
  const epoch = dayEpoch(value);
  if (epoch === null) return null;
  const weekday = new Date(epoch).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

/** Kun: bugun — «Bugun», kecha — «Kecha», boshqa — «21.10.2026» (`formatDateTimeLocalized` qoidasi). */
export const formatAdvisorDayRelative = (value: string, language?: string | null, now: Date = new Date()): string => {
  const today = advisorDayOf(now);
  const labels = RELATIVE_DAY_LABEL[resolveMoneyLanguage(language)];
  const day = value.slice(0, 10);
  if (today && day === today) return labels.today;
  if (today && day === addAdvisorDays(today, -1)) return labels.yesterday;
  return formatAdvisorDay(value);
};

/** Davr: «12–18.10.2026»; oy almashsa — «28.09–04.10.2026»; yil almashsa — «29.12.2025 – 04.01.2026»; bir kun — «20.10.2026». */
export const formatAdvisorDayRange = (from: string, to: string): string => {
  const a = dayParts(from);
  const b = dayParts(to);
  if (!a || !b) return `${from}–${to}`;
  if (a.y === b.y && a.m === b.m && a.d === b.d) return formatAdvisorDay(from);
  if (a.y !== b.y) return `${formatAdvisorDay(from)} – ${formatAdvisorDay(to)}`;
  if (a.m !== b.m) return `${pad2(a.d)}.${pad2(a.m)}–${pad2(b.d)}.${pad2(b.m)}.${b.y}`;
  return `${pad2(a.d)}–${pad2(b.d)}.${pad2(b.m)}.${b.y}`;
};

/** Nomli havola (filial, market, kategoriya, karta): ism yoki «#<id>» — backend ism olinmasa `null` (§3.5). */
export const advisorRefName = (ref: AiAdvisorNamedRef | null | undefined): string =>
  ref ? (ref.name?.trim() || `#${ref.id}`) : "";

/** Odam: ism yoki «#<id>» (§3.5). */
export const advisorUserName = advisorRefName;

/**
 * Asosiy kassaning `subject.id` si (backend `cashboxRef(0, "main")`). Backend uning nomini har doim o'zbekcha
 * («Asosiy kassa», finance `MAIN_CASHBOX_NAME`) beradi — FE tarjimadan oladi (ru/en da o'zbekcha chiqmasin).
 */
const MAIN_CASHBOX_SUBJECT_ID = "0";

/** Kassa nomi: asosiy kassa — har doim tarjima («Asosiy kassa»); boshqasi — server nomi, olinmasa «#<egasi>». */
export const advisorCashboxName = (cashbox: AiAdvisorCashboxRef, t: AdvisorTranslate): string =>
  cashbox.type === "main" ? t("alerts.cashbox.main") : cashbox.name?.trim() || `#${cashbox.owner_id}`;

/**
 * Kim/nima haqida: `branch?.name ?? subject.name`; tizim — «Butun tizim», asosiy kassa — «Asosiy kassa» (ikkalasi
 * tarjimadan, server nomi o'zbekcha); nomsiz — «#<id>».
 */
export const subjectName = (alert: Pick<AiAdvisorAlertListItem, "id" | "branch" | "subject">, t: AdvisorTranslate): string => {
  if (alert.branch?.name) return alert.branch.name;
  if (alert.subject.kind === "system") return t("alerts.subject.system");
  if (alert.subject.kind === "cashbox" && alert.subject.id === MAIN_CASHBOX_SUBJECT_ID) return t("alerts.cashbox.main");
  return alert.subject.name || `#${alert.subject.id ?? alert.id}`;
};

/** Qoida nomi («Smena kamomadi»); noma'lum — «Boshqa qoida». */
export const ruleName = (ruleKey: string, t: AdvisorTranslate): string =>
  isRuleKey(ruleKey) ? t(`rules.${ruleKey}.name`) : t("rules.other");

const isKnown = (alert: AiAdvisorAlertListItem): alert is AiAdvisorKnownAlert => alert.facts !== null;

const isCardBalance = (alert: AiAdvisorAlertListItem) => isKnown(alert) && alert.rule_key === "R7" && alert.facts.source === "card_balance";

/** Qisqa nom (realtime toast, «Jiddiy ogohlantirish — …»): R7 — «Chekda farq bor» / «Karta qoldig'ida farq». */
export const alertShortName = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate): string => {
  if (!isRuleKey(alert.rule_key)) return t("rules.other");
  return isCardBalance(alert) ? t("rules.R7.shortCard") : t(`rules.${alert.rule_key}.short`);
};

/** Gap ichidagi nom: «smena kamomadi», R7 — «chekda farq bor» / «karta qoldig'ida farq». */
export const alertInlineName = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate): string => {
  if (!isRuleKey(alert.rule_key)) return t("rules.otherInline");
  return isCardBalance(alert) ? t("rules.R7.inlineCard") : t(`rules.${alert.rule_key}.inline`);
};

/**
 * Sarlavha summasi (tasdiq oynasi): R7 da summa farqi bo'lmasa (faqat karta yoki valyuta) — `null`: backend chekda
 * `headline_amount` ga farqni (0 ham) qo'yadi, karta qoldig'ida — `null`; «0 so'm» ko'rsatilmaydi.
 */
export const alertHeadlineAmount = (alert: AiAdvisorAlertListItem): number | null =>
  isKnown(alert) && alert.rule_key === "R7" && !alert.facts.mismatch.includes("amount") ? null : alert.headline_amount;

/** Toast va tasdiq qatori: «Samarqand filiali · smena kamomadi». */
export const alertShortLabel = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate): string =>
  `${subjectName(alert, t)} · ${alertInlineName(alert, t)}`;

/**
 * Kassa joyi: filial — «Samarqand filiali kassasida» (nomi olinmagan filial — «#7 kassasida», backend kabi; «#7da»
 * emas), filialsiz (Asosiy) — «Asosiy kassada».
 */
const cashboxPlace = (cashbox: AiAdvisorCashboxRef, branch: AiAdvisorBranchRef | null, t: AdvisorTranslate) =>
  branch
    ? t("alerts.place.branchCashbox", { name: advisorRefName(branch) })
    : t("alerts.place.cashbox", { name: advisorCashboxName(cashbox, t) });

/** Egasi nomi (gap boshida): filial yoki kassa nomi. */
const ownerName = (cashbox: AiAdvisorCashboxRef, branch: AiAdvisorBranchRef | null, t: AdvisorTranslate) =>
  branch?.name || advisorCashboxName(cashbox, t);

/** R7 chek turi: `operation.kind` (round-3 — chek turi), yo'q bo'lsa `receipt_kind`. Karta qoldig'ida — `null`. */
export const receiptKindOf = (facts: Pick<AiAdvisorFactsR7, "operation" | "receipt_kind">): AiAdvisorReceiptKind | null =>
  facts.operation?.kind ?? facts.receipt_kind;

/** HQ'ga o'tkazma cheki (kuryer / filial): karta farqi — «Pul HQ kartasiga tushmagan», `cashbox` — jo'natuvchi. */
export const isTransferReceipt = (facts: Pick<AiAdvisorFactsR7, "operation" | "receipt_kind">): boolean => {
  const kind = receiptKindOf(facts);
  return kind === "courier_to_hq" || kind === "branch_to_hq";
};

/** R7 chek: «Urgut filiali yoqilg'i xarajati», «Urgut filiali kuryer topshirig'i». */
const receiptSubject = (facts: AiAdvisorFactsR7, branch: AiAdvisorBranchRef | null, t: AdvisorTranslate) => {
  const place = ownerName(facts.cashbox, facts.branch ?? branch, t);
  const kind = receiptKindOf(facts);
  if (!kind) return place;
  const category = facts.operation?.category_name;
  const label =
    kind === "courier_to_hq"
      ? t("alerts.operation.courierToHq")
      : kind === "branch_to_hq"
        ? t("alerts.operation.branchToHq")
        : category
          ? t("alerts.operation.expense", { category: lowerFirst(category) })
          : t("alerts.operation.manualExpense");
  return t("rules.R7.what", { place, operation: label });
};

type TitleMode = "list" | "dialog";

const knownTitle = (alert: AiAdvisorKnownAlert, mode: TitleMode, t: AdvisorTranslate, language?: string | null): string => {
  switch (alert.rule_key) {
    case "R1": {
      const f = alert.facts;
      const place = cashboxPlace(f.cashbox, f.branch ?? alert.branch, t);
      if (f.trigger === "single_shortage") {
        return mode === "list"
          ? t("rules.R1.titles.listSingle", { place, amount: money(f.last_difference, language) })
          : t("rules.R1.titles.dialogSingle", { place });
      }
      // «N smena ketma-ket» — uzluksiz manfiy qator (`streak_*`, birlashgan yakka kamomadlarsiz); eski javob — jami.
      const shifts = unit(t, "shifts", f.streak_length ?? f.shifts_count);
      return mode === "list"
        ? t("rules.R1.titles.listConsecutive", { place, shifts, amount: money(f.streak_total ?? f.total_difference, language) })
        : t("rules.R1.titles.dialogConsecutive", { place, shifts });
    }
    case "R2": {
      const f = alert.facts;
      const vars = { courier: advisorUserName(f.courier), amount: money(f.balance, language) };
      if (f.trigger === "growth") return t("rules.R2.titles.growth", { ...vars, days: unit(t, "days", f.growth_days) });
      if (f.days_without_handover === null || (mode === "dialog" && f.trigger === "both")) {
        return t("rules.R2.titles.notHanded", vars);
      }
      return t("rules.R2.titles.handover", { ...vars, days: unit(t, "days", f.days_without_handover) });
    }
    case "R3": {
      const f = alert.facts;
      const vars = {
        place: ownerName(f.cashbox, f.branch ?? alert.branch, t),
        category: f.category.name ? lowerFirst(f.category.name.trim()) : advisorRefName(f.category),
      };
      // Mediana 0 — nisbat yo'q (`ratio_to_median: null`): «odatdagidan ko'p», sonsiz.
      if (f.ratio_to_median === null) {
        return mode === "list"
          ? t("rules.R3.titles.listNoRatio", { ...vars, amount: money(f.amount, language) })
          : t("rules.R3.titles.dialogNoRatio", vars);
      }
      const ratio = ratioText(f.ratio_to_median, language);
      return mode === "list"
        ? t("rules.R3.titles.list", { ...vars, ratio, amount: money(f.amount, language) })
        : t("rules.R3.titles.dialog", { ...vars, ratio });
    }
    case "R4": {
      const f = alert.facts;
      const vars = { market: advisorRefName(f.market), days: unit(t, "days", f.days_without_payout) };
      return mode === "list"
        ? t("rules.R4.titles.list", { ...vars, amount: money(f.debt, language) })
        : t("rules.R4.titles.dialog", vars);
    }
    case "R5": {
      const f = alert.facts;
      const vars = { branch: advisorRefName(f.branch), days: unit(t, "days", f.days_without_transfer) };
      return mode === "list"
        ? t("rules.R5.titles.list", { ...vars, amount: money(f.balance, language) })
        : t("rules.R5.titles.dialog", vars);
    }
    case "R6": {
      const f = alert.facts;
      const amount = money(f.net, language);
      if (f.period === "week") {
        const range = formatAdvisorWeekRange(f.from, f.to, t);
        return t(mode === "list" ? "rules.R6.titles.listWeek" : "rules.R6.titles.dialogWeek", { range, amount });
      }
      return mode === "list"
        ? t("rules.R6.titles.listDay", { date: formatAdvisorDayMonth(f.from), amount })
        : t("rules.R6.titles.dialogDay", { date: formatAdvisorDay(f.from), amount });
    }
    case "R7": {
      const f = alert.facts;
      if (f.source === "card_balance") return t("rules.R7.titles.cardBalance", { cashbox: advisorCashboxName(f.cashbox, t) });
      const what = receiptSubject(f, alert.branch, t);
      const card = f.mismatch.includes("card");
      // Karta farqi chek turiga qarab: qo'lda chiqim — «karta mos emas», o'tkazma — «pul HQ kartasiga tushmagan».
      const cardSuffix = isTransferReceipt(f) ? "Transfer" : "Card";
      // Ro'yxatda ikkinchi farq sarlavhada ham; oynada — belgilarda (maket).
      const withCard = mode === "list" && card;
      if (f.mismatch.includes("currency")) {
        return t(withCard ? `rules.R7.titles.receiptCurrency${cardSuffix}` : "rules.R7.titles.receiptCurrency", { what });
      }
      const amountMismatch = f.mismatch.includes("amount") || !card;
      if (!amountMismatch) return t(isTransferReceipt(f) ? "rules.R7.titles.receiptTransfer" : "rules.R7.titles.receiptCard", { what });
      return t(withCard ? `rules.R7.titles.receiptAmount${cardSuffix}` : "rules.R7.titles.receiptAmount", { what });
    }
    case "R8": {
      const f = alert.facts;
      const vars = {
        range: formatAdvisorWeekRange(f.from, f.to, t),
        corrections: unit(t, "corrections", f.count),
      };
      // Oldingi 30 kunda tuzatish bo'lmagan (baza 0) — nisbat yo'q (`ratio: null`).
      if (f.ratio === null) return t(mode === "list" ? "rules.R8.titles.listNoBaseline" : "rules.R8.titles.dialogNoBaseline", vars);
      const ratio = ratioText(f.ratio, language);
      return t(mode === "list" ? "rules.R8.titles.list" : "rules.R8.titles.dialog", { ...vars, ratio });
    }
  }
};

/** Ro'yxat sarlavhasi (summa bilan); noma'lum qoida — server `title`. */
export const alertListTitle = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate, language?: string | null): string =>
  isKnown(alert) ? knownTitle(alert, "list", t, language) : alert.title || ruleName(alert.rule_key, t);

/** Oyna sarlavhasi (summa faktlarda); noma'lum qoida — server `title`. */
export const alertDialogTitle = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate, language?: string | null): string =>
  isKnown(alert) ? knownTitle(alert, "dialog", t, language) : alert.title || ruleName(alert.rule_key, t);

/** Ost-qatordagi joy: R6 — «butun tizim», R4/R8 — yo'q, qolgani — filial (filialsiz kassa — kassa nomi). */
const sublinePlace = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate): string | null => {
  if (!isKnown(alert)) {
    if (alert.branch?.name) return alert.branch.name;
    if (alert.subject.kind === "system") return t("alerts.subline.system");
    return alert.subject.name ? subjectName(alert, t) : null;
  }
  switch (alert.rule_key) {
    case "R4":
    case "R8":
      return null;
    case "R6":
      return t("alerts.subline.system");
    case "R2":
      return alert.branch?.name || alert.facts.branch?.name || null;
    case "R5":
      return advisorRefName(alert.facts.branch);
    default:
      return alert.branch?.name || alert.facts.branch?.name || advisorCashboxName(alert.facts.cashbox, t);
  }
};

/** «Smena kamomadi · Samarqand filiali», «Zarar · butun tizim», «Market to'lovi kechikmoqda». */
export const alertSubline = (alert: AiAdvisorAlertListItem, t: AdvisorTranslate): string => {
  const rule = ruleName(alert.rule_key, t);
  const place = sublinePlace(alert, t);
  return place ? `${rule} · ${place}` : rule;
};

const thresholdOf = (key: AiAdvisorRuleKey, thresholds: AiAdvisorThresholds, field: AiAdvisorThresholdField) =>
  thresholds[field] ?? DEFAULT_RULE_LIMITS[key][field]?.default ?? 0;

/**
 * Qoida sharti (ochilgan paytdagi chegaralar bilan): «Bir smenada 50 000 so'mdan ko'p yoki 3 smena ketma-ket
 * kamomad». Chegara yo'q bo'lsa — #644 sukuti; noma'lum qoida — `null`.
 */
export const ruleConditionText = (
  rule: { key: string; thresholds: AiAdvisorThresholds },
  t: AdvisorTranslate,
  language?: string | null,
): string | null => {
  const key = rule.key;
  if (!isRuleKey(key)) return null;
  const value = (field: AiAdvisorThresholdField) => thresholdOf(key, rule.thresholds, field);
  switch (key) {
    case "R1":
      return t("rules.R1.condition", {
        shortage: money(value("shortage_uzs"), language),
        shifts: unit(t, "shifts", value("consecutive_negative")),
      });
    case "R2":
      return t("rules.R2.condition", {
        growthDays: unit(t, "days", value("growth_days")),
        balance: money(value("balance_uzs"), language),
        daysOver: unit(t, "daysOver", value("no_handover_days")),
      });
    case "R3":
      return t("rules.R3.condition", { multiplier: ratioText(value("mad_multiplier"), language) });
    case "R4":
      return t("rules.R4.condition", { daysOver: unit(t, "daysOver", value("days_without_payout")) });
    case "R5":
      return t("rules.R5.condition", {
        balance: money(value("balance_uzs"), language),
        daysOver: unit(t, "daysOver", value("days_without_transfer")),
      });
    case "R8":
      return t("rules.R8.condition", { ratio: ratioText(value("ratio"), language) });
    default:
      return t(`rules.${key}.condition`);
  }
};
