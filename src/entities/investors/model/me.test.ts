import { describe, expect, it } from "vitest";
import { API_ENDPOINTS } from "../../../shared/api";
import {
  investorAccessProblem,
  toInvestorDashboard,
  toInvestorInvestmentsPage,
  toInvestorMe,
  toInvestorProfitsPage,
} from "./me";

/**
 * IN-1: `GET investors/me/*` javoblari (backend `investor-service` → `successRes`) — konvert, `monthly` obyekti,
 * oq ro'yxat maydonlari; noto'g'ri shaklda sahifa yiqilmaydi.
 */

describe("API_ENDPOINTS.INVESTORS — investorning o'zi", () => {
  it("me yo'llari `investors/:id` ga tushmaydi", () => {
    expect(API_ENDPOINTS.INVESTORS.ME).toBe("investors/me");
    expect(API_ENDPOINTS.INVESTORS.ME_DASHBOARD).toBe("investors/me/dashboard");
    expect(API_ENDPOINTS.INVESTORS.ME_INVESTMENTS).toBe("investors/me/investments");
    expect(API_ENDPOINTS.INVESTORS.ME_PROFITS).toBe("investors/me/profits");
    // `me` kalitlari `BY_ID` dan oldin (backend marshrut tartibi bilan bir xil).
    const keys = Object.keys(API_ENDPOINTS.INVESTORS);
    expect(keys.indexOf("ME_PROFITS")).toBeLessThan(keys.indexOf("BY_ID"));
  });
});

