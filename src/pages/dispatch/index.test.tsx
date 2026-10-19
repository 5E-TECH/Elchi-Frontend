import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import {
  addToDispatchBasket,
  DISPATCH_BASKET_TTL_MS,
  dispatchBasketStorageKey,
  resetDispatchBaskets,
} from "../../features/dispatch-basket";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";
import DispatchPage from "./index";

const mocks = vi.hoisted(() => ({
  useGetCouriers: vi.fn(),
  assign: vi.fn(),
  fetchScanDetail: vi.fn(),
  feedback: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetCouriers: mocks.useGetCouriers }),
}));

vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    assignCourier: { mutateAsync: mocks.assign, isPending: false },
  }),
}));

vi.mock("../scan/lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../scan/lib/scanResource")>()),
  fetchScanDetail: mocks.fetchScanDetail,
}));

vi.mock("../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.feedback,
}));

// Savat qurilmada (ega D2) — testlar bir-biriga savat qoldirmasin.
beforeEach(() => {
  window.localStorage.clear();
  resetDispatchBaskets();
  resetScanTargets();
});

const stateFor = (role: string, user: Record<string, unknown> | null) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user,
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

// HQ registratori: filial turi HQ, viloyat YO'Q (HQ ning region_id si NULL).
const HQ_SCOPE = { userId: "269", branchId: "1" };
const hqRegistrator = stateFor("registrator", {
  id: "269",
  role: "registrator",
  region_id: null,
  branch: { id: "1", type: "HQ", region_id: null },
});

type CourierItem = { id: string; name: string; phone_number?: string; region?: { name: string } | null };

const couriersResponse = (items: CourierItem[]) => ({
  data: { data: { items } },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const lastCourierQuery = () => {
  const calls = mocks.useGetCouriers.mock.calls;
  return calls[calls.length - 1] as [Record<string, unknown>, boolean | undefined];
};

const orderDetail = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  type: "order",
  data: {
    statusCode: 200,
    data: {
      id,
      status: "received",
      total_price: 185000,
      where_deliver: "address",
      createdAt: "2026-10-06T14:05:00.000Z",
      customer: { name, phone_number: "+998907421836" },
      district: { name: "Chilonzor tumani", region: { name: "Toshkent sh." } },
      market: { name: "Baraka Shop" },
      ...over,
    },
  },
});

/**
 * USB (HID) skaner: tez ketma-ket tugmalar + Enter (`useKeyboardScanner` oynada tinglaydi). Har skandan oldin
 * soat 1 s oldinga suriladi — skan darvozasining pauzasi (`blockScans(250)`) keyingi skanni yutmasin.
 */
let clock = 1_000_000;
const scan = async (value: string) => {
  clock += 1000;
  vi.spyOn(Date, "now").mockReturnValue(clock);
  await act(async () => {
    for (const key of value) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: "Enter" });
  });
};

