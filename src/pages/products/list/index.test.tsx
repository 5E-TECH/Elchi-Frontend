import type { ReactNode } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import ProductTable from "./index";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL holati router'ning
 * o'zidan (`useLocation`) o'qiladi (integrations/tabUrl.test.tsx patterni).
 */
const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const navigateMock = vi.fn();
const deleteMutateMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const adminRoleState = {
  id: "admin-1",
  role: "admin",
  region: null,
  name: "Admin",
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../shared/components/headerName", () => ({
  default: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock("../../../shared/components/button", () => ({
  default: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
}));

vi.mock("../../../shared/components/Table/Table", () => ({
  Table: ({
    data,
    columns,
  }: {
    data: Array<Record<string, unknown>>;
    columns: Array<{
      key: string;
      render?: (value: unknown, row: Record<string, unknown>, index: number) => ReactNode;
    }>;
  }) => (
    <div>
      {data.map((row) => (
        <div key={String(row.id)}>
          {columns.map((column) => (
            <div key={String(column.key)}>
              {column.render
                ? column.render(row[column.key], row, 0)
                : String(row[column.key] ?? "")}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../../../shared/components/popupSelect", () => ({
  default: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
    isOpen ? <div>{title}</div> : null,
}));

vi.mock("../../../shared/components/popupConfirm", () => ({
  default: ({
    isOpen,
    title,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div>
        <div>{title}</div>
        <button onClick={onConfirm}>confirm-delete</button>
      </div>
    ) : null,
}));

vi.mock("../../../shared/components/popupUpdate", () => ({
  default: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
  }) => (isOpen ? <div><div>{title}</div>{children}</div> : null),
}));

const getProductsMock = vi.fn((params: unknown, enabled: unknown) => {
  void params;
  void enabled;
  return {
    data: {
      data: [{ id: 1, name: "Olma", market: { id: 1, name: "Fresh" } }],
      total: 1,
    },
    isLoading: false,
    isFetching: false,
  };
});

vi.mock("../../../entities/product", () => ({
  useProducts: () => ({
    useGetProducts: (params: unknown, enabled: unknown) => getProductsMock(params, enabled),
    useGetMyProducts: () => ({
      data: { data: [] },
      isLoading: false,
      isFetching: false,
    }),
    useGetProductById: () => ({
      data: {
        data: { id: 1, name: "Olma", image_url: "/uploads/olma.png", market: { id: 1, name: "Fresh" } },
      },
      isLoading: false,
      isFetching: false,
    }),
    deleteProduct: { mutate: deleteMutateMock, isPending: false },
    updateProduct: { mutateAsync: updateMutateAsyncMock, isPending: false },
  }),
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({
      data: {
        data: {
          items: [{ id: 1, name: "Fresh", phone_number: "+998901234567" }],
        },
      },
    }),
  }),
}));

vi.mock("../../../features/Select/selectInput", () => ({
  default: ({ placeholder }: { placeholder: string }) => <div>{placeholder}</div>,
}));

vi.mock("../../../features/search", () => ({
  GlobalSearchInput: ({ placeholder }: { placeholder: string }) => <input placeholder={placeholder} />,
}));

describe("ProductTable", () => {
  const renderProductTable = (route = "/products") =>
    renderWithProviders(<ProductTable />, {
      route,
      preloadedState: { role: adminRoleState },
    });

  beforeEach(() => {
    navigateMock.mockReset();
    deleteMutateMock.mockReset();
    updateMutateAsyncMock.mockReset();
    getProductsMock.mockClear();
  });

  it("renders product page header and count", () => {
    renderProductTable();

    expect(screen.getByText("Mahsulotlar")).toBeInTheDocument();
    expect(screen.getByText("1 ta")).toBeInTheDocument();
    expect(screen.getByText("Olma")).toBeInTheDocument();
  });

  it("opens market selection popup when create button is clicked", async () => {
    const user = userEvent.setup();
    renderProductTable();

    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));

    expect(screen.getAllByText("Marketni tanlang").length).toBeGreaterThan(0);
  });

  it("opens delete confirmation and confirms delete", async () => {
    const user = userEvent.setup();
    renderProductTable();

    await user.click(screen.getByLabelText("Mahsulotni o'chirish"));
    await user.click(screen.getByRole("button", { name: "confirm-delete" }));

    expect(deleteMutateMock).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it("opens edit popup from action button", async () => {
    const user = userEvent.setup();
    renderProductTable();

    await user.click(screen.getByLabelText("Mahsulotni tahrirlash"));

    expect(screen.getByText("Mahsulotni tahrirlash")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Olma")).toBeInTheDocument();
  });

  it("restores the search filter from the URL after a refresh, instead of showing an unfiltered list", async () => {
    renderProductTable("/products?product_search=test");

    await waitFor(() => {
      expect(getProductsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "test" }),
        expect.any(Boolean),
      );
    });
  });

  it("restores the market filter from the URL after a refresh", async () => {
    renderProductTable("/products?market_id=1");

    await waitFor(() => {
      expect(getProductsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ market_id: "1" }),
        expect.any(Boolean),
      );
    });
  });

  it("does not reset back to page 1 while restoring search/filter state from the URL", async () => {
    renderProductTable("/products?product_search=test&page=3");

    await waitFor(() => {
      expect(getProductsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "test", page: 3 }),
        expect.any(Boolean),
      );
    });
  });

  it("writes the selected market filter to the URL immediately, so a refresh keeps it", async () => {
    // jsdom does not implement scrollIntoView; SearchableSelect calls it when
    // its dropdown opens. Pre-existing gap, unrelated to this fix.
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ProductTable />
        <LocationProbe />
      </>,
      { route: "/products", preloadedState: { role: adminRoleState } },
    );

    await user.click(document.getElementById("market_id")!);
    await user.click(await screen.findByRole("button", { name: "Fresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("search").textContent).toContain("market_id=1");
    });
  });
});
