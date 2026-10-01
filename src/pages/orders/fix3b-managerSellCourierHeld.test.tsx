import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * fix3b LC-04 — menejer jadvalida kuryer qo'lidagi buyurtmada "Sotish"
 * (qisman sotish ham shu oynada) ko'rsatilmaydi: backend 400 "Bu buyurtma
 * kuryer qo'lida — uni kuryerning o'zi sotadi". Filialda turgan buyurtma
 * avvalgidek sotiladi; bekor qilish ikkalasida ham qoladi.
 */

const baseRow = {
  market_id: "201",
  customer_id: "c-1",
  product_quantity: 1,
  status: "waiting",
  where_deliver: "center",
  total_price: 150000,
  to_be_paid: 0,
  paid_amount: 0,
  district_id: "5",
  region_id: "12",
  address: null,
  operator: null,
  comment: null,
  post_id: "77",
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-01T08:00:00.000Z",
  deleted: false,
  items: [],
  market: { id: "201", name: "Yandex" },
  district: { id: "5", name: "Guliston" },
};

const rows = [
  {
    ...baseRow,
    id: "9001",
    customer: { id: "c-1", name: "Kuryerdagi mijoz", phone_number: "+998901112233" },
    holder_type: "COURIER",
    holder_courier_id: "289",
    courier_id: "289",
  },
  {
    ...baseRow,
    id: "9002",
    customer: { id: "c-2", name: "Filialdagi mijoz", phone_number: "+998901112244" },
    holder_type: "BRANCH",
    holder_branch_id: "15",
    holder_courier_id: null,
    courier_id: "0",
  },
];

vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: () => ({
      data: { data: rows, total: rows.length, page: 1, limit: 10 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
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
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));

vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));

vi.mock("./list/courier/index", () => ({ default: () => null }));
vi.mock("./list/courier/list/SellModal", () => ({ default: () => null }));
vi.mock("./list/courier/list/CancelModal", () => ({ default: () => null }));

const regionalManagerState = {
  role: { id: "300", role: "manager", region: null, name: "Menejer" },
  user: {
    user: { id: "300", role: "manager", branch: { id: "15", type: "REGIONAL" } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const rowOf = (customerName: string) => {
  const row = screen.getByText(customerName).closest("tr");
  if (!row) throw new Error(`row not found: ${customerName}`);
  return row;
};

describe("Orders — menejer kuryerdagi buyurtmani sotmaydi (fix3b LC-04)", () => {
  it("kuryer qo'lidagi qatorda 'Sotish' yo'q, bekor qilish bor", () => {
    renderWithProviders(<Orders />, { route: "/orders?orderStatus=waiting", preloadedState: regionalManagerState });

    const courierRow = rowOf("Kuryerdagi mijoz");
    expect(within(courierRow).queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(within(courierRow).getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
  });

  it("filialda turgan qatorda 'Sotish' avvalgidek ('0' sentinel kuryer emas)", () => {
    renderWithProviders(<Orders />, { route: "/orders?orderStatus=waiting", preloadedState: regionalManagerState });

    const branchRow = rowOf("Filialdagi mijoz");
    expect(within(branchRow).getByRole("button", { name: "Sotish" })).toBeInTheDocument();
    expect(within(branchRow).getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
  });
});
