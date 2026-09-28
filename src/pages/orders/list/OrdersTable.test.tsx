import { screen, within } from "@testing-library/react";
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
        role: { role: "market", id: "", region: "", name: "" },
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

  it("allows selecting only unsent cancelled orders", async () => {
    const user = userEvent.setup();
    const onSelectChange = vi.fn();
    const cancelledOrders = [
      { ...orders[0], id: "cancelled-1", status: "cancelled" },
      { ...orders[0], id: "sent-1", status: "cancelled (sent)" },
    ];

    renderWithProviders(
      <OrdersTable
        data={cancelledOrders as never}
        isLoading={false}
        isSelectable={(order) => order.status === "cancelled"}
        selectedIds={new Set()}
        onSelectChange={onSelectChange}
        onSelectAll={vi.fn()}
      />,
    );

    const rowCheckboxes = screen.getAllByRole("checkbox").filter((checkbox) => checkbox !== screen.getAllByRole("checkbox")[0]);
    const enabledCheckbox = rowCheckboxes.find((checkbox) => !checkbox.hasAttribute("disabled"));
    const disabledCheckbox = rowCheckboxes.find((checkbox) => checkbox.hasAttribute("disabled"));

    expect(disabledCheckbox).toBeDisabled();
    await user.click(enabledCheckbox!);
    expect(onSelectChange).toHaveBeenCalledWith("cancelled-1", true);
  });

  it("shows the real order id next to the customer instead of just the row index", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    expect(screen.getByText("№o-1")).toBeInTheDocument();
  });

  it("copies the order id to the clipboard without triggering the row click", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderWithProviders(
      <OrdersTable data={orders as never} isLoading={false} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText("№o-1"));

    expect(writeText).toHaveBeenCalledWith("o-1");
    expect(onRowClick).not.toHaveBeenCalled();
    expect(await screen.findByText("Buyurtma raqami nusxalandi")).toBeInTheDocument();
  });

  it("does not claim the number was copied when the browser refuses the clipboard write", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
      configurable: true,
    });

    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    await user.click(screen.getByText("№o-1"));

    expect(await screen.findByText("Nusxa olib bo'lmadi — buyurtma raqami: o-1")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma raqami nusxalandi")).not.toBeInTheDocument();
  });

  it("makes the status column sortable and reports the click to the parent", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithProviders(
      <OrdersTable
        data={orders as never}
        isLoading={false}
        sortConfig={null}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("columnheader", { name: "Holat" }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "status", direction: "asc" });
  });

  it("keeps the server's row order when sorted (the whole list is sorted on the server)", () => {
    const serverSortedOrders = [
      { ...orders[0], id: "sold-1", status: "sold" },
      { ...orders[0], id: "new-1", status: "new" },
      { ...orders[0], id: "cancelled-1", status: "cancelled" },
    ];

    renderWithProviders(
      <OrdersTable
        data={serverSortedOrders as never}
        isLoading={false}
        sortConfig={{ key: "status", direction: "asc" }}
        onSortChange={vi.fn()}
      />,
    );

    const idBadges = screen.getAllByText(/^№/).map((node) => node.textContent);
    expect(idBadges).toEqual(["№sold-1", "№new-1", "№cancelled-1"]);
  });

  it("does not offer sorting by customer name (the server cannot sort by it)", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithProviders(
      <OrdersTable
        data={orders as never}
        isLoading={false}
        sortConfig={null}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("columnheader", { name: "Mijoz" }));

    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("marks the pinned exact-number match instead of a row number and keeps the others numbered from 1", () => {
    const rows = [
      { ...orders[0], id: "1", customer: { name: "Aniq Mijoz", phone_number: "+998901111111" } },
      { ...orders[0], id: "o-2" },
      { ...orders[0], id: "o-3" },
    ];

    renderWithProviders(<OrdersTable data={rows as never} isLoading={false} pinnedOrderId="1" />);

    const bodyRows = screen.getAllByRole("row").slice(1);
    const badge = within(bodyRows[0]).getByTestId("exact-match-badge");
    expect(badge).toHaveTextContent("Aniq");
    expect(badge).toHaveAttribute("title", "Qidiruvdagi raqamga aynan mos buyurtma");
    expect(within(bodyRows[1]).getAllByRole("cell")[0]).toHaveTextContent(/^#?1$/);
    expect(within(bodyRows[2]).getAllByRole("cell")[0]).toHaveTextContent(/^#?2$/);
    expect(screen.getAllByTestId("exact-match-badge")).toHaveLength(1);
  });

  it("numbers rows as usual without a pinned match", () => {
    const rows = [
      { ...orders[0], id: "o-2" },
      { ...orders[0], id: "o-3" },
    ];

    renderWithProviders(<OrdersTable data={rows as never} isLoading={false} rowNumberOffset={20} />);

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getAllByRole("cell")[0]).toHaveTextContent(/^#?21$/);
    expect(within(bodyRows[1]).getAllByRole("cell")[0]).toHaveTextContent(/^#?22$/);
    expect(screen.queryByTestId("exact-match-badge")).not.toBeInTheDocument();
  });

  it("shows the exact-match badge on the phone card too", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });
    try {
      renderWithProviders(
        <OrdersTable data={[{ ...orders[0], id: "1" }, { ...orders[0], id: "o-2" }] as never} isLoading={false} pinnedOrderId="1" />,
      );

      const badges = screen.getAllByTestId("exact-match-badge");
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent("Aniq");
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    }
  });

  it("names each clickable row by order number and customer for keyboard and screen-reader users", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} onRowClick={onRowClick} />);

    const row = screen.getByRole("button", { name: "Buyurtma №o-1, Ali" });
    expect(row.tagName).toBe("TR");
    row.focus();
    await user.keyboard("{Enter}");

    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: "o-1" }), 0);
  });
});
