import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { isAlertId, isRuleKey } from "../../entities/ai-advisor/model/advisorRules";
import { queryKeys } from "../../shared/config/queryKeys";

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

/** `overview` (tab nishoni, banner) va ro'yxatlar (sanoqlar ham) — ochiqlari darhol, qolgani keyingi ochilishda. */
export const refreshAdvisorQueries = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.aiAdvisor.overview }),
    client.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alertLists }),
  ]);

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
