import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import TodaysMails from "./todaysMails";
import { renderWithProviders } from "../../../test/test-utils";

const getNewMailsMock = vi.fn();
const getNewMailsCourierMock = vi.fn();

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetNewMails: getNewMailsMock,
    useGetNewMailsCourier: getNewMailsCourierMock,
  }),
}));

const roleState = (role: string) => ({ role: { id: "1", role, region: null, name: role } });

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

const renderToday = (layout: "card" | "page" = "card", role = "superadmin") =>
  renderWithProviders(
    <>
      <TodaysMails layout={layout} />
      <LocationProbe />
    </>,
    { route: "/mails/today", preloadedState: roleState(role) as never },
  );

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

  it("shows the courier column only when the backend sends couriers", () => {
    getNewMailsMock.mockReturnValue(
      loaded([{ ...MAILS[0], courier: { id: "7", name: "Jasur Tursunov" } }, MAILS[1]]),
    );

    renderToday();

    expect(screen.getByRole("columnheader", { name: "Kuryer" })).toBeInTheDocument();
    expect(screen.getAllByText("Jasur Tursunov").length).toBeGreaterThan(0);
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

  it("manager: «ta pochta» summary, no courier column, phone card «Pochta №X»", () => {
    getNewMailsMock.mockReturnValue(loaded([{ ...MAILS[0], courier: { id: "7", name: "Jasur Tursunov" } }]));

    const { unmount } = renderToday("card", "manager");
    expect(screen.queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "1 ta pochta · 18 ta buyurtma · jami 3 420 000 so'm")).toBeInTheDocument();
    unmount();

    mockPhone();
    renderToday("card", "manager");
    const card = screen.getByRole("link", { name: /Pochta №2486/ });
    expect(card).toHaveTextContent("Pochta №2486");
    expect(card).toHaveTextContent("Andijon · 18 ta buyurtma ·");
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

    it("uses the courier endpoint, stat cards and a sortable table (newest first)", async () => {
      const user = userEvent.setup();
      renderToday("page", "courier");

      expect(getNewMailsCourierMock).toHaveBeenCalledWith({ enabled: true });
      expect(getNewMailsMock).toHaveBeenCalledWith({ enabled: false });
      expect(screen.getByRole("heading", { name: "Qabul qilinishi kerak" })).toBeInTheDocument();
      expect(screen.getByText("Jami summa")).toBeInTheDocument();

      const table = screen.getByRole("table", { name: "Bugungi pochtalar" });
      const firstLinks = () =>
        within(table)
          .getAllByRole("link")
          .filter((link) => link.textContent?.startsWith("№"))
          .map((link) => link.textContent);
      expect(firstLinks()).toEqual(["№2486", "№2485", "№2484"]);
      expect(within(table).getByRole("link", { name: "Pochta №2486ni ochish" })).toBeInTheDocument();

      await user.click(within(table).getByRole("button", { name: /Summa/ }));
      expect(firstLinks()).toEqual(["№2486", "№2485", "№2484"]);
      await user.click(within(table).getByRole("button", { name: /Summa/ }));
      expect(firstLinks()).toEqual(["№2484", "№2485", "№2486"]);
    });

    it("phone: filter and summary above the card, cards titled by date", () => {
      mockPhone();
      renderToday("page", "courier");

      expect(screen.queryByRole("heading", { name: "Qabul qilinishi kerak" })).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Viloyat" })).toBeInTheDocument();
      expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "3 ta pochta · 33 ta buyurtma · jami 5 700 000 so'm")).toBeInTheDocument();
      const card = screen.getByRole("link", { name: /^Pochta №2486, Andijon, .*18 ta buyurtma, 3 420 000 so'm — ochish$/ });
      expect(card).toHaveTextContent("Pochta №2486 · Andijon · 18 ta buyurtma");
    });
  });
});
