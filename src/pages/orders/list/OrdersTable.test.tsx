import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrdersTable from "./OrdersTable";
import { renderWithProviders } from "../../../test/test-utils";

const orders = [
  {
    id: "o-1",
    customer: { name: "Ali", phone_number: "+998901234567" },
    district: { name: "Yunusobod", region: { name: "Toshkent" } },
    market: { name: "Fresh Market" },
    status: "sold",
    where_deliver: "center",
    total_price: 250000,
    createdAt: "2026-04-06T10:00:00.000Z",
  },
];

describe("OrdersTable", () => {
  it("renders order row data", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.getByText("Fresh Market")).toBeInTheDocument();
    expect(screen.getByText("Yunusobod")).toBeInTheDocument();
  });

  it("renders loading skeletons", () => {
    renderWithProviders(<OrdersTable data={[]} isLoading />);

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders empty state", () => {
    renderWithProviders(<OrdersTable data={[]} isLoading={false} />);

    expect(screen.getByText("Buyurtmalar topilmadi")).toBeInTheDocument();
  });

  it("hides market column for market role", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />, {
      preloadedState: {
        role: { role: "market", id: "", region: "" },
      },
    });

    expect(screen.queryByText("Market")).not.toBeInTheDocument();
  });

  it("renders translated delivery badge", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    expect(screen.getByText("Markaz")).toBeInTheDocument();
  });

  it("calls row click handler", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    renderWithProviders(
      <OrdersTable data={orders as never} isLoading={false} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText("Ali"));

    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "o-1" }),
      0,
    );
  });
});
