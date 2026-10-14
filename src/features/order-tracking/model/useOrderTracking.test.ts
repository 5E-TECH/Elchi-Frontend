import { renderHook, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getByOrderId: vi.fn() }));
vi.mock("../../../entities/order", () => ({ orderActivityLogApi: api }));

import { useOrderTracking } from "./useOrderTracking";

/** Buyurtma tarixi xatolari (Ho5qcDn4): blokda xom axios matni chiqmasin. */
describe("useOrderTracking — xato matni", () => {
  beforeEach(() => {
    api.getByOrderId.mockReset();
  });

  it("tarmoq xatosi: errorMessage bo'sh (xom \"Network Error\" emas)", async () => {
    api.getByOrderId.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    const { result } = renderHook(() => useOrderTracking("39"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("");
  });

  it("boshqa market buyurtmasi: backend 403 matni saqlanadi", async () => {
    api.getByOrderId.mockRejectedValue(
      new AxiosError("Request failed with status code 403", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 403,
        data: { message: "Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q" },
      } as AxiosResponse),
    );
    const { result } = renderHook(() => useOrderTracking("32"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q");
  });
});
