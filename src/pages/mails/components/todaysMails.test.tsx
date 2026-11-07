import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import TodaysMails from "./todaysMails";
import { renderWithProviders } from "../../../test/test-utils";
import { api } from "../../../shared/api/api";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";

const getNewMailsMock = vi.fn();
const getNewMailsCourierMock = vi.fn();

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetNewMails: getNewMailsMock,
    useGetNewMailsCourier: getNewMailsCourierMock,
  }),
}));

/** «Filial» ustuni nomlari — `GET branches` (superadmin, admin; `model/mailBranchNames.ts`). */
const branchesMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: {
      data: [
        { id: "1", name: "HQ Toshkent" },
        { id: "16", name: "Urgut filiali" },
      ],
    },
  })),
);
vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  useBranches: branchesMock,
}));

const roleState = (role: string) => ({ role: { id: "1", role, region: null, name: role } });

/** Menejer filial turi bilan (HQ — jadval, qolganlari — kartalar; `model/mailsCardView.ts`). */
const managerState = (branchType: string) => ({
  ...roleState("manager"),
  user: {
    user: { id: "m-1", role: "manager", branch: { id: "1", type: branchType } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
});

/** Router holati (`state`) ham ko'rinsin — tafsilotga o'tishda fix3 zaxira viloyati shu bilan boradi. */
const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <output data-testid="location-state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
};

const renderToday = (layout: "card" | "page" = "card", role = "superadmin", state: unknown = roleState(role)) =>
  renderWithProviders(
    <>
      <TodaysMails layout={layout} />
      <LocationProbe />
    </>,
    { route: "/mails/today", preloadedState: state as never },
  );

const dateOf = (iso: string) => formatDateTimeLocalized(iso, { language: "uz" });

/** Kartalar to'ridagi havolalar tartibi (har karta — bitta `<li>` ichida bitta havola). */
const cardLinks = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("link"));

/** Menejer zaxirasi `GET orders?status=on the road` — tarmoqqa chiqmasin. */
const silenceManagerFallback = () => {
  const fallbackSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
  onTestFinished(() => fallbackSpy.mockRestore());
};

const mail = (id: string, region: { id: string; name: string } | null, orders: number, amount: number, createdAt: string) => ({
  id,
  createdAt,
  updatedAt: createdAt,
  courier_id: "0",
  post_total_price: amount,
  order_quantity: orders,
  qr_code_token: `qr-${id}`,
  region_id: region?.id ?? "99",
  region,
  status: "new",
});

const MAILS = [
  mail("2486", { id: "1", name: "Andijon" }, 18, 3_420_000, "2026-10-08T05:12:00.000Z"),
  mail("2485", { id: "2", name: "Buxoro" }, 12, 2_160_000, "2026-10-08T04:58:00.000Z"),
  mail("2484", { id: "1", name: "Andijon" }, 3, 120_000, "2026-10-07T04:41:00.000Z"),
];

