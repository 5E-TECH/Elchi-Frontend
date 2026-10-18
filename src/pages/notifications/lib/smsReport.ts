import type { SmsMessageClass, SmsReport, SmsReportDay } from "../../../entities/sms";

/**
 * SMS XARAJAT HISOBOTI — `GET /notifications/sms/report?from&to` qatorlaridan (Toshkent kuni × sinf: soni, yetkazilgan,
 * xato, bo'laklar, so'm, tarifsizlar) maket `superadmin-notifications-sms-report` bloklari uchun hosilalar.
 * Backend kun kalitini `to_char(created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')` bilan beradi.
 */

export const REPORT_CLASSES: readonly SmsMessageClass[] = ["transactional", "promo", "security"];

const DAY_MS = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Lahzaning Toshkent kuni: «YYYY-MM-DD» (Toshkent UTC+5, yozgi vaqt yo'q). */
export const tashkentDay = (date: Date = new Date()) =>
  new Date(date.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);

/** «YYYY-MM-DD» + n kun. */
export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Ikki kun orasidagi barcha kunlar (ikkalasi ham kiradi), eskisidan yangisiga. */
export const daysBetween = (from: string, to: string): string[] => {
  const result: string[] = [];
  if (!from || !to || from > to) return result;
  for (let day = from; day <= to && result.length < 400; day = addDays(day, 1)) result.push(day);
  return result;
};

/** Sukut davri: oxirgi 30 kun (bugun ham kiradi), Toshkent kuni bo'yicha. */
export const defaultReportRange = (now: Date = new Date()) => {
  const to = tashkentDay(now);
  return { from: addDays(to, -29), to };
};

/**
 * So'rov parametrlari (avvalgidek): `from` — tanlangan kunning Toshkentdagi boshlanishi, `to` — oxirgi kundan
 * keyingi kunning boshlanishi (yarim ochiq oraliq).
 */
export const reportQueryRange = (from: string, to: string) => ({
  from: `${from}T00:00:00+05:00`,
  to: `${addDays(to, 1)}T00:00:00+05:00`,
});

export type DailyPoint = Record<SmsMessageClass, number> & {
  day: string;
  total: number;
  parts: number;
  cost: number;
};

/** Kunlik qatorlar — davrdagi har kun (SMS bo'lmagan kun — nol), sinf bo'yicha soni, jami bo'laklar va so'm. */
export const buildDaily = (
  rows: readonly SmsReportDay[],
  from: string,
  to: string,
): DailyPoint[] => {
  const byDay = new Map<string, DailyPoint>();
  for (const day of daysBetween(from, to)) {
    byDay.set(day, { day, transactional: 0, promo: 0, security: 0, total: 0, parts: 0, cost: 0 });
  }
  for (const row of rows) {
    const point =
      byDay.get(row.day) ??
      ({
        day: row.day,
        transactional: 0,
        promo: 0,
        security: 0,
        total: 0,
        parts: 0,
        cost: 0,
      } satisfies DailyPoint);
    point[row.message_class] += row.total;
    point.total += row.total;
    point.parts += row.parts;
    point.cost += Number(row.cost) || 0;
    byDay.set(row.day, point);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
};

export type ClassSummary = {
  messageClass: SmsMessageClass;
  total: number;
  delivered: number;
  failed: number;
  /** Operatordan javob kutayotganlar: jami − yetkazilgan − xato. */
  pending: number;
  parts: number;
  cost: number;
  untariffed: number;
  /** Xarajat ulushi, % (jami xarajat 0 bo'lsa — 0). */
  costShare: number;
  /** Yetkazilgan / jami, % (jami 0 bo'lsa — `null`). */
  deliveryRate: number | null;
  /** Bu sinfning birorta SMS'i ham tariflanmagan — narx hisoblanmagan. */
  notCounted: boolean;
};

/** Sinflar bo'yicha yig'indi (har doim uchala sinf, maket tartibida). */
export const summarizeByClass = (rows: readonly SmsReportDay[]): ClassSummary[] => {
  const totalCost = rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
  return REPORT_CLASSES.map((messageClass) => {
    const own = rows.filter((row) => row.message_class === messageClass);
    const total = own.reduce((sum, row) => sum + row.total, 0);
    const delivered = own.reduce((sum, row) => sum + row.delivered, 0);
    const failed = own.reduce((sum, row) => sum + row.failed, 0);
    const parts = own.reduce((sum, row) => sum + row.parts, 0);
    const cost = own.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
    const untariffed = own.reduce((sum, row) => sum + row.untariffed, 0);
    return {
      messageClass,
      total,
      delivered,
      failed,
      pending: Math.max(total - delivered - failed, 0),
      parts,
      cost,
      untariffed,
      costShare: totalCost > 0 ? (cost / totalCost) * 100 : 0,
      deliveryRate: total > 0 ? (delivered / total) * 100 : null,
      notCounted: total > 0 && untariffed >= total,
    };
  });
};

export type ReportTotals = {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  parts: number;
  cost: number;
  untariffed: number;
  /** «Yetkazildi / jami yuborilgan», % — maketdagi yorliq bo'yicha (jami 0 — `null`). */
  deliveryRate: number | null;
  /** Kuniga o'rtacha SMS (davrdagi kunlar soniga). */
  perDay: number;
  /** 1 SMS = o'rtacha N bo'lak. */
  partsPerSms: number | null;
};

export const summarizeTotals = (report: SmsReport, dayCount: number): ReportTotals => {
  const { total, delivered, failed, parts, cost, untariffed } = report.totals;
  return {
    total,
    delivered,
    failed,
    pending: Math.max(total - delivered - failed, 0),
    parts,
    cost: Number(cost) || 0,
    untariffed,
    deliveryRate: total > 0 ? (delivered / total) * 100 : null,
    perDay: dayCount > 0 ? total / dayCount : 0,
    partsPerSms: total > 0 ? parts / total : null,
  };
};

/** Muvaffaqiyat zonasi (DESIGN_SYSTEM §3): ≥ 70 — yaxshi, 40–70 — o'rtacha, < 40 — past. */
export const deliveryZone = (rate: number): "success" | "warning" | "danger" =>
  rate >= 70 ? "success" : rate >= 40 ? "warning" : "danger";

/** «Kunlar bo'yicha» jadvali: yangi kun tepada, kun ichida sinflar maket tartibida. */
export const sortDayRows = (rows: readonly SmsReportDay[]) =>
  [...rows].sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      REPORT_CLASSES.indexOf(a.message_class) - REPORT_CLASSES.indexOf(b.message_class),
  );
