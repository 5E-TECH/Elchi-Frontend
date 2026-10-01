import { describe, expect, it } from "vitest";
import type { RootState } from "../config/store";
import { canCreateProducts, canHandoverCancelledToMarket } from "./access";
import { getSidebarConfigForUser, type BranchType } from "../../widgets/Sidebar/model/menuConfig";

const state = (role: string | null, branchType?: BranchType): RootState =>
  ({
    role: { role },
    user: { user: branchType ? { branch: { type: branchType } } : {} },
  }) as unknown as RootState;

const paths = (role: string, branchType?: BranchType) =>
  getSidebarConfigForUser(role, branchType ? ({ branch: { type: branchType } } as never) : undefined).map(
    (item) => item.to,
  );

describe("canHandoverCancelledToMarket (fix3 CODE-16 / C4)", () => {
  it("superadmin, admin va HQ registratori — ruxsat", () => {
    expect(canHandoverCancelledToMarket(state("superadmin"))).toBe(true);
    expect(canHandoverCancelledToMarket(state("admin"))).toBe(true);
    expect(canHandoverCancelledToMarket(state("registrator", "HQ"))).toBe(true);
  });

  it.each(["REGIONAL", "HYBRID", "PICKUP"] as BranchType[])(
    "registrator/%s — rad (mollar HQ omborida)",
    (branchType) => {
      expect(canHandoverCancelledToMarket(state("registrator", branchType))).toBe(false);
    },
  );

  it("menejer, kuryer, market va noma'lum registrator — rad", () => {
    expect(canHandoverCancelledToMarket(state("manager", "HQ"))).toBe(false);
    expect(canHandoverCancelledToMarket(state("courier"))).toBe(false);
    expect(canHandoverCancelledToMarket(state("market"))).toBe(false);
    expect(canHandoverCancelledToMarket(state("registrator"))).toBe(false);
    expect(canHandoverCancelledToMarket(state(null))).toBe(false);
  });
});

describe("canCreateProducts (fix3 RBAC-17)", () => {
  it("POST /product rollari: superadmin, admin, market", () => {
    expect(canCreateProducts(state("superadmin"))).toBe(true);
    expect(canCreateProducts(state("admin"))).toBe(true);
    expect(canCreateProducts(state("market"))).toBe(true);
  });

  it("registrator (va boshqalar) yarata olmaydi", () => {
    expect(canCreateProducts(state("registrator", "HQ"))).toBe(false);
    expect(canCreateProducts(state("manager", "HYBRID"))).toBe(false);
    expect(canCreateProducts(state("courier"))).toBe(false);
  });
});

describe("menyu tuzatishlari (fix3 RBAC-18, CODE-21)", () => {
  it("market menyusida 'Operatorlar' yo'q (GET /users marketga doim 403)", () => {
    expect(paths("market")).not.toContain("/market-operators");
    expect(paths("market")).toEqual(["/", "/orders", "/new-orders", "/products", "/cash-box"]);
  });

  it("superadmin menyusida /batches va /returns bor (guard avvaldan ochiq edi)", () => {
    expect(paths("superadmin")).toEqual(expect.arrayContaining(["/batches", "/returns"]));
    expect(paths("admin")).toEqual(expect.arrayContaining(["/batches", "/returns"]));
  });
});
