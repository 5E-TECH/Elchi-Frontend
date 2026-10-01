import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("../../../shared/api/instance", () => ({
  api: { get: getMock },
}));

import { API_ENDPOINTS } from "../../../shared/api";
import { getDispatchDestinations } from "./branchApi";

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
