import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestStore } from "../../../test/test-utils";
import { useUser } from "./userApi";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

/**
 * LG-2: `createLogist` → `POST /logists` (+ «Logist biriktirish» ro'yxati yangilanadi); `createCourier` — bitta
 * so'rov, `region_id` siz qayta yuborish (avvalgi `shouldRetryCourierWithoutRegion`) olib tashlandi.
 */
const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={createTestStore()}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
  return { invalidate, ...renderHook(() => useUser(), { wrapper }) };
};

beforeEach(() => {
  api.post.mockReset().mockResolvedValue({ data: { statusCode: 201, data: { id: "57" } } });
});

describe("useUser — yaratish mutatsiyalari", () => {
  it("createLogist: POST logists, foydalanuvchilar va logistlar keshi eskiradi", async () => {
    const { result, invalidate } = setup();
    const body = {
      name: "Aziz Rahimov",
      phone_number: "+998901234567",
      password: "logist2026",
      salary: 6000000,
    };
    let response: unknown;
    await act(async () => {
      response = await result.current.createLogist.mutateAsync(body);
    });
    expect(api.post).toHaveBeenCalledWith("logists", body);
    expect(response).toEqual({ data: { statusCode: 201, data: { id: "57" } } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["user"], refetchType: "active" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["logists"] });
  });

  it("createCourier: 400 da qayta yuborilmaydi (region_id qayta urinishi yo'q)", async () => {
    api.post.mockRejectedValue({
      response: { status: 400, data: { message: ["property region_id should not exist"] } },
    });
    const { result } = setup();
    await act(async () => {
      await expect(
        result.current.createCourier.mutateAsync({
          name: "Kuryer",
          phone_number: "+998901112233",
          password: "secret",
          branch_id: "44",
        }),
      ).rejects.toBeTruthy();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      "couriers",
      expect.not.objectContaining({ region_id: expect.anything() }),
    );
  });
});
