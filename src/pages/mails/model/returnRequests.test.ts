import { describe, expect, it } from "vitest";
import type { MailItem } from "../../../entities/mails";
import { mockRejection } from "../../../test/mockEnvelope";
import {
  NO_COURIER_KEY,
  buildReturnPayload,
  groupReturnRequests,
  orderSummaryGroups,
  parseReturnActionResult,
  returnActionErrorKey,
  returnRequestState,
} from "./returnRequests";

/** u5HTJtqK — «Pochta → Qaytarish» yordamchilari (Ops'dagi `returnRequestRows` testlaridan ko'chgan qism). */
const item = (id: string, overrides: Partial<MailItem> = {}): MailItem => ({
  id,
  request_id: id,
  order_id: id,
  createdAt: "",
  updatedAt: "",
  courier_id: "",
  post_total_price: 1000,
  order_quantity: 1,
  qr_code_token: "",
  region_id: "1",
  region: { id: "1", name: "Toshkent", sato_code: "" },
  status: "waiting",
  ...overrides,
});
const courier = (id: string, name: string) => ({ courier_id: id, courier: { id, name, phone_number: "" } });
const transfer = (branchId: string) => ({ return_source: "branch_transfer" as const, return_branch: { id: branchId, name: "" } });

describe("returnRequests — guruhlash", () => {
  const items = [
    item("9004"),
    item("9001", courier("56", "Jasur Tursunov")),
    item("9101", { ...transfer("15"), status: "on the road" }),
    item("9002", { ...courier("56", "Jasur Tursunov"), status: "on the road" }),
    item("9003", courier("57", "Sherzod Komilov")),
    item("9102", { ...transfer("16"), status: "on the road" }),
  ];
  const groups = groupReturnRequests(items, "Kuryer", (branch) => `Filial ${branch?.id}`);

  it("jadval — ro'yxat tartibida; kuryersiz qator — `NO_COURIER_KEY`, filial o'tkazmasi — manzil filial bo'yicha", () => {
    expect(groups.map((group) => [group.key, group.kind, group.name, group.orders.map((order) => order.id)])).toEqual([
      [NO_COURIER_KEY, "courier", "Kuryer", ["9004"]],
      ["56", "courier", "Jasur Tursunov", ["9001", "9002"]],
      ["branch_transfer:15", "branch", "Filial 15", ["9101"]],
      ["57", "courier", "Sherzod Komilov", ["9003"]],
      ["branch_transfer:16", "branch", "Filial 16", ["9102"]],
    ]);
  });

  it("oyna — kuryerlar, keyin filiallar, kuryersiz guruh oxirida", () => {
    expect(orderSummaryGroups(groups).map((group) => group.key)).toEqual([
      "56",
      "57",
      "branch_transfer:15",
      "branch_transfer:16",
      NO_COURIER_KEY,
    ]);
  });

  it("so'rov tanasi — faqat takrorsiz `order_ids`", () => {
    expect(buildReturnPayload([item("1"), item("2", { order_id: "" }), item("1")])).toEqual({ order_ids: ["1", "2"] });
  });
});

describe("returnRequests — holat", () => {
  it.each([
    ["on the road", undefined, "notReceived", "warning"],
    ["ON_THE_ROAD", undefined, "notReceived", "warning"],
    ["on the road", "branch_transfer" as const, "notArrived", "warning"],
    ["WAITING", undefined, "withCourier", "neutral"],
  ])("%s (%s) → %s", (status, source, key, tone) => {
    expect(returnRequestState(item("1", { status, return_source: source }))).toEqual({ key, tone });
  });

  it("noma'lum holat — `null` (xom qiymat ko'rsatilmaydi)", () => {
    expect(returnRequestState(item("1", { status: "sold" }))).toBeNull();
  });
});

describe("returnRequests — amal javobi", () => {
  it("approve: approved va skipped_order_ids", () => {
    expect(
      parseReturnActionResult(
        { statusCode: 200, data: { approved: 2, order_ids: ["1", "2"], skipped_order_ids: ["3"] } },
        "approve",
        ["1", "2", "3"],
      ),
    ).toEqual({ done: 2, skippedOrderIds: ["3"] });
  });

  it("reject: rejected; approve kaliti hisobga olinmaydi", () => {
    expect(
      parseReturnActionResult({ data: { rejected: 1, approved: 9, skipped_order_ids: [2] } }, "reject", ["1", "2"]),
    ).toEqual({ done: 1, skippedOrderIds: ["2"] });
  });

  it("son bo'lmasa — order_ids soni, u ham bo'lmasa — yuborilganlar minus o'tkazilganlar", () => {
    expect(parseReturnActionResult({ data: { order_ids: ["1"] } }, "approve", ["1", "2"])).toEqual({
      done: 1,
      skippedOrderIds: [],
    });
    expect(parseReturnActionResult({ statusCode: 200, data: null }, "approve", ["1", "2"])).toEqual({
      done: 2,
      skippedOrderIds: [],
    });
    expect(parseReturnActionResult(undefined, "reject", ["1", "2"])).toEqual({ done: 2, skippedOrderIds: [] });
    expect(parseReturnActionResult({ data: { skipped_order_ids: ["2"] } }, "reject", ["1", "2"])).toEqual({
      done: 1,
      skippedOrderIds: ["2"],
    });
  });
});

describe("returnRequests — xato turi", () => {
  it.each([
    [403, "forbidden"],
    [409, "stale"],
    [404, "stale"],
    [500, "server"],
    [502, "server"],
    [400, "generic"],
  ] as const)("%s → %s", (status, key) => {
    expect(returnActionErrorKey(mockRejection(status))).toBe(key);
  });

  it("vaqt chegarasi — server (bir qismi yozilgan bo'lishi mumkin)", () => {
    expect(returnActionErrorKey({ isAxiosError: true, code: "ECONNABORTED", message: "timeout of 20000ms exceeded" })).toBe(
      "server",
    );
  });
});
