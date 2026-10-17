import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllTransferBatches, fetchTransferBatchesPage } from "./batchApi";

/**
 * `fetchAllTransferBatches` — `GET transfer-batches` ning hamma sahifalari (limit 100): bo'sh sahifada to'xtaydi
 * (holat bo'sh/`PENDING` bo'lsa `meta.total` ishonchsiz — backend PENDING'ni sahifa ichida yig'adi), holat
 * berilgan va `PENDING` emas — `totalPages` da ham; `maxPages` → `capped`.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, string>;

const raw = (id: number, status = "RECEIVED") => ({
  id: String(id),
  status,
  direction: "FORWARD",
  source_branch: { id: "7", name: "Urgut filiali" },
  destination_branch: { id: "1", name: "Toshkent HQ" },
  order_count: 1,
  total_price: 1000,
  createdAt: "2026-10-17T10:00:00.000Z",
});

/** `pages[n-1]` — n-sahifa qatorlari; `meta` — backend shakli (`{ data: { items, meta } }`). */
const respondPages = (pages: number[][], meta: (page: number) => { total: number; totalPages: number }, status?: string) => {
  mocks.get.mockImplementation((url: string, config?: { params?: Params }) => {
    if (url !== "transfer-batches") return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
    const page = Number(config?.params?.page ?? 1);
    const items = (pages[page - 1] ?? []).map((id) => raw(id, status));
    return Promise.resolve({
      data: { statusCode: 200, data: { items, meta: { page, limit: Number(config?.params?.limit), ...meta(page) } } },
    });
  });
};

const calls = () => mocks.get.mock.calls.map(([, config]) => (config as { params: Params }).params);

const range = (from: number, count: number) => Array.from({ length: count }, (_, index) => from + index);

afterEach(() => {
  mocks.get.mockReset();
});

describe("fetchTransferBatchesPage", () => {
  it("bitta sahifa: paramlar API shaklida, javob normallashtiriladi (useBatches bilan bir xil)", async () => {
    respondPages([[], [5]], () => ({ total: 11, totalPages: 2 }));
    const response = await fetchTransferBatchesPage({ status: "on_the_way", direction: "return", page: 2, limit: 10 });

    expect(calls()).toEqual([{ status: "SENT", direction: "RETURN", page: "2", limit: "10" }]);
    expect(response.data.map((batch) => [batch.id, batch.status, batch.from_branch.name])).toEqual([
      ["5", "received", "Urgut filiali"],
    ]);
    expect(response.meta).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
    expect(response.total).toBe(11);
  });
});

describe("fetchAllTransferBatches", () => {
  it("holatsiz: total ishonchsiz — bo'sh sahifagacha, har doim limit=100, filtrlar har sahifada bir xil", async () => {
    // Backend PENDING yig'ishi: `total` = sahifadagi qatorlar soni, `totalPages` = 1 — ularga ishonilmaydi.
    respondPages([range(1, 100), range(101, 100), range(201, 30)], (page) => ({
      total: page <= 3 ? [100, 100, 30][page - 1] : 0,
      totalPages: 1,
    }));
    const result = await fetchAllTransferBatches({ direction: "forward" });

    expect(result.capped).toBe(false);
    expect(result.data).toHaveLength(230);
    expect(result.data[0].id).toBe("1");
    expect(result.data.at(-1)?.id).toBe("230");
    expect(calls()).toEqual([1, 2, 3, 4].map((page) => ({ direction: "FORWARD", page: String(page), limit: "100" })));
  });

  it("holat RECEIVED: total ishonchli — totalPages da to'xtaydi (ortiqcha so'rov yo'q)", async () => {
    respondPages([range(1, 100), range(101, 50)], () => ({ total: 150, totalPages: 2 }));
    const result = await fetchAllTransferBatches({ status: "received" });

    expect(result).toMatchObject({ capped: false });
    expect(result.data).toHaveLength(150);
    expect(calls()).toEqual([
      { status: "RECEIVED", page: "1", limit: "100" },
      { status: "RECEIVED", page: "2", limit: "100" },
    ]);
  });

  it("holat PENDING (`new`) — total ishonchsiz, bo'sh sahifagacha", async () => {
    respondPages([range(1, 3)], () => ({ total: 3, totalPages: 1 }), "PENDING");
    const result = await fetchAllTransferBatches({ status: "new" });

    expect(result.data).toHaveLength(3);
    expect(calls().map((params) => params.page)).toEqual(["1", "2"]);
    expect(calls()[0]).toMatchObject({ status: "PENDING", limit: "100" });
  });

  it("maxPages ga yetsa — capped: true; pageSize 100 dan oshmaydi", async () => {
    respondPages([range(1, 100), range(101, 100), range(201, 100)], () => ({ total: 100, totalPages: 1 }));
    const result = await fetchAllTransferBatches(undefined, { maxPages: 2, pageSize: 500 });

    expect(result.capped).toBe(true);
    expect(result.data).toHaveLength(200);
    expect(calls()).toEqual([
      { page: "1", limit: "100" },
      { page: "2", limit: "100" },
    ]);
  });

  it("sahifalar orasida siljish — takror paket bir marta olinadi", async () => {
    respondPages([[3, 2], [2, 1]], () => ({ total: 2, totalPages: 1 }));
    const result = await fetchAllTransferBatches(undefined, { pageSize: 2 });
    expect(result.data.map((batch) => batch.id)).toEqual(["3", "2", "1"]);
  });

  it("birinchi xatoda rad etiladi", async () => {
    let call = 0;
    mocks.get.mockImplementation(() => {
      call += 1;
      return call === 2
        ? Promise.reject(new Error("Server"))
        : Promise.resolve({ data: { data: { items: range(1, 100).map((id) => raw(id)), meta: { total: 100, totalPages: 1 } } } });
    });
    await expect(fetchAllTransferBatches()).rejects.toThrow("Server");
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
