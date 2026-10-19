import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget } from "../../shared/lib/scanner/scanTargets";

/**
 * Bekor qilinganlarni HQ'ga yuborish (menejer, HYBRID/REGIONAL filial, «Bekor qilingan» tabi) — dizayn v2
 * (maket `manager-orders-list-cancelled`): tanlov ustuni, tanlov paneli (son + «Tanlovni bekor qilish» +
 * «HQ'ga yuborish»), faqat hali jo'natilmaganlarini tanlash mumkin.
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
  address: null,
  operator: null,
  comment: null,
  post_id: "77",
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-01T08:00:00.000Z",
  deleted: false,
  items: [],
  market: { id: "201", name: "Baraka Shop" },
  district: { id: "5", name: "Urgut tumani", region: { id: "12", name: "Samarqand" } },
};

const rows = [
  { ...baseRow, id: "10298", status: "cancelled", customer: { id: "c-1", name: "Bekzod Aliyev", phone_number: "+998913302774" } },
  { ...baseRow, id: "10296", status: "cancelled", customer: { id: "c-2", name: "Laylo Karimova", phone_number: "+998904419205" } },
  { ...baseRow, id: "10295", status: "cancelled (sent)", customer: { id: "c-3", name: "Shahnoza Ergasheva", phone_number: "+998952047719" } },
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

const sendToPost = vi.fn((_ids: string[], options?: { onSuccess?: () => void }) => options?.onSuccess?.());
const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
    SendToPost: { mutate: sendToPost, isPending: false },
  }),
}));

vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));
vi.mock("./list/courier/index", () => ({ default: () => null }));
vi.mock("./list/courier/list/SellModal", () => ({ default: () => null }));
vi.mock("./list/courier/list/CancelModal", () => ({ default: () => null }));

const managerState = (type: string) =>
  ({
    role: { id: "300", role: "manager", region: null, name: "Menejer" },
    user: {
      user: { id: "300", role: "manager", branch: { id: "15", type }, can_sell_cancel: true },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

describe("Orders — bekor qilinganlarni HQ'ga yuborish", () => {
  it("tanlov paneli faqat tanlanganda; yuborilgach tanlov tozalanadi va xabar chiqadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Orders />, {
      route: "/orders?status=cancelled,cancelled%20(sent)",
      preloadedState: managerState("HYBRID"),
    });

    expect(screen.getByRole("region", { name: "Bekor qilingan buyurtmalar" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№10295 allaqachon jo'natilgan, tanlab bo'lmaydi" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Sahifadagi jo'natilmagan buyurtmalarni tanlash" }));

    const bar = screen.getByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(within(bar).getByText("2 ta buyurtma tanlandi")).toBeInTheDocument();
    expect(
      within(bar).getByText(
        "QR kodni skanerlasangiz, buyurtma ro'yxatda avtomatik tanlanadi. Faqat hali jo'natilmaganlarini tanlash mumkin.",
      ),
    ).toBeInTheDocument();

    await user.click(within(bar).getByRole("button", { name: "HQ'ga yuborish" }));

    expect(sendToPost).toHaveBeenCalledWith(["10298", "10296"], expect.anything());
    expect(await screen.findByText("Bekor qilingan buyurtmalar HQ'ga yuborildi")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
  });

  it("«Tanlovni bekor qilish» tanlovni tozalaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Orders />, {
      route: "/orders?status=cancelled,cancelled%20(sent)",
      preloadedState: managerState("REGIONAL"),
    });

    await user.click(screen.getByRole("checkbox", { name: "№10298 ni tanlash" }));
    expect(
      within(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).getByText("1 ta buyurtma tanlandi"),
    ).toBeInTheDocument();
    // Son ekran o'quvchiga panel paydo bo'lishidan oldin DOMda turgan jonli hudud orqali aytiladi.
    expect(screen.getAllByRole("status").some((el) => el.textContent === "1 ta buyurtma tanlandi")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(screen.getByRole("checkbox", { name: "№10298 ni tanlash" })).not.toBeChecked();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
  });

  it("kamera (markaziy «Skaner»): «HQ'ga yuborish» maqsadi, skan tanlaydi; jo'natilgani rad etiladi", async () => {
    renderWithProviders(<Orders />, {
      route: "/orders?status=cancelled,cancelled%20(sent)",
      preloadedState: managerState("HYBRID"),
    });

    expect(getActiveScanTarget()).toMatchObject({
      id: "orders:cancelled-to-hq",
      title: "HQ'ga yuborish",
      context: "Bekor qilingan buyurtmalar · 2 ta",
      progress: { done: 0, total: 2, label: "ta tanlandi" },
    });

    act(() => {
      void getActiveScanTarget()!.onScan("10298", "camera");
    });
    expect(screen.getByRole("checkbox", { name: "№10298 ni tanlash" })).toBeChecked();
    act(() => {
      void getActiveScanTarget()!.onScan("10295", "manual");
    });
    await waitFor(() =>
      expect(getActiveScanTarget()?.list?.map((item) => [item.title, item.subtitle ?? "", item.tone])).toEqual([
        ["№10295", "Rad etildi · yuborib bo'lmaydi", "danger"],
        ["№10298 · Bekzod Aliyev", "Urgut tumani · 96 000 so'm", "success"],
      ]),
    );

    act(() => getActiveScanTarget()!.list![1].onUndo!());
    expect(screen.getByRole("checkbox", { name: "№10298 ni tanlash" })).not.toBeChecked();
  });

  it("HQ/PICKUP menejerida va boshqa tablarda tanlov yo'q", () => {
    const { unmount } = renderWithProviders(<Orders />, {
      route: "/orders?status=cancelled,cancelled%20(sent)",
      preloadedState: managerState("PICKUP"),
    });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(getActiveScanTarget()).toBeNull();
    unmount();

    renderWithProviders(<Orders />, { route: "/orders", preloadedState: managerState("HYBRID") });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
