import { beforeEach, describe, expect, it, vi } from "vitest";
import { importSiteOrders, searchSiteOrderByQr, SITE_IMPORT_CHUNK, type SiteImportResult } from "./siteIntake";

const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: { post: (...args: unknown[]) => apiPostMock(...args) },
}));

describe("searchSiteOrderByQr", () => {
  beforeEach(() => apiPostMock.mockReset());

  it("QR va (berilsa) endpoint yuboriladi; backend qobig'idan saytning javobi olinadi", async () => {
    const site = { success: true, data: { id: 1 } };
    apiPostMock.mockResolvedValue({
      data: { statusCode: 200, message: "ok", data: { integration: {}, request: {}, raw: site, data: site } },
    });

    await expect(searchSiteOrderByQr({ slug: "adosh", qr: "Q-1", endpoint: "/qrorder/find" })).resolves.toBe(site);
    expect(apiPostMock).toHaveBeenCalledWith("integrations/adosh/search-by-qr", {
      qr_code: "Q-1",
      endpoint: "/qrorder/find",
    });
  });

  it("endpoint berilmasa — yuborilmaydi; bo'sh javob — null", async () => {
    apiPostMock.mockResolvedValue({ data: { statusCode: 200, data: { data: null } } });

    await expect(searchSiteOrderByQr({ slug: "adosh", qr: "Q-2" })).resolves.toBeNull();
    expect(apiPostMock).toHaveBeenCalledWith("integrations/adosh/search-by-qr", { qr_code: "Q-2" });
  });
});

describe("importSiteOrders — bo'laklab yaratish", () => {
  const orders = Array.from({ length: SITE_IMPORT_CHUNK * 2 + 3 }, (_, index) => ({
    key: `Q-${index}`,
    payload: { id: index },
  }));
  const ok = (chunk: unknown[]): SiteImportResult => ({
    created: chunk.map((order) => ({ id: `o-${(order as { id: number }).id}`, external_id: String((order as { id: number }).id) })),
    skipped: [],
  });

  it("10 talab yuboradi va natijalarni jamlaydi", async () => {
    const send = vi.fn(async (chunk: unknown[]) => ok(chunk));
    const result = await importSiteOrders("int-1", orders, send);

    expect(send.mock.calls.map(([chunk]) => chunk.length)).toEqual([SITE_IMPORT_CHUNK, SITE_IMPORT_CHUNK, 3]);
    expect(result.created).toHaveLength(orders.length);
    expect(result.failed).toEqual([]);
  });

  it("birinchi bo'lak yiqilsa — xato yuqoriga (hech narsa yaratilmagan)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(importSiteOrders("int-1", orders, send)).rejects.toThrow("timeout");
  });

  it("⭐ keyingi bo'lak yiqilsa — yaratilganlar saqlanadi, yuborilmaganlar sababi bilan `failed` da", async () => {
    const error = new Error("504");
    const send = vi
      .fn()
      .mockImplementationOnce(async (chunk: unknown[]) => ok(chunk))
      .mockRejectedValueOnce(error);
    const result = await importSiteOrders("int-1", orders, send);

    expect(send).toHaveBeenCalledTimes(2);
    expect(result.created).toHaveLength(SITE_IMPORT_CHUNK);
    expect(result.failed.map((fail) => fail.key)).toEqual(orders.slice(SITE_IMPORT_CHUNK).map((order) => order.key));
    expect(result.failed.every((fail) => fail.reason === error)).toBe(true);
  });

  it("sukut yuboruvchi — orders/external/receive ga integration_id bilan; qobiq ochiladi", async () => {
    apiPostMock.mockReset();
    apiPostMock.mockResolvedValue({
      data: {
        statusCode: 200,
        data: { integration: {}, created: [{ id: "o-1", external_id: "1" }], skipped: [{ external_id: "2", reason: "phone_missing" }] },
      },
    });
    const result = await importSiteOrders("int-9", [
      { key: "a", payload: { id: 1 } },
      { key: "b", payload: { id: 2 } },
    ]);

    expect(apiPostMock).toHaveBeenCalledWith("orders/external/receive", {
      integration_id: "int-9",
      orders: [{ id: 1 }, { id: 2 }],
    });
    expect(result.created).toEqual([{ id: "o-1", external_id: "1" }]);
    expect(result.skipped).toEqual([{ external_id: "2", reason: "phone_missing" }]);
  });
});
