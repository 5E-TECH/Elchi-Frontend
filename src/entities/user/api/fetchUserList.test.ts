import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get },
}));

import { API_ENDPOINTS } from "../../../shared/api";
import { fetchUserList } from "./userApi";

/**
 * FY-1: `GET /users` — bitta so'rov, server sahifalashi. Avvalgi «market + marketing» ikki so'rovi va klientdagi
 * sahifalash olib tashlandi (backend `Roles` da `marketing` yo'q).
 */
describe("fetchUserList", () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [{ id: "1", name: "Baraka Shop", role: "market" }],
          meta: { page: 2, limit: 10, total: 342, totalPages: 35, totalMarket: 342, totalEmployees: 944, totalUsers: 1286 },
        },
      },
    });
  });

  it("`role=market` — bitta `GET /users`, parametrlar o'zgarmasdan; meta serverdan", async () => {
    const result = await fetchUserList({ role: "market", page: 2, limit: 10, search: "Baraka" });

    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith(API_ENDPOINTS.USERS.BASE, {
      params: { role: "market", page: 2, limit: 10, search: "Baraka" },
    });
    expect(result.data.items).toHaveLength(1);
    expect(result.data.meta).toMatchObject({ page: 2, limit: 10, total: 342, totalPages: 35, totalMarket: 342 });
  });

  it("yangi rollar (`market_operator`, `logist`, `investor`) — xuddi shunday bitta so'rov", async () => {
    for (const role of ["market_operator", "logist", "investor"]) {
      mocks.get.mockClear();
      await fetchUserList({ role, page: 1, limit: 25 });
      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.get).toHaveBeenCalledWith(API_ENDPOINTS.USERS.BASE, { params: { role, page: 1, limit: 25 } });
    }
  });
});
