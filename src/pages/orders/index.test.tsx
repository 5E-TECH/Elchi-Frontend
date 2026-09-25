import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import type { SortConfig } from "../../shared/components/Table/Table.types";

/** `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL `useLocation`dan o'qiladi. */
const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const orderRows = Array.from({ length: 10 }, (_, i) => ({
  id: `o-${i}`,
  status: "waiting",
  total_price: 1000 * (i + 1),
  created_at: "2026-09-20T10:00:00.000Z",
}));

const ordersResponse = { total: 25 };
const getOrdersMock = vi.fn((params: { page: number; limit: number }) => ({
  data: { data: orderRows, total: ordersResponse.total, page: params.page, limit: params.limit },
  isLoading: false,
}));

vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: (params: { page: number; limit: number }) => getOrdersMock(params),
  }),
}));

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
    SendToPost: idleMutation,
  }),
}));

vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: undefined, isLoading: false }),
  }),
}));

vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));

vi.mock("./list/OrdersTable", () => ({
  default: ({
    sortConfig,
    onSortChange,
  }: {
    sortConfig: SortConfig | null;
    onSortChange: (config: SortConfig | null) => void;
  }) => (
    <div data-testid="orders-table" data-sort={sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : ""}>
      <button type="button" onClick={() => onSortChange({ key: "total_price", direction: "desc" })}>
        sort-by-price
      </button>
    </div>
  ),
}));

vi.mock("./list/courier/index", () => ({ default: () => null }));
vi.mock("./list/courier/list/SellModal", () => ({ default: () => null }));
vi.mock("./list/courier/list/CancelModal", () => ({ default: () => null }));

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const open = (route: string) =>
  renderWithProviders(
    <>
      <Orders />
      <LocationProbe />
    </>,
    { route, preloadedState: adminState },
  );

const currentSearch = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

describe("Orders list sorting", () => {
  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
  });

  it("restores the sort from the URL after a refresh and keeps the saved page", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=desc&page=2");

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "total_price:desc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("writes a new sort to the URL together with page 1", async () => {
    const user = userEvent.setup();
    open("/orders?page=3");

    await user.click(screen.getByRole("button", { name: "sort-by-price" }));

    await waitFor(() => expect(currentSearch().get("orderSortBy")).toBe("total_price"));
    expect(currentSearch().get("orderSortDir")).toBe("desc");
    expect(currentSearch().get("page")).toBe("1");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "total_price:desc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("keeps an active filter while sorting (both apply at once)", () => {
    open("/orders?orderMarketId=5&orderSortBy=status&orderSortDir=asc");

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "status:asc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ market_id: "5" }));
  });

  it("says the sort only covers the current page when the list has more pages", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=asc");

    expect(screen.getByRole("note")).toHaveTextContent("Saralash faqat shu sahifadagi buyurtmalarga qo'llanadi");
  });

  it("does not show the current-page note without a sort or when everything fits on one page", () => {
    const { unmount } = open("/orders");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    unmount();

    ordersResponse.total = 10;
    open("/orders?orderSortBy=total_price&orderSortDir=asc");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
