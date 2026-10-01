import { describe, expect, it } from "vitest";
import type { RootState } from "../config/store";
import {
  canCreateOrders,
  canDispatchPostToBranch,
  canReceiveExternalOrders,
  canViewBatchesPage,
  canViewBranches,
  canViewCourierBulkPage,
  canViewDispatchPage,
  canViewFinancialBalance,
  canViewLogs,
  canViewMails,
  canViewNotifications,
  canSendNotifications,
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
 * o'lchab olingan; ataylab o'zgartirilgan kataklar alohida belgilangan.
 *
 * 2026-10-01: `canViewDispatchPage` · registrator (filial turi noma'lum) ✓ → —.
 * Bu katak avval ham faqat qog'ozda ✓ edi: `routes.tsx` ning o'z guardi
 * noma'lum turni rad etardi. Endi marshrut shu predikatni ishlatadi, shuning
 * uchun matritsa haqiqiy guard bilan moslashtirildi. `canDispatchPostToBranch`
 * qatori yangi (HQ registratori pastdagi alohida blokda).
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
  canSendNotifications: "✓   ✓   —   —   —   —   —   —   —   —",
  canViewBranches: "✓    —   —   —   —   —   —   —   —   —",
  canViewLogs: "    ✓   —   —   —   —   —   —   —   —   —",
  // rg = filial turi noma'lum registrator → rad (routes.tsx guardi bilan bir xil).
  canViewDispatchPage: "✓ ✓   —   —   —   —   —   ✓   ✓   —",
  canDispatchPostToBranch: "✓ ✓ —   —   —   —   —   —   —   —",
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
  canSendNotifications,
  canViewBranches,
  canViewLogs,
  canViewDispatchPage,
  canDispatchPostToBranch,
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

describe("registrator — /dispatch filial turi bo'yicha (2026-10-01)", () => {
  /**
   * HQ registratori HQ kuryerlariga buyurtma beradi (backend
   * POST /orders/assign-to-courier buni qo'llaydi), shuning uchun HQ QO'SHILDI.
   * REGIONAL/HYBRID hozirgidek; noma'lum tur — rad.
   */
  it.each(["HQ", "REGIONAL", "HYBRID"] as BranchType[])(
    "registrator/%s — ruxsat",
    (branchType) => {
      expect(canViewDispatchPage(state("registrator", branchType))).toBe(true);
    },
  );

  /**
   * fix3 CODE-21: PICKUP filialda kuryer bo'lmaydi (backend kuryerni faqat
   * HQ/REGIONAL/HYBRID ga biriktiradi) — sahifa bo'sh kuryer ro'yxati bilan
   * ochilardi. PICKUP menejerida ham `dispatch` qobiliyati yo'q.
   */
  it("registrator/PICKUP — rad (kuryersiz filial)", () => {
    expect(canViewDispatchPage(state("registrator", "PICKUP"))).toBe(false);
  });

  it("filial turi noma'lum registrator — rad (marshrut guardi bilan bir xil)", () => {
    expect(canViewDispatchPage(state("registrator"))).toBe(false);
  });

  it("menejer qoidasi o'zgarmadi: HQ menejeri /dispatch ko'rmaydi", () => {
    expect(canViewDispatchPage(state("manager", "HQ"))).toBe(false);
    expect(canViewDispatchPage(state("manager", "REGIONAL"))).toBe(true);
  });
});

describe("canDispatchPostToBranch — pochtani filialga jo'natish (backend bilan bir xil)", () => {
  it("superadmin, admin va HQ registratori — ruxsat", () => {
    expect(canDispatchPostToBranch(state("superadmin"))).toBe(true);
    expect(canDispatchPostToBranch(state("admin"))).toBe(true);
    expect(canDispatchPostToBranch(state("registrator", "HQ"))).toBe(true);
  });

  it.each(["REGIONAL", "HYBRID", "PICKUP"] as BranchType[])(
    "registrator/%s — rad (server doim 403 beradi)",
    (branchType) => {
      expect(canDispatchPostToBranch(state("registrator", branchType))).toBe(false);
    },
  );

  it("menejer (HQ ham), kuryer, market va noma'lum registrator — rad", () => {
    expect(canDispatchPostToBranch(state("manager", "HQ"))).toBe(false);
    expect(canDispatchPostToBranch(state("manager", "REGIONAL"))).toBe(false);
    expect(canDispatchPostToBranch(state("courier"))).toBe(false);
    expect(canDispatchPostToBranch(state("market"))).toBe(false);
    expect(canDispatchPostToBranch(state("registrator"))).toBe(false);
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
