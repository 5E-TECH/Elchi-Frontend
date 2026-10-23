import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logistKeys } from "../../../../entities/logist";
import { queryKeys } from "../../../../shared/config/queryKeys";
import { useChangeUserRole } from "./useChangeUserRole";

/** FY-2 (SZTZ4HEU): rol o'zgargach qaysi keshlar eskiradi. Tarmoqqa chiqilmaydi. */

const mocks = vi.hoisted(() => ({ changeUserRole: vi.fn() }));

vi.mock("../../../../entities/user/api/roleApi", () => ({ changeUserRole: mocks.changeUserRole }));

const setup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useChangeUserRole(), { wrapper });
  const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  return { result, invalidatedKeys };
};

beforeEach(() => {
  mocks.changeUserRole.mockReset().mockResolvedValue({ statusCode: 200 });
});

describe("useChangeUserRole — kesh invalidatsiyasi (FY-2)", () => {
  it("admin → menejer: `[user]` va `queryKeys.users` eskiradi, logist keshlari tegilmaydi", async () => {
    const { result, invalidatedKeys } = setup();
    await act(() => result.current.mutateAsync({ id: "41", role: "manager", from: "admin" }));

    expect(mocks.changeUserRole).toHaveBeenCalledWith("41", "manager");
    expect(invalidatedKeys()).toEqual(expect.arrayContaining([["user"], queryKeys.users.all]));
    expect(invalidatedKeys()).not.toContainEqual(logistKeys.regions);
  });

  it("logist → admin: logist va viloyat keshlari ham eskiradi", async () => {
    const { result, invalidatedKeys } = setup();
    await act(() => result.current.mutateAsync({ id: "41", role: "admin", from: "logist" }));

    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([["user"], queryKeys.users.all, logistKeys.all, logistKeys.regions]),
    );
  });

  it("natija noma'lum xato (vaqt) — foydalanuvchi keshi yangilanadi; 400 — yo'q", async () => {
    mocks.changeUserRole.mockRejectedValueOnce({ isAxiosError: true, code: "ECONNABORTED" });
    const timeout = setup();
    await act(() => timeout.result.current.mutateAsync({ id: "41", role: "admin", from: "manager" }).catch(() => {}));
    expect(timeout.invalidatedKeys()).toEqual(expect.arrayContaining([["user"], queryKeys.users.all]));

    mocks.changeUserRole.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400 } });
    const failed = setup();
    await act(() => failed.result.current.mutateAsync({ id: "41", role: "admin", from: "manager" }).catch(() => {}));
    expect(failed.invalidatedKeys()).toEqual([]);
  });
});
