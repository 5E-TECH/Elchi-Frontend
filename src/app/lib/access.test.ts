import { describe, expect, it } from "vitest";
import type { RootState } from "../config/store";
import {
  canCreateOrders,
  canReceiveExternalOrders,
  canViewBatchesPage,
  canViewBranches,
  canViewCourierBulkPage,
  canViewDispatchPage,
  canViewFinancialBalance,
  canViewLogs,
  canViewMails,
  canViewNotifications,
  canViewOrders,
  canViewPaymentsPage,
  canViewReturnsPage,
  canViewUsers,
} from "./access";
import type { BranchType } from "../../widgets/Sidebar/model/menuConfig";

/**
 * B0 — kirish huquqi sidebar'dan AJRATILDI.
 *
 * Bu testning maqsadi: refaktor hech kimning huquqini kengaytirmagani va
 * toraytirmaganini isbotlash. Quyidagi matritsa refaktordan OLDINGI holatdan
 * o'lchab olingan; ataylab o'zgartirilgan ikki katak alohida belgilangan.
 */

const state = (role: string | null, branchType?: BranchType): RootState =>
  ({
    role: { role },
    user: { user: branchType ? { branch: { type: branchType } } : {} },
  }) as unknown as RootState;

type Case = [name: string, RootState];

const CASES: Case[] = [
  ["superadmin", state("superadmin")],
  ["admin", state("admin")],
  ["market", state("market")],
  ["registrator", state("registrator")],
  ["courier", state("courier")],
  ["manager/HQ", state("manager", "HQ")],
  ["manager/PICKUP", state("manager", "PICKUP")],
  ["manager/REGIONAL", state("manager", "REGIONAL")],
  ["manager/HYBRID", state("manager", "HYBRID")],
  ["manager/noma'lum", state("manager")],
];

/** `✓` = ruxsat, `—` = rad. Ustunlar CASES tartibida. */
const MATRIX: Record<string, string> = {
  //                sa  ad  mk  rg  cr  HQ  PU  RG  HY  ???
  canViewOrders: "  ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓",
  canViewMails: "   ✓   ✓   —   ✓   ✓   ✓   —   ✓   ✓   —",
  canViewUsers: "   ✓   ✓   —   —   —   —   —   ✓   ✓   —",
  canViewFinancialBalance: "✓ ✓   —   —   —   —   —   —   —   —",
  canViewNotifications: "✓   —   —   —   —   —   —   —   —   —",
  canViewBranches: "✓    —   —   —   —   —   —   —   —   —",
  canViewLogs: "    ✓   —   —   —   —   —   —   —   —   —",
  canViewDispatchPage: "✓ ✓   —   ✓   —   —   —   ✓   ✓   —",
  canViewCourierBulkPage: "— — —   —   ✓   —   —   ✓   ✓   —",
  canViewBatchesPage: "✓  ✓   —   —   —   ✓   ✓   —   ✓   —",
  canViewReturnsPage: "✓  ✓   —   —   —   ✓   ✓   —   ✓   —",
  canViewPaymentsPage: "✓  ✓   —   —   —   ✓   —   ✓   ✓   —",
  canCreateOrders: "  ✓   ✓   ✓   ✓   —   ✓   ✓   —   ✓   —",
  canReceiveExternalOrders: "✓ ✓ — ✓   —   ✓   ✓   —   ✓   —",
};

const PREDICATES = {
  canViewOrders,
  canViewMails,
  canViewUsers,
  canViewFinancialBalance,
  canViewNotifications,
  canViewBranches,
  canViewLogs,
  canViewDispatchPage,
  canViewCourierBulkPage,
  canViewBatchesPage,
  canViewReturnsPage,
  canViewPaymentsPage,
  canCreateOrders,
  canReceiveExternalOrders,
};

describe("kirish huquqi matritsasi", () => {
  for (const [name, predicate] of Object.entries(PREDICATES)) {
    const expected = MATRIX[name].trim().split(/\s+/);

    it(`${name} — 10 ta rol/filial kombinatsiyasi`, () => {
      expect(expected).toHaveLength(CASES.length);

      CASES.forEach(([caseName, s], index) => {
        const want = expected[index] === "✓";
        expect(
          predicate(s),
          `${name} · ${caseName} kutilgan: ${want ? "ruxsat" : "rad"}`,
        ).toBe(want);
      });
    });
  }
});

describe("ataylab qilingan ikki o'zgarish", () => {
  /**
   * Foydalanuvchi qarori (2026-09-10): hamkordan kelgan posilkani HQ qabul
   * qiladi, shuning uchun HQ menejeri qabul ekranini ko'rishi kerak.
   */
  it("HQ menejeri endi tashqi posilkani qabul qila oladi", () => {
    expect(canReceiveExternalOrders(state("manager", "HQ"))).toBe(true);
  });

  /**
   * Avval HQ menejeri menyuda "Kassa" bandini ko'rardi, lekin bosganda 403
   * olardi — menyu va guard ikki joyda alohida yozilgani uchun. Endi ikkalasi
   * bitta qobiliyatdan kelib chiqadi.
   */
  it("HQ menejerining menyusi va kassa guardi endi mos", () => {
    expect(canViewPaymentsPage(state("manager", "HQ"))).toBe(true);
  });
});

describe("noma'lum filial turi — xavfsiz tomonga yiqiladi", () => {
  it("qo'shimcha huquq bermaydi", () => {
    const unknown = state("manager");
    expect(canViewMails(unknown)).toBe(false);
    expect(canViewUsers(unknown)).toBe(false);
    expect(canViewPaymentsPage(unknown)).toBe(false);
    expect(canCreateOrders(unknown)).toBe(false);
    expect(canReceiveExternalOrders(unknown)).toBe(false);
  });

  it("bazaviy ko'rishni ham yopmaydi", () => {
    expect(canViewOrders(state("manager"))).toBe(true);
  });
});

describe("rol yo'q bo'lsa hech narsa ochilmaydi", () => {
  it("null rol barcha guardlarda rad etiladi", () => {
    const anonymous = state(null);
    for (const [name, predicate] of Object.entries(PREDICATES)) {
      expect(predicate(anonymous), name).toBe(false);
    }
  });
});
