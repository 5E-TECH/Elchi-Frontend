import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, patch: mocks.patch },
}));

import { changeUserRole, fetchRoleCatalog, normalizeRoleCatalog } from "./roleApi";
import { CHANGEABLE_USER_ROLES, isChangeableUserRole } from "../lib/changeableRole";

/** FY-2 (K3scaE0W): `GET /roles` → faqat `changeable_roles`; `PATCH /users/:id/role` → `{ role }`. */
describe("normalizeRoleCatalog", () => {
  it("`data.changeable_roles` — maket tartibida (Admin · Menejer · Ro'yxatchi · Logist), yorliqlar olinmaydi", () => {
    expect(
      normalizeRoleCatalog({
        statusCode: 200,
        data: {
          items: [{ role: "admin", label: "Admin" }],
          changeable_roles: ["logist", "registrator", "manager", "admin"],
        },
      }),
    ).toEqual({ changeableRoles: ["admin", "manager", "registrator", "logist"] });
  });

  it("noma'lum va almashtirilmaydigan rollar tashlab yuboriladi; registr va bo'shliq e'tiborsiz", () => {
    expect(
      normalizeRoleCatalog({ changeable_roles: [" Manager ", "courier", "superadmin", 7, null, "operator"] }),
    ).toEqual({ changeableRoles: ["manager"] });
  });

  it("massiv yo'q — `null` (chaqiruvchi zaxira ro'yxatni oladi)", () => {
    expect(normalizeRoleCatalog({ data: { items: [] } })).toBeNull();
    expect(normalizeRoleCatalog(null)).toBeNull();
    expect(normalizeRoleCatalog("x")).toBeNull();
  });
});

describe("rol API", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
  });

  it("fetchRoleCatalog — `GET roles`", async () => {
    mocks.get.mockResolvedValue({ data: { data: { changeable_roles: ["admin"] } } });
    await expect(fetchRoleCatalog()).resolves.toEqual({ changeableRoles: ["admin"] });
    expect(mocks.get).toHaveBeenCalledWith("roles");
  });

  it("changeUserRole — `PATCH users/:id/role` `{ role }`", async () => {
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, data: { id: "41", role: "manager" } } });
    await expect(changeUserRole("41", "manager")).resolves.toEqual({ statusCode: 200, data: { id: "41", role: "manager" } });
    expect(mocks.patch).toHaveBeenCalledWith("users/41/role", { role: "manager" });
  });
});

describe("isChangeableUserRole", () => {
  it("faqat admin, menejer, ro'yxatchi va logist", () => {
    expect(CHANGEABLE_USER_ROLES).toEqual(["admin", "manager", "registrator", "logist"]);
    for (const role of CHANGEABLE_USER_ROLES) expect(isChangeableUserRole(role)).toBe(true);
    for (const role of ["superadmin", "courier", "market", "market_operator", "investor", "operator", "", null]) {
      expect(isChangeableUserRole(role)).toBe(false);
    }
  });
});
