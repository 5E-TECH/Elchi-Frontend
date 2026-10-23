import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignRegionLogist,
  bulkAssignRegionLogist,
  getLogistRegions,
  getLogists,
  normalizeLogistList,
  normalizeLogistRegions,
} from "./logistApi";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset().mockResolvedValue({ data: { statusCode: 200 } });
  api.patch.mockReset().mockResolvedValue({ data: { statusCode: 200 } });
});

describe("normalizeLogistList", () => {
  it("`GET /logists` (identity `user.find_all`) → id satr, holat, telefon; buzuq qator tashlanadi", () => {
    expect(
      normalizeLogistList({
        statusCode: 200,
        data: {
          items: [
            { id: 42, name: " Aziz Rahimov ", phone_number: "+998901234567", status: "active" },
            {
              id: "43",
              name: "Malika Yusupova",
              phone_number: "+998944567890",
              status: "inactive",
            },
            { name: "id'siz" },
          ],
          meta: { page: 1, limit: 100, total: 3 },
        },
      }),
    ).toEqual([
      { id: "42", name: "Aziz Rahimov", phone_number: "+998901234567", status: "active" },
      { id: "43", name: "Malika Yusupova", phone_number: "+998944567890", status: "inactive" },
    ]);
    expect(normalizeLogistList(null)).toEqual([]);
  });

  it("holat: faqat «active» faol (backend `resolveActiveLogist`), yo'q/noma'lum — nofaol", () => {
    expect(
      normalizeLogistList({
        data: [
          { id: "1", name: "A" },
          { id: "2", name: "B", status: "blocked" },
          { id: "3", name: "C", status: " Active " },
        ],
      }).map((logist) => logist.status),
    ).toEqual(["inactive", "inactive", "active"]);
  });
});

describe("normalizeLogistRegions", () => {
  it("`GET /region` → id, nom, `logist_id` (yo'q — null)", () => {
    expect(
      normalizeLogistRegions({
        statusCode: 200,
        data: [
          { id: 3, name: "Buxoro viloyati", logist_id: null, districts: [{ id: 1 }] },
          { id: "5", name: "Jizzax viloyati", logist_id: 42 },
          { id: "6", name: "" },
          { name: "id'siz" },
        ],
      }),
    ).toEqual([
      { id: "3", name: "Buxoro viloyati", logistId: null },
      { id: "5", name: "Jizzax viloyati", logistId: "42" },
      { id: "6", name: "—", logistId: null },
    ]);
  });
});

describe("so'rovlar", () => {
  it("logistlar bitta sahifada (limit 100), viloyatlar `region` dan", async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: { items: [] } } })
      .mockResolvedValueOnce({ data: { data: [] } });
    await getLogists();
    await getLogistRegions();
    expect(api.get).toHaveBeenNthCalledWith(1, "logists", { params: { page: 1, limit: 100 } });
    expect(api.get).toHaveBeenNthCalledWith(2, "region");
  });

  it("100 dan ko'p logist — `meta.totalPages` bo'yicha qolgan sahifalar ham olinadi", async () => {
    const page = (ids: string[], totalPages: number) => ({
      data: {
        data: {
          items: ids.map((id) => ({ id, name: `L${id}`, status: "active" })),
          meta: { total: 201, totalPages },
        },
      },
    });
    api.get
      .mockResolvedValueOnce(page(["1", "2"], 3))
      .mockResolvedValueOnce(page(["3"], 3))
      .mockResolvedValueOnce(page(["3", "4"], 3));
    const logists = await getLogists();
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(api.get).toHaveBeenNthCalledWith(2, "logists", { params: { page: 2, limit: 100 } });
    expect(api.get).toHaveBeenNthCalledWith(3, "logists", { params: { page: 3, limit: 100 } });
    expect(logists.map((logist) => logist.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("POST region/logist/bulk va PATCH region/:id/logist", async () => {
    await bulkAssignRegionLogist({ logist_id: "42", region_ids: ["3", "5"] });
    expect(api.post).toHaveBeenCalledWith("region/logist/bulk", {
      logist_id: "42",
      region_ids: ["3", "5"],
    });
    await assignRegionLogist("5", null);
    expect(api.patch).toHaveBeenCalledWith("region/5/logist", { logist_id: null });
  });
});