describe("DispatchPage — kuryerlar ro'yxati", () => {
  beforeEach(() => {
    mocks.useGetCouriers.mockReturnValue(couriersResponse([{ id: "263", name: "HQ kuryer" }]));
  });

  it("HQ registratori: so'rov yoqilgan, region_id yo'q, faqat faol kuryerlar", () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    const [params, enabled] = lastCourierQuery();
    expect(enabled).toBe(true);
    expect(params).toEqual({ page: 1, limit: 100, status: "active" });
    expect(params).not.toHaveProperty("region_id");
  });

  it("viloyati bor menejer ham region_id yubormaydi — backend filialga o'zi cheklaydi", () => {
    renderWithProviders(<DispatchPage />, {
      preloadedState: stateFor("manager", {
        id: "198",
        role: "manager",
        region_id: "12",
        branch: { id: "15", type: "REGIONAL", region_id: "12" },
      }),
    });

    const [params, enabled] = lastCourierQuery();
    expect(enabled).toBe(true);
    expect(params).toEqual({ page: 1, limit: 100, status: "active" });
  });

  it("superadmin parametrlari o'zgarmagan", () => {
    renderWithProviders(<DispatchPage />, {
      preloadedState: stateFor("superadmin", { id: "1", role: "superadmin" }),
    });

    const [params, enabled] = lastCourierQuery();
    expect(enabled).toBe(true);
    expect(params).toEqual({ page: 1, limit: 100 });
  });

  it("kuryer bo'lmasa — bo'sh holat matni chiqadi va biriktirish tugmasi o'chiq", () => {
    mocks.useGetCouriers.mockReturnValue(couriersResponse([]));

    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.getByText("Filialda faol kuryer yo'q")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kuryerga biriktirish/ })).toBeDisabled();
  });

  it("kuryer yo'q: filial nomi bo'lsa — «… filialining faol kuryerlari», menejerga «Foydalanuvchilar» havolasi", () => {
    mocks.useGetCouriers.mockReturnValue(couriersResponse([]));

    renderWithProviders(<DispatchPage />, {
      preloadedState: stateFor("manager", {
        id: "198",
        role: "manager",
        branch: { id: "15", type: "REGIONAL", name: "Urgut filiali" },
      }),
    });

    expect(screen.getByText(/Ro'yxatda faqat Urgut filialining faol kuryerlari ko'rinadi\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Foydalanuvchilar" })).toHaveAttribute("href", "/all-users");
  });

  it("kuryer bor bo'lsa bo'sh holat matni chiqmaydi", () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.queryByText("Filialda faol kuryer yo'q")).not.toBeInTheDocument();
  });

  it("yuklanayotganda yoki xatoda bo'sh holat matni chiqmaydi", () => {
    mocks.useGetCouriers.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    const { unmount } = renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });
    expect(screen.queryByText("Filialda faol kuryer yo'q")).not.toBeInTheDocument();
    unmount();

    mocks.useGetCouriers.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });
    expect(screen.queryByText("Filialda faol kuryer yo'q")).not.toBeInTheDocument();
  });

  it("kuryerlar yuklanmasa — sahifa tepasida xato va «Qayta urinish» qayta so'raydi", async () => {
    const refetch = vi.fn();
    mocks.useGetCouriers.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const user = userEvent.setup();
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kuryerlar ro'yxatini yuklab bo'lmadi. Skanerlash mumkin, lekin biriktirish uchun qayta urinib ko'ring.",
    );
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Kuryerga biriktirish/ })).toBeDisabled();
  });
});

