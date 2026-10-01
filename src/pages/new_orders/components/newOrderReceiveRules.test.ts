import { describe, expect, it } from "vitest";
import type { BranchType } from "../../../widgets/Sidebar/model/menuConfig";
import { resolveReceiveMode, type NewOrderReceiveMode } from "./newOrderReceiveRules";

type Row = [role: string | null, branchType: BranchType | null, expected: NewOrderReceiveMode];

/**
 * "Qabul qilish" jadvali. Yagona o'zgarish — HQ xodimi endi POST /orders/receive
 * ga boradi (avval transfer-batches ga borib 400 olardi). Qolgan qatorlar
 * avvalgi xatti-harakatni qulflaydi.
 */
const TABLE: Row[] = [
  // HQ — POST /orders/receive
  ["registrator", "HQ", "receive"],
  ["manager", "HQ", "receive"],
  // Boshqa filiallar — transfer-batches (hozirgidek)
  ["registrator", "PICKUP", "transfer"],
  ["registrator", "HYBRID", "transfer"],
  ["manager", "PICKUP", "transfer"],
  ["manager", "HYBRID", "transfer"],
  ["registrator", "REGIONAL", "transfer"],
  ["manager", "REGIONAL", "transfer"],
  // Noma'lum filial turi — hozirgidek transfer-batches
  ["registrator", null, "transfer"],
  ["manager", null, "transfer"],
  // Superadmin/admin — hozirgidek POST /orders/receive (filial turiga qaramaydi)
  ["superadmin", null, "receive"],
  ["admin", null, "receive"],
  ["admin", "HQ", "receive"],
  // Market — qabul oqimi yo'q
  ["market", null, "none"],
  ["market", "HQ", "none"],
];

describe("resolveReceiveMode", () => {
  it.each(TABLE)("%s / %s → %s", (role, branchType, expected) => {
    expect(resolveReceiveMode(role, branchType)).toBe(expected);
  });

  it("undefined filial turi null bilan bir xil", () => {
    expect(resolveReceiveMode("registrator", undefined)).toBe("transfer");
    expect(resolveReceiveMode("manager", undefined)).toBe("transfer");
  });
});
