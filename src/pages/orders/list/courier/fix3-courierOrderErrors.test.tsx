import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierOrders from "./index";
import { renderWithProviders } from "../../../../test/test-utils";

/**
 * fix3 FE-ORD-02 — kuryer ro'yxatidagi sotish/bekor qilish rad etilsa sabab
 * ko'rinadi; uyga yetkazishda qo'shimcha xarajat maydoni yo'q; market
 * yoqqan "*_extra_cost" sharti isbotni oldindan talab qiladi.
 */

const baseOrder = {
  created_at: "2026-10-01T08:00:00.000Z",
  status: "waiting",
  total_price: 250000,
  product_quantity: 1,
  customer: { name: "TEST-FIX3", phone_number: "+998900000014" },
  district: { name: "Andijon shahri" },
  region: { name: "Andijon" },
  items: [],
};

const listState = {
  orders: [] as Array<Record<string, unknown>>,
};

const sellMutate = vi.fn();
const cancelMutate = vi.fn();
const idle = { mutate: vi.fn(), isPending: false };

vi.mock("../../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderCourier: () => ({
      data: { data: listState.orders, total: listState.orders.length, page: 1, limit: 10 },
      isLoading: false,
    }),
    useGetCourierOrderCounts: () => ({ data: undefined }),
    SellOrder: { mutate: sellMutate, isPending: false },
    PartlySellOrder: idle,
    RollbackOrder: idle,
    CancelOrder: { mutate: cancelMutate, isPending: false },
    SendToPost: idle,
  }),
}));

type MutateOptions = { onSuccess?: (response: unknown) => void; onError?: (error: unknown) => void };

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

/**
 * Oyna ichidagi tugma. Dizayn v2 `Dialog` `#ui-portal` ga chiziladi; u testlar orasida saqlanadi va
 * keyingi testning konteyneridan OLDIN turadi — `getAllByRole(…).at(-1)` endi qatordagi tugmani olardi.
 * «Yopish» — oxirgisi (sarlavhadagi × ham «Yopish»).
 */
const dialogButton = (name: RegExp | string) => within(screen.getByRole("dialog")).getAllByRole("button", { name }).at(-1)!;

const renderPage = () => renderWithProviders(<CourierOrders />, { route: "/orders?status=waiting" });

const openFirst = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getAllByRole("button", { name })[0]);
};

describe("Kuryer ro'yxati — rad javobi ko'rinadi (fix3 FE-ORD-02)", () => {
  beforeEach(() => {
    sellMutate.mockReset();
    cancelMutate.mockReset();
    listState.orders = [
      { ...baseOrder, id: "7001", where_deliver: "center", market: { name: "BeePost" } },
    ];
  });

  it("sotish 403 — backend sababi chiqadi, oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onError?.(httpError(403, "Bu foydalanuvchiga qo'shimcha xarajat yozish ruxsati berilmagan")),
    );
    renderPage();

    await openFirst(user, /ni sotish$/);
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");
    await user.click(dialogButton(/^Sotish$/));

    expect(sellMutate).toHaveBeenCalledWith(
      { orderId: "7001", data: expect.objectContaining({ extraCost: 5000 }) },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(
      await screen.findByText("Bu foydalanuvchiga qo'shimcha xarajat yozish ruxsati berilmagan"),
    ).toBeInTheDocument();
    // Oyna yopilmadi — kuryer tuzatib qayta yuboradi.
    // Qator tugmasining nomi «№7001 ni sotish» — «Sotish» faqat oynadagi tugma.
    expect(screen.getAllByRole("button", { name: /^Sotish$/ })).toHaveLength(1);
  });

  it("bekor qilish 400 — sabab chiqadi", async () => {
    const user = userEvent.setup();
    cancelMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onError?.(httpError(400, "Buyurtma holati noto'g'ri")),
    );
    renderPage();

    await openFirst(user, /ni bekor qilish$/);
    // Sabab — `Select` (combobox): ochib, variantni bosish.
    await user.click(screen.getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Manzil noto'g'ri" }));
    await user.click(dialogButton(/^Bekor qilish$/));

    expect(await screen.findByText("Buyurtma holati noto'g'ri")).toBeInTheDocument();
  });

  it("tarmoq xatosida ikkinchi bildirishnoma chiqmaydi (global 'Tarmoq xatosi' yetarli)", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onError?.(new AxiosError("Network Error", "ERR_NETWORK")),
    );
    renderPage();

    await openFirst(user, /ni sotish$/);
    await user.click(dialogButton(/^Sotish$/));

    expect(sellMutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Amalni bajarib bo'lmadi. Qayta urinib ko'ring.")).not.toBeInTheDocument();
  });
});

