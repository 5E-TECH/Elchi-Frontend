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
 *  - `finance.shift.auto_opened` — smena jadval bo'yicha avtomatik ochildi («Kun tartibi», 2026-11-10; payload
 *    `{ shift_id, cashbox_type, branch_id?, opened_at }`): smena va kassa qayta o'qiladi, kassirga xabar;
 *  - `finance.shift.account_checked` — karta qoldig'ining AI tekshiruvi tugadi (smena yopish oynasi o'qiydi);
 *  - `finance.cashbox.card_changed` — kassa kartasida operatsiya (yaratish, o'tkazma, konvertatsiya; backend
 *    2026-10-25): smenaga tegmaydi — faqat kassa qoldiqlari (naqd / karta) qayta o'qiladi;
 *  - `finance.receipt.checked` — chekning AI tahlili tugadi (QlLf33Ma): chek tafsiloti va kassa tarixi qayta o'qiladi,
 *    natija sahifa yangilanmay ko'rinadi;
 *  - `finance.payment.corrected` — to'lov qaytarildi yoki summasi tahrirlandi (T6-FE-3, 2wgTzcG0; payload summasiz:
 *    `{ correction_id, action, payment_kind, cashbox_type, branch_id?, cashbox_ids, at }`): faqat kassa so'rovlari
 *    (qoldiqlar, tarix, ochiq tafsilot) REST'dan qayta o'qiladi, smena holati so'ralmaydi, xabar yo'q. Filial qabul
 *    qilgan to'lovda hodisa superadmin/adminga kelmaydi (backend xonalari) — tuzatish so'rovining o'zi kassani
 *    yangilashi kerak (T6-FE-2).
 *
 * ⚠️ Modul `RealtimeSync` da socket.io bilan birga DINAMIK yuklanadi (kirgandan keyin): statik import moliya
 * modulini ilova kirish bo'lagiga qo'shib, /login ni og'irlashtirardi (login-performance byudjeti).
 */
export const FINANCE_EVENTS = [
  "finance.shift.closed",
  "finance.shift.auto_closed",
  "finance.shift.auto_opened",
  "finance.shift.account_checked",
  "finance.cashbox.card_changed",
  "finance.receipt.checked",
  "finance.payment.corrected",
] as const;

export type FinanceEvent = (typeof FINANCE_EVENTS)[number];

const readMoment = (payload: unknown, snake: string, camel: string): Date => {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const raw = record[snake] ?? record[camel];
  const date = typeof raw === "string" || typeof raw === "number" ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
};

/** Avtomatik yopilish vaqti: backend `closed_at` (yoki `closedAt`), bo'lmasa — hodisa kelgan payt. */
export const readClosedAt = (payload: unknown): Date => readMoment(payload, "closed_at", "closedAt");

/** Avtomatik ochilish vaqti: backend `opened_at` (yoki `openedAt`), bo'lmasa — hodisa kelgan payt. */
export const readOpenedAt = (payload: unknown): Date => readMoment(payload, "opened_at", "openedAt");

/** Ochiq kassa sahifalari (asosiy kassa, filial kassasi, To'lovlar) — smena holati va qoldiqlar qayta o'qiladi. */
export const refreshShiftQueries = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [shift], refetchType: "active" }),
    refreshCashboxQueries(client),
  ]);

/**
 * Hodisa: so'rovlar yangilanadi (karta hodisasida va to'lov tuzatilganda — faqat kassa, smena holati qayta
 * so'ralmaydi); avtomatik yopilganda kassirga «Smena avtomatik yopildi — HH:MM».
 */
export const handleFinanceEvent = (client: QueryClient, t: TFunction, event: FinanceEvent, payload: unknown) => {
  if (event === "finance.cashbox.card_changed" || event === "finance.payment.corrected") {
    void refreshCashboxQueries(client);
    return;
  }
  if (event === "finance.receipt.checked") {
    void refreshReceiptQueries(client);
    return;
  }
  void refreshShiftQueries(client);
  if (event === "finance.shift.auto_opened") {
    const openedAt = readOpenedAt(payload);
    notify.info(t("realtime.shiftAutoOpened", { time: formatTimeLocalized(openedAt) }), {
      id: `elchi-shift-auto-opened-${openedAt.getTime()}`,
    });
    return;
  }
  if (event !== "finance.shift.auto_closed") return;
  const closedAt = readClosedAt(payload);
  notify.info(t("realtime.shiftAutoClosed", { time: formatTimeLocalized(closedAt) }), {
    id: `elchi-shift-auto-closed-${closedAt.getTime()}`,
  });
};
