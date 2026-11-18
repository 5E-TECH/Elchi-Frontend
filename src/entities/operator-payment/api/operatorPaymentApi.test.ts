import { describe, expect, it } from "vitest";
import {
  normalizeEarningsTotal,
  normalizeMyOperatorBalance,
  normalizeMyOperatorPayments,
  normalizeOperatorBalances,
  normalizeOperatorPayment,
  normalizeOperatorPaymentList,
  normalizeOperatorPaymentResult,
} from "./operatorPaymentApi";

/** F2qp6FtE — backend javob shakllari (market ko'rinishi va operatorning `/me` qatori) normalizatsiyasi. */
describe("operator-payment normalizatorlari", () => {
  it("balanslar: konvertdan, satr sonlar, manfiy qoldiq; totals yo'q bo'lsa — yig'indi", () => {
    const res = normalizeOperatorBalances({
      statusCode: 200,
      data: {
        items: [
          { operator_id: "41", operator_name: "Madina", status: "active", earned: "1000.50", paid: 400, balance: "600.50", payments_count: "2", last_paid_at: "2026-11-15" },
          { operator_id: 42, operator_name: "Sevara", status: "inactive", earned: 100, paid: 150 },
          { operator_name: "id siz" },
        ],
      },
    });
    expect(res.items).toEqual([
      { operatorId: "41", operatorName: "Madina", status: "active", earned: 1000.5, paid: 400, balance: 600.5, paymentsCount: 2, lastPaidAt: "2026-11-15" },
      { operatorId: "42", operatorName: "Sevara", status: "inactive", earned: 100, paid: 150, balance: -50, paymentsCount: 0, lastPaidAt: null },
    ]);
    expect(res.totals).toEqual({ earned: 1100.5, paid: 550, balance: 550.5 });
  });

  it("market ko'rinishi: holat, manba, bekor qilish; `can_cancel` faqat faol qatorda", () => {
    expect(
      normalizeOperatorPayment({
        id: 9, operator_id: "41", operator_name: null, amount: "150000.00", paid_at: "2026-11-15", note: " Avans ",
        source: "market", affects_cashbox: false, created_at: "2026-11-15T09:30:00.000Z", status: "cancelled",
        cancelled_at: "2026-11-16T10:00:00.000Z", cancel_reason: "Xato", can_cancel: true,
      }),
    ).toEqual({
      id: "9", operatorId: "41", operatorName: null, amount: 150000, paidAt: "2026-11-15", note: "Avans", source: "market",
      affectsCashbox: false, createdAt: "2026-11-15T09:30:00.000Z", status: "cancelled", cancelledAt: "2026-11-16T10:00:00.000Z",
      cancelReason: "Xato", canCancel: false,
    });
  });

  it("`/me/payments` eski qatori (paid_at siz, `createdAt`, `comment`) — sana createdAt dan, manba elchi", () => {
    const list = normalizeMyOperatorPayments({
      statusCode: 200,
      data: { rows: [{ id: "1", operator_id: "77", amount: 4000, comment: "avans", createdAt: "2026-10-05T07:00:00.000Z" }], total: 3 },
    });
    expect(list.total).toBe(3);
    expect(list.items[0]).toMatchObject({ paidAt: "2026-10-05", note: "avans", source: "elchi", status: "active", canCancel: false });
  });

  it("ro'yxat sahifasi, natija (`idempotent`), `/me/balance`, daromad jami", () => {
    expect(
      normalizeOperatorPaymentList({ statusCode: 200, data: { items: [{ id: "1" }], pagination: { total: 41, page: 3, limit: 20 } } }, { page: 1, limit: 20 }),
    ).toMatchObject({ total: 41, page: 3, limit: 20 });
    expect(normalizeOperatorPaymentResult({ statusCode: 200, data: { id: "5", amount: 10, idempotent: true } })).toMatchObject({
      idempotent: true,
      payment: { id: "5", amount: 10 },
    });
    expect(normalizeMyOperatorBalance({ statusCode: 200, data: { operator_id: "77", earned: 12000, paid: 4000, balance: 8000 } })).toEqual({
      earned: 12000,
      paid: 4000,
      balance: 8000,
    });
    expect(normalizeMyOperatorBalance({ statusCode: 200, data: null })).toBeNull();
    expect(normalizeEarningsTotal({ statusCode: 200, data: { rows: [], total: 82 } })).toBe(82);
    expect(normalizeEarningsTotal({ statusCode: 200, data: {} })).toBeNull();
  });
});
