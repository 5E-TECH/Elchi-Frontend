import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierOrders from "./index";
import { renderWithProviders } from "../../../../test/test-utils";

/**
 * fix3b LC-05 — "Hamma buyurtmalar" tabida bekor qilingan buyurtmada
 * "Qayta tiklash" faqat posilka hali SHU kuryerda bo'lsa ko'rinadi (filial/HQ
 * qabul qilgan bo'lsa backend 400). Sotilgan qator avvalgidek.
 * fix3b L1 / CODE-14 — rollback 200 + `cancel_post_created: false` qaytarsa,
 * oddiy muvaffaqiyat emas, ogohlantirish ko'rsatiladi.
 */

const COURIER_ID = "56";

const baseOrder = {
  created_at: "2026-10-01T08:00:00.000Z",
  total_price: 150000,
  where_deliver: "center",
  product_quantity: 1,
  market: { name: "Yandex" },
  district: { name: "Guliston" },
  region: { name: "Sirdaryo" },
  items: [],
};

const orders = [
  {
    ...baseOrder,
    id: "501",
    status: "sold",
    customer: { name: "Sotilgan mijoz", phone_number: "+998900000001" },
    holder_type: "COURIER",
    holder_courier_id: COURIER_ID,
  },
  {
    ...baseOrder,
    id: "502",
    status: "cancelled",
    customer: { name: "Qo'limdagi bekor", phone_number: "+998900000002" },
    holder_type: "COURIER",
    holder_courier_id: COURIER_ID,
  },
  {
    ...baseOrder,
    id: "503",
    status: "cancelled",
    customer: { name: "HQ dagi bekor", phone_number: "+998900000003" },
    holder_type: "HQ",
    holder_courier_id: null,
  },
  {
    ...baseOrder,
    id: "504",
    status: "cancelled",
    customer: { name: "Boshqa kuryerdagi bekor", phone_number: "+998900000004" },
    holder_type: "COURIER",
    holder_courier_id: "57",
  },
  {
    ...baseOrder,
    id: "505",
    status: "cancelled",
    transport_status: "cancelled (sent)",
    customer: { name: "Pochtaga yuborilgan bekor", phone_number: "+998900000005" },
    holder_type: "COURIER",
    holder_courier_id: COURIER_ID,
  },
];

const rollbackMutate = vi.fn();
const idle = { mutate: vi.fn(), isPending: false };

vi.mock("../../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderCourier: () => ({
      data: { data: orders, total: orders.length, page: 1, limit: 10 },
      isLoading: false,
    }),
    SellOrder: idle,
    PartlySellOrder: idle,
    RollbackOrder: { mutate: rollbackMutate, isPending: false },
    CancelOrder: idle,
    SendToPost: idle,
  }),
}));

type MutateOptions = { onSuccess?: (response: unknown) => void };

const courierState = {
  role: { id: COURIER_ID, role: "courier", region: null, name: "Kuryer" },
} as never;

const openAllTab = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(<CourierOrders />, { route: "/orders?status=waiting", preloadedState: courierState });
  await user.click(screen.getAllByRole("button", { name: /Hamma buyurtmalar/ })[0]);
};

const rowOf = (customerName: string) => {
  const row = screen.getByText(customerName).closest("tr");
  if (!row) throw new Error(`row not found: ${customerName}`);
  return row;
};

const restoreButtonIn = (customerName: string) =>
  within(rowOf(customerName)).queryByRole("button", { name: "Qayta tiklash" });

describe("Kuryer — bekor qilinganni qayta tiklash (fix3b LC-05)", () => {
  beforeEach(() => rollbackMutate.mockReset());

  it("posilka o'zida turgan bekor va sotilgan buyurtmada tugma bor", async () => {
    const user = userEvent.setup();
    await openAllTab(user);

    expect(restoreButtonIn("Qo'limdagi bekor")).toBeInTheDocument();
    expect(restoreButtonIn("Sotilgan mijoz")).toBeInTheDocument();
  });

  it("HQ/filial qabul qilgan, boshqa kuryerdagi yoki pochtaga yuborilgan bekor buyurtmada tugma yo'q", async () => {
    const user = userEvent.setup();
    await openAllTab(user);

    expect(restoreButtonIn("HQ dagi bekor")).not.toBeInTheDocument();
    expect(restoreButtonIn("Boshqa kuryerdagi bekor")).not.toBeInTheDocument();
    expect(restoreButtonIn("Pochtaga yuborilgan bekor")).not.toBeInTheDocument();
  });

  it("rollback pochtasiz bajarilsa (cancel_post_created=false) — ogohlantirish ko'rinadi (fix3b L1)", async () => {
    const user = userEvent.setup();
    rollbackMutate.mockImplementation((_id: string, options?: MutateOptions) =>
      options?.onSuccess?.({
        statusCode: 200,
        message: "Buyurtma bekor qilindi, lekin bekor qilinganlar pochtasiga qo'shilmadi (403). Uni pochtaga qo'lda qo'shing.",
        data: {
          cancel_post_created: false,
          warning: "Buyurtma bekor qilindi, lekin bekor qilinganlar pochtasiga qo'shilmadi (403). Uni pochtaga qo'lda qo'shing.",
        },
      }),
    );
    await openAllTab(user);

    await user.click(restoreButtonIn("Qo'limdagi bekor")!);
    await user.click(screen.getByRole("button", { name: "Ha, qaytarish" }));

    expect(rollbackMutate).toHaveBeenCalledWith("502", expect.anything());
    expect(await screen.findByText("Ogohlantirish")).toBeInTheDocument();
    expect(screen.getByText(/pochtasiga qo'shilmadi \(403\)/)).toBeInTheDocument();
  });

  it("oddiy rollback javobida ogohlantirish yo'q", async () => {
    const user = userEvent.setup();
    rollbackMutate.mockImplementation((_id: string, options?: MutateOptions) =>
      options?.onSuccess?.({ statusCode: 200, message: "Order WAITING holatiga qaytarildi", data: {} }),
    );
    await openAllTab(user);

    await user.click(restoreButtonIn("Sotilgan mijoz")!);
    await user.click(screen.getByRole("button", { name: "Ha, qaytarish" }));

    expect(rollbackMutate).toHaveBeenCalledWith("501", expect.anything());
    expect(screen.queryByText("Ogohlantirish")).not.toBeInTheDocument();
  });
});
