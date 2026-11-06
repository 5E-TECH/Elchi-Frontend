import { describe, expect, it } from "vitest";
import { extraCostProofPath, extraCostsQueryKey, isExtraCostTab, toExtraCostsPage } from "./extraCosts";

/** GykuOz8f — `GET orders/extra-costs` javobi → sahifa (`toExtraCostsPage`) va kesh kaliti. */

describe("toExtraCostsPage (GykuOz8f)", () => {
  it("⭐ `{ statusCode, data: { items, total, page, limit, counts } }` → qatorlar, sonlar", () => {
    const page = toExtraCostsPage({
      statusCode: 200,
      message: "ok",
      data: {
        items: [
          {
            id: 12,
            order_id: 81,
            order_number: "EL-100081",
            market_id: "7",
            requested_by_user_id: 56,
            requested_by_role: "courier",
            requested_by: { id: "56", name: " Jasur " },
            action: "partly_sell",
            amount: "15000",
            status: "approved",
            auto_approved: false,
            immediate: true,
            proof_file_keys: ["a.jpg", "", 5, " b.mp4 "],
            proof_count: 2,
            decided_at: null,
            auto_approve_at: "1762423200000",
            reject_reason: "SOMETHING_ELSE",
            reject_reason_label: "Boshqa",
            created_at: "2026-11-05T10:00:00.000Z",
            customer: { name: "Ali", phone_number: "+998901234567" },
            market: { id: 7, name: "Baraka" },
            order_status: "sold",
          },
          { id: "", order_id: "1" },
          "junk",
        ],
        total: 31,
        page: 2,
        limit: 10,
        counts: { all: 31, pending: "3", approved: 20, cancelled: 8 },
      },
    });

    expect(page.total).toBe(31);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(10);
    expect(page.counts).toEqual({ all: 31, pending: 3, approved: 20, cancelled: 8 });
    expect(page.items).toHaveLength(1);
    const [row] = page.items;
    expect(row).toMatchObject({
      id: "12",
      order_id: "81",
      order_number: "EL-100081",
      requested_by_user_id: "56",
      requested_by: { id: "56", name: "Jasur" },
      action: "partly_sell",
      amount: 15000,
      status: "approved",
      immediate: true,
      auto_approved: false,
      proof_file_keys: ["a.jpg", "b.mp4"],
      proof_count: 2,
      reject_reason: null,
      reject_reason_label: "Boshqa",
      createdAt: "2026-11-05T10:00:00.000Z",
      customer: { name: "Ali", phone: "+998901234567" },
      market: { id: "7", name: "Baraka" },
      order_status: "sold",
    });
    expect(row.auto_approve_at).toBe(new Date(1762423200000).toISOString());
  });

  it("sonlar to'liq kelmasa — `counts: null` (tablar sonsiz); noma'lum holat → pending, `proof_count` — kalitlardan", () => {
    const page = toExtraCostsPage({
      data: {
        items: [{ id: "1", order_id: "2", status: "weird", action: "x", proof_file_keys: ["a", "b", "c"] }],
        counts: { all: 1, pending: 1 },
      },
    });
    expect(page.counts).toBeNull();
    expect(page.items[0]).toMatchObject({ status: "pending", action: "sell", proof_count: 3, customer: null });
    expect(page.total).toBe(1);
  });

  it("tab, kalit va isbot yo'li", () => {
    expect(isExtraCostTab("cancelled")).toBe(true);
    expect(isExtraCostTab("rejected")).toBe(false);
    expect(extraCostsQueryKey({ tab: "pending", page: 1, limit: 25 })).toEqual([
      "orders",
      "extra-costs",
      { tab: "pending", page: 1, limit: 25 },
    ]);
    expect(extraCostProofPath("ap/1", 0)).toBe("orders/extra-costs/ap%2F1/proofs/0");
  });
});
