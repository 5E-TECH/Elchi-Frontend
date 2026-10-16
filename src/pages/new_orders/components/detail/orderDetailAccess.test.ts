import { describe, expect, it } from "vitest";
import { getOrderDetailAccess, getOrderPageBranchType } from "./orderDetailAccess";
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
    expect(getOrderDetailAccess({ role: "manager", branchType: "REGIONAL", order: waiting })).toMatchObject({
      canUseCourierActions: true,
      canSell: true,
    });
    expect(getOrderDetailAccess({ role: "manager", branchType: "HQ", order: waiting }).canUseCourierActions).toBe(false);
    expect(getOrderDetailAccess({ role: "admin", branchType: null, order: waiting }).canUseCourierActions).toBe(false);
    const held = order({ status: "waiting", post_id: "90", holder_type: "COURIER", courier_id: "289" });
    expect(getOrderDetailAccess({ role: "manager", branchType: "HYBRID", order: held })).toMatchObject({
      canUseCourierActions: true,
      canSell: false,
    });
  });

  it("qaytarish (rollback) — hududiy menejer, sotilgan buyurtma", () => {
    expect(getOrderDetailAccess({ role: "manager", branchType: "REGIONAL", order: order({ status: "sold" }) }).canRollback).toBe(true);
    expect(getOrderDetailAccess({ role: "manager", branchType: "PICKUP", order: order({ status: "sold" }) }).canRollback).toBe(false);
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
