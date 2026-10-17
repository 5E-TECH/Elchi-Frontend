import { describe, expect, it, vi } from "vitest";
import type { Batch } from "../../../entities/batch";
import {
  buildOldMailsQuery,
  clearOldMailsFilters,
  countOldMailsFilters,
  EMPTY_OLD_MAILS_FILTERS,
  effectiveOldMailsStatus,
  fetchAllOldMailPages,
  filterOldBatches,
  getOldMailStatusBadge,
  getOldMailStatusKind,
  OLD_MAIL_STATUS_FILTERS_COURIER,
  OLD_MAILS_PAGE_MAX,
  readOldMailsFilters,
  readOldMailsPage,
  readPostOrders,
  summarizeOldMails,
  toOldMailSourceFromBatch,
  toServerPostStatus,
  writeOldMailsFilters,
  writeOldMailsMode,
  type OldMailSource,
} from "./oldMailsModel";

const mail = (overrides: Partial<OldMailSource> = {}): OldMailSource => ({
  id: "90",
  createdAt: "2026-10-05T12:00:00.000Z",
  updatedAt: "2026-10-05T12:00:00.000Z",
  post_total_price: 650000,
  order_quantity: 3,
  region_id: "2",
  region: { id: "2", name: "Buxoro" },
  status: "received",
  courier_id: "119",
  courier: { id: "119", name: "Buxaro Courier" },
  ...overrides,
});

describe("oldMailsModel — URL", () => {
  it("reads the v1 URL keys", () => {
    const params = new URLSearchParams(
      "region_id=2&courier_id=119&status=sent&startDate=2026-10-01&endDate=2026-10-08&batch_mode=all",
    );
    expect(readOldMailsFilters(params)).toEqual({
      regionId: "2",
      courierId: "119",
      status: "sent",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-08",
    });
  });

  it("writes a filter, drops empty keys, resets the page and keeps the mode and page size", () => {
    const next = writeOldMailsFilters(new URLSearchParams("page=3&limit=16&batch_mode=all&region_id=2"), {
      regionId: "",
      status: "received",
    });
    expect(next.get("region_id")).toBeNull();
    expect(next.get("status")).toBe("received");
    expect(next.get("page")).toBe("1");
    expect(next.get("limit")).toBe("16");
    expect(next.get("batch_mode")).toBe("all");
  });

  it("clears every filter and the page but keeps the mode and page size", () => {
    const next = clearOldMailsFilters(
      new URLSearchParams("region_id=2&courier_id=1&status=sent&startDate=a&endDate=b&page=2&limit=16&batch_mode=all"),
    );
    expect(next.toString()).toBe("limit=16&batch_mode=all");
  });

  it("switches the mode: writes or removes batch_mode=all, drops the status (D11) and the page", () => {
    const toBatches = writeOldMailsMode(new URLSearchParams("status=sent&region_id=2&page=4"), true);
    expect(toBatches.get("batch_mode")).toBe("all");
    expect(toBatches.get("status")).toBeNull();
    expect(toBatches.get("page")).toBeNull();
    expect(toBatches.get("region_id")).toBe("2");

    const toMails = writeOldMailsMode(new URLSearchParams("batch_mode=all&status=received"), false);
    expect(toMails.get("batch_mode")).toBeNull();
    expect(toMails.get("status")).toBeNull();
  });
});

describe("oldMailsModel — holat", () => {
  it.each([
    ["received", "received"],
    ["sent", "sent"],
    ["on the road", "sent"],
    ["canceled", "cancelled"],
    ["cancelled_(sent)", "cancelled"],
    ["canceled_received", "returned"],
    ["something-else", "received"],
  ])("%s → %s (v1 getStatusKind)", (status, kind) => {
    expect(getOldMailStatusKind(status)).toBe(kind);
  });

  it("maps kinds to the mockup tones and mails: labels", () => {
    expect(getOldMailStatusBadge("received")).toEqual({ kind: "received", tone: "success", labelKey: "statusReceived" });
    expect(getOldMailStatusBadge("sent")).toEqual({ kind: "sent", tone: "warning", labelKey: "statusSent" });
    expect(getOldMailStatusBadge("canceled")).toEqual({ kind: "cancelled", tone: "danger", labelKey: "statusRejected" });
    expect(getOldMailStatusBadge("canceled_received")).toEqual({
      kind: "returned",
      tone: "neutral",
      labelKey: "statusReturned",
    });
  });

  it("keeps only statuses valid for the mode", () => {
    expect(effectiveOldMailsStatus("sent", false)).toBe("sent");
    expect(effectiveOldMailsStatus("sent", true)).toBe("");
    expect(effectiveOldMailsStatus("on_the_way", true)).toBe("on_the_way");
  });

  it("drops «Jo'natilgan» for the courier (post/courier/old-posts has no sent mails)", () => {
    expect(effectiveOldMailsStatus("sent", false, { courier: true })).toBe("");
    expect(effectiveOldMailsStatus("on the road", false, { courier: true })).toBe("");
    expect(effectiveOldMailsStatus("received", false, { courier: true })).toBe("received");
    expect(OLD_MAIL_STATUS_FILTERS_COURIER.map((option) => option.value)).toEqual([
      "received",
      "canceled",
      "canceled_received",
    ]);
  });
});