describe("DispatchPage — skanerlash va biriktirish", () => {
  beforeEach(() => {
    mocks.useGetCouriers.mockReturnValue(couriersResponse([{ id: "263", name: "HQ kuryer" }]));
    mocks.fetchScanDetail.mockReset();
    mocks.assign.mockReset();
    mocks.assign.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bo'sh ro'yxat: «Hali buyurtma qo'shilmagan» va skanerlash ko'rsatmasi", () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.getByRole("heading", { level: 1, name: "Kuryerga biriktirish" })).toBeInTheDocument();
    expect(screen.getByText("Hali buyurtma qo'shilmagan")).toBeInTheDocument();
    expect(screen.getByText("Buyurtma QR kodlarini skanerlang")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuryerga biriktirish — 0 ta" })).toBeDisabled();
  });

  it("USB skaner buyurtmani ro'yxatga qo'shadi va tanlaydi", async () => {
    mocks.fetchScanDetail.mockResolvedValue(orderDetail("10285", "Zarina Mirzayeva"));
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-10285");

    expect(await screen.findByText("№10285")).toBeInTheDocument();
    expect(mocks.fetchScanDetail).toHaveBeenCalledWith("tok-10285");
    expect(screen.getByRole("checkbox", { name: "№10285 ni tanlash" })).toBeChecked();
    expect(screen.getByText("1 ta buyurtma qo'shilgan")).toBeInTheDocument();
    expect(screen.getByText("Qabul qilindi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuryerga biriktirish — 1 ta" })).toBeEnabled();
  });

  it("takror skan — ogohlantirish, qayta so'ralmaydi", async () => {
    mocks.fetchScanDetail.mockResolvedValue(orderDetail("10285", "Zarina Mirzayeva"));
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-10285");
    expect(await screen.findByText("№10285")).toBeInTheDocument();

    // Takror darvozasidan (2,6 s) keyin — ro'yxatda bor buyurtma.
    clock += 5000;
    await scan("tok-10285");

    expect(await screen.findByText("Bu buyurtma allaqachon ro'yxatga qo'shilgan")).toBeInTheDocument();
    expect(mocks.fetchScanDetail).toHaveBeenCalledTimes(1);
  });

  it("paket QR — «Faqat buyurtma QR kodlarini skanerlash mumkin», so'rov yuborilmaydi", async () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("BTB-0412");

    expect(await screen.findByRole("alert")).toHaveTextContent("Faqat buyurtma QR kodlarini skanerlash mumkin");
    expect(mocks.fetchScanDetail).not.toHaveBeenCalled();
  });

  it("tekshiruv ketayotganda «N ta buyurtma tekshirilmoqda...» va biriktirish o'chiq", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.fetchScanDetail.mockReturnValue(new Promise((done) => (resolve = done)));
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-10285");

    expect(await screen.findByText("1 ta buyurtma tekshirilmoqda...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kuryerga biriktirish/ })).toBeDisabled();

    await act(async () => resolve(orderDetail("10285", "Zarina Mirzayeva")));
    expect(await screen.findByText("№10285")).toBeInTheDocument();
    expect(screen.queryByText("1 ta buyurtma tekshirilmoqda...")).not.toBeInTheDocument();
  });

  it("bitta kuryer — oynasiz to'g'ridan-to'g'ri biriktiriladi, biriktirilganlar ro'yxatdan olinadi", async () => {
    const user = userEvent.setup();
    mocks.fetchScanDetail.mockResolvedValue(orderDetail("10285", "Zarina Mirzayeva"));
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-10285");
    await user.click(await screen.findByRole("button", { name: "Kuryerga biriktirish — 1 ta" }));

    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith({ courier_id: "263", order_ids: ["10285"] }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("1 ta buyurtma HQ kuryerga biriktirildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("№10285")).not.toBeInTheDocument());
  });

  it("bir nechta kuryer — oyna: tanlangach biriktiradi, tanlanmagan buyurtma ro'yxatda qoladi", async () => {
    mocks.useGetCouriers.mockReturnValue(
      couriersResponse([
        { id: "263", name: "Jasur Tursunov", phone_number: "+998904121855", region: { name: "Toshkent sh." } },
        { id: "264", name: "Sherzod Komilov", phone_number: "+998932204710", region: null },
      ]),
    );
    mocks.fetchScanDetail.mockImplementation(async (token: string) =>
      token === "tok-1" ? orderDetail("10285", "Zarina Mirzayeva") : orderDetail("10282", "Jahongir Alimov"),
    );
    const user = userEvent.setup();
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-1");
    expect(await screen.findByText("№10285")).toBeInTheDocument();
    await scan("tok-2");
    expect(await screen.findByText("№10282")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "№10282 ni tanlash" }));

    await user.click(screen.getByRole("button", { name: "Kuryerga biriktirish — 1 ta" }));
    const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });
    expect(dialog).toHaveTextContent("1 ta buyurtma shu kuryerga biriktiriladi");
    const submit = within(dialog).getByRole("button", { name: "Biriktirish — 1 ta" });
    expect(submit).toBeDisabled();

    // Qidiruv — yuklangan ro'yxat ichida, telefon raqami bo'yicha ham.
    await user.type(within(dialog).getByRole("searchbox", { name: "Kuryerni qidirish" }), "220 47");
    expect(within(dialog).queryByRole("radio", { name: /Jasur Tursunov/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: /Sherzod Komilov/ }));
    await user.click(submit);

    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith({ courier_id: "264", order_ids: ["10285"] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("1 ta buyurtma Sherzod Komilovga biriktirildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("№10285")).not.toBeInTheDocument());
    expect(screen.getByText("№10282")).toBeInTheDocument();
  });

  it("kuryer oynasi: qidiruv tanlangan kuryerni yashirsa — «Biriktirish» o'chadi, so'rov ketmaydi", async () => {
    mocks.useGetCouriers.mockReturnValue(
      couriersResponse([
        { id: "263", name: "Jasur Tursunov" },
        { id: "264", name: "Sherzod Komilov" },
      ]),
    );
    mocks.fetchScanDetail.mockResolvedValue(orderDetail("10285", "Zarina Mirzayeva"));
    const user = userEvent.setup();
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-10285");
    await user.click(await screen.findByRole("button", { name: "Kuryerga biriktirish — 1 ta" }));
    const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });
    const submit = within(dialog).getByRole("button", { name: "Biriktirish — 1 ta" });
    await user.click(within(dialog).getByRole("radio", { name: /Jasur Tursunov/ }));
    expect(submit).toBeEnabled();

    await user.click(within(dialog).getByRole("searchbox", { name: "Kuryerni qidirish" }));
    await user.paste("Sherzod");
    expect(within(dialog).queryByRole("radio", { name: /Jasur Tursunov/ })).not.toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.assign).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByRole("searchbox", { name: "Kuryerni qidirish" }));
    expect(within(dialog).getByRole("radio", { name: /Jasur Tursunov/ })).toBeChecked();
    expect(submit).toBeEnabled();
  });

  it("biriktirish xatosi — xato xabari, oyna ochiq qoladi, ro'yxat o'zgarmaydi", async () => {
    mocks.useGetCouriers.mockReturnValue(
      couriersResponse([
        { id: "263", name: "Jasur Tursunov" },
        { id: "264", name: "Sherzod Komilov" },
      ]),
    );
    mocks.fetchScanDetail.mockResolvedValue(orderDetail("10285", "Zarina Mirzayeva"));
    mocks.assign.mockRejectedValue({ response: { data: { message: "Buyurtma kuryerga biriktirib bo'lmaydi" } } });
    const user = userEvent.setup();
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-10285");
    await user.click(await screen.findByRole("button", { name: "Kuryerga biriktirish — 1 ta" }));
    const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });
    await user.click(within(dialog).getByRole("radio", { name: /Jasur Tursunov/ }));
    await user.click(within(dialog).getByRole("button", { name: "Biriktirish — 1 ta" }));

    expect(await screen.findByText("Buyurtma kuryerga biriktirib bo'lmaydi")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Kuryerni tanlang" })).toBeInTheDocument();
    expect(screen.getByText("№10285")).toBeInTheDocument();
  });

  it("`/scan/:token` savatga qo'shgan buyurtma sahifada tanlangan holda turadi — qayta so'ralmaydi", async () => {
    addToDispatchBasket(HQ_SCOPE, {
      id: "10316",
      token: "tok-10316",
      market: "Nur Elektronika",
      name: "Aziz Rahimov",
      phone: null,
      district: "Pastdarg'om tumani",
      region: null,
      amount: 232500,
      deliveryKind: "home",
      createdAt: null,
      status: "received",
    });
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(await screen.findByText("№10316")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№10316 ni tanlash" })).toBeChecked();
    expect(mocks.fetchScanDetail).not.toHaveBeenCalled();
  });

  it("savat qurilmada saqlanadi: sahifa qayta ochilganda buyurtmalar va tanlov joyida", async () => {
    mocks.fetchScanDetail.mockImplementation(async (token: string) =>
      token === "tok-1" ? orderDetail("10285", "Zarina Mirzayeva") : orderDetail("10282", "Jahongir Alimov"),
    );
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-1");
    expect(await screen.findByText("№10285")).toBeInTheDocument();
    await scan("tok-2");
    expect(await screen.findByText("№10282")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "№10282 ni tanlash" }));
    unmount();

    // Yangi sessiya (sahifa yangilandi): xotira tozalangan, savat qurilmadan o'qiladi.
    resetDispatchBaskets();
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(await screen.findByText("№10285")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№10285 ni tanlash" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "№10282 ni tanlash" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Kuryerga biriktirish — 1 ta" })).toBeEnabled();
  });

  it("savat boshqa foydalanuvchi yoki filialga ko'rinmaydi, eskirgan yozuv tashlanadi", async () => {
    const stale = Date.now() - DISPATCH_BASKET_TTL_MS - 60_000;
    window.localStorage.setItem(
      dispatchBasketStorageKey(HQ_SCOPE),
      JSON.stringify({ items: [{ order: { id: "10200", token: "tok-old" }, selected: true, addedAt: stale }] }),
    );
    addToDispatchBasket({ userId: "269", branchId: "2" }, { ...BASKET_ORDER, id: "10201", token: "tok-other-branch" });
    addToDispatchBasket({ userId: "300", branchId: "1" }, { ...BASKET_ORDER, id: "10202", token: "tok-other-user" });

    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.getByText("Hali buyurtma qo'shilmagan")).toBeInTheDocument();
    expect(screen.queryByText("№10200")).not.toBeInTheDocument();
    expect(screen.queryByText("№10201")).not.toBeInTheDocument();
    expect(screen.queryByText("№10202")).not.toBeInTheDocument();
    // Eskirgani qurilmadan ham olib tashlandi.
    await waitFor(() => expect(window.localStorage.getItem(dispatchBasketStorageKey(HQ_SCOPE))).toBeNull());
  });

  it("qatordan olib tashlash va «Tanlovni bekor qilish»", async () => {
    mocks.fetchScanDetail.mockImplementation(async (token: string) =>
      token === "tok-1" ? orderDetail("10285", "Zarina Mirzayeva") : orderDetail("10282", "Jahongir Alimov"),
    );
    const user = userEvent.setup();
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await scan("tok-1");
    expect(await screen.findByText("№10285")).toBeInTheDocument();
    await scan("tok-2");
    expect(await screen.findByText("№10282")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(screen.getByRole("button", { name: "Kuryerga biriktirish — 0 ta" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "№10285 ni ro'yxatdan olib tashlash" }));
    expect(screen.queryByText("№10285")).not.toBeInTheDocument();
    expect(screen.getByText("1 ta buyurtma qo'shilgan")).toBeInTheDocument();
  });
});

