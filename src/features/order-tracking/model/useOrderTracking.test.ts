import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { createElement, StrictMode, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getByOrderId: vi.fn() }));
vi.mock("../../../entities/order", () => ({ orderActivityLogApi: api }));

import { useOrderTracking } from "./useOrderTracking";

/** Ilova sozlamasiga o'xshash: so'rovlar 1 marta qayta urinadi — hook buni o'zi o'chirishi kerak. */
const createWrapper = (strict = false) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } });
  return ({ children }: { children: ReactNode }) => {
    const tree = createElement(QueryClientProvider, { client }, children);
    return strict ? createElement(StrictMode, null, tree) : tree;
  };
};

const page = (data: unknown[], total?: number) => ({ data: { data, total, page: 1, limit: 20 } });

/** Buyurtma tarixi xatolari (Ho5qcDn4): blokda xom axios matni chiqmasin. */
describe("useOrderTracking — xato matni", () => {
  beforeEach(() => {
    api.getByOrderId.mockReset();
  });

  it("tarmoq xatosi: errorMessage bo'sh (xom \"Network Error\" emas)", async () => {
    api.getByOrderId.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    const { result } = renderHook(() => useOrderTracking("39"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("");
  });

  it("boshqa market buyurtmasi: backend 403 matni saqlanadi, qayta urinilmaydi", async () => {
    api.getByOrderId.mockRejectedValue(
      new AxiosError("Request failed with status code 403", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 403,
        data: { message: "Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q" },
      } as AxiosResponse),
    );
    const { result } = renderHook(() => useOrderTracking("32"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q");
    expect(result.current.errorStatus).toBe(403);
    expect(api.getByOrderId).toHaveBeenCalledTimes(1);
  });
});

describe("useOrderTracking — so'rovlar va tartib", () => {
  beforeEach(() => {
    api.getByOrderId.mockReset();
  });

  it("⭐ D-18: StrictMode'da ham bitta `GET orders/:id/tracking` (ikki marta mount — bitta so'rov)", async () => {
    api.getByOrderId.mockResolvedValue(page([]));
    const { result } = renderHook(() => useOrderTracking("95"), { wrapper: createWrapper(true) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getByOrderId).toHaveBeenCalledTimes(1);
    expect(api.getByOrderId).toHaveBeenCalledWith("95", { page: 1, limit: 20 });
  });

  it("yangidan eskiga; yashirin (custody) yozuvlar chiqmaydi; «Ko'proq yuklash» — keyingi sahifa", async () => {
    api.getByOrderId
      .mockResolvedValueOnce(
        page(
          [
            { id: "1", action: "created", created_at: "2026-10-05T10:00:00Z" },
            { id: "3", action: "sold", created_at: "2026-10-07T10:00:00Z" },
            { id: "x", action: "custody_change", created_at: "2026-10-06T12:00:00Z" },
          ],
          25,
        ),
      )
      .mockResolvedValueOnce(page([{ id: "0", action: "note", created_at: "2026-10-01T10:00:00Z" }], 25));
    const { result } = renderHook(() => useOrderTracking("95"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.events.map((event) => event.id)).toEqual(["3", "1"]));
    expect(result.current.total).toBe(25);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.events.map((event) => event.id)).toEqual(["3", "1", "0"]));
    expect(api.getByOrderId).toHaveBeenLastCalledWith("95", { page: 2, limit: 20 });
  });

  it("⭐ D-04: tizim hodisasi keyingi odam hodisasining aktyoriga yozilmaydi (aktyor o'zgarmaydi)", async () => {
    api.getByOrderId.mockResolvedValue(
      page([
        {
          id: "s1",
          action: "status_change",
          changed_by_role: "system",
          actor: { name: "system", role: "system" },
          old_value: { status: "new" },
          new_value: { status: "received" },
          created_at: "2026-10-06T10:00:00Z",
        },
        {
          id: "h1",
          action: "status_change",
          changed_by: "77",
          changed_by_role: "manager",
          actor: { name: "Ravshan Ortiqov", role: "manager" },
          old_value: { status: "received" },
          new_value: { status: "on the road" },
          created_at: "2026-10-09T10:00:00Z",
        },
      ]),
    );
    const { result } = renderHook(() => useOrderTracking("95"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    const system = result.current.events.find((event) => event.id === "s1");
    expect(system?.actor).toEqual({ name: "system", role: "system" });
    expect(system?.changed_by_role).toBe("system");
    expect(system?.changed_by).toBeUndefined();
  });

  it("o'chirilgan (`enabled=false`) — so'rov yo'q, yuklanish yo'q", () => {
    const { result } = renderHook(() => useOrderTracking("95", false), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.events).toEqual([]);
    expect(api.getByOrderId).not.toHaveBeenCalled();
  });
});
