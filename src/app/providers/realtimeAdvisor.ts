import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
// Chuqur import ataylab: modul socket bilan birga dinamik bo'lakda — `entities/ai-advisor` barreli (UI, so'rovlar,
// normalizatorlar) bu bo'lakka kirmasin, faqat `advisorRules` dagi ikki tekshiruv kerak.
import { isAlertId, isRuleKey } from "../../entities/ai-advisor/model/advisorRules";
import { queryKeys } from "../../shared/config/queryKeys";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";

/**
 * AI maslahatchining jiddiy ogohlantirishi — jonli kanal (60PWUbgC, shartnoma v0.3 §9.3–9.4; maket
 * `tizim-ai-advisor-messages` «Jiddiy ogohlantirish · ilova ochiq»).
 *
 * Backend `notification:new` ni `type: "ai.advisor_alert"` bilan yuboradi: aniq qabul qiluvchiga (faol superadminlar,
 * `recipient_ids`) — to'liq qator (`id`, `title`, `body`, `link`, `data`), rol orqali — faqat
 * `{ type, category, priority }` signali. Ikkalasida ham `overview` (tab nishoni, banner) va ogohlantirishlar
 * ro'yxatlari (sanoqlar ham shu prefiks ostida) qayta o'qiladi; qatorli hodisa — foydalanuvchi yopguncha turadigan
 * xabar (`RealtimeSync`). Tafsilot (`GET alerts/:id`) bu yerda so'ralmaydi — u ogohlantirishni «Ko'rildi» qiladi.
 *
 * Ogohlantirish o'zgarishi (`ai.advisor.alert_changed`, summasiz) — `readAdvisorAlertChange` → `overview`, ro'yxatlar va
 * ochiq tafsilot qayta o'qiladi (AI izohi tayyor bo'lganda ham — poll'dan oldin).
 *
 * Xabar matni (maket): «Jiddiy ogohlantirish» + «{qisqa nom} — {joy}» («Chekda farq bor — Urgut filiali»). Qisqa nom
 * `data.rule_key` (+ R7 da `data.variant`) dan, uchala tilda (`aiAdvisor:rules.*`); joy — `data.subject_name`
 * (`branch?.name ?? subject.name`, server bergan nom). Qoida noma'lum bo'lsa — serverning o'zbekcha `title`i
 * («Jiddiy ogohlantirish · …») va izohda joy (yo'q bo'lsa — `body`).
 *
 * ⚠️ Modul `RealtimeSync` da socket.io bilan birga DINAMIK yuklanadi (kirgandan keyin) — ilova kirish bo'lagiga
 * qo'shilmaydi. Matnlar `aiAdvisor` nomlar fazosidan kalit prefiksi bilan o'qiladi (`RealtimeSync` uni
 * `useTranslation` bilan so'ramaydi — aks holda to'g'ridan-to'g'ri `/login` da hamma tarjima yuklanardi); kalit
 * topilmasa — server matni.
 */
export const ADVISOR_ALERT_TYPE = "ai.advisor_alert";

/** `notification:new` qatori yoki signalidan kerakli qism. */
export type AdvisorRealtimePayload = {
  type?: string | null;
  title?: string | null;
  body?: string | null;
  link?: string | null;
  data?: unknown;
};

export type AdvisorAlertToast = {
  title: string;
  description?: string;
  /** Xom havola (`/ai-assistant?tab=alerts&alert=:id`); xavfsizligini chaqiruvchi tekshiradi. */
  link: string | null;
};

/** Maslahatchi ogohlantirishi hodisasimi (qatorli yoki signal). */
export const isAdvisorAlert = (payload: AdvisorRealtimePayload | null | undefined): boolean =>
  payload?.type === ADVISOR_ALERT_TYPE;

/**
 * Ogohlantirish oynasi ochiqmi: tafsilot so'rovining faol kuzatuvchisi bor (yopiq oynada `enabled: false` — faol emas).
 */
export const isAlertDialogOpen = (client: QueryClient): boolean =>
  client
    .getQueryCache()
    .findAll({ queryKey: queryKeys.aiAdvisor.alertDetails })
    .some((query) => query.isActive());

/**
 * `overview` (tab nishoni, banner) va ro'yxatlar (sanoqlar ham) — ochiqlari darhol, qolgani keyingi ochilishda.
 * `alertIds` — ochiq tafsilot oynasi ham (faqat faol so'rov qayta o'qiladi: yopiq oyna uchun `GET :id` — u «Ko'rildi»
 * qiladi — yuborilmaydi, kesh eskirgan deb belgilanadi).
 *
 * D16: ogohlantirish oynasi ochiq bo'lsa ro'yxatlar faqat eskirgan deb belgilanadi (`refetchType: "none"`) — oynani
 * ochish (`GET :id`) o'zi «Ko'rildi» hodisasini chiqaradi, ro'yxat oyna ortida qayta o'qilsa `?status=new` da ochilgan
 * qator yo'qolib, fokus o'z havolasiga qaytolmasdi. Oyna yopilganda ro'yxatni o'zi yangilaydi (`AlertDialog`).
 */
export const refreshAdvisorQueries = (client: QueryClient, alertIds: readonly string[] = []) =>
  Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.aiAdvisor.overview }),
    client.invalidateQueries({
      queryKey: queryKeys.aiAdvisor.alertLists,
      refetchType: isAlertDialogOpen(client) ? "none" : "active",
    }),
    ...alertIds.map((id) => client.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alert(id) })),
  ]);

