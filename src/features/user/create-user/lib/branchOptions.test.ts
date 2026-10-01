import { describe, expect, it } from "vitest";
import type { Branch } from "../../../../entities/branch";
import { getBranchOptionsForRole, isHqBranch, isManagerHqSelection } from "./branchOptions";

const branch = (overrides: Partial<Branch> & Pick<Branch, "id" | "name">): Branch => ({
  region: { id: "", name: "—" },
  district: { id: "", name: "—" },
  address: "—",
  status: "active",
  employees_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const HQ = branch({ id: "1", name: "HQ-TSHKNT", type: "HQ", level: 0 });
const SURXON = branch({ id: "15", name: "Surxondaryo", type: "REGIONAL", level: 1 });
const ANDIJON = branch({ id: "16", name: "Andijon", type: "HYBRID", level: 1 });
const PUNKT = branch({ id: "17", name: "Chilonzor punkt", type: "PICKUP", level: 2 });
const OLD = branch({ id: "18", name: "Eski filial", type: "REGIONAL", level: 1, status: "inactive" });

// Ataylab aralash tartibda — saralash helper ichida bo'lishi kerak.
const BRANCHES = [PUNKT, SURXON, OLD, HQ, ANDIJON];

const ids = (list: Branch[]) => list.map((item) => item.id);

describe("getBranchOptionsForRole", () => {
  it("menejer ro'yxatida HQ yo'q", () => {
    expect(ids(getBranchOptionsForRole(BRANCHES, "manager"))).toEqual(["16", "15", "17"]);
  });

  it("registrator ro'yxatida HQ bor (HQ registratorlari kerak)", () => {
    expect(ids(getBranchOptionsForRole(BRANCHES, "registrator"))).toEqual(["1", "16", "15", "17"]);
  });

  it("nofaol filiallar hech qaysi rolda chiqmaydi", () => {
    for (const role of ["manager", "registrator", "admin", null]) {
      expect(ids(getBranchOptionsForRole(BRANCHES, role)), String(role)).not.toContain("18");
    }
  });

  it("saralash saqlanadi: avval level, keyin nom", () => {
    const sameLevel = [
      branch({ id: "b", name: "Buxoro", type: "REGIONAL", level: 1 }),
      branch({ id: "a", name: "Andijon", type: "REGIONAL", level: 1 }),
      branch({ id: "root", name: "Zzz", type: "HQ", level: 0 }),
    ];

    expect(ids(getBranchOptionsForRole(sameLevel, "registrator"))).toEqual(["root", "a", "b"]);
  });

  it("kirish massivini o'zgartirmaydi", () => {
    const input = [...BRANCHES];
    getBranchOptionsForRole(input, "manager");
    expect(input).toEqual(BRANCHES);
  });

  it("bo'sh yoki yuklanmagan ro'yxat — bo'sh natija", () => {
    expect(getBranchOptionsForRole(undefined, "manager")).toEqual([]);
    expect(getBranchOptionsForRole(null, "registrator")).toEqual([]);
  });
});

describe("isManagerHqSelection (forma himoyasi)", () => {
  it("menejer + HQ id → true", () => {
    expect(isManagerHqSelection(BRANCHES, "manager", "1")).toBe(true);
  });

  it("menejer + oddiy filial → false", () => {
    expect(isManagerHqSelection(BRANCHES, "manager", "15")).toBe(false);
  });

  it("registrator + HQ id → false (ruxsat)", () => {
    expect(isManagerHqSelection(BRANCHES, "registrator", "1")).toBe(false);
  });

  it("filial tanlanmagan yoki topilmagan → false", () => {
    expect(isManagerHqSelection(BRANCHES, "manager", "")).toBe(false);
    expect(isManagerHqSelection(BRANCHES, "manager", "999")).toBe(false);
    expect(isManagerHqSelection(undefined, "manager", "1")).toBe(false);
  });
});

describe("isHqBranch", () => {
  it("faqat HQ turini tan oladi", () => {
    expect(isHqBranch(HQ)).toBe(true);
    expect(isHqBranch(SURXON)).toBe(false);
    expect(isHqBranch(null)).toBe(false);
  });
});
