import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import authService from "../../../auth/authService";
import { mergeSettings, SETTINGS_KEY } from "../../../entities/settings";
import { useLogin } from "./login";

/**
 * Kirishdan keyin my-profile keshi to'ldiriladi (h0AM0kDL): `SettingsSync` (`useSettings`) va «Profil»
 * (`useGetMyProfile`) `auth/my-profile` ni darhol qayta so'ramaydi.
 */
const setup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useLogin(), { wrapper });
  return { queryClient, result };
};

const credentials = { phone_number: "+998901234567", password: "secret" };

afterEach(() => vi.restoreAllMocks());

describe("useLogin — profil keshi", () => {
  it("kirishda kelgan profil sozlamalar va o'z profili keshiga yoziladi", async () => {
    const user = { id: "7", role: "manager", name: "Menejer", settings: { appearance: { language: "ru" }, interface: { sidebarOpen: false } } };
    vi.spyOn(authService, "login").mockResolvedValue({ accessToken: "t", user } as unknown as Awaited<ReturnType<typeof authService.login>>);
    const { queryClient, result } = setup();

    await act(() => result.current.signinUser.mutateAsync(credentials));

    expect(queryClient.getQueryData(SETTINGS_KEY)).toEqual(mergeSettings(user.settings));
    expect(queryClient.getQueryData(SETTINGS_KEY)).toMatchObject({ appearance: { language: "ru" }, interface: { sidebarOpen: false } });
    expect(queryClient.getQueryData(["user", "profile"])).toMatchObject({ data: { id: "7", name: "Menejer" } });
  });

  it("profil kelmagan (fonda yuklanadi) — kesh tegilmaydi", async () => {
    vi.spyOn(authService, "login").mockResolvedValue({ accessToken: "t", user: null });
    const { queryClient, result } = setup();

    await act(() => result.current.signinUser.mutateAsync(credentials));

    expect(queryClient.getQueryData(SETTINGS_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(["user", "profile"])).toBeUndefined();
  });
});
