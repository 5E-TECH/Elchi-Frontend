import { describe, expect, it } from "vitest";
import { canRollbackOrderStatus, getRollbackTargets, ROLLBACK_TARGET_STATUS } from "./rollbackTarget";

/** y2RarzlT — ortga qaytarish backend qoidasi: kim, qaysi holatdan, qaysi holatga. */
describe("canRollbackOrderStatus", () => {
  it.each(["sold", "cancelled", "closed", "paid", "partly_paid", "partly paid", "PAID"])("superadmin: %s — mumkin", (status) => {
    expect(canRollbackOrderStatus("superadmin", status)).toBe(true);
  });

  it.each(["new", "created", "received", "on the road", "waiting", "waiting_customer", "returned_to_market", "", null])(
    "superadmin: %j — mumkin emas",
    (status) => {
      expect(canRollbackOrderStatus("superadmin", status)).toBe(false);
    },
  );

  it.each(["manager", "courier"] as const)("%s: faqat sotilgan va bekor qilingan", (role) => {
    expect(canRollbackOrderStatus(role, "sold")).toBe(true);
    expect(canRollbackOrderStatus(role, "cancelled")).toBe(true);
    for (const status of ["paid", "partly_paid", "closed", "waiting", "new"]) {
      expect(canRollbackOrderStatus(role, status), status).toBe(false);
    }
  });
});

describe("getRollbackTargets", () => {
  it("menejer / superadmin (sotilgan, to'langan): «Kutilmoqda» · «Bekor qilish»; «Bekor — jo'natilgan» yo'q", () => {
    expect(getRollbackTargets("manager", "sold")).toEqual(["waiting", "cancelled"]);
    expect(getRollbackTargets("manager", "paid")).toEqual(["waiting", "cancelled"]);
  });

  it("kuryer (sotilgan): «Bekor — jo'natilgan» ham — faqat kuryerda", () => {
    expect(getRollbackTargets("courier", "sold")).toEqual(["waiting", "cancelled", "cancelled_sent"]);
    expect(ROLLBACK_TARGET_STATUS.cancelled_sent).toBe("cancelled (sent)");
  });

  it.each(["manager", "courier"] as const)("%s: bekor qilingan buyurtma — faqat «Kutilmoqda» (tanlov yo'q)", (role) => {
    expect(getRollbackTargets(role, "cancelled")).toEqual(["waiting"]);
    expect(getRollbackTargets(role, "cancelled (sent)")).toEqual(["waiting"]);
  });
});
