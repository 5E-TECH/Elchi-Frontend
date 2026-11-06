import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import {
  replaceableOrdersQueryKey,
  toReplaceableOrdersPage,
  toReplaceableSearch,
  useReplaceableOrders,
} from "./replaceableOrders";

/**
 * lQjt6sKP — `GET orders/replaceable` (yaratish formasidagi «Almashtirish» tanlovi): javob normalizatsiyasi,
 * qidiruv matni va hook (kalit `["orders", "replaceable", params]` — `["orders"]` yangilanishi buni ham yangilaydi).
 */

const ROW = {
  id: 120,
  status: "sold",
  market_id: "3",
  customer_id: "801",
  customer: { id: "801", name: "Ali Valiyev", phone_number: "+998901234567" },
  total_price: "185000",
  where_deliver: "center",
  comment: "Qora rangli",
  sold_at: "1729000000000",
  createdAt: "2026-10-14T09:00:00.000Z",
  items: [
    { product_id: "501", product_name: "Telefon ushlagich", quantity: 2 },
    { product_id: null, product_name: null, quantity: "1" },
  ],
};

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  mocks.get.mockReset();
});

describe("toReplaceableOrdersPage", () => {
  it("gateway qobig'i ochiladi, qator maydonlari oq ro'yxatda (son → satr, summa/miqdor → son)", () => {
    const page = toReplaceableOrdersPage({
      statusCode: 200,
      data: { items: [ROW, null, { id: "" }, "x"], total: 41, page: 1, limit: 30 },
    });
    expect(page.total).toBe(41);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(30);
    expect(page.items).toEqual([
      {
        id: "120",
        status: "sold",
        market_id: "3",
        customer_id: "801",
        customer: { id: "801", name: "Ali Valiyev", phone_number: "+998901234567" },
        total_price: 185000,
        where_deliver: "center",
        comment: "Qora rangli",
        sold_at: "1729000000000",
        createdAt: "2026-10-14T09:00:00.000Z",
        items: [
          { product_id: "501", product_name: "Telefon ushlagich", quantity: 2 },
          { product_id: null, product_name: null, quantity: 1 },
        ],
      },
    ]);
  });

  it("buzuq javob yiqitmaydi: bo'sh sahifa; mijozsiz qator — `customer: null`; total qatorlardan kam bo'lmaydi", () => {
    expect(toReplaceableOrdersPage(null)).toEqual({ items: [], total: 0, page: 1, limit: 0 });
    expect(toReplaceableOrdersPage({ data: "x" }).items).toEqual([]);
    const page = toReplaceableOrdersPage({ data: [{ ...ROW, customer: null, comment: "", items: "x" }] });
    expect(page.items[0]).toMatchObject({ customer: null, comment: null, items: [] });
    expect(page.total).toBe(1);
  });
});

describe("toReplaceableSearch", () => {
  it("ko'rinadigan raqam «EL-…» — ichki id (backend «EL-» ni tushunmaydi)", () => {
    expect(toReplaceableSearch("EL-100120")).toBe("120");
    expect(toReplaceableSearch(" №EL-100120 ")).toBe("120");
    expect(toReplaceableSearch("#el 100120")).toBe("120");
  });

  it("«#120» / «№120» — «120»; telefon va matn o'zgarmaydi (qirqiladi)", () => {
    expect(toReplaceableSearch("#120")).toBe("120");
    expect(toReplaceableSearch("№ 120")).toBe("120");
    expect(toReplaceableSearch(" +998 90 123 45 67 ")).toBe("+998 90 123 45 67");
    expect(toReplaceableSearch("samsung")).toBe("samsung");
  });
});

describe("useReplaceableOrders", () => {
  it("`orders/replaceable` ga parametrlar bilan; kalit `orders` ildizi ostida", async () => {
    mocks.get.mockResolvedValue({ data: { statusCode: 200, data: { items: [ROW], total: 1, page: 1, limit: 30 } } });
    const client = newClient();
    const params = { market_id: "3", customer_id: "801", limit: 30 };
    const { result } = renderHook(() => useReplaceableOrders(params, true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.get).toHaveBeenCalledWith("orders/replaceable", { params });
    expect(result.current.data?.items.map((row) => row.id)).toEqual(["120"]);
    expect(replaceableOrdersQueryKey(params)).toEqual(["orders", "replaceable", params]);
    expect(client.getQueryData(["orders", "replaceable", params])).toBeDefined();

    // Yaratish/sotishdan keyingi `["orders"]` yangilanishi tanlash ro'yxatini ham yangilaydi.
    await client.invalidateQueries({ queryKey: ["orders"] });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });

  it("`enabled: false` — so'rov ketmaydi", async () => {
    const client = newClient();
    const { result } = renderHook(() => useReplaceableOrders({ limit: 30 }, false), { wrapper: wrapper(client) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("xato — jim (`meta.silentError`), qayta urinmaydi; xato holati qaytadi", async () => {
    mocks.get.mockRejectedValue({ response: { status: 400, data: { message: "market_id majburiy" } } });
    const client = newClient();
    const { result } = renderHook(() => useReplaceableOrders({ limit: 30 }, true), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.get).toHaveBeenCalledTimes(1);
    const query = client.getQueryCache().find({ queryKey: ["orders", "replaceable", { limit: 30 }] });
    expect(query?.meta).toEqual({ silentError: true });
  });
});
