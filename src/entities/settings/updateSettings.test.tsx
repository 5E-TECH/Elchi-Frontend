import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../shared/api/api";
import { DEFAULT_SETTINGS, SETTINGS_KEY, useUpdateSettings } from "./index";

/**
 * `useUpdateSettings` backendga TO'LIQ sozlamani yuboradi. Kesh yo'q paytda (profil hali kelmagan yoki yiqilgan)
 * mavzu / til almashtirilsa — avval serverdagi sozlama olinadi; ilgari sukut qiymatlar bilan foydalanuvchining
 * vidjet, skaner va bildirishnoma sozlamalari ustidan yozilardi (profil menyusi — `useAppearance`).
 */
const SERVER_SETTINGS = {
  appearance: { theme: "light", language: "uz" },
  dashboard: { widgets: { region: false, financial: false } },
  scanner: { feedback: { sound: false } },
  notifications: { push: true, quiet_hours: { enabled: true, from: "23:00", to: "07:00" } },
};

const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateSettings(), { wrapper });
  return { client, result };
};

afterEach(() => vi.restoreAllMocks());

describe("useUpdateSettings — kesh yo'q paytda sozlamalar o'chib ketmaydi", () => {
  it("⭐ kesh yo'q: avval profil sozlamasi olinadi, PATCH foydalanuvchi sozlamasini saqlab faqat mavzuni o'zgartiradi", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValue({ data: { data: { id: "1", settings: SERVER_SETTINGS } } });
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ appearance: { theme: "dark", themeChosen: true } });
    });

    expect(get).toHaveBeenCalledWith("auth/my-profile");
    const sent = (patch.mock.calls[0][1] as { settings: typeof DEFAULT_SETTINGS }).settings;
    expect(sent.appearance.theme).toBe("dark");
    expect(sent.dashboard.widgets).toMatchObject({ region: false, financial: false, stats: true });
    expect(sent.scanner.feedback.sound).toBe(false);
    expect(sent.notifications.push).toBe(true);
    expect(sent.notifications.quiet_hours).toEqual({ enabled: true, from: "23:00", to: "07:00" });
    expect(client.getQueryData(SETTINGS_KEY)).toEqual(sent);
  });

  it("⭐ kesh yo'q va profil olinmadi (tarmoq) — serverga hech narsa yozilmaydi, soxta sukut kesh yaratilmaydi", async () => {
    vi.spyOn(api, "get").mockRejectedValue(
      Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }),
    );
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const { client, result } = setup();

    act(() => {
      result.current.mutate({ appearance: { language: "ru" } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(patch).not.toHaveBeenCalled();
    expect(client.getQueryData(SETTINGS_KEY)).toBeUndefined();
  });

  it("kesh bor — avvalgidek: profil qayta so'ralmaydi, optimistik yangilanadi, yuboriladi", async () => {
    const get = vi.spyOn(api, "get");
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const { client, result } = setup();
    client.setQueryData(SETTINGS_KEY, DEFAULT_SETTINGS);

    await act(async () => {
      await result.current.mutateAsync({ interface: { sidebarOpen: false } });
    });

    expect(get).not.toHaveBeenCalled();
    const sent = (patch.mock.calls[0][1] as { settings: typeof DEFAULT_SETTINGS }).settings;
    expect(sent).toEqual({ ...DEFAULT_SETTINGS, interface: { sidebarOpen: false } });
    expect(client.getQueryData(SETTINGS_KEY)).toEqual(sent);
  });
});
