import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import NewOrderDetail from "./new_orderDetail";

const mocks = vi.hoisted(() => ({
  receiveMutate: vi.fn(),
  transferMutate: vi.fn(),
  deleteMutateAsync: vi.fn(),
  marketsList: undefined as unknown,
  orders: [] as Record<string, unknown>[],
}));

const baseOrders = () => [
  {
    id: "o1",
    status: "new",
    where_deliver: "address",
    total_price: 50000,
    paid_amount: 0,
    to_be_paid: 50000,
    createdAt: "2026-10-01T08:00:00.000Z",
    comment: null,
    address: "Toshkent",
    items: [{ id: "i1", quantity: 2, product: { id: "p1", name: "Telefon g'ilofi", image_url: null } }],
    customer: { id: "c1", name: "Ali", phone_number: "+998901112233" },
    district: { name: "Chilonzor tumani" },
    region: { name: "Toshkent sh." },
    market: { id: "121", name: "Ipak Yo'li Savdo" },
  },
  {
    id: "o2",
    status: "new",
    where_deliver: "center",
    total_price: 70000,
    paid_amount: 20000,
    to_be_paid: 50000,
    createdAt: "2026-10-01T09:00:00.000Z",
    comment: null,
    address: "Toshkent",
    items: [{ id: "i2", quantity: 1, product: null, product_name: "Himoya oynasi" }],
    customer: { id: "c2", name: "Vali", phone_number: "+998901112244" },
    market: { id: "121", name: "Ipak Yo'li Savdo" },
  },
];

const success = (data: unknown) => ({
  data,
  status: "success",
  isLoading: false,
  isPending: false,
  isSuccess: true,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetTodayOrdersByMarket: () => success({ data: mocks.orders }),
    useGetTodayOrders: () => success(mocks.marketsList),
    useCancelledMarkets: () => success([]),
    useCancelledOrdersByMarket: () => success([]),
    deleteOrder: { mutate: vi.fn(), mutateAsync: mocks.deleteMutateAsync, isPending: false },
    createReceiveOrder: { mutate: mocks.receiveMutate, isPending: false },
    createTransferBatch: { mutate: mocks.transferMutate, isPending: false },
  }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: () => undefined,
}));

type StaffOptions = { branchType?: string; branchName?: string };

const stateFor = (role: string, options: StaffOptions = {}) =>
  ({
    role: { id: role === "market" ? "121" : `${role}-1`, role, region: null, name: role },
    user: {
      user: {
        id: `${role}-1`,
        role,
        ...(options.branchType
          ? { branch: { id: "1", type: options.branchType, name: options.branchName ?? null } }
          : {}),
      },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderPage = (role: string, options: StaffOptions = {}) =>
  renderWithProviders(
    <Routes>
      <Route path="/new-orders/:marketId" element={<NewOrderDetail />} />
      <Route path="/new-orders/:marketId/edit/:orderId" element={<p>EDIT PAGE</p>} />
    </Routes>,
    { route: "/new-orders/121", preloadedState: stateFor(role, options) },
  );

const receiveAllOrders = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Qabul qilish — 2 ta buyurtma" }));
  await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));
};

beforeEach(() => {
  mocks.receiveMutate.mockReset();
  mocks.transferMutate.mockReset();
  mocks.deleteMutateAsync.mockReset();
  mocks.orders = baseOrders();
  mocks.marketsList = undefined;
});

