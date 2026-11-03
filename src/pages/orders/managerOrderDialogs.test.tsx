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
  {
    ...baseRow,
    id: "10293",
    status: "waiting",
    customer: { id: "c-2", name: "Sevara Tursunova", phone_number: "+998905621407" },
    // vbu7Wr3o: kutilayotgan buyurtmada `to_be_paid` 0 — chegara backend bergan maydonda (96 000 − markaz tarifi).
    sale_market_paid_max: 25000,
  },
];

// GaBIPi3Z: holat tablari sonlari — bu testlar ro'yxat va oynalarni tekshiradi (sonlar `statusCounts.test.tsx` da).
vi.mock("../../entities/order/api/orderStatusCounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/order/api/orderStatusCounts")>()),
  useOrderStatusCounts: () => ({ data: undefined, isPlaceholderData: false, isFetching: false, refetch: async () => undefined }),
}));
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

  it("vbu7Wr3o: sotish oynasida «Marketga to'langan summa» chegarasi `sale_market_paid_max` dan (25 000, «0 so'm» emas)", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowAction("№10293 ni sotish"));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    const field = within(dialog).getByLabelText("Marketga to'langan summa");
    const hint = field.closest("[data-field]") ?? dialog;
    expect(hint).toHaveTextContent(/25\s000 so'mdan oshmasin/);
    expect(dialog).not.toHaveTextContent(/·\s*0 so'mdan oshmasin/);

    // Chegaradan oshsa — xato va «Sotish» yuborilmaydi.
    await user.type(field, "30000");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/25\s000/);
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

  // 2KisY7DL: tasdiqsiz marketda menejer kuryer chegarasida — 400 sababi oyna ichida (toast oyna ortida qolardi).
  const badRequest = (message: string) =>
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      data: { message },
    } as AxiosResponse);

  it("2KisY7DL: sotish 400 — sabab oyna ichida bir marta, oyna ochiq; qayta ochilganda tozalangan", async () => {
    const user = userEvent.setup();
    const reason = "Qo'shimcha xarajat maksimal 30 000 so'm bo'lishi mumkin";
    sellMutate.mockImplementation((_vars: unknown, options?: MutateOptions) => options?.onError?.(badRequest(reason)));
    renderPage();

    await user.click(rowAction("№10293 ni sotish"));
    let dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    await user.type(within(dialog).getByLabelText("Qo'shimcha xarajat"), "50000");
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(reason);
    expect(screen.getAllByText(reason)).toHaveLength(1);
    expect(screen.queryByText("Buyurtma sotildi")).not.toBeInTheDocument();

    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await user.click(rowAction("№10293 ni sotish"));
    dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("2KisY7DL: bekor qilish 400 — sabab oyna ichida, oyna ochiq", async () => {
    const user = userEvent.setup();
    const reason = "Qo'shimcha xarajat o'z xizmat haqqingizdan (25 000 so'm) oshmasligi kerak";
    cancelMutate.mockImplementation((_vars: unknown, options?: MutateOptions) => options?.onError?.(badRequest(reason)));
    renderPage();

    await user.click(rowAction("№10293 ni bekor qilish"));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani bekor qilish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz javob bermadi" }));
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(reason);
    expect(screen.getAllByText(reason)).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Buyurtmani bekor qilish" })).toBeInTheDocument();
  });

  it("2KisY7DL: javobsiz tarmoq xatosi oynada chiqmaydi (global «Tarmoq xatosi» yetarli)", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars: unknown, options?: MutateOptions) =>
      options?.onError?.(new AxiosError("Network Error", "ERR_NETWORK")),
    );
    renderPage();

    await user.click(rowAction("№10293 ni sotish"));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    expect(sellMutate).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
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
