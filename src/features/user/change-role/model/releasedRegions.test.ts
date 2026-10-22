import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { loadReleasedRegionNames } from "./releasedRegions";

/** FY-2: logistdan chiqishda bo'shaydigan viloyatlar (tasdiq oynasi uchun). Tarmoqqa chiqilmaydi. */

const mocks = vi.hoisted(() => ({ getLogistRegions: vi.fn() }));

vi.mock("../../../../entities/logist", async () => {
  const actual = await vi.importActual<typeof import("../../../../entities/logist")>("../../../../entities/logist");
  return { ...actual, getLogistRegions: mocks.getLogistRegions };
});

/** Ilovadagidek: global `QueryCache.onError` `meta.silentError` bo'lmasa xabar chiqaradi. */
const clientWithGlobalToast = () => {
  const toast = vi.fn();
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (_error, query) => (query.meta?.silentError ? undefined : toast()) }),
    defaultOptions: { queries: { retry: false } },
  });
  return { queryClient, toast };
};

describe("loadReleasedRegionNames (FY-2)", () => {
  it("faqat shu logistning viloyatlari", async () => {
    mocks.getLogistRegions.mockResolvedValueOnce([
      { id: "1", name: "Samarqand", logistId: "41" },
      { id: "2", name: "Toshkent", logistId: "9" },
    ]);
    const { queryClient } = clientWithGlobalToast();
    await expect(loadReleasedRegionNames(queryClient, "41")).resolves.toEqual(["Samarqand"]);
  });

  it("`GET /region` yiqilsa — `null`, global xato xabari (backend matni bilan) chiqmaydi", async () => {
    mocks.getLogistRegions.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { message: "raw" } } });
    const { queryClient, toast } = clientWithGlobalToast();
    await expect(loadReleasedRegionNames(queryClient, "41")).resolves.toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
});