describe("NewOrderDetail — 'Qabul qilish' endpointi", () => {
  it("HQ registratori POST /orders/receive (createReceiveOrder) ishlatadi", async () => {
    renderPage("registrator", { branchType: "HQ" });

    await receiveAllOrders();

    await waitFor(() =>
      expect(mocks.receiveMutate).toHaveBeenCalledWith({ orderIds: ["o1", "o2"] }, expect.any(Object)),
    );
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });

  it("HQ menejeri ham POST /orders/receive ishlatadi", async () => {
    renderPage("manager", { branchType: "HQ" });

    await receiveAllOrders();

    await waitFor(() => expect(mocks.receiveMutate).toHaveBeenCalledTimes(1));
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });

  it.each(["HYBRID", "PICKUP"])("%s registratori hozirgidek transfer-batches ishlatadi", async (branchType) => {
    renderPage("registrator", { branchType });

    await receiveAllOrders();

    await waitFor(() =>
      expect(mocks.transferMutate).toHaveBeenCalledWith({ orderIds: ["o1", "o2"] }, expect.any(Object)),
    );
    expect(mocks.receiveMutate).not.toHaveBeenCalled();
  });

  it("superadmin hozirgidek POST /orders/receive ishlatadi", async () => {
    renderPage("superadmin");

    await receiveAllOrders();

    await waitFor(() => expect(mocks.receiveMutate).toHaveBeenCalledTimes(1));
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });
});

describe("NewOrderDetail — REGIONAL xodimi (fix3 CODE-17)", () => {
  it("REGIONAL registratorida 'Qabul qilish' tugmasi yo'q, /dispatch maslahati ko'rinadi", async () => {
    renderPage("registrator", { branchType: "REGIONAL" });

    expect(await screen.findByRole("note")).toHaveTextContent("Biriktirish");
    expect(screen.queryByRole("button", { name: /Qabul qilish/ })).not.toBeInTheDocument();
    // Skaner qabul qilmaydi — «QR skanerlansa…» va «USB skaner tayyor» ham yo'q.
    expect(screen.queryByText("USB skaner tayyor")).not.toBeInTheDocument();
    expect(screen.queryByText("QR skanerlansa, buyurtma darhol qabul qilinadi")).not.toBeInTheDocument();
    // Tanlov chop etish uchun qoladi.
    // Izohda «qabul qilish» yo'q — bu filialda qabul qilinmaydi.
    expect(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).toHaveTextContent(
      "Chop etish faqat tanlanganlarga qo'llanadi",
    );
    expect(mocks.receiveMutate).not.toHaveBeenCalled();
    expect(mocks.transferMutate).not.toHaveBeenCalled();
  });
});

