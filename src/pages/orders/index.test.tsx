import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi, type MockInstance } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { api } from "../../shared/api/api";
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

const ordersResponse: { total: number; search_truncated: boolean; rows: { id: string }[] } = {
  total: 25,
  search_truncated: false,
  rows: orderRows,
};
const getOrdersMock = vi.fn((params: { page: number; limit: number }) => ({
  data: {
    data: ordersResponse.rows,
    total: ordersResponse.total,
    page: params.page,
    limit: params.limit,
    search_truncated: ordersResponse.search_truncated,
  },
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
    data,
    pinnedOrderId,
    sortConfig,
    onSortChange,
  }: {
    data: { id: string }[];
    pinnedOrderId?: string;
    sortConfig: SortConfig | null;
    onSortChange: (config: SortConfig | null) => void;
  }) => (
    <div
      data-testid="orders-table"
      data-sort={sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : ""}
      data-ids={data.map((order) => order.id).join(",")}
      data-pinned={pinnedOrderId ?? ""}
    >
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
    ordersResponse.search_truncated = false;
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

  it("sends the sort to the server so it covers the whole list, not just this page", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=desc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: "total_price", sort_dir: "desc" }),
    );
  });

  it("maps the date column to the API field and keeps no sort params without a sort", () => {
    const { unmount } = open("/orders?orderSortBy=createdAt&orderSortDir=asc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: "created_at", sort_dir: "asc" }),
    );
    unmount();

    getOrdersMock.mockClear();
    open("/orders");
    const params = getOrdersMock.mock.lastCall?.[0] as Record<string, unknown>;
    expect(params).not.toHaveProperty("sort_by");
    expect(params).not.toHaveProperty("sort_dir");
  });

  it("ignores a URL sort the server cannot do (old customer-name link)", () => {
    open("/orders?orderSortBy=customer&orderSortDir=asc");

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "");
    expect(getOrdersMock.mock.lastCall?.[0]).not.toHaveProperty("sort_by");
  });

  it("no longer shows the current-page-only sort note", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=asc");

    expect(screen.queryByText(/faqat shu sahifadagi/)).not.toBeInTheDocument();
  });
});

describe("Orders list search", () => {
  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
  });

  it("warns that the results are incomplete when the server cut the customer list", () => {
    ordersResponse.search_truncated = true;
    open("/orders?orderSearch=ali");

    expect(screen.getByRole("note")).toHaveTextContent("Natija to'liq emas, qidiruvni aniqlashtiring");
  });

  it("shows no warning when the search result is complete", () => {
    open("/orders?orderSearch=ali");

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("Orders list search by exact order number", () => {
  const exactOrder = { id: "1", status: "new", total_price: 55000, created_at: "2026-09-01T10:00:00.000Z" };
  const pageIds = orderRows.map((order) => order.id).join(",");
  let getSpy: MockInstance<typeof api.get>;

  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
    ordersResponse.rows = orderRows;
    // GET /orders/{id} — javob `{ statusCode, message, data: order }` qobig'ida keladi.
    getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { statusCode: 200, message: "ok", data: exactOrder } });
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  const settleLookup = async () => {
    await waitFor(() => expect(getSpy).toHaveBeenCalled());
    await act(async () => {
      await Promise.allSettled(getSpy.mock.results.map((result) => result.value));
    });
  };

  it("puts the order whose number equals the search first, even when the server ranked it pages away", async () => {
    open("/orders?orderSearch=1");

    await waitFor(() => expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "1"));
    expect(getSpy).toHaveBeenCalledWith("orders/1");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", `1,${pageIds}`);
  });

  it("does not show the exact order twice when the server already returned it on this page", async () => {
    ordersResponse.rows = [orderRows[0], { ...exactOrder }, orderRows[1]];
    open("/orders?orderSearch=1");

    await waitFor(() => expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "1"));
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", "1,o-0,o-1");
  });

  it("pins only on the first page", async () => {
    open("/orders?orderSearch=1&page=2");
    await settleLookup();

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", pageIds);
  });

  it("does not look up an order for a search that is not a plain number", async () => {
    open("/orders?orderSearch=ali");
    open("/orders?orderSearch=%2B998901234567");

    await act(async () => {});
    expect(getSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^orders\//));
  });

  it("adds nothing when there is no such order or the user may not see it", async () => {
    getSpy.mockRejectedValue(Object.assign(new Error("Not found"), { response: { status: 404 } }));
    open("/orders?orderSearch=999999");
    await settleLookup();

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", pageIds);
  });

  it("ignores a lookup answer for a different order", async () => {
    getSpy.mockResolvedValue({ data: { data: { ...exactOrder, id: "10" } } });
    open("/orders?orderSearch=1");
    await settleLookup();

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "");
  });
});
