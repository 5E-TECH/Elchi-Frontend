import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { vi } from "vitest";
import { createTestStore } from "../../../test/test-utils";
import { useTodayMails } from "./mailsLists";

/**
 * anKpzwxk (Elchi-Backend #620): `GET post/new` faqat HQ xodimlariga (superadmin, admin, HQ registratori). HQ bo'lmagan
 * yoki filial turi noma'lum registratorda so'rov UMUMAN ketmasin (aks holda har `/mails` tabida 403 xabari chiqardi);
 * menejer (HQ ham — ega Q2 sukuti) — o'z filiali ro'yxati, `post/new` emas.
 */
const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: apiMock }));

const wrapperFor = (role: string, branchType?: string) => {
  const store = createTestStore({
    role: { id: "7", role, region: null, name: role },
    user: {
      user: { id: "7", ...(branchType ? { branch: { id: "3", type: branchType } } : {}) },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    } as never,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Provider>
  );
  return { wrapper, client };
};

const requestedUrls = () => apiMock.get.mock.calls.map(([url]) => url);

describe("useTodayMails — «Yangi pochtalar» faqat HQ xodimlariga", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.get.mockResolvedValue({ data: { statusCode: 200, data: { data: [], total: 0 } } });
  });

  it.each(["REGIONAL", "HYBRID", "PICKUP", undefined])("registrator/%s — hech qanday so'rov yo'q, available: false", async (branchType) => {
    const { wrapper, client } = wrapperFor("registrator", branchType);
    const { result } = renderHook(() => useTodayMails(), { wrapper });

    // So'rov yoqilmagan: kesh yozuvi bor (kalit), lekin `fetchStatus` — «idle», tarmoqqa chiqilmagan.
    await waitFor(() => expect(client.getQueryCache().getAll().length).toBeGreaterThan(0));
    expect(result.current.available).toBe(false);
    expect(result.current.isLoaded).toBe(false);
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll().every((query) => query.state.fetchStatus === "idle")).toBe(true);
  });

  it.each([
    ["superadmin", undefined],
    ["admin", undefined],
    ["registrator", "HQ"],
  ])("%s %s — GET post/new", async (role, branchType) => {
    const { wrapper } = wrapperFor(role, branchType);
    const { result } = renderHook(() => useTodayMails(), { wrapper });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.available).toBe(true);
    expect(requestedUrls()).toEqual(["post/new"]);
  });

  it("HQ menejeri — o'z filiali ro'yxati (post?status=sent), post/new emas", async () => {
    const { wrapper } = wrapperFor("manager", "HQ");
    const { result } = renderHook(() => useTodayMails(), { wrapper });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.available).toBe(true);
    expect(requestedUrls()).not.toContain("post/new");
    expect(requestedUrls()).toContain("post");
  });

  it("kuryer — faqat o'z pochtalari (post/on-the-road), GET post va post/new so'ralmaydi (#620: o'tkazmalar yashirin)", async () => {
    const { wrapper } = wrapperFor("courier", "REGIONAL");
    const { result } = renderHook(() => useTodayMails(), { wrapper });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(requestedUrls()).toEqual(["post/on-the-road"]);
  });
});
