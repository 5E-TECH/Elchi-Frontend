import { describe, expect, it } from "vitest";
import { extraCostOrderNumber, extraCostRequesterName } from "./extraCostApprovalView";

describe("qo'shimcha xarajat so'rovi — raqam va so'rovchi (0Ngp09FG)", () => {
  it("`order_number` bor — «EL-100076» (oldidagi «#»/«№» olinadi); yo'q yoki bo'sh — `order_id`", () => {
    expect(extraCostOrderNumber({ order_id: "76", order_number: "EL-100076" })).toBe("EL-100076");
    expect(extraCostOrderNumber({ order_id: "76", order_number: "#EL-100076" })).toBe("EL-100076");
    expect(extraCostOrderNumber({ order_id: "76", order_number: null })).toBe("76");
    expect(extraCostOrderNumber({ order_id: "76", order_number: "  " })).toBe("76");
    expect(extraCostOrderNumber({ order_id: "76" })).toBe("76");
  });

  it("so'rovchi ismi; `null` / bo'sh / maydon yo'q — `null` (UI zaxirasi `#id`)", () => {
    expect(extraCostRequesterName({ requested_by: { id: "301", name: " Ali Kuryer " } })).toBe("Ali Kuryer");
    expect(extraCostRequesterName({ requested_by: { id: "301", name: null } })).toBeNull();
    expect(extraCostRequesterName({ requested_by: { id: "301", name: "" } })).toBeNull();
    expect(extraCostRequesterName({})).toBeNull();
  });
});
