import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NewOrderUpdate from "./new_orderUpdate";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * `/new-orders/:marketId/edit/:orderId` — o'z maketlari (`superadmin-neworders-market-order-edit`,
 * `registrator-new-orders-market-order-edit`, `market-new-orders-edit`): orqaga havolasi, «Tahrirlash ochiq.»,
 * marketga «o'chirib, qaytadan yarating», «Buyurtma ma'lumotlari» kartasi yo'q. `/orders/edit/:id` o'zgarmaydi.
 */

const order = {
  id: "10255",
  status: "new",
  where_deliver: "address",
  total_price: 232500,
  to_be_paid: 132500,
  paid_amount: 100000,
  comment: null,
  createdAt: "2026-10-16T07:10:00.000Z",
  customer: { id: "c1", name: "Madina Yo'ldosheva", phone_number: "+998973308119" },
  market: { id: "121", name: "Ipak Yo'li Savdo" },
  items: [],
};

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderById: () => ({ data: { data: order }, isLoading: false }),
    updateNewOrder: idleMutation,
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
    scanMarketCancelledQr: idleMutation,
    verifyMarketCancelledPin: idleMutation,
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

vi.mock("../../../widgets/order-tracking", () => ({
  OrderTracking: () => null,
}));

const stateFor = (role: string) =>
  ({
    role: { id: role === "market" ? "121" : `${role}-1`, role, region: null, name: role },
    user: {
      user: { id: `${role}-1`, role, ...(role === "registrator" ? { branch: { id: "1", type: "HQ" } } : {}) },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderAt = (route: string, role: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
      <Route path="/new-orders/:marketId/edit/:orderId" element={<NewOrderUpdate />} />
      <Route path="/new-orders/:marketId" element={<p>MARKET ORDERS</p>} />
    </Routes>,
    { route, preloadedState: stateFor(role) },
  );

describe("NewOrderUpdate — /new-orders/:marketId/edit/:orderId", () => {
  it("superadmin: orqaga — market nomi; «Tahrirlash ochiq.» (to'liq); «Buyurtma ma'lumotlari» yo'q", async () => {
    renderAt("/new-orders/121/edit/10255", "superadmin");

    expect(await screen.findByRole("heading", { level: 1, name: "№10255" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ipak Yo'li Savdo/ })).toBeInTheDocument();
    const alert = screen.getByText("Tahrirlash ochiq.").closest("[role=status]") as HTMLElement;
    expect(alert).toHaveTextContent("barcha ma'lumotlarni o'zgartirish mumkin");
    expect(screen.queryByText("Buyurtma ma'lumotlari")).not.toBeInTheDocument();
  });

  it("orqaga bosilsa (havoladan ochilgan) — market buyurtmalari ro'yxatiga", async () => {
    const user = userEvent.setup();
    renderAt("/new-orders/121/edit/10255", "superadmin");

    await user.click(await screen.findByRole("button", { name: /Ipak Yo'li Savdo/ }));
    expect(await screen.findByText("MARKET ORDERS")).toBeInTheDocument();
  });

  it("registrator: «Tahrirlash ochiq.» — mahsulot, summa va manzil", async () => {
    renderAt("/new-orders/121/edit/10255", "registrator");

    const alert = (await screen.findByText("Tahrirlash ochiq.")).closest("[role=status]") as HTMLElement;
    expect(alert).toHaveTextContent("mahsulot, summa va manzilni o'zgartirish mumkin");
  });

  it("market: orqaga — «Qabul va yaratish»; «Faqat ko'rish uchun» + «Yangi buyurtmalar» havolasi", async () => {
    renderAt("/new-orders/121/edit/10255", "market");

    expect(await screen.findByRole("button", { name: /Qabul va yaratish/ })).toBeInTheDocument();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Faqat ko'rish uchun");
    expect(note).toHaveTextContent("ro'yxatidan o'chirib, qaytadan yarating");
    expect(screen.getByRole("link", { name: "Yangi buyurtmalar" })).toHaveAttribute("href", "/new-orders/121");
    expect(screen.queryByText("Tahrirlash ochiq.")).not.toBeInTheDocument();
  });

  it("/orders/edit/:id o'zgarmaydi: «Buyurtmalar», «Buyurtma ma'lumotlari», «Tahrirlash ochiq.» yo'q", async () => {
    renderAt("/orders/edit/10255", "superadmin");

    expect(await screen.findByRole("button", { name: /Buyurtmalar/ })).toBeInTheDocument();
    expect(screen.getByText("Buyurtma ma'lumotlari")).toBeInTheDocument();
    expect(screen.queryByText("Tahrirlash ochiq.")).not.toBeInTheDocument();
  });
});
