import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import NewOrderUpdate from "./new_orderUpdate";
import { renderWithProviders } from "../../../test/test-utils";

const order = {
  id: "1251175",
  status: "waiting",
  where_deliver: "address",
  total_price: 100000,
  to_be_paid: 100000,
  paid_amount: 0,
  comment: null,
  customer: { id: "c1", name: "Ali Valiyev", phone_number: "+998901234567" },
  items: [],
};

const orderState: { comment: string | null } = { comment: null };

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderById: () => ({ data: { data: { ...order, comment: orderState.comment } }, isLoading: false }),
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

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
    </Routes>,
    { route: "/orders/edit/1251175" },
  );

describe("NewOrderUpdate comment", () => {
  afterEach(() => {
    orderState.comment = null;
  });

  it("shows the order comment on the detail page itself, keeping its line breaks", () => {
    orderState.comment = "!!! Bu buyurtmadan qo'shimcha 10000 miqdorda pul ushlab qolingan\nKuryer: Ali";
    renderPage();

    const text = screen.getByText(/Bu buyurtmadan qo'shimcha 10000 miqdorda pul ushlab qolingan/);
    expect(text.textContent).toBe("!!! Bu buyurtmadan qo'shimcha 10000 miqdorda pul ushlab qolingan\nKuryer: Ali");
    expect(text).toHaveClass("whitespace-pre-line");
  });

  it.each([null, "", "   ", "\n\n"])("renders no comment card for an empty comment (%j)", (comment) => {
    orderState.comment = comment;
    const { container } = renderPage();

    expect(container.querySelector(".whitespace-pre-line")).toBeNull();
  });
});

describe("NewOrderUpdate header", () => {
  it("shows the order number on the detail page, matching the list's №id", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Raqamni nusxalash" })).toHaveTextContent("№1251175");
  });

  it("copies the order number and confirms it with a notification", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Raqamni nusxalash" }));

    expect(await navigator.clipboard.readText()).toBe("1251175");
    expect(await screen.findByText("Buyurtma raqami nusxalandi")).toBeInTheDocument();
  });
});