const BASKET_ORDER = {
  id: "10316",
  token: "tok-10316",
  market: null,
  name: "Aziz Rahimov",
  phone: null,
  district: null,
  region: null,
  amount: 0,
  deliveryKind: null,
  createdAt: null,
  status: null,
} as const;

describe("DispatchPage — kamera (markaziy «Skaner» tugmasi)", () => {
  beforeEach(() => {
    mocks.useGetCouriers.mockReturnValue(couriersResponse([{ id: "263", name: "HQ kuryer" }]));
    mocks.fetchScanDetail.mockReset();
  });

  const target = () => {
    const active = getActiveScanTarget();
    if (!active) throw new Error("kamera maqsadi yo'q");
    return active;
  };

  it("maqsad: «Biriktirish · <filial> · savatda N ta», hisoblagich, sahifada «Kamera» tugmasi yo'q", () => {
    renderWithProviders(<DispatchPage />, {
      preloadedState: stateFor("manager", {
        id: "198",
        role: "manager",
        branch: { id: "15", type: "REGIONAL", name: "Urgut filiali" },
      }),
    });

    expect(target()).toMatchObject({
      id: "dispatch",
      title: "Biriktirish",
      context: "Urgut filiali · savatda 0 ta",
      hint: "Buyurtma yorlig'idagi QR kodni ramkaga oling",
      progress: { done: 0, label: "ta skanerlandi · 0 tasi tanlangan" },
      finish: { label: "Tugatish" },
    });
    expect(screen.queryByRole("button", { name: /Kamera/ })).not.toBeInTheDocument();
  });

  it("kamera skani USB bilan bir handler: buyurtma savatga qo'shiladi, ro'yxatda «Bekor qilish» savatdan oladi", async () => {
    mocks.fetchScanDetail.mockResolvedValue(orderDetail("10285", "Zarina Mirzayeva"));
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await act(async () => {
      await target().onScan("tok-10285", "camera");
    });

    expect(await screen.findByText("№10285")).toBeInTheDocument();
    expect(mocks.fetchScanDetail).toHaveBeenCalledWith("tok-10285");
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Qo'shildi №10285");
    await waitFor(() => expect(target().progress).toMatchObject({ done: 1, label: "ta skanerlandi · 1 tasi tanlangan" }));
    expect(target().context).toBe("Savatda 1 ta");
    expect(target().list?.[0]).toMatchObject({
      key: "order:10285",
      title: "№10285 · Zarina Mirzayeva",
      tone: "success",
    });

    act(() => target().list![0].onUndo!());
    await waitFor(() => expect(screen.queryByText("№10285")).not.toBeInTheDocument());
    expect(target().list).toEqual([]);
  });

  it("paket QR — rad etiladi: ro'yxatda «Paket … · Rad etildi», savatga kirmaydi, so'rov yo'q", async () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    await act(async () => {
      await target().onScan("BTB-0418", "manual");
    });

    expect(mocks.fetchScanDetail).not.toHaveBeenCalled();
    expect(mocks.feedback).toHaveBeenLastCalledWith(
      "error",
      "Noto'g'ri QR turi — buyurtma yorlig'idagi QR kodni skanerlang",
    );
    await waitFor(() =>
      expect(target().list?.[0]).toMatchObject({
        title: "Paket BTB-0418",
        subtitle: "Rad etildi · buyurtma QR kodi emas",
        tone: "danger",
      }),
    );
    expect(target().progress?.done).toBe(0);
  });
});
