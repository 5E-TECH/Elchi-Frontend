import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * Menejer ro'yxati → amal oynalari (haqiqiy `SellModal` / `CancelModal` / `RollbackOrderDialog`,
 * `variant="manager"`; maketlar `manager-orders-sell-dialog`, `-cancel-dialog`, `-rollback-dialog`).
 * Amal bajarilgach oyna yopiladi va qisqa xabar chiqadi («Buyurtma sotildi» …).
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
  updatedAt: "2026-10-01T08:00:00.000Z",
  deleted: false,
  items: [],
  market: { id: "201", name: "Chilonzor Market" },
  district: { id: "5", name: "Jomboy tumani" },
  holder_type: "BRANCH",
  holder_branch_id: "15",
  courier_id: "0",
};

const rows = [
  { ...baseRow, id: "10302", status: "sold", customer: { id: "c-1", name: "Malika Yusupova", phone_number: "+998998124011" } },
  { ...baseRow, id: "10293", status: "waiting", customer: { id: "c-2", name: "Sevara Tursunova", phone_number: "+998905621407" } },
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

type MutateOptions = { onSuccess?: (response: unknown) => void; onError?: (error: unknown) => void };
const sellMutate = vi.fn();
const cancelMutate = vi.fn();
const rollbackMutate = vi.fn();
const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutate: sellMutate, isPending: false },
    PartlySellOrder: idleMutation,
    CancelOrder: { mutate: cancelMutate, isPending: false },
    RollbackOrder: { mutate: rollbackMutate, isPending: false },
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

const managerState = {
  role: { id: "300", role: "manager", region: null, name: "Menejer" },
  user: {
    user: { id: "300", role: "manager", branch: { id: "15", type: "HYBRID" }, can_sell_cancel: true },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const renderPage = () =>
  renderWithProviders(<Orders />, { route: "/orders", preloadedState: managerState });

/** Qatordagi amal tugmasi (jadval va telefon kartasi bo'lsa — birinchisi). */
const rowAction = (name: string) => screen.getAllByRole("button", { name })[0];

describe("Menejer ro'yxati — amal oynalari (dizayn v2)", () => {
  beforeEach(() => {
    sellMutate.mockReset();
    cancelMutate.mockReset();
    rollbackMutate.mockReset();
  });

  it("qaytarish: «Buyurtmani qaytarish» tasdig'i → POST rollback → oyna yopiladi, «Buyurtma qayta tiklandi»", async () => {
    const user = userEvent.setup();
    rollbackMutate.mockImplementation((_id: string, options?: MutateOptions) =>
      options?.onSuccess?.({ statusCode: 200, data: {} }),
    );
    renderPage();

    await user.click(rowAction("№10302 ni kutilmoqda holatiga qaytarish"));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani qaytarish" });
    expect(dialog).toHaveTextContent("№10302 · Chilonzor Market · Uygacha");
    expect(dialog).toHaveTextContent("Buyurtma «Kutilmoqda» holatiga qaytariladi. Davom etasizmi?");
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    expect(rollbackMutate).toHaveBeenCalledWith({ orderId: "10302", targetStatus: "waiting" }, expect.any(Object));
    expect(await screen.findByText("Buyurtma qayta tiklandi")).toBeInTheDocument();
    expect(screen.getByText("№10302 · Malika Yusupova")).toBeInTheDocument();
  });

  it("qaytarish rad etilsa — oyna ochiq qoladi, sabab xabarda", async () => {
    const user = userEvent.setup();
    rollbackMutate.mockImplementation((_id: string, options?: MutateOptions) =>
      options?.onError?.(
        new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 400,
          data: { message: "Kassa yopilgan — qaytarib bo'lmaydi" },
        } as AxiosResponse),
      ),
    );
    renderPage();

    await user.click(rowAction("№10302 ni kutilmoqda holatiga qaytarish"));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani qaytarish" });
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    expect(await screen.findByText("Kassa yopilgan — qaytarib bo'lmaydi")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Buyurtmani qaytarish" })).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma qayta tiklandi")).not.toBeInTheDocument();
  });

  it("sotish: «Buyurtmani sotish» (menejer varianti) → POST sell → «Buyurtma sotildi»", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars: unknown, options?: MutateOptions) =>
      options?.onSuccess?.({ statusCode: 200, data: { id: "10293", status: "sold" } }),
    );
    renderPage();

    await user.click(rowAction("№10293 ni sotish"));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    expect(within(dialog).getByText("Kiritilsa, market tasdig'idan o'tadi")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    expect(sellMutate).toHaveBeenCalledWith(
      { orderId: "10293", data: { comment: "", extraCost: 0 } },
      expect.any(Object),
    );
    expect(await screen.findByText("Buyurtma sotildi")).toBeInTheDocument();
    expect(screen.getByText("№10293 · Sevara Tursunova")).toBeInTheDocument();
  });

  it("bekor qilish: sabab tanlanadi → POST cancel → «Buyurtma bekor qilindi»", async () => {
    const user = userEvent.setup();
    cancelMutate.mockImplementation((_vars: unknown, options?: MutateOptions) =>
      options?.onSuccess?.({ statusCode: 200, data: { id: "10293", status: "cancelled" } }),
    );
    renderPage();

    await user.click(rowAction("№10293 ni bekor qilish"));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani bekor qilish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz javob bermadi" }));
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    expect(cancelMutate).toHaveBeenCalledWith(
      { orderId: "10293", data: { reason: "CUSTOMER_NO_ANSWER", comment: "", extraCost: 0 } },
      expect.any(Object),
    );
    expect(await screen.findByText("Buyurtma bekor qilindi")).toBeInTheDocument();
  });

  it("xarajat bilan sotish market tasdig'iga tushsa — oyna «Market tasdig'i kutilmoqda», xabar yo'q", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars: unknown, options?: MutateOptions) =>
      options?.onSuccess?.({
        statusCode: 202,
        data: { approval_required: true, approval: { action: "sell", amount: 20000, createdAt: new Date().toISOString() } },
      }),
    );
    renderPage();

    await user.click(rowAction("№10293 ni sotish"));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    await user.type(within(dialog).getByLabelText("Qo'shimcha xarajat"), "20000");
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    expect(await screen.findByRole("dialog", { name: "Market tasdig'i kutilmoqda" })).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma sotildi")).not.toBeInTheDocument();
  });
});