describe("oldMailsModel — server so'rovi (F4, YfrqN70i)", () => {
  const filters = {
    regionId: "2",
    courierId: "119",
    status: "canceled",
    dateFrom: "2026-10-01",
    dateTo: "2026-10-08",
  };

  it("builds the GET /post query from the URL filters (server-side filters, has_orders)", () => {
    expect(buildOldMailsQuery({ filters, page: 3, limit: 16, isCourier: false })).toEqual({
      page: 3,
      limit: 16,
      has_orders: true,
      region_id: "2",
      courier_id: "119",
      status: "canceled",
      startDate: "2026-10-01",
      endDate: "2026-10-08",
    });
  });

  it("never asks for more than 100 rows and omits empty filters", () => {
    const query = buildOldMailsQuery({ filters: EMPTY_OLD_MAILS_FILTERS, page: 1, limit: 10000, isCourier: false });
    expect(query).toStrictEqual({ page: 1, limit: OLD_MAILS_PAGE_MAX, has_orders: true });
    expect(OLD_MAILS_PAGE_MAX).toBe(100);
  });

  it("sends legacy URL statuses as backend post statuses", () => {
    expect(toServerPostStatus("")).toBe("");
    expect(toServerPostStatus("cancelled")).toBe("canceled");
    expect(toServerPostStatus("rejected")).toBe("canceled");
    expect(toServerPostStatus("returned")).toBe("canceled_received");
    expect(toServerPostStatus("on the road")).toBe("sent");
    expect(toServerPostStatus("received")).toBe("received");
    expect(buildOldMailsQuery({ filters: { ...filters, status: "cancelled" }, page: 1, limit: 8, isCourier: false }).status).toBe(
      "canceled",
    );
  });

  it("courier: no courier_id and no «sent» status (backend returns an empty page for it)", () => {
    const query = buildOldMailsQuery({ filters: { ...filters, status: "sent" }, page: 2, limit: 8, isCourier: true });
    expect(query).toStrictEqual({
      page: 2,
      limit: 8,
      has_orders: true,
      region_id: "2",
      startDate: "2026-10-01",
      endDate: "2026-10-08",
    });
    expect(buildOldMailsQuery({ filters, page: 1, limit: 8, isCourier: true }).status).toBe("canceled");
  });

  it("swaps a reversed date range and drops an invalid date (backend answers 400 otherwise)", () => {
    const reversed = buildOldMailsQuery({
      filters: { ...EMPTY_OLD_MAILS_FILTERS, dateFrom: "2026-10-08", dateTo: "2026-10-01" },
      page: 1,
      limit: 8,
      isCourier: false,
    });
    expect([reversed.startDate, reversed.endDate]).toEqual(["2026-10-01", "2026-10-08"]);

    const invalid = buildOldMailsQuery({
      filters: { ...EMPTY_OLD_MAILS_FILTERS, dateFrom: "2026-13-40", dateTo: "yesterday" },
      page: 1,
      limit: 8,
      isCourier: false,
    });
    expect(invalid).toStrictEqual({ page: 1, limit: 8, has_orders: true });
  });

  it("reads one server page: rows, total, totalPages, limit", () => {
    const rows = [mail(), mail({ id: "91" })];
    expect(
      readOldMailsPage({ statusCode: 200, data: { data: rows, total: 250, page: 2, totalPages: 32, limit: 8 } }),
    ).toEqual({ rows, total: 250, totalPages: 32, limit: 8 });
    expect(readOldMailsPage(undefined)).toEqual({ rows: [], total: 0, totalPages: 1, limit: 0 });
  });
});

