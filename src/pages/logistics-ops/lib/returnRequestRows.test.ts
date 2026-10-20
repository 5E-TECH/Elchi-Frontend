import { describe, expect, it } from "vitest";
import {
  extractReturnRequestRows,
  extractReturnRequestScope,
  groupReturnRequestRowsByCourier,
  normalizeReturnRequestStatus,
  parseApproveReturnResult,
} from "./returnRequestRows";

const payload = {
  statusCode: 200,
  data: {
    total: 4,
    scope: { type: "BRANCH", branch_id: "7" },
    groups: [
      { courier_id: null, courier: null, orders: [{ id: "9004", status: "waiting" }] },
      {
        courier_id: "56",
        courier: { id: "56", name: "Jasur Tursunov" },
        orders: [
          { id: "9001", status: "waiting" },
          { id: "9002", status: "on the road" },
        ],
      },
      { courier_id: "57", courier: { id: "57", name: "Sherzod Komilov" }, orders: [{ id: "9003", status: "waiting" }] },
    ],
  },
};

describe("returnRequestRows (OS-3)", () => {
  it("qatorga kuryer id si yoziladi, kuryersiz guruhda — bo'sh", () => {
    const rows = extractReturnRequestRows(payload);
    expect(rows.map((row) => [row.id, row.courierId, row.courier])).toEqual([
      ["9004", "", ""],
      ["9001", "56", "Jasur Tursunov"],
      ["9002", "56", "Jasur Tursunov"],
      ["9003", "57", "Sherzod Komilov"],
    ]);
  });

  it("holat i18n kalitiga keltiriladi: backend 'on the road' → on_the_road (xom qiymat ko'rinmasin)", () => {
    expect(extractReturnRequestRows(payload).map((row) => row.status)).toEqual([
      "waiting",
      "waiting",
      "on_the_road",
      "waiting",
    ]);
    expect(normalizeReturnRequestStatus("ON_THE_ROAD")).toBe("on_the_road");
    expect(normalizeReturnRequestStatus("on-the-road")).toBe("on_the_road");
    expect(normalizeReturnRequestStatus("WAITING")).toBe("waiting");
    expect(normalizeReturnRequestStatus(undefined)).toBe("");
  });

  it("doira `data.scope.type` dan; noma'lum bo'lsa — null", () => {
    expect(extractReturnRequestScope(payload)).toBe("BRANCH");
    expect(extractReturnRequestScope({ data: { scope: { type: "hq" } } })).toBe("HQ");
    expect(extractReturnRequestScope({ data: { groups: [] } })).toBeNull();
    expect(extractReturnRequestScope(undefined)).toBeNull();
  });

  it("kuryer bo'yicha guruhlaydi: ro'yxat tartibida, kuryersiz guruh — oxirida", () => {
    const groups = groupReturnRequestRowsByCourier(extractReturnRequestRows(payload));
    expect(groups.map((group) => [group.courier, group.rows.map((row) => row.id)])).toEqual([
      ["Jasur Tursunov", ["9001", "9002"]],
      ["Sherzod Komilov", ["9003"]],
      ["", ["9004"]],
    ]);
  });

  it("tasdiqlash javobi: approved va skipped_order_ids", () => {
    expect(
      parseApproveReturnResult(
        { statusCode: 200, data: { approved: 2, order_ids: ["1", "2"], skipped_order_ids: ["3"] } },
        ["1", "2", "3"],
      ),
    ).toEqual({ approved: 2, skippedOrderIds: ["3"] });
  });

  it("tasdiqlash javobida maydon bo'lmasa — yuborilganlar hammasi tasdiqlangan", () => {
    expect(parseApproveReturnResult({ statusCode: 200 }, ["1", "2"])).toEqual({ approved: 2, skippedOrderIds: [] });
    expect(parseApproveReturnResult(undefined, ["1"])).toEqual({ approved: 1, skippedOrderIds: [] });
    expect(parseApproveReturnResult({ data: { order_ids: ["1"], skipped_order_ids: [2] } }, ["1", "2"])).toEqual({
      approved: 1,
      skippedOrderIds: ["2"],
    });
  });
});
