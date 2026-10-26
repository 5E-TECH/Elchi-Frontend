import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

import { fetchCustomerSuggestions, toCustomerDistrict, toCustomerSuggestions } from "./api";

beforeEach(() => {
  mocks.get.mockReset();
});

describe("toCustomerSuggestions", () => {
  it("gateway qobig'ini ochadi, id'siz qatorni tashlaydi, sonlarni normallaydi", () => {
    const rows = toCustomerSuggestions({
      statusCode: 200,
      data: [
        {
          id: 55,
          name: "Shahnoza",
          phone_number: "+998903456721",
          extra_number: "99-871-22-64",
          address: null,
          region_id: null,
          district_id: 101,
          orders_count: "4",
          new_orders_count: 1,
          has_new_orders: true,
          new_order_ids: [10260, null],
          last_order_at: "2026-10-19T09:52:00.000Z",
          matched_by: "extra_number",
          password: "yo'q",
        },
        { name: "id'siz" },
        null,
      ],
    });

    expect(rows).toEqual([
      {
        id: "55",
        name: "Shahnoza",
        phone_number: "+998903456721",
        extra_number: "99-871-22-64",
        address: null,
        region_id: null,
        district_id: "101",
        orders_count: 4,
        new_orders_count: 1,
        has_new_orders: true,
        new_order_ids: ["10260"],
        last_order_at: "2026-10-19T09:52:00.000Z",
        matched_by: "extra_number",
      },
    ]);
  });

  it("9444UAa8: matched_by — faqat phone | extra_number | name, qolgani (yo'q / noma'lum) `null`", () => {
    const rows = toCustomerSuggestions({
      data: [
        { id: "1", matched_by: "phone" },
        { id: "2", matched_by: "name" },
        { id: "3", matched_by: "address" },
        { id: "4" },
      ],
    });
    expect(rows.map((row) => row.matched_by)).toEqual(["phone", "name", null, null]);
  });

  it("market konteksti yo'q — sonlar `null`; ro'yxat bo'lmasa bo'sh", () => {
    expect(toCustomerSuggestions({ data: [{ id: "1", orders_count: null, new_orders_count: null }] })[0]).toMatchObject({
      orders_count: null,
      new_orders_count: null,
      has_new_orders: false,
    });
    expect(toCustomerSuggestions({ data: { items: [] } })).toEqual([]);
    expect(toCustomerSuggestions(undefined)).toEqual([]);
  });
});

describe("toCustomerDistrict", () => {
  it("viloyat `region_id` yoki `region.id` dan", () => {
    expect(toCustomerDistrict({ data: { id: 101, name: "Chilonzor", region_id: 11 } })).toEqual({
      id: "101",
      name: "Chilonzor",
      region_id: "11",
    });
    expect(toCustomerDistrict({ data: { id: "7", name: "Urgut", region: { id: "12" } } })?.region_id).toBe("12");
    expect(toCustomerDistrict({ data: null })).toBeNull();
  });
});

describe("fetchCustomerSuggestions", () => {
  it("market rolida `market_id` yuborilmaydi, boshqalarida yuboriladi", async () => {
    mocks.get.mockResolvedValue({ data: { data: [] } });

    await fetchCustomerSuggestions({ phone: "9034567" });
    await fetchCustomerSuggestions({ phone: "9034567", marketId: "3" });

    expect(mocks.get).toHaveBeenNthCalledWith(1, "customers/suggest", { params: { phone: "9034567" } });
    expect(mocks.get).toHaveBeenNthCalledWith(2, "customers/suggest", { params: { phone: "9034567", market_id: "3" } });
  });
});