describe("NewOrderDetail — xodim sahifasi (dizayn v2)", () => {
  it("sarlavha: «← Qabul va yaratish», market nomi, bugungi soni va summasi; skaner tayyor", async () => {
    renderPage("superadmin");

    expect(await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Qabul va yaratish/ })).toHaveAttribute("href", "/new-orders");
    expect(screen.getByText(/Bugungi yangi buyurtmalar/)).toHaveTextContent(/2 ta · 120\s000 so'm/);
    expect(screen.getByText("USB skaner tayyor")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ipak Yo'li Savdo yangi buyurtmalari" })).toBeInTheDocument();
  });

  it("buyurtmalar bo'sh bo'lsa nom marketlar ro'yxatidan olinadi", async () => {
    mocks.orders = [];
    mocks.marketsList = { data: [{ market_id: "121", market: { name: "Urgut Savdo" } }] };
    renderPage("superadmin");

    expect(await screen.findByRole("heading", { level: 1, name: "Urgut Savdo" })).toBeInTheDocument();
    expect(screen.getByText("Bugun yangi buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
  });

  it("qatorlar: №, mijoz, mahsulot, yetkazish, to'langan; tahrirlash havolasi", async () => {
    renderPage("superadmin");

    const table = await screen.findByRole("table", { name: "Yangi buyurtmalar" });
    const row = within(table).getByRole("checkbox", { name: "№o2 ni tanlash" }).closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: "№o2" })).toHaveAttribute("href", "/new-orders/121/edit/o2");
    expect(within(row).getByText("Vali")).toBeInTheDocument();
    expect(within(row).getByText(/Himoya oynasi/)).toBeInTheDocument();
    expect(within(row).getByText("Markazgacha")).toBeInTheDocument();
    expect(within(row).getByText(/20\s000 so'm to'langan/)).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "№o2 ni tahrirlash" })).toHaveAttribute(
      "href",
      "/new-orders/121/edit/o2",
    );
  });

  it("qabul oynasi: market, son, summa; tanlanmaganlar eslatmasi va faqat tanlanganlar yuboriladi", async () => {
    const user = userEvent.setup();
    renderPage("superadmin");

    await user.click(await screen.findByRole("checkbox", { name: "№o2 ni tanlash" }));
    expect(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).toHaveTextContent(
      /1 ta buyurtma tanlandi · 50\s000 so'm/,
    );
    await user.click(screen.getByRole("button", { name: "Qabul qilish — 1 ta buyurtma" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Qo'lda qabul qilish" });
    expect(dialog).toHaveTextContent("skanerlamasdan qabul qilishni tasdiqlaysizmi");
    expect(dialog).toHaveTextContent("Ipak Yo'li Savdo");
    expect(dialog).toHaveTextContent(/Buyurtmalar\s*1 ta/);
    expect(dialog).toHaveTextContent(/Jami summa\s*50\s000 so'm/);
    expect(dialog).toHaveTextContent("Tanlanmagan 1 ta buyurtma (№o2) ro'yxatda qoladi.");

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    expect(mocks.receiveMutate).toHaveBeenCalledWith({ orderIds: ["o1"] }, expect.any(Object));
  });

  it("filial nomi ma'lum bo'lsa (HQ registrator) — «… pochtasiga o'tkaziladi»", async () => {
    const user = userEvent.setup();
    renderPage("registrator", { branchType: "HQ", branchName: "Toshkent HQ" });

    await user.click(await screen.findByRole("button", { name: "Qabul qilish — 2 ta buyurtma" }));
    expect(await screen.findByRole("alertdialog", { name: "Qo'lda qabul qilish" })).toHaveTextContent(
      "Ular Toshkent HQ pochtasiga o'tkaziladi.",
    );
  });

  it("«Barchasini tanlash» ↔ «Tanlovni bekor qilish»; 0 tada qabul tugmasi o'chiq", async () => {
    const user = userEvent.setup();
    renderPage("superadmin");

    await user.click(await screen.findByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(screen.getByText("Buyurtma tanlanmagan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish — 0 ta buyurtma" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    expect(screen.getByRole("button", { name: "Qabul qilish — 2 ta buyurtma" })).toBeEnabled();
  });

  it("qidiruv: mijoz bo'yicha filtrlaydi; topilmasa — «Qidiruvni tozalash»", async () => {
    const user = userEvent.setup();
    renderPage("superadmin");

    const search = await screen.findByRole("searchbox", { name: "Buyurtmalarni qidirish" });
    await user.type(search, "Vali");
    expect(screen.queryByRole("checkbox", { name: "№o1 ni tanlash" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№o2 ni tanlash" })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Rustam");
    expect(screen.getByText("Bu qidiruv bo'yicha buyurtma topilmadi")).toBeInTheDocument();
    // Maydonning o'z «×» tugmasi ham shu nomda — bo'sh holatdagi amal oxirgisi.
    const clearButtons = screen.getAllByRole("button", { name: "Qidiruvni tozalash" });
    await user.click(clearButtons[clearButtons.length - 1]);
    expect(screen.getByRole("checkbox", { name: "№o1 ni tanlash" })).toBeInTheDocument();
  });

  it("o'chirish: oyna «№ · mijoz», «market · tuman», summa; tasdiqlansa DELETE", async () => {
    mocks.deleteMutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage("manager", { branchType: "HQ" });

    await user.click(await screen.findByRole("button", { name: "№o1 ni o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani o'chirish" });
    expect(dialog).toHaveTextContent("Bu buyurtma butunlay o'chiriladi. Davom etasizmi?");
    expect(dialog).toHaveTextContent("№o1 · Ali");
    expect(dialog).toHaveTextContent(/Ipak Yo'li Savdo\s*·\s*Chilonzor tumani/);
    expect(dialog).toHaveTextContent(/Jami summa\s*50\s000 so'm/);

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(mocks.deleteMutateAsync).toHaveBeenCalledWith("o1");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("o'chirish xatosi oynada ko'rinadi, oyna ochiq qoladi", async () => {
    mocks.deleteMutateAsync.mockRejectedValue(
      new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: { message: "Buyurtma allaqachon qabul qilingan" },
      } as AxiosResponse),
    );
    const user = userEvent.setup();
    renderPage("superadmin");

    await user.click(await screen.findByRole("button", { name: "№o2 ni o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    expect(await within(dialog).findByText(/allaqachon qabul qilingan/)).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Buyurtmani o'chirish" })).toBeInTheDocument();
  });

  it("transfer rejimi: «Paketlar» havolasi faqat /batches ga ruxsat bo'lsa", async () => {
    // PICKUP menejerida `intake` qobiliyati bor (MANAGER_CAPABILITIES) — `/batches` ochiq.
    const { unmount } = renderPage("manager", { branchType: "PICKUP" });
    const region = await screen.findByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(region).toHaveTextContent("Qabul qilinganlar HQ'ga jo'natish uchun yangi paketga qo'shiladi — Paketlar");
    expect(within(region).getByRole("link", { name: "Paketlar" })).toHaveAttribute("href", "/batches");
    unmount();

    renderPage("registrator", { branchType: "PICKUP" });
    const registratorRegion = await screen.findByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(registratorRegion).toHaveTextContent("— Paketlar");
    expect(within(registratorRegion).queryByRole("link", { name: "Paketlar" })).not.toBeInTheDocument();
  });

  it("qabul rejimida (superadmin) — oddiy izoh, paket havolasi yo'q", async () => {
    renderPage("superadmin");
    const region = await screen.findByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(region).toHaveTextContent("Chop etish va qabul qilish faqat tanlanganlarga qo'llanadi");
    expect(within(region).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("NewOrderDetail — EN tugma matni (birlik/ko'plik)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("«Receive — 1 order» / «Receive — 2 orders»", async () => {
    const user = userEvent.setup();
    renderPage("superadmin");

    expect(await screen.findByRole("button", { name: "Receive — 2 orders" })).toBeEnabled();
    await user.click(screen.getByRole("checkbox", { name: "Select №o2" }));
    expect(screen.getByRole("button", { name: "Receive — 1 order" })).toBeEnabled();
  });
});

describe("NewOrderDetail — market roli (o'z ro'yxati)", () => {
  it("tanlov, skaner va qabul yo'q; summa qatori; o'chirish va ochish", async () => {
    renderPage("market");

    expect(await screen.findByRole("table", { name: "Yangi buyurtmalar" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByText("USB skaner tayyor")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buyurtmalarni qidirish" })).toHaveAttribute(
      "placeholder",
      "Shu ro'yxatdan qidirish",
    );
    expect(screen.getByText(/Bugun ·/)).toHaveTextContent(/Bugun · 2 ta buyurtma · jami 120\s000 so'm/);
    expect(screen.getByRole("link", { name: "№o1 ni ochish" })).toHaveAttribute("href", "/new-orders/121/edit/o1");
    expect(screen.getByRole("button", { name: "№o1 ni o'chirish" })).toBeInTheDocument();
    // Sarlavha qobiqda — sahifa o'z h1 ini chizmaydi.
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("market o'chirish oynasi: mahsulot va yetkazish turi", async () => {
    const user = userEvent.setup();
    renderPage("market");

    await user.click(await screen.findByRole("button", { name: "№o1 ni o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani o'chirish" });
    expect(dialog).toHaveTextContent("№o1 · Ali");
    expect(dialog).toHaveTextContent("Telefon g'ilofi · 2 ta · Uygacha");
    expect(dialog).toHaveTextContent(/50\s000 so'm/);
  });

  it("qator bosilsa buyurtma ochiladi", async () => {
    const user = userEvent.setup();
    renderPage("market");

    await user.click(await screen.findByText("Vali"));
    expect(await screen.findByText("EDIT PAGE")).toBeInTheDocument();
  });
});