describe("Kuryer sotuvi — uyga yetkazishda qo'shimcha xarajat yo'q (fix3 FE-ORD-02)", () => {
  beforeEach(() => {
    sellMutate.mockReset();
    listState.orders = [
      { ...baseOrder, id: "7002", where_deliver: "address", market: { name: "BeePost" } },
    ];
  });

  it("xarajat maydoni o'rniga izoh; so'rovda extraCost: 0", async () => {
    const user = userEvent.setup();
    renderPage();

    await openFirst(user, /ni sotish$/);

    expect(
      screen.getByText("Uyga yetkazishda qo'shimcha xarajat yozilmaydi — uy tarifi allaqachon yuqori."),
    ).toBeInTheDocument();
    // Xarajat maydoni yo'q (faqat «Marketga to'langan summa» qoladi — uguUEhin).
    expect(screen.queryByRole("textbox", { name: "Qo'shimcha xarajat" })).toBeNull();
    expect(screen.getByLabelText("Marketga to'langan summa")).toBeInTheDocument();

    await user.click(dialogButton(/^Sotish$/));
    expect(sellMutate).toHaveBeenCalledWith(
      { orderId: "7002", data: expect.objectContaining({ extraCost: 0 }) },
      expect.any(Object),
    );
  });
});

describe("Market isbot shartlari — xarajat yozilganda isbot (fix3 FE-ORD-02)", () => {
  beforeEach(() => {
    cancelMutate.mockReset();
    sellMutate.mockReset();
    listState.orders = [
      {
        ...baseOrder,
        id: "7003",
        where_deliver: "center",
        market: { name: "BeePost", expense_proof_conditions: ["cancel_extra_cost", "sell_extra_cost"] },
      },
    ];
  });

  it("bekor qilishda xarajat > 0 — isbotsiz yuborilmaydi; xarajat 0 — oddiy", async () => {
    const user = userEvent.setup();
    renderPage();

    await openFirst(user, /ni bekor qilish$/);
    // Sabab — `Select` (combobox): ochib, variantni bosish.
    await user.click(screen.getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz rad etdi" }));
    // Xarajatsiz — isbot shart emas.
    expect(dialogButton(/^Bekor qilish$/)).toBeEnabled();

    const extraCostInput = screen.getByLabelText("Qo'shimcha xarajat");
    await user.clear(extraCostInput);
    await user.type(extraCostInput, "5000");

    // Sabab tugma yonida yoziladi, «Bekor qilish» o'chiq.
    expect(screen.getAllByText("Bekor qilishda rasm yoki video majburiy").length).toBeGreaterThan(0);
    expect(dialogButton(/^Bekor qilish$/)).toBeDisabled();
    expect(cancelMutate).not.toHaveBeenCalled();
  });

  it("sotishda xarajat > 0 — isbot talab qilinadi", async () => {
    const user = userEvent.setup();
    renderPage();

    await openFirst(user, /ni sotish$/);
    expect(dialogButton(/^Sotish$/)).toBeEnabled();

    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "3000");

    // Sabab tugma yonida yoziladi, «Sotish» o'chiq.
    expect(screen.getAllByText("Sotishda rasm yoki video majburiy").length).toBeGreaterThan(0);
    expect(dialogButton(/^Sotish$/)).toBeDisabled();
  });
});

describe("Sotishdan keyin marketga to'lov natijasi (uguUEhin)", () => {
  beforeEach(() => {
    sellMutate.mockReset();
    listState.orders = [{ ...baseOrder, id: "7004", where_deliver: "center", market: { name: "BeePost" } }];
  });

  it.each([
    ["paid", "Sotildi, marketga to'liq to'landi"],
    ["partly_paid", "Sotildi, marketga qisman to'landi"],
  ])("data.status=%s — «%s» bildirishnomasi", async (status, text) => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onSuccess?.({ statusCode: 200, data: { id: "7004", status } }),
    );
    renderPage();

    await openFirst(user, /ni sotish$/);
    await user.type(screen.getByLabelText("Marketga to'langan summa"), "100000");
    await user.click(dialogButton(/^Sotish$/));

    expect(sellMutate).toHaveBeenCalledWith(
      { orderId: "7004", data: expect.objectContaining({ paidAmount: 100000 }) },
      expect.any(Object),
    );
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("data.status=sold — qo'shimcha bildirishnoma yo'q (avvalgidek)", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onSuccess?.({ statusCode: 200, data: { id: "7004", status: "sold" } }),
    );
    renderPage();
    await openFirst(user, /ni sotish$/);
    await user.click(dialogButton(/^Sotish$/));
    expect(screen.queryByText(/marketga (to'liq|qisman) to'landi/)).toBeNull();
  });
});
