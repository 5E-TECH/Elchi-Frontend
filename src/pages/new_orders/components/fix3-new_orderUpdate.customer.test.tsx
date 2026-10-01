import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NewOrderUpdate from "./new_orderUpdate";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * fix3 FE-ORD-12 — mijozni tahrirlash (PATCH /users/:id) faqat
 * superadmin/admin uchun ishlaydi; boshqalarga tugma o'chiq va sababi ko'rinadi.
 */

const order = {
  id: "1251175",
  status: "new",
  where_deliver: "address",
  total_price: 100000,
  to_be_paid: 100000,
  paid_amount: 0,
  comment: null,
  customer: { id: "c1", name: "Ali Valiyev", phone_number: "+998901234567" },
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

vi.mock("../../orders/list/courier/list/SellModal", () => ({ default: () => null }));
vi.mock("../../orders/list/courier/list/CancelModal", () => ({ default: () => null }));

const renderAs = (role: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
    </Routes>,
    {
      route: "/orders/edit/1251175",
      preloadedState: { role: { id: `${role}-1`, role, region: null, name: role } } as never,
    },
  );

const customerEditButton = () => {
  const head = screen.getByText("Mijoz ma'lumotlari").closest(".justify-between");
  const button = head?.querySelector("button");
  if (!button) throw new Error("customer edit button not found");
  return button;
};

describe("NewOrderUpdate — mijozni tahrirlash huquqi (fix3 FE-ORD-12)", () => {
  it.each(["registrator", "market", "courier", "manager"])(
    "%s — tugma o'chiq, sababi title'da (backend 403 berardi)",
    (role) => {
      renderAs(role);

      const button = customerEditButton();
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute(
        "title",
        "Mijoz ma'lumotlarini faqat admin yoki superadmin o'zgartira oladi.",
      );
    },
  );

  it.each(["superadmin", "admin"])("%s — tahrirlash oynasi ochiladi", async (role) => {
    const user = userEvent.setup();
    renderAs(role);

    const button = customerEditButton();
    expect(button).toBeEnabled();
    await user.click(button);

    expect(await screen.findByText("Mijoz ma'lumotini tahrirlash")).toBeInTheDocument();
  });
});
