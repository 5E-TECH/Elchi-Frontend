import { describe, expect, it } from "vitest";
import {
  normalizeEarningsTotal,
  normalizeMyOperatorBalance,
  normalizeMyOperatorPayments,
  normalizeOperatorBalances,
  normalizeOperatorEarnings,
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
    // Buyurtmalar soni yo'q (eski backend) — `null`.
    const noCounts = { ordersTotal: null, ordersSold: null, ordersPending: null };
    expect(res.items).toEqual([
      { operatorId: "41", operatorName: "Madina", status: "active", earned: 1000.5, paid: 400, balance: 600.5, paymentsCount: 2, lastPaidAt: "2026-11-15", ...noCounts },
      { operatorId: "42", operatorName: "Sevara", status: "inactive", earned: 100, paid: 150, balance: -50, paymentsCount: 0, lastPaidAt: null, ...noCounts },
    ]);
    expect(res.totals).toEqual({ earned: 1100.5, paid: 550, balance: 550.5 });
  });

  it("2026-11-20: buyurtmalar soni (jami / sotilgan / yo'lda) va o'chirilgan operator holati", () => {
    const res = normalizeOperatorBalances({
      statusCode: 200,
      data: {
        items: [
          { operator_id: "41", status: "active", earned: 10, paid: 0, orders_total: 57, orders_sold: "41", orders_pending: 9 },
          { operator_id: "47", status: "deleted", earned: 60, paid: 10, orders_total: null, orders_sold: -1, orders_pending: "x" },
        ],
        totals: { earned: 70, paid: 10, balance: 60 },
      },
    });
    expect(res.items[0]).toMatchObject({ status: "active", ordersTotal: 57, ordersSold: 41, ordersPending: 9 });
    // Yaroqsiz son — `null` (noma'lum), «0» emas.
    expect(res.items[1]).toMatchObject({ status: "deleted", ordersTotal: null, ordersSold: null, ordersPending: null });
  });

  it("2026-11-20: market daromad qatorlari — `{ items, pagination: { total } }` shakli", () => {
    const list = normalizeOperatorEarnings({
      statusCode: 200,
      data: {
        items: [
          { id: "901", order_id: "55120", amount: 12500, order_total_price: 250000, commission_type: "percent", commission_value: 5, created_at: "2026-11-18T09:12:00.000Z" },
        ],
        pagination: { total: 21, page: 2, limit: 10, totalPages: 3 },
      },
    });
    expect(list.total).toBe(21);
    expect(list.items).toEqual([
      { id: "901", orderId: "55120", amount: 12500, commissionType: "percent", commissionValue: 5, orderTotal: 250000, createdAt: "2026-11-18T09:12:00.000Z" },
    ]);
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

  it("B1te60bD: `/operators/:id/earnings` qatorlari — satr sonlar, stavka turi, eski yozuvda stavka yo'q", () => {
    const list = normalizeOperatorEarnings({
      statusCode: 200,
      data: {
        rows: [
          {
            id: "9001", operator_id: "41", order_id: 10241, amount: "18000.00", commission_type: "percent",
            commission_value: "5.00", order_total_price: "360000.00", createdAt: "2026-11-16T08:52:00.000Z",
          },
          { id: "9000", order_id: "10200", amount: 0, commission_type: null, commission_value: null, order_total_price: null },
          { order_id: "id siz" },
        ],
        total: "82",
        limit: 10,
        offset: 0,
      },
    });
    expect(list.total).toBe(82);
    expect(list.items).toEqual([
      {
        id: "9001", orderId: "10241", amount: 18000, commissionType: "percent", commissionValue: 5, orderTotal: 360000,
        createdAt: "2026-11-16T08:52:00.000Z",
      },
      { id: "9000", orderId: "10200", amount: 0, commissionType: null, commissionValue: null, orderTotal: null, createdAt: null },
    ]);
    expect(normalizeOperatorEarnings({ statusCode: 200, data: null })).toEqual({ items: [], total: 0 });
  });
});
