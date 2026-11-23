import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, post: mocks.post } };
});

import { REHOME_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { parseDistrictRehomeResult, rehomeDistrictOpenOrders, useRehomeDistrictOrders } from "./districtRehome";

/** Backend `POST district/:id/rehome-open-orders` javobi (gateway `ApiOkResponse` misoli shaklida). */
const RESPONSE = {
  statusCode: 200,
  message: "success",
  data: {
    district_id: "1401",
    target_region_id: "9",
    moved: 2,
    order_ids: ["1001", 1002],
    from_post_ids: ["900"],
    to_post_id: "905",
    skipped: [
      { order_id: "1003", reason: "held_by_courier" },
      { order_id: 1004, reason: "status_not_received" },
      { order_id: null, reason: "deleted" },
    ],
  },
};

describe("districtRehome (PlIPwpQY)", () => {
  beforeEach(() => mocks.post.mockReset());

  it("⭐ REHOME_REQUEST_TIMEOUT_MS — gateway 30 s dan kamida 5 s ko'p (≥ 35 s)", () => {
    expect(REHOME_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000 + 5_000);
  });

  it("endpoint — district/:id/rehome-open-orders", () => {
    expect(API_ENDPOINTS.DISTRICTS.REHOME_OPEN_ORDERS(1401)).toBe("district/1401/rehome-open-orders");
  });

  it("⭐ javob o'qiladi: id'lar satrga, sababsiz yoki id'siz o'tkazilgan qator tashlanadi", () => {
    expect(parseDistrictRehomeResult(RESPONSE)).toEqual({
      districtId: "1401",
      targetRegionId: "9",
      moved: 2,
      orderIds: ["1001", "1002"],
      fromPostIds: ["900"],
      toPostId: "905",
      skipped: [
        { orderId: "1003", reason: "held_by_courier" },
        { orderId: "1004", reason: "status_not_received" },
      ],
    });
  });

  it("ko'chadigani yo'q: to_post_id null, moved 0 — natija (soxta emas)", () => {
    const result = parseDistrictRehomeResult({ data: { district_id: "7", moved: 0, to_post_id: null, skipped: [] } });
    expect(result).toMatchObject({ districtId: "7", moved: 0, toPostId: null, orderIds: [], skipped: [] });
  });

  it("PATCH district/:id javobidagi `data.rehome` ham o'qiladi", () => {
    const result = parseDistrictRehomeResult({
      data: { serving_branch_cleared: true, rehome: { district_id: "7", moved: 1, order_ids: ["5"], to_post_id: "11" } },
    });
    expect(result).toMatchObject({ districtId: "7", moved: 1, orderIds: ["5"], toPostId: "11" });
  });

  it("⭐ tanimagan javob — null (natija noma'lum, «0 ta ko'chirildi» emas)", () => {
    expect(parseDistrictRehomeResult(null)).toBeNull();
    expect(parseDistrictRehomeResult({ data: [] })).toBeNull();
    expect(parseDistrictRehomeResult({ data: { moved: 2 } })).toBeNull();
    expect(parseDistrictRehomeResult({ data: { district_id: "7", moved: "ko'p" } })).toBeNull();
    expect(parseDistrictRehomeResult({ data: { district_id: "7", moved: -1 } })).toBeNull();
  });

  it("⭐ so'rov: POST, tanasiz, timeout = REHOME_REQUEST_TIMEOUT_MS", async () => {
    mocks.post.mockResolvedValue({ data: RESPONSE });
    const result = await rehomeDistrictOpenOrders("1401");

    expect(mocks.post).toHaveBeenCalledWith("district/1401/rehome-open-orders", undefined, {
      timeout: REHOME_REQUEST_TIMEOUT_MS,
    });
    expect(result?.moved).toBe(2);
  });

  it("hook: muvaffaqiyatda pochta va buyurtma ro'yxatlari yangilanadi", async () => {
    mocks.post.mockResolvedValue({ data: RESPONSE });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useRehomeDistrictOrders(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("1401");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.toPostId).toBe("905");
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([["mails"], ["orders"]]);
  });
});
