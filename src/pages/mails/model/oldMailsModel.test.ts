import { describe, expect, it } from "vitest";
import type { Batch } from "../../../entities/batch";
import {
  clearOldMailsFilters,
  countOldMailsFilters,
  EMPTY_OLD_MAILS_FILTERS,
  effectiveOldMailsStatus,
  filterOldMails,
  getOldMailStatusBadge,
  getOldMailStatusKind,
  readOldMailsFilters,
  readPostOrders,
  summarizeOldMails,
  toOldMailSourceFromBatch,
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
});

describe("oldMailsModel — filtr va xulosa", () => {
  const items = [
    mail(),
    mail({ id: "91", status: "sent", region: { id: "3", name: "Andijon" }, region_id: "3", courier_id: "7", courier: null }),
    mail({ id: "92", order_quantity: 0 }),
    mail({ id: "93", status: "canceled", createdAt: "2026-09-20T10:00:00.000Z" }),
  ];

  it("hides mails without orders", () => {
    expect(filterOldMails(items, EMPTY_OLD_MAILS_FILTERS, false).map((item) => item.id)).toEqual(["90", "91", "93"]);
  });

  it("filters by region, courier, status kind and date range", () => {
    const pick = (patch: Partial<typeof EMPTY_OLD_MAILS_FILTERS>) =>
      filterOldMails(items, { ...EMPTY_OLD_MAILS_FILTERS, ...patch }, false).map((item) => item.id);
    expect(pick({ regionId: "3" })).toEqual(["91"]);
    expect(pick({ courierId: "119" })).toEqual(["90", "93"]);
    expect(pick({ status: "cancelled" })).toEqual(["93"]);
    expect(pick({ dateFrom: "2026-10-01", dateTo: "2026-10-08" })).toEqual(["90", "91"]);
  });

  it("compares batch statuses exactly and ignores the courier filter in the batches mode", () => {
    const batches = [mail({ id: "129", status: "received" }), mail({ id: "128", status: "on_the_way" })];
    expect(
      filterOldMails(batches, { ...EMPTY_OLD_MAILS_FILTERS, status: "on_the_way", courierId: "999" }, true).map(
        (item) => item.id,
      ),
    ).toEqual(["128"]);
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
