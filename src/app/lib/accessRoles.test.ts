import { describe, expect, expectTypeOf, it } from "vitest";
import type { UserRole } from "../../entities/user/types/user";
import type { BranchType } from "../../widgets/Sidebar/model/menuConfig";
import type { RootState } from "../config/store";
import * as access from "./access";

/**
 * K3scaE0W — `access.ts` predikatlaridan qurilgan ruxsat jadvali. `access.test.ts` qo'lda tanlangan predikat va
 * rollarni tekshiradi; bu test har eksport qilingan predikatni har rol bilan yuradi: rol tushib qolsa yoki yangi
 * predikat qo'shilsa, jadval (snapshot) o'zgaradi va ko'rib chiqiladi.
 */
const ROLES = [
  "superadmin",
  "admin",
  "registrator",
  "manager",
  "courier",
  "market",
  "market_operator",
  "logist",
  "investor",
  "operator",
  "marketing",
  "customer",
  "branch",
] as const satisfies readonly UserRole[];

/** Ruxsati filial turiga bog'liq rollar har tur bilan alohida ustun. */
const BRANCH_TYPES: readonly BranchType[] = ["HQ", "PICKUP", "REGIONAL", "HYBRID"];
const BRANCH_ROLES: readonly UserRole[] = ["manager", "registrator", "courier"];

const stateOf = (role: string | null, branchType?: BranchType) =>
  ({
    role: { role },
    user: { user: branchType ? { branch: { type: branchType } } : {} },
  }) as unknown as RootState;

const COLUMNS: Array<[string, RootState]> = ROLES.flatMap((role): Array<[string, RootState]> => [
  [role, stateOf(role)],
  ...(BRANCH_ROLES.includes(role)
    ? BRANCH_TYPES.map((type): [string, RootState] => [`${role}/${type}`, stateOf(role, type)])
    : []),
]);

const PREDICATES = Object.entries(access).filter(
  (entry): entry is [string, (state: RootState) => boolean] =>
    /^can[A-Z]/.test(entry[0]) && typeof entry[1] === "function",
);

const allowedBy = (predicate: (state: RootState) => boolean) =>
  COLUMNS.filter(([, state]) => predicate(state)).map(([name]) => name);

describe("access.ts — ruxsat jadvali", () => {
  it("rollar ro'yxati `UserRole` ni to'liq qamraydi", () => {
    expectTypeOf<Exclude<UserRole, (typeof ROLES)[number]>>().toBeNever();
    expect(new Set(ROLES).size).toBe(ROLES.length);
  });

  it("jadval bo'sh emas: predikatlar va ustunlar topildi", () => {
    expect(PREDICATES.length).toBeGreaterThan(25);
    expect(COLUMNS.length).toBe(ROLES.length + BRANCH_ROLES.length * BRANCH_TYPES.length);
  });

  it.each(PREDICATES)("%s: har ustunda aniq javob, rolsiz foydalanuvchiga ruxsat yo'q", (_name, predicate) => {
    for (const [, state] of COLUMNS) expect(typeof predicate(state)).toBe("boolean");
    expect(predicate(stateOf(null))).toBe(false);
  });

  it("har predikat kamida bitta rolga ochiq (o'lik predikat yo'q)", () => {
    expect(PREDICATES.filter(([, predicate]) => allowedBy(predicate).length === 0).map(([name]) => name)).toEqual([]);
  });

  it("logist, operator, marketing, mijoz va filial hisobi moliyaga kirmaydi", () => {
    const closed = ["logist", "operator", "marketing", "customer", "branch"];
    for (const predicate of [access.canViewPaymentsPage, access.canViewFinancialBalance]) {
      expect(allowedBy(predicate).filter((name) => closed.includes(name))).toEqual([]);
    }
  });

  it("jadval o'zgarmagan (snapshot)", () => {
    const table = Object.fromEntries(PREDICATES.map(([name, predicate]) => [name, allowedBy(predicate).join(" ")]));
    expect(table).toMatchSnapshot();
  });
});
