import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

import { readPartnerList, readWebhooksPage, usePartnerWebhooks } from "./index";

const webhookRow = {
  id: "w1",
  partner_id: "1",
  order_id: "o1",
  external_order_id: "BP-1",
  event_type: "order.status_changed",
  new_status: "sold",
  status: "awaiting_config",
  attempts: 0,
  max_attempts: 8,
  last_error: "hamkorda webhook_url sozlanmagan",
  next_retry_at: null,
  delivered_at: null,
  created_at: "2026-09-15T10:00:00.000Z",
  payload: {},
};

// Gateway'ning haqiqiy javobi: sahifa obyekti `successRes` qobig'i ichida.
const twoLayerPage = {
  statusCode: 200,
  message: "partner webhooks",
  data: { data: [webhookRow], total: 1, page: 1, limit: 20, totalPages: 1 },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("partners response readers", () => {
  beforeEach(() => mocks.get.mockReset());

  it("usePartnerWebhooks returns the page object — rows AND totalPages — from the two-layer envelope", async () => {
    mocks.get.mockResolvedValue({ data: twoLayerPage });

    const { result } = renderHook(() => usePartnerWebhooks({ status: "all", page: 1, limit: 20 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].id).toBe("w1");
    expect(result.current.data?.totalPages).toBe(1);
  });

  it("does not collapse the page object into the rows array (the old unwrap bug)", () => {
    const page = readWebhooksPage({ ...twoLayerPage, data: { ...twoLayerPage.data, total: 33, totalPages: 2 } });

    expect(Array.isArray(page)).toBe(false);
    expect(page).toMatchObject({ total: 33, page: 1, limit: 20, totalPages: 2 });
    expect(page.data).toHaveLength(1);
  });

  it("still reads single-layer array responses", () => {
    expect(readPartnerList({ statusCode: 200, message: "partners", data: [{ id: "1", name: "BeePost" }] })).toEqual([
      { id: "1", name: "BeePost" },
    ]);
    expect(readWebhooksPage({ statusCode: 200, message: "ok", data: [webhookRow] })).toMatchObject({
      data: [webhookRow],
      totalPages: 1,
    });
  });

  it("fails loudly on an unknown shape instead of pretending the journal is empty", async () => {
    expect(() => readWebhooksPage({ statusCode: 200, message: "ok", data: { rows: [webhookRow] } })).toThrow();
    expect(() => readPartnerList({ statusCode: 200, message: "ok", data: { items: [] } })).toThrow();

    mocks.get.mockResolvedValue({ data: { statusCode: 200, message: "ok", data: null } });
    const { result } = renderHook(() => usePartnerWebhooks({ status: "all" }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
