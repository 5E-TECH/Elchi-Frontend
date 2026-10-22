import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import NewOrderUpdate from "./new_orderUpdate";
import { renderWithProviders } from "../../../test/test-utils";
import { api } from "../../../shared/api/api";

/**
 * MO-3 — market operatori buyurtma tafsilotida (maket yo'q — eng yaqini `market-orders-detail`): market ko'rinishi,
 * faqat o'qish. «Kuzatuv» va «Qaytarish yo'li» yo'q — `GET orders/:id/tracking` @Roles da MARKET_OPERATOR yo'q (403),
 * so'rov umuman yuborilmaydi (global 403 xabari chiqmasin). Market egasida esa tarix avvalgidek so'raladi.
 */

let getSpy: MockInstance;
beforeEach(() => {
  getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
});
afterEach(() => getSpy.mockRestore());

const orderState: Record<string, unknown> = {};
const baseOrder = {
  id: "1251175",
  status: "new",
  market_id: "7",
  where_deliver: "address",
  total_price: 100000,
  to_be_paid: 100000,
  paid_amount: 0,
  market_tariff: 25000,
  comment: null,
  address: "Mustaqillik 1",
  customer: { id: "c1", name: "Ali Valiyev", phone_number: "+998901234567" },
  items: [{ id: "i1", quantity: 2, product_id: "8", product: { id: "8", name: "Krossovka" } }],
};
const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderById: () => ({ data: { data: { ...baseOrder, ...orderState } }, isLoading: false }),
    updateNewOrder: idleMutation,
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
  }),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ updateUser: idleMutation }),
}));

vi.mock("../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({
    useGetRegions: () => ({ data: undefined }),
    useGetDistricts: () => ({ data: undefined }),
  }),
}));

const renderAs = (role: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
    </Routes>,
    {
      route: "/orders/edit/1251175",
      preloadedState: {
        role: { id: `${role}-1`, role, region: null, name: role },
        user: {
          user: { id: `${role}-1`, role, market_id: "7" },
          isAuthenticated: true,
          accessToken: null,
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      } as never,
    },
  );

const trackingCalls = () => getSpy.mock.calls.filter(([url]) => String(url).includes("/tracking"));

describe("NewOrderUpdate — market operatori (MO-3)", () => {
  beforeEach(() => {
    for (const key of Object.keys(orderState)) delete orderState[key];
  });

  it("market ko'rinishi, faqat o'qish: tahrirlash, sotish/bekor va qaytarish tugmalari yo'q", async () => {
    renderAs("market_operator");

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tahrirlash/i })).not.toBeInTheDocument();
    for (const name of [/^Sotish/, /^Bekor qilish/, /Qaytarish/, /Ortga qaytarish/, /Marketga topshirish/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("«Buyurtma tarixi» yo'q va `orders/:id/tracking` so'ralmaydi (bekor qilingan buyurtmada ham)", async () => {
    Object.assign(orderState, { status: "cancelled" });
    renderAs("market_operator");

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByRole("heading", { name: "Buyurtma tarixi" })).not.toBeInTheDocument();
    expect(trackingCalls()).toEqual([]);
  });

  it("market egasida tarix avvalgidek so'raladi (cheklov faqat operatorda)", async () => {
    renderAs("market");

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    await waitFor(() => expect(trackingCalls().length).toBeGreaterThan(0));
  });
});
