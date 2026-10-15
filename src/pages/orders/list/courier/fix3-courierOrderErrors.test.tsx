import { screen } from "@testing-library/react";
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

    await openFirst(user, /^Sotish$/);
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");
    await user.click(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!);

    expect(sellMutate).toHaveBeenCalledWith(
      { orderId: "7001", data: expect.objectContaining({ extraCost: 5000 }) },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(
      await screen.findByText("Bu foydalanuvchiga qo'shimcha xarajat yozish ruxsati berilmagan"),
    ).toBeInTheDocument();
    // Oyna yopilmadi — kuryer tuzatib qayta yuboradi.
    expect(screen.getAllByRole("button", { name: /^Sotish$/ }).length).toBeGreaterThan(1);
  });

  it("bekor qilish 400 — sabab chiqadi", async () => {
    const user = userEvent.setup();
    cancelMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onError?.(httpError(400, "Buyurtma holati noto'g'ri")),
    );
    renderPage();

    await openFirst(user, /^Bekor qilish$/);
    await user.selectOptions(screen.getByLabelText(/^Sabab/), "WRONG_ADDRESS");
    await user.click(screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)!);

    expect(await screen.findByText("Buyurtma holati noto'g'ri")).toBeInTheDocument();
  });

  it("tarmoq xatosida ikkinchi bildirishnoma chiqmaydi (global 'Tarmoq xatosi' yetarli)", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onError?.(new AxiosError("Network Error", "ERR_NETWORK")),
    );
    renderPage();

    await openFirst(user, /^Sotish$/);
    await user.click(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!);

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

    await openFirst(user, /^Sotish$/);

    expect(
      screen.getByText("Uyga yetkazishda qo'shimcha xarajat yozilmaydi — uy tarifi allaqachon yuqori."),
    ).toBeInTheDocument();
    // Xarajat maydoni yo'q (faqat «Marketga to'langan summa» qoladi — uguUEhin).
    expect(screen.queryByRole("textbox", { name: "Qo'shimcha xarajat" })).toBeNull();
    expect(screen.getByLabelText("Marketga to'langan summa")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!);
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

    await openFirst(user, /^Bekor qilish$/);
    await user.selectOptions(screen.getByLabelText(/^Sabab/), "CUSTOMER_REFUSED");
    // Xarajatsiz — isbot shart emas.
    expect(screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)!).toBeEnabled();

    const [extraCostInput] = screen.getAllByRole("spinbutton");
    await user.clear(extraCostInput);
    await user.type(extraCostInput, "5000");

    // Sabab tugma yonida yoziladi, «Bekor qilish» o'chiq.
    expect(screen.getAllByText("Bekor qilishda rasm yoki video majburiy").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)!).toBeDisabled();
    expect(cancelMutate).not.toHaveBeenCalled();
  });

  it("sotishda xarajat > 0 — isbot talab qilinadi", async () => {
    const user = userEvent.setup();
    renderPage();

    await openFirst(user, /^Sotish$/);
    expect(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!).toBeEnabled();

    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "3000");

    // Sabab tugma yonida yoziladi, «Sotish» o'chiq.
    expect(screen.getAllByText("Sotishda rasm yoki video majburiy").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!).toBeDisabled();
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

    await openFirst(user, /^Sotish$/);
    await user.type(screen.getByLabelText("Marketga to'langan summa"), "100000");
    await user.click(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!);

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
    await openFirst(user, /^Sotish$/);
    await user.click(screen.getAllByRole("button", { name: /^Sotish$/ }).at(-1)!);
    expect(screen.queryByText(/marketga (to'liq|qisman) to'landi/)).toBeNull();
  });
});