const loaded = (data: unknown[]) => ({
  data: { data: { data } },
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

/** Telefon (< 768): jadval o'rniga kartalar. */
const mockPhone = () =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

describe("TodaysMails", () => {
  beforeEach(() => {
    getNewMailsMock.mockReturnValue(loaded([]));
    getNewMailsCourierMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the loading state while the list loads", () => {
    getNewMailsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });

    const { container } = renderToday();

    expect(container.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-preset="table"], [data-skeleton]')).not.toBeNull();
  });

  it("renders empty state", () => {
    renderToday();

    expect(screen.getByText("Bugun yangi pochta yo'q")).toBeInTheDocument();
  });

  it("renders mail rows, the «Yangi» badge and the summary", () => {
    getNewMailsMock.mockReturnValue(loaded(MAILS));

    renderToday();

    const table = screen.getByRole("table", { name: "Bugungi pochtalar" });
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Pochta", "Viloyat", "Holat", "Buyurtmalar", "Summa", "Amallar"]);
    expect(within(table).getByRole("link", { name: "№2486" })).toHaveAttribute("href", "/mails/2486");
    expect(within(table).getByRole("link", { name: "№2486 pochtani ochish" })).toBeInTheDocument();
    expect(within(table).getByText("18 ta")).toBeInTheDocument();
    expect(within(table).getByText("3 420 000 so'm")).toBeInTheDocument();
    expect(within(table).getAllByText("Yangi")).toHaveLength(3);
    // Xulosa: turli viloyatlar (Andijon ikki marta) · buyurtmalar · jami.
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "2 ta viloyat · 33 ta buyurtma · jami 5 700 000 so'm")).toBeInTheDocument();
  });

  it("superadmin: «Kuryer» o'rnida «Filial» — faqat pochtada filial bo'lsa (YANGI pochtada filial yo'q)", () => {
    getNewMailsMock.mockReturnValue(
      loaded([{ ...MAILS[0], branch_id: "16", courier: { id: "7", name: "Jasur Tursunov" } }, MAILS[1]]),
    );

    const { unmount } = renderToday();

    const table = screen.getByRole("table", { name: "Bugungi pochtalar" });
    expect(within(table).getByRole("columnheader", { name: "Filial" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    // Ustun (≥ 1024) va planshet nusxasi (viloyat ostida); kuryer ismi jadvalda yo'q.
    expect(within(table).getAllByText("Urgut filiali").length).toBeGreaterThan(0);
    expect(within(table).queryByText("Jasur Tursunov")).not.toBeInTheDocument();
    unmount();

    // Filialsiz (jo'natilmagan) pochtalar — ustun chizilmaydi, nomlar so'ralmaydi.
    branchesMock.mockClear();
    getNewMailsMock.mockReturnValue(loaded(MAILS));
    renderToday("card", "admin");
    expect(screen.queryByRole("columnheader", { name: "Filial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(branchesMock.mock.calls.every((call) => !(call as unknown[])[1])).toBe(true);
  });

  it("filters by region on the client and clears the filter", async () => {
    const user = userEvent.setup();
    getNewMailsMock.mockReturnValue(loaded(MAILS));

    renderToday();

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.click(await screen.findByRole("option", { name: "Buxoro" }));

    const table = screen.getByRole("table", { name: "Bugungi pochtalar" });
    expect(within(table).getByRole("link", { name: "№2485" })).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "№2486" })).not.toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "1 ta viloyat · 12 ta buyurtma · jami 2 160 000 so'm")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(screen.getByRole("link", { name: "№2486" })).toBeInTheDocument();
  });

  it("opens the mail with the fix3 fallback region state", async () => {
    const user = userEvent.setup();
    getNewMailsMock.mockReturnValue(loaded(MAILS));

    renderToday();
    await user.click(screen.getByRole("link", { name: "№2486 pochtani ochish" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/mails/2486");
    expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual({
      fromTab: "today",
      fallbackRegionId: "1",
      fallbackRegionName: "Andijon",
      expectedOrderCount: 18,
    });
  });

  it("falls back to «Viloyat N» when the region name is missing", () => {
    getNewMailsMock.mockReturnValue(loaded([mail("2490", null, 1, 10_000, "2026-10-08T05:00:00.000Z")]));

    renderToday();

    expect(screen.getByText("Viloyat 99")).toBeInTheDocument();
  });

  it("⭐ menejer: asosiy ro'yxat bor — zaxira `GET orders?status=on the road` yuborilmaydi; bo'sh — yuboriladi", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    onTestFinished(() => get.mockRestore());
    const fallbackCalls = () => get.mock.calls.filter(([url]) => url === "orders");

    getNewMailsMock.mockReturnValue(loaded(MAILS));
    const { unmount } = renderToday("page", "manager", managerState("HQ"));
    await screen.findAllByText(/2486/);
    expect(fallbackCalls()).toHaveLength(0);
    unmount();

    getNewMailsMock.mockReturnValue(loaded([]));
    renderToday("page", "manager", managerState("HQ"));
    await vi.waitFor(() => expect(fallbackCalls()).toHaveLength(1));
    expect(fallbackCalls()[0][1]).toMatchObject({ params: { status: "on the road", limit: 100 } });
  });

  it("HQ manager keeps the table: «ta pochta» summary, no courier column, phone card «Pochta №X»", () => {
    // Menejer zaxirasi `GET orders?status=on the road` — tarmoqqa chiqmasin; xatosi keyingi testga «Internet aloqasi
    // yo'q» xabarini (ikkinchi «Qayta urinish») tashlardi.
    silenceManagerFallback();
    getNewMailsMock.mockReturnValue(loaded([{ ...MAILS[0], courier: { id: "7", name: "Jasur Tursunov" } }]));

    const { unmount } = renderToday("card", "manager", managerState("HQ"));
    expect(screen.getByRole("table", { name: "Bugungi pochtalar" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Bugungi pochtalar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "1 ta pochta · 18 ta buyurtma · jami 3 420 000 so'm")).toBeInTheDocument();
    unmount();

    mockPhone();
    renderToday("card", "manager", managerState("HQ"));
    const card = screen.getByRole("link", { name: /Pochta №2486/ });
    expect(card).toHaveTextContent("Pochta №2486");
    expect(card).toHaveTextContent("Andijon · 18 ta buyurtma ·");
  });

  it.each(["superadmin", "admin", "registrator"])("%s keeps the table (HQ staff)", (role) => {
    getNewMailsMock.mockReturnValue(loaded(MAILS));

    renderToday("card", role);

    expect(screen.getByRole("table", { name: "Bugungi pochtalar" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Bugungi pochtalar" })).not.toBeInTheDocument();
  });

  it.each(["REGIONAL", "HYBRID"])(
    "branch manager (%s): one date card per post, newest first, summary kept, same router state",
    async (branchType) => {
      const user = userEvent.setup();
      silenceManagerFallback();
      // API tartibi aralash — kartalar sana bo'yicha kamayishda.
      getNewMailsMock.mockReturnValue(
        loaded([MAILS[2], { ...MAILS[0], courier: { id: "7", name: "Jasur Tursunov" } }, MAILS[1]]),
      );

      renderToday("card", "manager", managerState(branchType));

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "3 ta pochta · 33 ta buyurtma · jami 5 700 000 so'm")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Viloyat" })).toBeInTheDocument();

      const list = screen.getByRole("list", { name: "Bugungi pochtalar" });
      const links = cardLinks(list);
      expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mails/2486", "/mails/2485", "/mails/2484"]);

      const first = links[0];
      expect(first).toHaveAccessibleName(
        `Pochta №2486, ${dateOf(MAILS[0].createdAt)}, Yangi, Andijon, 18 ta buyurtma, 3 420 000 so'm — ochish`,
      );
      expect(within(first).getByText(dateOf(MAILS[0].createdAt))).toBeInTheDocument();
      expect(within(first).getByText("Yangi")).toBeInTheDocument();
      expect(within(first).getByText("Pochta №2486")).toBeInTheDocument();
      expect(within(first).getByText("Andijon")).toBeInTheDocument();
      expect(within(first).getByText("Kuryer: Jasur Tursunov")).toBeInTheDocument();
      expect(within(first).getByText("18 ta buyurtma")).toBeInTheDocument();
      expect(within(first).getByText("3 420 000 so'm")).toHaveClass("font-bold");
      // Kuryersiz pochtada kuryer qatori yo'q.
      expect(within(links[1]).queryByText(/Kuryer:/)).not.toBeInTheDocument();

      await user.click(first);
      expect(screen.getByTestId("location")).toHaveTextContent("/mails/2486");
      expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual({
        fromTab: "today",
        fallbackRegionId: "1",
        fallbackRegionName: "Andijon",
        expectedOrderCount: 18,
      });
    },
  );

  it("branch manager: a post created today is titled «Bugun, HH:MM»; the region filter narrows the cards", async () => {
    const user = userEvent.setup();
    silenceManagerFallback();
    const now = new Date();
    getNewMailsMock.mockReturnValue(loaded([...MAILS, mail("2499", { id: "2", name: "Buxoro" }, 2, 50_000, now.toISOString())]));

    renderToday("card", "manager", managerState("REGIONAL"));

    const list = screen.getByRole("list", { name: "Bugungi pochtalar" });
    const [newest] = cardLinks(list);
    expect(newest).toHaveAttribute("href", "/mails/2499");
    expect(within(newest).getByText(/^Bugun, \d{2}:\d{2}$/)).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.click(await screen.findByRole("option", { name: "Andijon" }));
    expect(cardLinks(screen.getByRole("list", { name: "Bugungi pochtalar" })).map((link) => link.getAttribute("href"))).toEqual([
      "/mails/2486",
      "/mails/2484",
    ]);
  });

  it("branch manager: card-shaped loading skeleton", () => {
    silenceManagerFallback();
    getNewMailsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });

    const { container } = renderToday("card", "manager", managerState("REGIONAL"));

    expect(container.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-preset="cards"]')).not.toBeNull();
  });

  it("error state shows the load error with retry", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    getNewMailsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("x"), refetch });

    renderToday();

    expect(screen.getByText("Ma'lumotlarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  describe("courier", () => {
    beforeEach(() => {
      getNewMailsCourierMock.mockReturnValue(loaded(MAILS));
    });

    it("uses the courier endpoint, stat cards and date cards (newest first) instead of the table", async () => {
      const user = userEvent.setup();
      getNewMailsCourierMock.mockReturnValue(loaded([MAILS[1], MAILS[2], MAILS[0]]));
      renderToday("page", "courier");

      expect(getNewMailsCourierMock).toHaveBeenCalledWith({ enabled: true });
      expect(getNewMailsMock).toHaveBeenCalledWith({ enabled: false });
      expect(screen.getByRole("heading", { name: "Qabul qilinishi kerak" })).toBeInTheDocument();
      expect(screen.getByText("Jami summa")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();

      const list = screen.getByRole("list", { name: "Bugungi pochtalar" });
      const links = cardLinks(list);
      expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mails/2486", "/mails/2485", "/mails/2484"]);
      expect(links[0]).toHaveAccessibleName(
        `Pochta №2486, ${dateOf(MAILS[0].createdAt)}, Yangi, Andijon, 18 ta buyurtma, 3 420 000 so'm — ochish`,
      );
      expect(within(links[0]).getByText(dateOf(MAILS[0].createdAt))).toBeInTheDocument();
      expect(within(links[0]).getByText("Pochta №2486")).toBeInTheDocument();
      expect(within(links[0]).getByText("18 ta buyurtma")).toBeInTheDocument();
      expect(within(links[0]).getByText("3 420 000 so'm")).toBeInTheDocument();

      await user.click(links[1]);
      expect(screen.getByTestId("location")).toHaveTextContent("/mails/2485");
      expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual({
        fromTab: "today",
        fallbackRegionId: "2",
        fallbackRegionName: "Buxoro",
        expectedOrderCount: 12,
      });
    });

    it("phone: filter and summary above the card, date cards in one list", () => {
      mockPhone();
      renderToday("page", "courier");

      expect(screen.queryByRole("heading", { name: "Qabul qilinishi kerak" })).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Viloyat" })).toBeInTheDocument();
      expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "3 ta pochta · 33 ta buyurtma · jami 5 700 000 so'm")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const card = screen.getByRole("link", { name: /^Pochta №2486, .+, Yangi, Andijon, 18 ta buyurtma, 3 420 000 so'm — ochish$/ });
      expect(card).toHaveTextContent(dateOf(MAILS[0].createdAt));
      expect(card).toHaveTextContent("Pochta №2486");
    });
  });
});
