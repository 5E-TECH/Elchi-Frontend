import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createIdempotencyKey, isUncertainWriteError, useIdempotencyKeys } from "./idempotency";

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

describe("Idempotency-Key (kirim, inventarizatsiya)", () => {
  it("kalit backend shakliga mos (8–128 `[A-Za-z0-9._:-]`), har chaqiruvda yangi", () => {
    const first = createIdempotencyKey();
    expect(first).toMatch(KEY_PATTERN);
    expect(createIdempotencyKey()).not.toBe(first);
  });

  it("AYNI tarkib — AYNI kalit (qayta urinish); boshqa tarkib — yangi; eski tarkib o'z kalitini saqlaydi; reset — hammasi yangi", () => {
    const { result } = renderHook(() => useIdempotencyKeys());
    const a = result.current.take("A");
    expect(result.current.take("A")).toBe(a);
    const b = result.current.take("B");
    expect(b).not.toBe(a);
    expect(result.current.take("A")).toBe(a);
    result.current.reset();
    expect(result.current.take("A")).not.toBe(a);
  });

  it("natijasi noma'lum xato: javobsiz, 502/503/504; 400/409 — aniq xato", () => {
    expect(isUncertainWriteError(new Error("Network Error"))).toBe(true);
    expect(isUncertainWriteError({ response: { status: 504 } })).toBe(true);
    expect(isUncertainWriteError({ response: { status: 409 } })).toBe(false);
    expect(isUncertainWriteError(null)).toBe(false);
  });
});