/**
 * Backend realtime hodisasi (§12, BE-5 4–5-qism): superadminlarga, summasiz —
 * `{alert_id, rule_key, severity, status, change: opened|occurred|status|explanation, explanation_status, at}`.
 * Ochilish / takror (har tekshiruv), «Ko'rildi», «Hal qilindi» / «Ahamiyatsiz» va AI izohi tayyor / xato bo'lganda.
 */
export const ADVISOR_CHANGED_EVENT = "ai.advisor.alert_changed";

export type AdvisorAlertChange = {
  alertId: string;
  /** Ochiq tafsilotni qayta o'qish kerakmi (izoh tayyor, holat o'zgardi, yangi takror). */
  refetchDetail: boolean;
};

/**
 * `ai.advisor.alert_changed` yuki → yangilash rejasi; ID yaroqsiz — `null` (hech narsa qilinmaydi). `GET :id` ning
 * o'zi chiqaradigan «Ko'rildi» (`change: status`, `status: seen`, faqat new → seen) — ro'yxat va nishon yangilanadi,
 * tafsilot emas (u hozirgina o'qilgan); oyna ochiq bo'lsa ro'yxat — u yopilgach (`refreshAdvisorQueries`, D16).
 * `change: explanation` — izoh `pending` dan chiqdi: tafsilot qayta o'qiladi va poll to'xtaydi (`useAdvisorAlert`).
 */
export const readAdvisorAlertChange = (payload: unknown): AdvisorAlertChange | null => {
  const data = readData(payload);
  const id = typeof data.alert_id === "number" ? String(data.alert_id) : data.alert_id;
  if (!isAlertId(id)) return null;
  const seenOnly = data.change === "status" && data.status === "seen";
  return { alertId: id, refetchDetail: !seenOnly };
};

const readData = (data: unknown): Record<string, unknown> =>
  data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};

const readText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Qisqa nom (maket, shartnoma §9.3): R7 chek — «Chekda farq bor», karta — «Karta qoldig'ida farq», qolgani — qoida. */
const shortName = (data: Record<string, unknown>, t: TFunction): string => {
  const ruleKey = data.rule_key;
  if (!isRuleKey(ruleKey)) return "";
  const key = ruleKey === "R7" && data.variant === "card_balance" ? "rules.R7.shortCard" : `rules.${ruleKey}.short`;
  return readText(t(`aiAdvisor:${key}`, { defaultValue: "" }));
};

/** Havola: server `link`; bo'lmasa — `data.alert_id` dan ogohlantirish oynasi. */
const alertLink = (row: AdvisorRealtimePayload, data: Record<string, unknown>): string | null => {
  if (typeof row.link === "string" && row.link) return row.link;
  const id = typeof data.alert_id === "number" ? String(data.alert_id) : data.alert_id;
  return isAlertId(id) ? `/ai-assistant?tab=alerts&alert=${id}` : null;
};

/** Qatorli hodisadan xabar matni va havolasi. */
export const advisorAlertToast = (row: AdvisorRealtimePayload, t: TFunction): AdvisorAlertToast => {
  const data = readData(row.data);
  const subject = readText(data.subject_name);
  const serverTitle = readText(row.title);
  const short = shortName(data, t);
  const link = alertLink(row, data);
  if (short) {
    return {
      title: readText(t("aiAdvisor:messages.alert.toastTitle", { defaultValue: "" })) || serverTitle,
      description: subject ? t("aiAdvisor:messages.alert.toastText", { rule: short, subject }) : short,
      link,
    };
  }
  return { title: serverTitle, description: subject || readText(row.body) || undefined, link };
};

/** Bir nechta jiddiy ogohlantirish — jadval faqat jiddiylar bilan (banner «Faqat jiddiylar» bilan bir xil). */
export const ADVISOR_CRITICAL_LIST_LINK = "/ai-assistant?tab=alerts&severity=critical";

/**
 * Bitta yig'ish oynasida bir nechta jiddiy ogohlantirish — BITTA xabar: «N ta jiddiy ogohlantirish» + qisqa nomlar
 * (« · », takrorsiz — banner ost-qatoridagidek), «Ochish» → faqat jiddiylar ro'yxati. Aks holda har biri yopilguncha
 * turadigan alohida xabar bo'lib, `MAX_TOASTS` dan oshganlari jimgina tushib qolardi. Maket yo'q — eng yaqini
 * «N ta yangi bildirishnoma» (`notifications:realtime.manyNew`, kalit topilmasa — shu matn).
 */
export const advisorAlertsBatchToast = (
  rows: readonly AdvisorRealtimePayload[],
  t: TFunction,
  language: string,
): AdvisorAlertToast => {
  const count = rows.length;
  const names = [...new Set(rows.map((row) => shortName(readData(row.data), t)).filter(Boolean))];
  const title =
    readText(t("aiAdvisor:messages.alert.toastMany", { count, value: formatNumberLocalized(count, { language }), defaultValue: "" })) ||
    t("realtime.manyNew", { count });
  return { title, description: names.length ? names.join(" · ") : undefined, link: ADVISOR_CRITICAL_LIST_LINK };
};
