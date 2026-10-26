import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReceiveTransferBatch } from "../../entities/batch";
import { api } from "../../shared/api/api";
import { queryKeys } from "../../shared/config/queryKeys";

/**
 * sUjPxTzJ — /returns ro'yxati partiyalar ildizida (`queryKeys.batches.returns`): partiya qabul qilingach
 * (`useReceiveTransferBatch` → `[batches]`) u ham eskirgan deb belgilanadi va sahifaga qaytilganda qayta so'raladi.
 * Avval o'z `["return-batches", …]` kalitida edi — mutatsiya unga yetmas, ro'yxat eski qolardi.
 */
const PARAMS = { page: 1, limit: 20 };

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useReceiveTransferBatch(), { wrapper });
  return { client, result };
};

afterEach(() => vi.restoreAllMocks());

describe("/returns keshi — partiya qabulidan keyin (sUjPxTzJ)", () => {
  it("useReceiveTransferBatch.onSuccess — /returns so'rovi eskirgan (invalidated) bo'ladi", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { statusCode: 200 } } as AxiosResponse);
    const { client, result } = setup();
    const returnsKey = queryKeys.batches.returns("b-1", PARAMS);
    const legacyKey = ["return-batches", "b-1", PARAMS];
    client.setQueryData(returnsKey, { data: [], total: 0 });
    client.setQueryData(legacyKey, { data: [], total: 0 });

    await act(() => result.current.mutateAsync("batch-7"));

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(returnsKey)?.isInvalidated).toBe(true);
    // Eski kalit mutatsiyaga yetmasdi — xato aynan shu edi.
    expect(client.getQueryState(legacyKey)?.isInvalidated).toBe(false);
  });
});
