import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { refreshCashboxQueries, shift } from "../../entities/payments";
import { formatTimeLocalized } from "../../shared/lib/formatDateTime";
import { notify } from "../../shared/lib/notify";

/**
 * Smena va kassa jonli hodisalari (rWdLuoP3). Nomlar kartadan — backend «Smena: avtomatik yopish» (y8Tqm9Ap) va
 * «Smena yopilishi: karta qoldig'i» (kiZgTybn) kartalari bilan kelishiladi; nom o'zgarsa faqat shu ro'yxat.
 *  - `finance.shift.closed` — smena qo'lda yopildi (boshqa tab, boshqa kassir);
 *  - `finance.shift.auto_closed` — smena jadval bo'yicha avtomatik yopildi (kassirga xabar ham);
 *  - `finance.shift.account_checked` — karta qoldig'ining AI tekshiruvi tugadi (smena yopish oynasi o'qiydi).
 *
 * ⚠️ Modul `RealtimeSync` da socket.io bilan birga DINAMIK yuklanadi (kirgandan keyin): statik import moliya
 * modulini ilova kirish bo'lagiga qo'shib, /login ni og'irlashtirardi (login-performance byudjeti).
 */
export const FINANCE_SHIFT_EVENTS = [
  "finance.shift.closed",
  "finance.shift.auto_closed",
  "finance.shift.account_checked",
] as const;

export type FinanceShiftEvent = (typeof FINANCE_SHIFT_EVENTS)[number];

/** Avtomatik yopilish vaqti: backend `closed_at` (yoki `closedAt`), bo'lmasa — hodisa kelgan payt. */
export const readClosedAt = (payload: unknown): Date => {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const raw = record.closed_at ?? record.closedAt;
  const date = typeof raw === "string" || typeof raw === "number" ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
};

/** Ochiq kassa sahifalari (asosiy kassa, filial kassasi, To'lovlar) — smena holati va qoldiqlar qayta o'qiladi. */
export const refreshShiftQueries = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [shift], refetchType: "active" }),
    refreshCashboxQueries(client),
  ]);

/** Hodisa: so'rovlar yangilanadi; avtomatik yopilganda kassirga «Smena avtomatik yopildi — HH:MM». */
export const handleShiftEvent = (client: QueryClient, t: TFunction, event: FinanceShiftEvent, payload: unknown) => {
  void refreshShiftQueries(client);
  if (event !== "finance.shift.auto_closed") return;
  const closedAt = readClosedAt(payload);
  notify.info(t("realtime.shiftAutoClosed", { time: formatTimeLocalized(closedAt) }), {
    id: `elchi-shift-auto-closed-${closedAt.getTime()}`,
  });
};
