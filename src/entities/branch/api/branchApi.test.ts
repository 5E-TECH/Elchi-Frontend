import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("../../../shared/api/instance", () => ({
  api: { get: getMock },
}));

import { API_ENDPOINTS } from "../../../shared/api";
import { getBranches, getDispatchDestinations, normalizeBranchList } from "./branchApi";

// C5 javob shakli: { statusCode, message, data: { items, total } }.
const envelope = (items: unknown[]) => ({
  data: { statusCode: 200, message: "ok", data: { items, total: items.length } },
});

const SIRDARYO = {
  id: 15,
  name: "E2E Filial Sirdaryo",
  code: "SRD-01",
  type: "REGIONAL",
  status: "active",
  phone_number: "+998903009002",
  region_id: "12",
  region: { id: "12", name: "Sirdaryo" },
  has_manager: true,
  manager: { id: "300", name: "Sirdaryo menejeri", phone_number: "+998903009002" },
};

describe("getDispatchDestinations (GET /branches/dispatch-destinations)", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(envelope([SIRDARYO]));
  });

  it("yangi endpointga region_id bilan boradi", async () => {
    await getDispatchDestinations({ region_id: "12" });

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith(API_ENDPOINTS.BRANCHES.DISPATCH_DESTINATIONS, {
      params: { region_id: "12" },
    });
    expect(API_ENDPOINTS.BRANCHES.DISPATCH_DESTINATIONS).toBe("branches/dispatch-destinations");
  });

  it("region_id bo'lmasa filtr yuborilmaydi", async () => {
    await getDispatchDestinations();
    await getDispatchDestinations({ region_id: "  " });

    expect(getMock).toHaveBeenNthCalledWith(1, API_ENDPOINTS.BRANCHES.DISPATCH_DESTINATIONS, { params: undefined });
    expect(getMock).toHaveBeenNthCalledWith(2, API_ENDPOINTS.BRANCHES.DISPATCH_DESTINATIONS, { params: undefined });
  });

  it("data.items normallashtiriladi: id, tur, viloyat, menejer", async () => {
    const result = await getDispatchDestinations({ region_id: "12" });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "15",
      name: "E2E Filial Sirdaryo",
      code: "SRD-01",
      type: "REGIONAL",
      status: "active",
      phone_number: "+998903009002",
      region: { id: "12", name: "Sirdaryo" },
      has_manager: true,
      manager_id: "300",
      manager: { id: "300", name: "Sirdaryo menejeri" },
    });
  });

  it("menejersiz filial has_manager=false bilan keladi", async () => {
    getMock.mockResolvedValue(
      envelope([{ ...SIRDARYO, id: "16", type: "HYBRID", has_manager: false, manager: null }]),
    );

    const [item] = (await getDispatchDestinations({ region_id: "12" })).data;

    expect(item.type).toBe("HYBRID");
    expect(item.has_manager).toBe(false);
    expect(item.manager).toBeNull();
  });

  it("region obyekti null bo'lsa ham region_id saqlanadi (viloyat filtri uchun)", async () => {
    getMock.mockResolvedValue(envelope([{ ...SIRDARYO, region: null, region_id: 12 }]));

    const [item] = (await getDispatchDestinations({ region_id: "12" })).data;

    expect(item.region.id).toBe("12");
  });

  it("bo'sh ro'yxat — bo'sh natija", async () => {
    getMock.mockResolvedValue(envelope([]));

    const result = await getDispatchDestinations({ region_id: "12" });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("xato chaqiruvchiga uzatiladi (403 xabarini ko'rsatish uchun)", async () => {
    const error = { response: { status: 403, data: { message: "Ruxsat yo'q" } } };
    getMock.mockRejectedValue(error);

    await expect(getDispatchDestinations({ region_id: "12" })).rejects.toBe(error);
  });
});