describe("oldMailsModel — Excel uchun barcha sahifalar (fetchAllOldMailPages)", () => {
  const page = (from: number, count: number, total: number, limit = 100) => ({
    statusCode: 200,
    data: {
      data: Array.from({ length: count }, (_, index) => mail({ id: String(from + index) })),
      total,
      page: Math.floor(from / limit) + 1,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    },
  });
  const query = { page: 1, limit: 100, has_orders: true as const, region_id: "2", status: "received" };

  it("requests pages 1..totalPages sequentially with the same filters and limit 100", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, 100, 250))
      .mockResolvedValueOnce(page(100, 100, 250))
      .mockResolvedValueOnce(page(200, 50, 250));

    const result = await fetchAllOldMailPages(fetchPage, { ...query, limit: 16, page: 4 });

    expect(fetchPage.mock.calls.map(([params]) => params)).toEqual([
      { ...query, page: 1 },
      { ...query, page: 2 },
      { ...query, page: 3 },
    ]);
    expect(result.rows).toHaveLength(250);
    expect(result.capped).toBe(false);
  });

  it("stops at maxPages and reports capped", async () => {
    const fetchPage = vi.fn((params: { page?: number }) =>
      Promise.resolve(page(((params.page ?? 1) - 1) * 100, 100, 1000)),
    );

    const result = await fetchAllOldMailPages(fetchPage, query, { maxPages: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(200);
    expect(result.capped).toBe(true);
  });

  it("drops duplicates when a new mail shifts the pages and stops on an empty page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, 100, 500))
      .mockResolvedValueOnce(page(99, 100, 500))
      .mockResolvedValueOnce(page(0, 0, 500));

    const result = await fetchAllOldMailPages(fetchPage, query);

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.rows).toHaveLength(199);
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(199);
  });

  it("follows a growing total: a mail added during the export does not push the last row out", async () => {
    // 1-sahifa: 200 ta (2 sahifa). Yig'ish paytida yangi pochta qo'shildi — 2-sahifa `total: 201` (3 sahifa) va
    // bitta siljigan; oxirgi qator 3-sahifaga o'tdi va u ham olinadi.
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, 100, 200))
      .mockResolvedValueOnce(page(99, 100, 201))
      .mockResolvedValueOnce(page(199, 1, 201));

    const result = await fetchAllOldMailPages(fetchPage, query);

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.rows).toHaveLength(200);
    expect(result.rows.at(-1)?.id).toBe("199");
    expect(result.capped).toBe(false);
  });

  it("rejects on the first failed page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, 100, 250))
      .mockRejectedValueOnce(new Error("502"));

    await expect(fetchAllOldMailPages(fetchPage, query)).rejects.toThrow("502");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

describe("oldMailsModel — filtr va xulosa", () => {
  const items = [
    mail(),
    mail({ id: "91", status: "sent", region: { id: "3", name: "Andijon" }, region_id: "3", courier_id: "7", courier: null }),
    mail({ id: "92", order_quantity: 0 }),
    mail({ id: "93", status: "canceled", createdAt: "2026-09-20T10:00:00.000Z" }),
  ];

  it("hides batches without orders", () => {
    expect(filterOldBatches(items, EMPTY_OLD_MAILS_FILTERS).map((item) => item.id)).toEqual(["90", "91", "93"]);
  });

  it("filters batches by region and date range", () => {
    const pick = (patch: Partial<typeof EMPTY_OLD_MAILS_FILTERS>) =>
      filterOldBatches(items, { ...EMPTY_OLD_MAILS_FILTERS, ...patch }).map((item) => item.id);
    expect(pick({ regionId: "3" })).toEqual(["91"]);
    expect(pick({ dateFrom: "2026-10-01", dateTo: "2026-10-08" })).toEqual(["90", "91"]);
  });

  it("compares batch statuses exactly and ignores the courier filter", () => {
    const batches = [mail({ id: "129", status: "received" }), mail({ id: "128", status: "on_the_way" })];
    expect(
      filterOldBatches(batches, { ...EMPTY_OLD_MAILS_FILTERS, status: "on_the_way", courierId: "999" }).map(
        (item) => item.id,
      ),
    ).toEqual(["128"]);
    // Pochta holati (paket holati emas) — filtr yo'q.
    expect(filterOldBatches(batches, { ...EMPTY_OLD_MAILS_FILTERS, status: "canceled" }).map((item) => item.id)).toEqual([
      "129",
      "128",
    ]);
  });

  it("counts active filters per mode and role", () => {
    const filters = { regionId: "2", courierId: "1", status: "sent", dateFrom: "2026-10-01", dateTo: "" };
    expect(countOldMailsFilters(filters, { batches: false, withCourier: true })).toBe(4);
    expect(countOldMailsFilters(filters, { batches: true, withCourier: false })).toBe(2);
    expect(countOldMailsFilters(filters, { batches: false, withCourier: false, withDate: false })).toBe(2);
  });

  it("summarizes the filtered list", () => {
    expect(summarizeOldMails([mail(), mail({ order_quantity: 2, post_total_price: 100000 })])).toEqual({
      count: 2,
      orders: 5,
      amount: 750000,
    });
  });

  it("adapts a batch to a row source (region — destination branch region or name)", () => {
    const batch = {
      id: "129",
      token: "t",
      from_branch: { id: "1", name: "Andijon filiali" },
      to_branch: { id: "5", name: "Toshkent HQ", region: "Toshkent" },
      direction: "forward",
      orders_count: 14,
      total_price: 3186000,
      status: "received",
      created_at: "2026-10-07T12:55:00.000Z",
    } as Batch;
    expect(toOldMailSourceFromBatch(batch)).toEqual({
      id: "129",
      createdAt: "2026-10-07T12:55:00.000Z",
      updatedAt: "2026-10-07T12:55:00.000Z",
      post_total_price: 3186000,
      order_quantity: 14,
      region_id: "5",
      region: { id: "5", name: "Toshkent" },
      status: "received",
    });
  });

  it("reads post orders from every known response shape", () => {
    expect(readPostOrders([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(readPostOrders({ data: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(readPostOrders({ data: { allOrdersByPostId: [{ id: 3 }] } })).toEqual([{ id: 3 }]);
    expect(readPostOrders({ data: { orders: [{ id: 4 }] } })).toEqual([{ id: 4 }]);
    expect(readPostOrders({ data: { data: [{ id: 5 }] } })).toEqual([{ id: 5 }]);
    expect(readPostOrders(null)).toEqual([]);
  });
});
