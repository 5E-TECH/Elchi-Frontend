import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CreateOrderRequest } from "../types/order";
import { createOrderFingerprint, useCreateOrderIdempotencyKeys } from "./createIdempotency";

const order = (total_price: number) =>
  ({
    customer: { name: "Vali", phone_number: "+998901234567", district_id: "101" },
    items: [{ product_id: "501", quantity: 1 }],
    district_id: "101",
    region_id: "11",
    total_price,
    where_deliver: "center",
  }) as CreateOrderRequest;

describe("buyurtma yaratish Idempotency-Key (gpCIsGjH)", () => {
  it("kalit gateway chegarasida (≤ 255 belgi), bo'sh emas", () => {
    const { result } = renderHook(() => useCreateOrderIdempotencyKeys());
    const key = result.current.take(order(1000));
    expect(key.length).toBeGreaterThan(8);
    expect(key.length).toBeLessThanOrEqual(255);
  });

  it("AYNI tarkib — AYNI kalit (qayta urinish); boshqa tarkib — yangi; eski tarkib o'z kalitini saqlaydi; reset — yangi", () => {
    const { result } = renderHook(() => useCreateOrderIdempotencyKeys());
    const a = result.current.take(order(1000));
    expect(result.current.take(order(1000))).toBe(a);
    const b = result.current.take(order(2000));
    expect(b).not.toBe(a);
    expect(result.current.take(order(1000))).toBe(a);
    result.current.reset();
    expect(result.current.take(order(1000))).not.toBe(a);
  });

  it("barmoq izi tarkibga bog'liq, obyekt nusxasiga emas", () => {
    expect(createOrderFingerprint(order(1000))).toBe(createOrderFingerprint(order(1000)));
    expect(createOrderFingerprint(order(1000))).not.toBe(createOrderFingerprint(order(1001)));
  });
});