describe("getBranches (GET /branches) — sahifalash meta'dan", () => {
  const branch = (id: number, name: string) => ({ id, name, code: `B-${id}`, type: "REGIONAL", status: "active" });
  // Jonli API: GET /branches?page=1&limit=12 → 12 ta (Andijon..Namangan), meta.total = 13.
  const PAGE_1 = Array.from({ length: 12 }, (_, index) => branch(index + 1, `Filial ${index + 1}`));

  const listEnvelope = (items: unknown[], meta: Record<string, number>) => ({
    data: { statusCode: 200, message: "Branches list", data: { items, meta } },
  });

  it("⭐ jami JORIY sahifa uzunligi emas, meta.total (12 emas — 13)", async () => {
    getMock.mockResolvedValue(listEnvelope(PAGE_1, { page: 1, limit: 12, total: 13, totalPages: 2 }));
    const result = await getBranches({ page: 1, limit: 12 });

    expect(getMock).toHaveBeenCalledWith(API_ENDPOINTS.BRANCHES.BASE, { params: { page: 1, limit: 12 } });
    expect(result.data).toHaveLength(12);
    expect(result).toMatchObject({ total: 13, page: 1, limit: 12 });
  });

  it("⭐ 2-sahifa: HQ Toshkent yetib boriladigan (page meta'dan)", async () => {
    getMock.mockResolvedValue(
      listEnvelope([branch(13, "HQ Toshkent")], { page: 2, limit: 12, total: 13, totalPages: 2 }),
    );
    const result = await getBranches({ page: 2, limit: 12 });

    expect(result.data.map((item) => item.name)).toEqual(["HQ Toshkent"]);
    expect(result).toMatchObject({ total: 13, page: 2, limit: 12 });
  });

  it("karta rejimi (limit 8): jami 13 — 2 sahifa", async () => {
    getMock.mockResolvedValue(listEnvelope(PAGE_1.slice(0, 8), { page: 1, limit: 8, total: 13, totalPages: 2 }));
    const result = await getBranches({ page: 1, limit: 8 });

    expect(result).toMatchObject({ total: 13, page: 1, limit: 8 });
  });

  it("meta yo'q eski javob — avvalgidek ro'yxat uzunligi va so'rov parametrlari", async () => {
    getMock.mockResolvedValue({ data: { statusCode: 200, data: [branch(1, "A"), branch(2, "B")] } });
    const result = await getBranches({ page: 3, limit: 24 });

    expect(result).toMatchObject({ total: 2, page: 3, limit: 24 });
  });
});

describe("normalizeBranchList — qabul mezonlari", () => {
  const items = (count: number, from = 1) =>
    Array.from({ length: count }, (_, index) => ({ id: index + from, name: `Filial ${index + from}`, status: "active" }));

  it("⭐ unit: {data:{items:[...12], meta:{total:13,page:1,limit:12,totalPages:2}}} → total=13, page=1, limit=12", () => {
    const result = normalizeBranchList({
      data: { items: items(12), meta: { total: 13, page: 1, limit: 12, totalPages: 2 } },
    });

    expect(result.data).toHaveLength(12);
    expect(result.total).toBe(13);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(12);
  });

  describe("⭐ regressiya: eski (flat total) javob shakllari buzilmaydi", () => {
    it("ildizda tekis: { data: [...], total, page, limit }", () => {
      expect(normalizeBranchList({ data: items(12), total: 13, page: 1, limit: 12 })).toMatchObject({
        total: 13,
        page: 1,
        limit: 12,
      });
    });

    it("data ichida tekis: { data: { items, total, page, limit } }", () => {
      expect(normalizeBranchList({ data: { items: items(12), total: 13, page: 2, limit: 12 } })).toMatchObject({
        total: 13,
        page: 2,
        limit: 12,
      });
    });

    it("tekis total satr bo'lsa ham son (\"13\" → 13)", () => {
      expect(normalizeBranchList({ data: items(12), total: "13" }).total).toBe(13);
    });

    it("jami umuman yo'q — ro'yxat uzunligi va so'rov parametrlari", () => {
      expect(normalizeBranchList({ data: items(3) }, { page: 4, limit: 24 })).toMatchObject({
        total: 3,
        page: 4,
        limit: 24,
      });
    });

    it("tekis total va meta birga kelsa — tekis (eski) qiymat ustun", () => {
      expect(
        normalizeBranchList({ data: { items: items(2), total: 20, meta: { total: 13 } } }).total,
      ).toBe(20);
    });
  });
});
