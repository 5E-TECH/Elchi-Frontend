import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * BE #738 — `/orders` ro'yxatida «Qaytarish» faqat server maydonidan (`rollback.allowed`); maydon noma'lum (`null` /
 * eski backend) — avvalgi qoida (hududiy menejer, sotilgan / bekor, jo'natilmagan bekor posilka).
 */

const baseRow = {
  market_id: "201",
  customer_id: "c-1",
  product_quantity: 1,
  where_deliver: "address",
  total_price: 96000,
  to_be_paid: 0,
  paid_amount: 0,
  district_id: "5",
  region_id: "12",
  post_id: "77",
  createdAt: "2026-10-01T08:00:00.000Z",
  items: [],
  market: { id: "201", name: "Chilonzor Market" },
  district: { id: "5", name: "Jomboy tumani" },
  customer: { id: "c-1", name: "Malika Yusupova", phone_number: "+998998124011" },
  holder_type: "BRANCH",
  holder_branch_id: "15",
  courier_id: "0",
};
const allowed = { allowed: true, code: null, message: null };
const SUPERADMIN_ONLY = "Buyurtma puli bosh ofisga o'tgan — faqat superadmin qaytara oladi";
const PARCEL_SENT = "Posilka filialdan jo'natilgan (bekorlar paketi, pochta, HQ yoki market) — qaytarib bo'lmaydi";

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("../../entities/order/api/orderStatusCounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/order/api/orderStatusCounts")>()),
  useOrderStatusCounts: () => ({ data: undefined, isPlaceholderData: false, isFetching: false, refetch: async () => undefined }),
}));
vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: () => ({
      data: { data: state.rows, total: state.rows.length, page: 1, limit: 10 },
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
  orderByIdQueryOptions: (orderId: string) => ({ queryKey: ["orders", orderId], queryFn: async () => null }),
}));
vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));
vi.mock("./list/courier/index", () => ({ default: () => null }));

const asManager = (branchType: string, canSellCancel = true) =>
  ({
    role: { id: "300", role: "manager", region: null, name: "Menejer" },
    user: {
      user: { id: "300", role: "manager", branch: { id: "15", type: branchType }, can_sell_cancel: canSellCancel },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const rowOf = (id: string) => screen.getByRole("link", { name: `№${id}` }).closest("tr") as HTMLElement;
const rollbackButton = (id: string) => within(rowOf(id)).queryByRole("button", { name: `№${id} ni kutilmoqda holatiga qaytarish` });

describe("/orders — «Qaytarish» ko'rinishi (BE #738)", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("⭐ hududiy menejer: allowed → tugma; false → «—» + sabab; null / yo'q → zaxira; «Bekor — jo'natilgan» → yo'q", () => {
    state.rows = [
      { ...baseRow, id: "1", status: "sold", rollback: allowed },
      { ...baseRow, id: "2", status: "sold", rollback: { allowed: false, code: "SUPERADMIN_ONLY", message: SUPERADMIN_ONLY } },
      { ...baseRow, id: "3", status: "sold", rollback: null },
      { ...baseRow, id: "4", status: "cancelled" },
      { ...baseRow, id: "5", status: "cancelled", transport_status: "cancelled (sent)", rollback: null },
      {
        ...baseRow,
        id: "6",
        status: "cancelled",
        transport_status: "cancelled (sent)",
        rollback: { allowed: false, code: "PARCEL_NOT_IN_BRANCH", message: PARCEL_SENT },
      },
      { ...baseRow, id: "7", status: "cancelled", canceled_post_id: "41" },
    ];
    renderWithProviders(<Orders />, { route: "/orders", preloadedState: asManager("HYBRID") });

    expect(rollbackButton("1")).toBeInTheDocument();
    expect(rollbackButton("2")).not.toBeInTheDocument();
    expect(within(rowOf("2")).getByLabelText(`№2 ni qaytarib bo'lmaydi: ${SUPERADMIN_ONLY}`)).toHaveAttribute(
      "title",
      SUPERADMIN_ONLY,
    );
    expect(rollbackButton("3")).toBeInTheDocument();
    expect(rollbackButton("4")).toBeInTheDocument();
    // «Bekor — jo'natilgan» (gateway: `cancelled` + `transport_status`) — avval tugma chiqib, doim rad etilardi.
    expect(rollbackButton("5")).not.toBeInTheDocument();
    expect(within(rowOf("5")).getByLabelText("Amal yo'q")).toBeInTheDocument();
    expect(rollbackButton("6")).not.toBeInTheDocument();
    expect(within(rowOf("6")).getByLabelText(`№6 ni qaytarib bo'lmaydi: ${PARCEL_SENT}`)).toBeInTheDocument();
    expect(rollbackButton("7")).not.toBeInTheDocument();
  });

  it("⭐ server `allowed` eski FE shartlarini bekor qiladi: `can_sell_cancel` siz ham tugma, ruxsatsiz — yo'q", () => {
    state.rows = [
      { ...baseRow, id: "1", status: "sold", rollback: allowed },
      { ...baseRow, id: "2", status: "sold", rollback: null },
    ];
    renderWithProviders(<Orders />, { route: "/orders", preloadedState: asManager("REGIONAL", false) });
    expect(rollbackButton("1")).toBeInTheDocument();
    // Zaxira (null): `can_sell_cancel` yo'q — avvalgidek tugma yo'q.
    expect(rollbackButton("2")).not.toBeInTheDocument();
  });

  it("HQ menejeri: server ruxsat bergan qator bo'lsa «Amallar» ustuni chiqadi, aks holda ustun yo'q", () => {
    state.rows = [
      { ...baseRow, id: "1", status: "sold", rollback: allowed },
      { ...baseRow, id: "2", status: "waiting", rollback: { allowed: false, code: "STATUS_NOT_ROLLBACKABLE", message: "x" } },
    ];
    const view = renderWithProviders(<Orders />, { route: "/orders", preloadedState: asManager("HQ") });
    expect(screen.getByRole("columnheader", { name: "Amallar" })).toBeInTheDocument();
    expect(rollbackButton("1")).toBeInTheDocument();
    // Kutilmoqda qatorda HQ menejeriga sotish / bekor yo'q (eski qoida o'zgarmagan).
    expect(within(rowOf("2")).queryByRole("button", { name: /ni sotish/ })).not.toBeInTheDocument();
    view.unmount();

    state.rows = [{ ...baseRow, id: "3", status: "sold", rollback: null }];
    renderWithProviders(<Orders />, { route: "/orders", preloadedState: asManager("HQ") });
    expect(screen.queryByRole("columnheader", { name: "Amallar" })).not.toBeInTheDocument();
  });
});
