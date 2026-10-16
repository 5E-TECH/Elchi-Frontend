import { describe, expect, it } from "vitest";
import { getOrderDetailAccess, getOrderPageBranchType, getUserCanSellCancel } from "./orderDetailAccess";
import { normalizeOrderDetail } from "./orderDetailModel";

const order = (fields: Record<string, unknown>) => normalizeOrderDetail({ id: "1", ...fields });

describe("getOrderDetailAccess — rollar va qulflar", () => {
  it.each([
    ["superadmin", "button", true, true, false],
    ["admin", "button", true, true, false],
    ["registrator", "disabled", false, true, true],
    ["manager", "hidden", false, true, true],
    ["market", "hidden", false, false, false],
    ["courier", "hidden", false, false, false],
  ] as const)("%s: mijoz tugmasi %s, mijoz=%s, buyurtma=%s, izoh=%s", (role, edit, customer, full, hint) => {
    const access = getOrderDetailAccess({ role, branchType: null, order: order({ status: "new" }) });
    expect(access.customerEdit).toBe(edit);
    expect(access.canEditCustomer).toBe(customer);
    expect(access.canEditOrderFull).toBe(full);
    expect(access.showCustomerLockHint).toBe(hint);
  });

  it("ko'rinish: market va kuryer o'z maketida", () => {
    expect(getOrderDetailAccess({ role: "market", branchType: null, order: null }).layout).toBe("market");
    expect(getOrderDetailAccess({ role: "courier", branchType: null, order: null }).layout).toBe("courier");
    expect(getOrderDetailAccess({ role: "registrator", branchType: null, order: null }).layout).toBe("default");
  });

  it("qulflar: received — mahsulot; waiting — mahsulot + manzil; flag — manzil", () => {
    const received = getOrderDetailAccess({ role: "admin", branchType: null, order: order({ status: "received" }) });
    expect([received.productsLocked, received.destinationLocked]).toEqual([true, false]);
    const waiting = getOrderDetailAccess({ role: "admin", branchType: null, order: order({ status: "waiting" }) });
    expect([waiting.productsLocked, waiting.destinationLocked]).toEqual([true, true]);
    const flagged = getOrderDetailAccess({ role: "admin", branchType: null, order: order({ status: "new", batch_id: "9" }) });
    expect([flagged.productsLocked, flagged.destinationLocked]).toEqual([false, true]);
  });

  it("⭐ sotish/bekor — faqat REGIONAL/HYBRID menejeri, WAITING + post_id; kuryer qo'lida sotish yo'q (LC-04)", () => {
    const waiting = order({ status: "waiting", post_id: "90", holder_type: "BRANCH" });
    const allowed = { canSellCancel: true, order: waiting };
    expect(getOrderDetailAccess({ role: "manager", branchType: "REGIONAL", ...allowed })).toMatchObject({
      canUseCourierActions: true,
      canSell: true,
    });
    expect(getOrderDetailAccess({ role: "manager", branchType: "HQ", ...allowed }).canUseCourierActions).toBe(false);
    expect(getOrderDetailAccess({ role: "admin", branchType: null, ...allowed }).canUseCourierActions).toBe(false);
    const held = order({ status: "waiting", post_id: "90", holder_type: "COURIER", courier_id: "289" });
    expect(getOrderDetailAccess({ role: "manager", branchType: "HYBRID", canSellCancel: true, order: held })).toMatchObject({
      canUseCourierActions: true,
      canSell: false,
    });
  });

  it("qaytarish (rollback) — hududiy menejer, sotilgan buyurtma", () => {
    const sold = order({ status: "sold" });
    expect(getOrderDetailAccess({ role: "manager", branchType: "REGIONAL", canSellCancel: true, order: sold }).canRollback).toBe(true);
    expect(getOrderDetailAccess({ role: "manager", branchType: "PICKUP", canSellCancel: true, order: sold }).canRollback).toBe(false);
  });

  // Ro'yxatdagi `canUseManagerTableActions` bilan AYNI qoida: `can_sell_cancel` yo'q menejerda
  // sotish / bekor / qaytarish umuman yo'q; bayroq berilmasa ham — yo'q (yopiq default).
  it.each(["REGIONAL", "HYBRID"] as const)("⭐ %s menejeri, can_sell_cancel yo'q — sotish/bekor/qaytarish yo'q", (branchType) => {
    const waiting = order({ status: "waiting", post_id: "90", holder_type: "BRANCH" });
    for (const access of [
      getOrderDetailAccess({ role: "manager", branchType, canSellCancel: false, order: waiting }),
      getOrderDetailAccess({ role: "manager", branchType, order: waiting }),
    ]) {
      expect(access).toMatchObject({ isRegionalManager: true, canUseCourierActions: false, canSell: false });
    }
    const sold = order({ status: "sold" });
    expect(getOrderDetailAccess({ role: "manager", branchType, canSellCancel: false, order: sold }).canRollback).toBe(false);
    // Tahrirlash huquqi bayroqqa bog'liq emas.
    expect(getOrderDetailAccess({ role: "manager", branchType, order: order({ status: "new" }) }).canEditOrderFull).toBe(true);
  });
});

describe("getUserCanSellCancel", () => {
  it("faqat `can_sell_cancel === true` bo'lsa ruxsat", () => {
    expect(getUserCanSellCancel({ can_sell_cancel: true } as never)).toBe(true);
    expect(getUserCanSellCancel({ can_sell_cancel: false } as never)).toBe(false);
    expect(getUserCanSellCancel({} as never)).toBe(false);
    expect(getUserCanSellCancel(null)).toBe(false);
  });
});

describe("getOrderPageBranchType", () => {
  it("profilning har xil shakllari", () => {
    expect(getOrderPageBranchType({ branch: { branch: { type: "regional" } } } as never)).toBe("REGIONAL");
    expect(getOrderPageBranchType({ branch: { type: "HQ" } } as never)).toBe("HQ");
    expect(getOrderPageBranchType({ branch_type: "hybrid" } as never)).toBe("HYBRID");
    expect(getOrderPageBranchType({ branch: { type: "unknown" } } as never)).toBeNull();
    expect(getOrderPageBranchType(null)).toBeNull();
  });
});