describe("toInvestorDashboard", () => {
  const payload = {
    statusCode: 200,
    message: "success",
    data: {
      investor: { id: 7, name: "Habibulla Nazirov", phone_number: "+998901112233", status: "active" },
      summary: {
        total_invested: 450_000_000,
        investments_count: 5,
        first_invested_at: "2025-11-02T00:00:00.000Z",
        last_invested_at: "2026-08-01T00:00:00+05:00",
        total_paid_profit: 34_300_000,
        total_unpaid_profit: 6_200_000,
        total_profit: 40_500_000,
        profit_shares_count: 9,
        current_percentage: "12.5",
        last_paid_at: "2026-09-05T10:00:00.000Z",
      },
      monthly: {
        months: 3,
        items: [
          { month: "2026-10", paid_amount: 0, unpaid_amount: 0, total_amount: 0 },
          { month: "2026-08", paid_amount: 5_600_000, unpaid_amount: 0, total_amount: 5_600_000 },
          { month: "2026-09", paid_amount: 0, unpaid_amount: 6_200_000, total_amount: 6_200_000 },
        ],
      },
    },
  };

  it("konvertni ochadi; KPI maydonlari raqam, foiz satrdan son", () => {
    const dashboard = toInvestorDashboard(payload);
    expect(dashboard.investor).toEqual({ id: "7", name: "Habibulla Nazirov", status: "active" });
    expect(dashboard.summary).toEqual({
      totalInvested: 450_000_000,
      investmentsCount: 5,
      lastInvestedAt: "2026-08-01T00:00:00+05:00",
      totalPaidProfit: 34_300_000,
      totalUnpaidProfit: 6_200_000,
      profitSharesCount: 9,
      currentPercentage: 12.5,
      lastPaidAt: "2026-09-05T10:00:00.000Z",
    });
  });

  it("`monthly` — obyekt `{ months, items }`; oylar o'sish tartibida", () => {
    const { monthly } = toInvestorDashboard(payload);
    expect(monthly.months).toBe(3);
    expect(monthly.items.map((item) => item.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(monthly.items[1]).toEqual({ month: "2026-09", paid: 0, unpaid: 6_200_000, total: 6_200_000 });
  });

  it("eski massiv shakli, noto'g'ri oy va bo'sh javob — yiqilmaydi", () => {
    const fromArray = toInvestorDashboard({ data: { monthly: [{ month: "2026-01", paid_amount: "100", unpaid_amount: 50 }, { month: "x" }] } });
    expect(fromArray.monthly.items).toEqual([{ month: "2026-01", paid: 100, unpaid: 50, total: 150 }]);
    expect(fromArray.investor).toBeNull();

    const empty = toInvestorDashboard(undefined);
    expect(empty.summary.totalInvested).toBe(0);
    expect(empty.summary.currentPercentage).toBeNull();
    expect(empty.summary.lastPaidAt).toBeNull();
    expect(empty.monthly).toEqual({ months: 0, items: [] });
  });
});

describe("toInvestorMe", () => {
  it("profil va yig'indi (`GET investors/me`); telefon kabi ortiqcha maydon olinmaydi", () => {
    const me = toInvestorMe({
      statusCode: 200,
      message: "success",
      data: {
        investor: { id: 7, name: " Habibulla Nazirov ", phone_number: "+998901112233", status: "active" },
        summary: { total_invested: "450000000", investments_count: 5, current_percentage: "12.5", last_paid_at: null },
      },
    });
    expect(me.investor).toEqual({ id: "7", name: "Habibulla Nazirov", status: "active" });
    expect(me.summary.totalInvested).toBe(450_000_000);
    expect(me.summary.investmentsCount).toBe(5);
    expect(me.summary.currentPercentage).toBe(12.5);
    expect(me.summary.lastPaidAt).toBeNull();
  });

  it("bo'sh yoki noto'g'ri javob — profil `null`, yig'indi 0", () => {
    const me = toInvestorMe(null);
    expect(me.investor).toBeNull();
    expect(me.summary.totalInvested).toBe(0);
    expect(me.summary.currentPercentage).toBeNull();
  });
});

describe("toInvestorInvestmentsPage / toInvestorProfitsPage", () => {
  it("investitsiyalar: qatorlar, meta va umumiy yig'indi", () => {
    const page = toInvestorInvestmentsPage({
      data: {
        items: [{ id: 3, amount: "100000000", invested_at: "2026-08-01T00:00:00.000Z", branch_id: null }],
        meta: { page: 1, limit: 3, total: 5, totalPages: 2 },
        summary: { total_amount: 450_000_000 },
      },
    });
    expect(page.items).toEqual([{ id: "3", amount: 100_000_000, investedAt: "2026-08-01T00:00:00.000Z" }]);
    expect(page.meta).toEqual({ page: 1, limit: 3, total: 5, totalPages: 2 });
    expect(page.totalAmount).toBe(450_000_000);
    // Eski javob — `range_amount` yo'q: `null` (0 emas).
    expect(page.rangeAmount).toBeNull();
  });

  it("su4IYGCN: `summary.range_amount` — tanlangan oraliq yig'indisi (0 ham qiymat)", () => {
    const page = (rangeAmount: unknown) =>
      toInvestorInvestmentsPage({
        data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 }, summary: { total_amount: 450_000_000, range_amount: rangeAmount } },
      });
    expect(page(150_000_000).rangeAmount).toBe(150_000_000);
    expect(page("2500000").rangeAmount).toBe(2_500_000);
    expect(page(0).rangeAmount).toBe(0);
    expect(page(null).rangeAmount).toBeNull();
  });

  it("foyda: holat, foiz va to'langan sana; summary", () => {
    const page = toInvestorProfitsPage({
      data: {
        items: [
          {
            id: 11,
            amount: 6_200_000,
            percentage: 12.5,
            period_start: "2026-09-01T00:00:00+05:00",
            period_end: "2026-09-30T23:59:59+05:00",
            is_paid: false,
            paid_at: null,
          },
        ],
        meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
        summary: { total_paid_amount: 34_300_000, total_unpaid_amount: 6_200_000 },
      },
    });
    expect(page.items[0]).toEqual({
      id: "11",
      amount: 6_200_000,
      percentage: 12.5,
      periodStart: "2026-09-01T00:00:00+05:00",
      periodEnd: "2026-09-30T23:59:59+05:00",
      isPaid: false,
      paidAt: null,
    });
    expect(page.totalPaid).toBe(34_300_000);
    expect(page.totalUnpaid).toBe(6_200_000);
  });

  it("bo'sh javob — bo'sh ro'yxat, meta sukutda", () => {
    expect(toInvestorProfitsPage(null)).toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      totalPaid: 0,
      totalUnpaid: 0,
    });
  });
});

describe("investorAccessProblem", () => {
  it.each([
    [403, "inactive"],
    [404, "notLinked"],
    [409, "multiple"],
    [500, null],
  ] as const)("%s → %s", (status, expected) => {
    expect(investorAccessProblem({ isAxiosError: true, response: { status, data: { message: "raw backend text" } } })).toBe(
      expected,
    );
  });

  it("javobsiz xato (tarmoq) — oddiy yuklash xatosi", () => {
    expect(investorAccessProblem(new Error("Network Error"))).toBeNull();
    expect(investorAccessProblem(null)).toBeNull();
  });
});
