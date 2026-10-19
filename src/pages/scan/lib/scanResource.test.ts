import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({ api: apiMock }));

import { BATCH_KEY } from "../../../entities/batch";
import {
  SCAN_ACTION_QUERY_PREFIXES,
  fetchScanDetail,
  getScanDetailQueryKey,
  getScanResourceType,
  invalidateAfterScanAction,
  normalizeScanToken,
} from "./scanResource";

const ok = (data: unknown) => Promise.resolve({ data });
const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: { message: "x" } } });

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
});

describe("getScanResourceType — token prefiksi", () => {
  it.each([
    ["BTB-a8c3d4e5", "package"],
    ["btr-a8c3d4e5", "returned-package"],
    // Backend pochta tokenini `POST-<base36>-<rand>` yaratadi (X4RzXk1H) — buyurtma deb ketmasin.
    ["POST-k1x2y3-ab12", "post"],
    ["PST-k1x2y3", "post"],
    ["MCR-eyJtIjo3fQ", "market-qr"],
    ["a1b2c3d4e5f60718293a4b5c", "order"],
    ["BP-778812", "order"],
    ["https://elchi.uz/scan/POST-k1x2-ab", "post"],
  ])("%s → %s", (token, type) => {
    expect(getScanResourceType(token)).toBe(type);
  });
});

describe("normalizeScanToken", () => {
  it("lowercases a 24-character internal hex token (Caps Lock scanner)", () => {
    expect(normalizeScanToken("A1B2C3D4E5F60718293A4B5C")).toBe("a1b2c3d4e5f60718293a4b5c");
  });

  it("keeps prefixed and provider tokens as they are (they may be case-sensitive)", () => {
    expect(normalizeScanToken("BTB-AbC123")).toBe("BTB-AbC123");
    expect(normalizeScanToken("BeePost-XY12")).toBe("BeePost-XY12");
  });

  it("extracts the token from a /scan/ link", () => {
    expect(normalizeScanToken(" https://elchi.uz/scan/A1B2C3D4E5F60718293A4B5C ")).toBe("a1b2c3d4e5f60718293a4b5c");
  });

  it("uses the normalised token in the query key (one cache entry for both cases)", () => {
    expect(getScanDetailQueryKey("A1B2C3D4E5F60718293A4B5C")).toEqual([
      "scan-detail",
      "order",
      "a1b2c3d4e5f60718293a4b5c",
    ]);
  });
});

describe("fetchScanDetail — yo'naltirish", () => {
  it("sends POST- mail tokens to post/scan", async () => {
    apiMock.get.mockReturnValue(ok({ data: { id: "2493" } }));

    await expect(fetchScanDetail("POST-k1x2-ab")).resolves.toEqual({ type: "post", data: { data: { id: "2493" } } });
    expect(apiMock.get).toHaveBeenCalledWith("post/scan/POST-k1x2-ab");
  });

  it("sends packages to the universal scan/:token resolver", async () => {
    apiMock.get.mockReturnValue(ok({ type: "batch", data: { id: "137" } }));

    await fetchScanDetail("BTB-a8c3d4e5");
    expect(apiMock.get).toHaveBeenCalledWith("scan/BTB-a8c3d4e5");
  });

  it("never requests a market QR — the backend would consume it", async () => {
    await expect(fetchScanDetail("MCR-eyJtIjo3fQ")).resolves.toEqual({ type: "market-qr", data: null });
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("looks up orders by QR with an encoded, lowercased token", async () => {
    apiMock.get.mockReturnValue(ok({ data: { id: "10226" } }));

    await expect(fetchScanDetail("A1B2C3D4E5F60718293A4B5C")).resolves.toMatchObject({ type: "order" });
    expect(apiMock.get).toHaveBeenCalledWith("orders/qr-code/a1b2c3d4e5f60718293a4b5c");
  });

  it("encodes provider tokens in the path", async () => {
    apiMock.get.mockReturnValue(ok({ data: { id: "1" } }));

    await fetchScanDetail("BP 77/12");
    expect(apiMock.get).toHaveBeenCalledWith("orders/qr-code/BP%2077%2F12");
  });

  it("falls back to scan/:token on 404 and recognises a BeePost bag label", async () => {
    const bag = { external_batch_token: "BAG-77", is_external_batch: true, count: 2, members: [] };
    apiMock.get.mockImplementation((url: string) =>
      url.startsWith("orders/qr-code/") ? Promise.reject(httpError(404)) : ok({ type: "batch", data: bag }),
    );

    await expect(fetchScanDetail("BAG-77")).resolves.toEqual({ type: "external-bag", data: bag });
    expect(apiMock.get).toHaveBeenNthCalledWith(1, "orders/qr-code/BAG-77");
    expect(apiMock.get).toHaveBeenNthCalledWith(2, "scan/BAG-77");
  });

  it("keeps the original 404 when the fallback is not a bag either", async () => {
    const original = httpError(404);
    apiMock.get.mockImplementation((url: string) =>
      url.startsWith("orders/qr-code/") ? Promise.reject(original) : Promise.reject(httpError(404)),
    );

    await expect(fetchScanDetail("NOPE-1")).rejects.toBe(original);
  });

  it("does not hide other errors behind the fallback (403, 5xx, timeout)", async () => {
    const forbidden = httpError(403);
    apiMock.get.mockReturnValue(Promise.reject(forbidden));

    await expect(fetchScanDetail("PARCEL-1")).rejects.toBe(forbidden);
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });
});

describe("invalidateAfterScanAction (6qypMFeT)", () => {
  it("uses the batch entity's own cache key", () => {
    expect(SCAN_ACTION_QUERY_PREFIXES).toContainEqual([BATCH_KEY]);
  });

  it("marks orders, mails, batches and scan results stale without refetching the open result", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidateAfterScanAction(client);

    expect(spy.mock.calls.map(([filters]) => filters)).toEqual([
      { queryKey: ["orders"], refetchType: "active" },
      { queryKey: ["mails"], refetchType: "active" },
      { queryKey: ["batches"], refetchType: "active" },
      { queryKey: ["scan-detail"], refetchType: "none" },
    ]);
  });
});
