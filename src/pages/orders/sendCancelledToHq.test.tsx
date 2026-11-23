import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget } from "../../shared/lib/scanner/scanTargets";
import { api } from "../../shared/api/api";

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

/** Ro'yxatning joriy javobi va jami soni (60 s yangilanishni / ko'p sahifali tabni taqlid qilish uchun almashtiriladi). */
let listRows: unknown[] = rows;
let listTotal = rows.length;

// GaBIPi3Z: holat tablari sonlari — bu testlar ro'yxat va oynalarni tekshiradi (sonlar `statusCounts.test.tsx` da).
vi.mock("../../entities/order/api/orderStatusCounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/order/api/orderStatusCounts")>()),
  useOrderStatusCounts: () => ({ data: undefined, isPlaceholderData: false, isFetching: false, refetch: async () => undefined }),
}));
vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: () => ({
      data: { data: listRows, total: listTotal, page: 1, limit: 10 },
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

  it("kamera (markaziy «Skaner»): «HQ'ga yuborish» maqsadi, skan tanlaydi; jo'natilgani «allaqachon yuborilgan» (#64)", async () => {
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
        ["№10295", "Rad etildi · allaqachon yuborilgan", "danger"],
        ["№10298 · Bekzod Aliyev", "Urgut tumani · 96 000 so'm", "success"],
      ]),
    );

    act(() => getActiveScanTarget()!.list![1].onUndo!());
    expect(screen.getByRole("checkbox", { name: "№10298 ni tanlash" })).not.toBeChecked();
  });

  it("ko'rinib turgan jo'natilgan qator (USB) — «Allaqachon yuborilgan», «Buyurtma topilmadi» emas (#64)", async () => {
    renderWithProviders(<Orders />, {
      route: "/orders?status=cancelled,cancelled%20(sent)",
      preloadedState: managerState("HYBRID"),
    });

    act(() => {
      void getActiveScanTarget()!.onScan("10295", "manual");
    });

    expect(await screen.findByText("Allaqachon yuborilgan")).toBeInTheDocument();
    expect(screen.getByText("№10295 bekor qilinganlar pochtasi bilan yuborilgan — qayta yuborilmaydi")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma topilmadi")).not.toBeInTheDocument();
  });

  it("begona QR (403 order_not_in_your_branch, #620): lokal sarlavha, «Buyurtma topilmadi» va backend matni yo'q", async () => {
    const get = vi.spyOn(api, "get").mockImplementation((url: string) =>
      url.includes("qr-code")
        ? Promise.reject(
            Object.assign(new Error("Forbidden"), {
              response: {
                status: 403,
                data: { statusCode: 403, message: "backend matni", data: { reason: "order_not_in_your_branch" } },
              },
            }),
          )
        : Promise.reject(new Error(`kutilmagan so'rov: ${url}`)),
    );
    renderWithProviders(<Orders />, {
      route: "/orders?status=cancelled,cancelled%20(sent)",
      preloadedState: managerState("HYBRID"),
    });

    act(() => {
      void getActiveScanTarget()!.onScan("f2f2f2f2f2f2f2f2f2f2f2f2", "camera");
    });

    expect(await screen.findByText("Bu buyurtma sizning filialingizda emas")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma topilmadi")).not.toBeInTheDocument();
    expect(screen.queryByText("backend matni")).not.toBeInTheDocument();
    get.mockRestore();
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

/**
 * Skan auditi 2026-11-23: sahifada yo'q kod (#52), «o'xshash mijoz» evristikasi (#54), qidiruv xatosi (#56) va 60 s
 * yangilanishda tanlov (#65). Kod — 24 hex token; server javobi (`GET orders/qr-code/:token`) — `api.get` soxtasi.
 */
describe("Orders — «Bekor qilingan» tabida skan: sahifadan mustaqil, faqat aniq buyurtma", () => {
  const TOKEN = "c0ffee00c0ffee00c0ffee00";
  const route = "/orders?status=cancelled,cancelled%20(sent)";

  const mockQr = (result: { data?: unknown; error?: unknown }) =>
    vi.spyOn(api, "get").mockImplementation((url: string) => {
      if (url.includes("qr-code")) {
        return result.error ? Promise.reject(result.error) : Promise.resolve({ data: { statusCode: 200, data: result.data } });
      }
      return Promise.reject(Object.assign(new Error("Not found"), { response: { status: 404 } }));
    });

  /** Bekzod Aliyev (c-1) ning boshqa, sahifada yo'q buyurtmasi — `10298` bilan bir mijoz, market va tuman. */
  const offPage = (patch: Record<string, unknown> = {}) => ({
    id: "10400",
    qr_code_token: TOKEN,
    status: "cancelled",
    market_id: "201",
    customer_id: "c-1",
    district_id: "5",
    region_id: "12",
    where_deliver: "address",
    total_price: 150000,
    market: { id: "201", name: "Baraka Shop" },
    customer: { id: "c-1", name: "Bekzod Aliyev", phone_number: "+998913302774" },
    district: { id: "5", name: "Urgut tumani" },
    ...patch,
  });

  beforeEach(() => {
    // Tab 2 sahifa (12 ta): sahifadagi 3 qatordan tashqari bekorlar ham bor.
    listTotal = 12;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    listRows = rows;
    listTotal = rows.length;
  });

  it("boshqa sahifadagi bekor — o'zi tanlanadi (o'xshash qator emas), qayta skan «Allaqachon tanlangan», yuboriladi", async () => {
    const get = mockQr({ data: offPage() });
    const user = userEvent.setup();
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "camera");
    });

    const bar = await screen.findByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(within(bar).getByText("1 ta buyurtma tanlandi")).toBeInTheDocument();
    // Bir xil mijoz + market + tumandagi sahifadagi qator TANLANMAYDI (#54).
    expect(screen.getByRole("checkbox", { name: "№10298 ni tanlash" })).not.toBeChecked();
    expect(getActiveScanTarget()).toMatchObject({ progress: { done: 1, total: 3 } });
    expect(getActiveScanTarget()?.list?.[0]).toMatchObject({
      key: "order:10400",
      title: "№10400 · Bekzod Aliyev",
      subtitle: "Urgut tumani · 150 000 so'm",
      tone: "success",
    });

    // Qayta skan — so'rovsiz, «Allaqachon tanlangan».
    get.mockClear();
    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "camera");
    });
    expect(await screen.findByText("Allaqachon tanlangan")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();

    await user.click(within(bar).getByRole("button", { name: "HQ'ga yuborish" }));
    expect(sendToPost).toHaveBeenLastCalledWith(["10400"], expect.anything());
  });

  it("o'sha mijozning bekor qilinmagan buyurtmasi — «Bekor qilinmagan», sahifadagi qator tanlanmaydi (#54)", async () => {
    mockQr({ data: offPage({ status: "waiting" }) });
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "camera");
    });

    await waitFor(() =>
      expect(getActiveScanTarget()?.list?.map((item) => [item.title, item.subtitle])).toEqual([
        ["№10400", "Rad etildi · yuborib bo'lmaydi"],
      ]),
    );
    expect(screen.getByRole("checkbox", { name: "№10298 ni tanlash" })).not.toBeChecked();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
  });

  it("sahifada yo'q, allaqachon yuborilgan — «Allaqachon yuborilgan» (#64)", async () => {
    mockQr({ data: offPage({ status: "cancelled (sent)" }) });
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "manual");
    });

    expect(await screen.findByText("Allaqachon yuborilgan")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
  });

  it("joriy filtrga (market) mos kelmaydi — «Filtrga mos emas», tanlanmaydi", async () => {
    mockQr({ data: offPage({ market_id: "999", market: { id: "999", name: "Boshqa" } }) });
    renderWithProviders(<Orders />, { route: `${route}&orderMarketId=201`, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "manual");
    });

    expect(await screen.findByText("Filtrga mos emas")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
  });

  it("server tanimagan kod (404) — «Buyurtma topilmadi», kamera ro'yxatida «topilmadi»", async () => {
    mockQr({ error: Object.assign(new Error("Not found"), { response: { status: 404, data: { message: "Buyurtma topilmadi" } } }) });
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "manual");
    });

    expect(await screen.findByText("Bu QR kod bo'yicha buyurtma topilmadi")).toBeInTheDocument();
    expect(getActiveScanTarget()?.list?.[0]).toMatchObject({ title: TOKEN, subtitle: "Rad etildi · topilmadi" });
  });

  it("tarmoq xatosi / 5xx / 429 — «Tekshirib bo'lmadi — qayta skanerlang», «Buyurtma topilmadi» emas (#56)", async () => {
    const get = mockQr({ error: { isAxiosError: true, code: "ERR_NETWORK", request: {}, message: "Network Error" } });
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "manual");
    });

    expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(screen.getAllByText("Tekshirib bo'lmadi — qayta skanerlang").length).toBeGreaterThan(0);
    expect(screen.queryByText("Buyurtma topilmadi")).not.toBeInTheDocument();
    // Rad etilganlar ro'yxatiga tushmaydi — qayta skan odatda o'tadi.
    expect(getActiveScanTarget()?.list).toEqual([]);

    get.mockImplementation(() =>
      Promise.reject(Object.assign(new Error("Too Many Requests"), { response: { status: 429, data: { message: "ThrottlerException" } } })),
    );
    act(() => {
      void getActiveScanTarget()!.onScan(TOKEN, "manual");
    });
    expect(await screen.findByText("So'rovlar juda ko'p — bir necha soniya kutib, qayta skanerlang")).toBeInTheDocument();
  });

  it("ro'yxat surilsa (60 s yangilanish, sahifa almashishi) — tanlangan buyurtma tanlovdan JIM tushmaydi (#65)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan("10298", "camera");
    });
    expect(within(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).getByText("1 ta buyurtma tanlandi")).toBeInTheDocument();

    // Keyingi javobda 10298 joriy sahifada yo'q (yangi bekorlar qo'shilib ro'yxat surildi / boshqa sahifa).
    listRows = [
      { ...rows[1], id: "10500", customer: { id: "c-9", name: "Yangi Mijoz", phone_number: "+998900000000" } },
      rows[1],
      rows[2],
    ];
    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));

    expect(await screen.findByRole("checkbox", { name: "№10500 ni tanlash" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).getByText("1 ta buyurtma tanlandi")).toBeInTheDocument();
    await waitFor(() => expect(getActiveScanTarget()?.list?.[0]).toMatchObject({ key: "order:10298", title: "№10298" }));
  });

  it("butun tab bitta sahifada — ro'yxatdan chiqqan (boshqa qurilmada yuborilgan) buyurtma tanlovdan chiqadi", async () => {
    const user = userEvent.setup();
    listTotal = rows.length;
    renderWithProviders(<Orders />, { route, preloadedState: managerState("HYBRID") });

    act(() => {
      void getActiveScanTarget()!.onScan("10298", "camera");
    });
    expect(within(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).getByText("1 ta buyurtma tanlandi")).toBeInTheDocument();

    listRows = [rows[1], rows[2]];
    listTotal = 2;
    await user.click(screen.getByRole("checkbox", { name: "№10296 ni tanlash" }));

    const bar = screen.getByRole("region", { name: "Tanlangan buyurtmalar" });
    await waitFor(() => expect(within(bar).getByText("1 ta buyurtma tanlandi")).toBeInTheDocument());
    await user.click(within(bar).getByRole("button", { name: "HQ'ga yuborish" }));
    expect(sendToPost).toHaveBeenLastCalledWith(["10296"], expect.anything());
  });
});
