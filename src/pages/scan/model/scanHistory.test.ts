import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildExternalBagView } from "./scanExternalBagView";
import {
  SCAN_HISTORY_LIMIT,
  readScanHistory,
  recordScanHistory,
  toScanHistoryEntry,
  type ScanHistoryEntry,
} from "./scanHistory";

const entry = (token: string, at = 1): ScanHistoryEntry => ({
  token,
  kind: "order",
  ref: token,
  name: null,
  place: null,
  count: null,
  at,
});

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("scan history (Oxirgi skanerlar · Shu qurilmada)", () => {
  it("keeps the newest first, one row per token (case-insensitive), at most 10", () => {
    for (let index = 0; index < 12; index += 1) recordScanHistory("u-1", entry(`tok-${index}`, index));
    recordScanHistory("u-1", entry("TOK-3", 99));

    const history = readScanHistory("u-1");
    expect(history).toHaveLength(SCAN_HISTORY_LIMIT);
    expect(history[0]).toMatchObject({ token: "TOK-3", at: 99 });
    expect(history.filter((item) => item.token.toLowerCase() === "tok-3")).toHaveLength(1);
  });

  it("is kept per user — another account on the same device does not see it", () => {
    recordScanHistory("u-1", entry("tok-a"));

    expect(readScanHistory("u-2")).toEqual([]);
  });

  it("survives a blocked or broken storage (private window, quota)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => recordScanHistory("u-1", entry("tok-a"))).not.toThrow();
    expect(readScanHistory("u-1")).toEqual([]);
  });

  it("drops malformed rows", () => {
    window.localStorage.setItem("elchi:scan-history:v1:u-1", JSON.stringify([{ token: 1 }, entry("ok"), "x"]));

    expect(readScanHistory("u-1").map((item) => item.token)).toEqual(["ok"]);
  });
});

describe("toScanHistoryEntry", () => {
  it("stores raw fields for an order (number, customer, district)", () => {
    expect(
      toScanHistoryEntry(
        "tok",
        { type: "order", data: { data: { id: "10241", customer: { name: "Dilnoza" }, district: { name: "Chilonzor" } } } },
        5,
      ),
    ).toEqual({ token: "tok", kind: "order", ref: "10241", name: "Dilnoza", place: "Chilonzor", count: null, at: 5 });
  });

  it("stores the package code and order count", () => {
    expect(
      toScanHistoryEntry("BTB-1", { type: "package", data: { type: "batch", data: { id: "137", order_count: 8 } } }, 5),
    ).toMatchObject({ kind: "package", ref: "B-137", count: 8 });
  });

  it("stores the bag size", () => {
    expect(
      toScanHistoryEntry("BAG-1", {
        type: "external-bag",
        data: { is_external_batch: true, count: 3, members: [] },
      }),
    ).toMatchObject({ kind: "external-bag", count: 3 });
  });

  it("does not record empty answers or a market QR", () => {
    expect(toScanHistoryEntry("tok", { type: "order", data: {} })).toBeNull();
    expect(toScanHistoryEntry("MCR-1", { type: "market-qr", data: null })).toBeNull();
    expect(toScanHistoryEntry("tok", undefined)).toBeNull();
  });
});

describe("buildExternalBagView", () => {
  it("reads the backend bag shape (members, count) and counts the parcels not yet received", () => {
    expect(
      buildExternalBagView({
        statusCode: 200,
        data: {
          external_batch_token: "BAG-77",
          is_external_batch: true,
          count: 3,
          members: [
            { id: "1", qr_code_token: "P-1", status: "NEW" },
            { id: "2", qr_code_token: "P-2", status: "received" },
            { id: null, qr_code_token: null },
          ],
        },
      }),
    ).toEqual({
      token: "BAG-77",
      count: 3,
      pending: 1,
      members: [
        { id: "1", token: "P-1", status: "new" },
        { id: "2", token: "P-2", status: "received" },
      ],
    });
  });

  it("returns null for a non-bag answer", () => {
    expect(buildExternalBagView({ type: "batch", data: { id: "137" } })).toBeNull();
  });
});
