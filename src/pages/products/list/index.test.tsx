import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ProductTable from "./index";
import { renderWithProviders } from "../../../test/test-utils";

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

vi.mock("../../../entities/product", () => ({
  useProducts: () => ({
    getProducts: () => ({
      data: {
        data: [{ id: 1, name: "Olma", market: { id: 1, name: "Fresh" } }],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
    }),
    getMyProducts: () => ({
      data: { data: [] },
      isLoading: false,
      isFetching: false,
    }),
    getProductById: () => ({
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
    getMarkets: () => ({
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
  const renderProductTable = () =>
    renderWithProviders(<ProductTable />, {
      preloadedState: { role: adminRoleState },
    });

  beforeEach(() => {
    navigateMock.mockReset();
    deleteMutateMock.mockReset();
    updateMutateAsyncMock.mockReset();
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
});
