import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductTable from "../list";
import { renderWithProviders } from "../../../test/test-utils";
import { rawProduct } from "../../../test/warehouseFixtures";
import { shortWarehouseName } from "./marketStockView";

/**
 * yXC91RRx — market «Ombordagi qoldiq» (`/products?view=warehouse`, maket `market-products-warehouse-stock`):
 * faqat market, faqat ko'rish; `GET /market/warehouse-stock` (market_id yuborilmaydi — token bo'yicha).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const STOCK = {
  market_id: "121",
  warehouses: [
    { id: "3", name: "Samarqand filiali ombori", status: "ACTIVE", branch: { id: "13", name: "Samarqand filiali" }, region: null },
    { id: "6", name: "Urgut filiali ombori", status: "PAUSED", branch: { id: "16", name: "Urgut filiali" }, region: null },
  ],
  data: [
    {
      product: rawProduct({ id: "142", name: "Simsiz quloqchin" }),
      cells: [
        { warehouse_id: "3", warehouse_status: "ACTIVE", on_hand: 0, reserved: 0, available: 0, threshold: 10, level: "out" },
        { warehouse_id: "6", warehouse_status: "PAUSED", on_hand: 6, reserved: 0, available: 6, threshold: 5, level: "ok" },
      ],
      total_available: 0,
      total_on_hand: 6,
      has_low: true,
    },
    {
      product: rawProduct({ id: "143", name: "Termos, 0,5 l" }),
      cells: [{ warehouse_id: "3", warehouse_status: "ACTIVE", on_hand: 22, reserved: 0, available: 22, threshold: 5, level: "ok" }],
      total_available: 22,
      total_on_hand: 22,
      has_low: false,
    },
  ],
  total: 2,
  page: 1,
  limit: 50,
  summary: { products_total: 12, products_in_warehouses: 2, total_available: 22, warehouses_total: 2, warehouses_active: 1, warehouses_paused: 1, active_warehouses_with_stock: 1, low_positions: 0, out_positions: 1 },
};

beforeEach(() => {
  mocks.get.mockReset().mockImplementation((url: string) => {
    if (url === "market/warehouse-stock") return Promise.resolve({ data: STOCK });
    if (url === "product/my-products") return Promise.resolve({ data: { data: [], total: 12, page: 1, limit: 10 } });
    return Promise.reject(new Error(`kutilmagan: ${url}`));
  });
});

const renderAs = (role: string, route = "/products?view=warehouse") =>
  renderWithProviders(<ProductTable />, {
    route,
    preloadedState: {
      role: { id: "121", role, region: null, name: role },
      user: { user: { id: "121", role, name: "Baraka Shop" }, isAuthenticated: true, accessToken: null, loading: false, isAppInitializing: false, error: null },
    } as never,
  });

describe("market «Ombordagi qoldiq» (yXC91RRx)", () => {
  it("tablar: «Mahsulotlar 12 · Ombordagi qoldiq 2»; KPI; «Faqat ko'rish»; ombor ustunlari va katakchalar", async () => {
    renderAs("market");
    expect(await screen.findByRole("link", { name: /Ombordagi qoldiq/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Faqat ko'rish")).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Mahsulotlar omborlar bo'yicha" });
    expect(within(table).getByRole("columnheader", { name: /Samarqand/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /Urgut.*To'xtatilgan/ })).toBeInTheDocument();
    expect(within(table).getByText("0 · tugagan")).toBeInTheDocument();
    // Omborda yo'q — «—» (ekran o'quvchiga matn bilan).
    expect(within(table).getAllByText("Bu omborda yo'q").length).toBeGreaterThan(0);
    // Ro'yxat bitta sahifada — «Jami, dona» qatori.
    expect(within(table).getByText("Jami, dona")).toBeInTheDocument();
    expect(screen.getByText("12 ta mahsulotdan 2 tasi omborlarda")).toBeInTheDocument();
    const call = mocks.get.mock.calls.find(([url, config]) => url === "market/warehouse-stock" && config?.params?.limit === 50);
    expect(call?.[1].params).not.toHaveProperty("market_id");
  });

  it("«Faqat kam qolganlar» — `low_only=true`", async () => {
    const user = userEvent.setup();
    renderAs("market");
    await user.click(await screen.findByRole("button", { name: /Faqat kam qolganlar/ }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("market/warehouse-stock", { params: { page: 1, limit: 50, low_only: true } }),
    );
  });

  it("mahsulotlar tabida ham tablar (market); market operatorida — yo'q", async () => {
    renderAs("market", "/products");
    expect(await screen.findByRole("link", { name: /Mahsulotlar/ })).toHaveAttribute("aria-current", "page");
    const operator = renderAs("market_operator", "/products?view=warehouse");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("product/my-products", expect.anything()));
    expect(within(operator.container).queryByRole("link", { name: /Ombordagi qoldiq/ })).not.toBeInTheDocument();
  });

  it("qisqa ombor nomi", () => {
    expect(shortWarehouseName({ name: "Samarqand filiali ombori", branch: null })).toBe("Samarqand");
    expect(shortWarehouseName({ name: "X", branch: { id: "1", name: "Urgut filiali" } })).toBe("Urgut");
    expect(shortWarehouseName({ name: "Markaziy", branch: null })).toBe("Markaziy");
  });
});
