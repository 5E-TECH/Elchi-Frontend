import { describe, expect, it } from "vitest";
import type { BatchDetail } from "../../../entities/batch";
import { buildScanPackageView, buildScanPostView, getPackageReceiveError, toScanBatchStatus } from "./scanBatchView";

/** `GET scan/BTB-…` (origin/main): `{ type: "batch", data: <paket qatori> }` — nomlar yo'q, faqat id. */
const SCAN_PACKAGE = {
  type: "batch",
  data: {
    id: "137",
    qr_code_token: "BTB-137",
    source_branch_id: "7",
    destination_branch_id: "1",
    status: "SENT",
    order_count: 2,
    total_price: 495000,
    driver_name: "Sardor Aliyev",
    vehicle_plate: "01 A 345 KA",
    createdAt: "2026-10-16T17:20:00.000Z",
    items: [
      { id: "i1", order_id: "10184", snapshot_price: 310000 },
      { id: "i2", order_id: "10181", snapshot_price: 185000 },
    ],
  },
};

describe("buildScanPackageView", () => {
  it("reads the scan response as is (courier: no branch names, orders by id + snapshot price)", () => {
    const view = buildScanPackageView(SCAN_PACKAGE, "package");
    expect(view).toMatchObject({
      id: "137",
      code: "B-137",
      returned: false,
      status: "on_the_way",
      total: 495000,
      ordersCount: 2,
      fromBranch: null,
      destinationRegion: null,
      driver: "Sardor Aliyev",
      vehicle: "01 A 345 KA",
    });
    expect(view?.orders).toEqual([
      { id: "10184", customer: null, phone: null, amount: 310000, status: null },
      { id: "10181", customer: null, phone: null, amount: 185000, status: null },
    ]);
  });

  it("fills names and orders from `GET transfer-batches/:id` for staff", () => {
    const detail = {
      id: "137",
      from_branch: { id: "7", name: "Chilonzor qabul punkti" },
      to_branch: { id: "1", name: "Farg'ona filiali", region: "Farg'ona" },
      driver: "Sardor Aliyev",
      vehicle_plate: "01 A 345 KA",
      orders: [{ id: "10184", receiver: "Nodira Karimova", phone: "+998905124418", price: 310000, status: "on the road" }],
    } as unknown as BatchDetail;

    const view = buildScanPackageView(SCAN_PACKAGE, "package", detail);
    expect(view).toMatchObject({ fromBranch: "Chilonzor qabul punkti", destinationRegion: "Farg'ona", ordersCount: 2 });
    expect(view?.orders).toEqual([
      { id: "10184", customer: "Nodira Karimova", phone: "+998905124418", amount: 310000, status: "on the road" },
    ]);
  });

  it("ignores a detail of another package and marks returned packages", () => {
    const other = { id: "999", from_branch: { name: "X" }, to_branch: {}, orders: [] } as unknown as BatchDetail;
    const view = buildScanPackageView(SCAN_PACKAGE, "returned-package", other);
    expect(view?.fromBranch).toBeNull();
    expect(view?.returned).toBe(true);
  });

  it("returns null when the response has no package id", () => {
    expect(buildScanPackageView({ type: "batch", data: {} }, "package")).toBeNull();
    expect(buildScanPackageView(null, "package")).toBeNull();
  });
});

describe("toScanBatchStatus", () => {
  it("maps backend statuses (SENT = «Yo'lda», F1)", () => {
    expect(toScanBatchStatus("PENDING")).toBe("new");
    expect(toScanBatchStatus("SENT")).toBe("on_the_way");
    expect(toScanBatchStatus("RECEIVED")).toBe("received");
    expect(toScanBatchStatus("CANCELLED")).toBe("cancelled");
    expect(toScanBatchStatus("??")).toBeNull();
  });
});

describe("getPackageReceiveError", () => {
  const error = (message?: string) => ({ response: { status: 400, data: message ? { message } : {} } });

  it("maps known backend reasons", () => {
    expect(getPackageReceiveError(error("Batch already received")).key).toBe("alreadyReceived");
    expect(getPackageReceiveError(error("Paket bekor qilingan")).key).toBe("cancelled");
    expect(getPackageReceiveError(error("Boshqa filial paketi")).key).toBe("wrongBranch");
  });

  it("keeps an unknown backend message verbatim, otherwise the generic error", () => {
    expect(getPackageReceiveError(error("Server band"))).toEqual({ key: "receiveError", message: "Server band" });
    expect(getPackageReceiveError(error())).toEqual({ key: "receiveError", message: null });
  });
});

describe("buildScanPostView", () => {
  it("reads the bare post row from `GET post/scan/:id` (no orders list, no names)", () => {
    const view = buildScanPostView({
      statusCode: 200,
      data: { id: "2493", order_quantity: 6, post_total_price: 1411000, region_id: "5", courier_id: "93" },
    });
    expect(view).toEqual({
      id: "2493",
      createdAt: null,
      total: 1411000,
      ordersCount: 6,
      region: null,
      courier: null,
      orders: null,
    });
  });

  it("uses an orders list and names when the response has them", () => {
    const view = buildScanPostView({
      data: {
        id: "2493",
        region: { name: "Toshkent sh." },
        courier: { name: "Jasur Tursunov" },
        orders: [{ id: "10252", total_price: 245000, status: "on the road", customer: { name: "Shohruh Aliyev" } }],
      },
    });
    expect(view).toMatchObject({ total: 245000, ordersCount: 1, region: "Toshkent sh.", courier: "Jasur Tursunov" });
    expect(view?.orders?.[0]).toEqual({
      id: "10252",
      customer: "Shohruh Aliyev",
      phone: null,
      amount: 245000,
      status: "on the road",
    });
  });

  it("returns null without a post id", () => {
    expect(buildScanPostView({ data: {} })).toBeNull();
  });
});
