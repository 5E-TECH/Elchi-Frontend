import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { refreshCashboxQueries, refreshReceiptQueries, shift } from "../../entities/payments";
import { formatTimeLocalized } from "../../shared/lib/formatDateTime";
import { notify } from "../../shared/lib/notify";

/**
 * Smena va kassa jonli hodisalari (rWdLuoP3). Nomlar kartadan — backend «Smena: avtomatik yopish» (y8Tqm9Ap) va
 * «Smena yopilishi: karta qoldig'i» (kiZgTybn) kartalari bilan kelishiladi; nom o'zgarsa faqat shu ro'yxat.
 *  - `finance.shift.closed` — smena qo'lda yopildi (boshqa tab, boshqa kassir);
 *  - `finance.shift.auto_closed` — smena jadval bo'yicha avtomatik yopildi (kassirga xabar ham);
 *  - `finance.shift.account_checked` — karta qoldig'ining AI tekshiruvi tugadi (smena yopish oynasi o'qiydi);
 *  - `finance.cashbox.card_changed` — kassa kartasida operatsiya (yaratish, o'tkazma, konvertatsiya; backend
 *    2026-10-25): smenaga tegmaydi — faqat kassa qoldiqlari (naqd / karta) qayta o'qiladi;
 *  - `finance.receipt.checked` — chekning AI tahlili tugadi (QlLf33Ma): chek tafsiloti va kassa tarixi qayta o'qiladi,
 *    natija sahifa yangilanmay ko'rinadi.
 *
 * ⚠️ Modul `RealtimeSync` da socket.io bilan birga DINAMIK yuklanadi (kirgandan keyin): statik import moliya
 * modulini ilova kirish bo'lagiga qo'shib, /login ni og'irlashtirardi (login-performance byudjeti).
 */
export const FINANCE_EVENTS = [
  "finance.shift.closed",
  "finance.shift.auto_closed",
  "finance.shift.account_checked",
  "finance.cashbox.card_changed",
  "finance.receipt.checked",
] as const;

export type FinanceEvent = (typeof FINANCE_EVENTS)[number];

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

/**
 * Hodisa: so'rovlar yangilanadi (karta hodisasida — faqat kassa, smena holati qayta so'ralmaydi); avtomatik
 * yopilganda kassirga «Smena avtomatik yopildi — HH:MM».
 */
export const handleFinanceEvent = (client: QueryClient, t: TFunction, event: FinanceEvent, payload: unknown) => {
  if (event === "finance.cashbox.card_changed") {
    void refreshCashboxQueries(client);
    return;
  }
  if (event === "finance.receipt.checked") {
    void refreshReceiptQueries(client);
    return;
  }
  void refreshShiftQueries(client);
  if (event !== "finance.shift.auto_closed") return;
  const closedAt = readClosedAt(payload);
  notify.info(t("realtime.shiftAutoClosed", { time: formatTimeLocalized(closedAt) }), {
    id: `elchi-shift-auto-closed-${closedAt.getTime()}`,
  });
};
