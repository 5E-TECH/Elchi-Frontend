import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import { getTodayRange } from "../../shared/lib/dateRange";
import LogistDashboardPage from "./LogistDashboardPage";

/**
 * LG-1 — logist bosh sahifasi (maket `logist-dashboard-main`): faqat o'z viloyatlari (`logist_id === me`), pulsiz,
 * holatlar. So'rov — haqiqiy `useRegionStats` + normalizator, faqat `api.get` soxta.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const ME = "42";

const region = (
  id: number,
  name: string,
  logistId: string | null,
  totals: [total: number, delivered: number, cancelled: number],
  couriers: [active: number | null, total: number | null] = [5, 6],
  districts = 10,
) => ({
  id,
  name,
  sato_code: String(1700 + id),
  logist_id: logistId,
  districts_count: districts,
  totalOrders: totals[0],
  deliveredOrders: totals[1],
  cancelledOrders: totals[2],
  revenue: 987_654_321,
  activeCouriers: couriers[0],
  totalCouriers: couriers[1],
});

const STATS = {
  statusCode: 200,
  message: "Region stats",
  data: {
    regions: [
      region(1, "Samarqand viloyati", ME, [86, 58, 9], [18, 22], 16),
      region(2, "Qashqadaryo viloyati", ME, [12, 9, 1], [9, 11], 14),
      region(3, "Toshkent shahri", "7", [500, 400, 20], [40, 50], 12),
      region(4, "Navoiy viloyati", ME, [5, 4, 0], [4, 5], 10),
      region(5, "Andijon viloyati", null, [30, 20, 5]),
    ],
    summary: { totalRegions: 5, totalOrders: 633, deliveredOrders: 491, cancelledOrders: 35, totalRevenue: 4_938_271_605 },
  },
};

const logistState = (id: string | null = ME) =>
  ({
    role: { id, role: "logist", region: null, name: "Aziz Rahimov" },
    user: {
      user: id ? ({ id, name: "Aziz Rahimov", role: "logist" } as never) : null,
      isAuthenticated: true,
      accessToken: "token",
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderPage = (id: string | null = ME) =>
  renderWithProviders(<LogistDashboardPage />, { route: "/", preloadedState: logistState(id) });

const section = (title: string) =>
  screen.getByRole("heading", { level: 2, name: new RegExp(`^${title}`) }).closest("section") as HTMLElement;

const asPhone = () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

beforeEach(() => {
  mocks.get.mockReset();
  mocks.get.mockResolvedValue({ data: STATS });
});

afterEach(async () => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
  if (i18n.language !== "uz") await i18n.changeLanguage("uz");
});

describe("LogistDashboardPage — o'z viloyatlari (LG-1)", () => {
  it("sarlavhada faqat biriktirilgan viloyatlar; KPI — ularning yig'indisi; so'rov bugungi kun bilan", async () => {
    renderPage();

    expect(
      await screen.findByText("Sizga biriktirilgan 3 ta viloyat: Samarqand, Qashqadaryo, Navoiy"),
    ).toBeInTheDocument();
    const today = getTodayRange();
    expect(mocks.get).toHaveBeenCalledWith("region/stats/all", {
      params: { startDate: today.from, endDate: today.to },
    });

    const kpis = screen.getByRole("region", { name: "Viloyatlarim bo'yicha umumiy ko'rsatkichlar" });
    // 86 + 12 + 5 = 103; sotilgan 58 + 9 + 4 = 71; bekor 9 + 1 + 0 = 10; jarayonda 22.
    expect(within(kpis).getByText("103")).toBeInTheDocument();
    expect(within(kpis).getByText("Jarayonda 22 ta · 3 viloyat")).toBeInTheDocument();
    expect(within(kpis).getByText("71")).toBeInTheDocument();
    expect(within(kpis).getByText("10")).toBeInTheDocument();
    // Faol kuryerlar: 18 + 9 + 4 = 31 / 22 + 11 + 5 = 38.
    expect(within(kpis).getByText("31")).toBeInTheDocument();
    expect(within(kpis).getByText("/ 38")).toBeInTheDocument();
    expect(within(kpis).getByText("Faol holatdagi kuryerlar")).toBeInTheDocument();

    // Boshqa logist va biriktirilmagan viloyat ko'rinmaydi.
    expect(screen.queryByText("Toshkent sh.")).not.toBeInTheDocument();
    expect(screen.queryByText("Andijon")).not.toBeInTheDocument();
  });

  it("LG-S1: yagona GET — `region/stats/all` (analitika, kassa, to'lovlar so'ralmaydi)", async () => {
    renderPage();
    await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/);
    const paths = new Set(mocks.get.mock.calls.map(([path]) => path));
    expect([...paths]).toEqual(["region/stats/all"]);
  });

  it("pul chizilmaydi (ega LG-S1): tushum yo'q, «so'm» yo'q", async () => {
    const { container } = renderPage();
    await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/);
    expect(container.textContent).not.toMatch(/so'm|daromad|tushum|987/i);
  });

  it("«Viloyatlar muvaffaqiyati» — eng pastdan; eng past va eng yuqori viloyat", async () => {
    renderPage();
    await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/);
    const card = section("Viloyatlar muvaffaqiyati");
    const meters = within(card).getAllByRole("meter").map((meter) => meter.getAttribute("aria-label"));
    expect(meters).toEqual(["Samarqand muvaffaqiyati", "Qashqadaryo muvaffaqiyati", "Navoiy muvaffaqiyati"]);
    expect(within(card).getByText("67,4%")).toBeInTheDocument();
    expect(within(card).getByText("58 / 86")).toBeInTheDocument();
    expect(within(card).getByText("Eng past muvaffaqiyat")).toBeInTheDocument();
    expect(within(card).getByText("Eng yuqori muvaffaqiyat")).toBeInTheDocument();
    expect(within(card).getByText(/^80(,0)?% · 4 \/ 5 ta$/)).toBeInTheDocument();
  });

  it("«Viloyatlarim» jadvali — buyurtmalar bo'yicha, «Jami» qatori; nom va «›» — viloyat tafsiloti (LG-3)", async () => {
    renderPage();
    await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/);
    const card = section("Viloyatlarim");
    expect(within(card).getByText("(3)")).toBeInTheDocument();
    const table = within(card).getByRole("table", { name: "Viloyatlarim jadvali" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "Samarqand16 tuman",
      "Qashqadaryo14 tuman",
      "Navoiy10 tuman",
      "Jami · 3 viloyat",
    ]);
    expect(within(rows[0]).getByText("18 / 22")).toBeInTheDocument();
    expect(within(rows[3]).getByText("103 ta")).toBeInTheDocument();
    expect(within(rows[3]).getByText("31 / 38")).toBeInTheDocument();
    // LG-3: nom va «›» → logistning `/regions` ko'rinishi; «Jami» qatorida havola yo'q.
    // Bosh sahifa davri havolaga o'tadi (sukut — «Bugun»); «›» nomi — to'liq viloyat nomi (maket).
    expect(within(rows[0]).getByRole("link", { name: /16 tuman$/ })).toHaveAttribute(
      "href",
      "/regions?region=1&period=today",
    );
    expect(within(rows[0]).getByRole("link", { name: "Samarqand viloyati tafsiloti" })).toHaveAttribute(
      "href",
      "/regions?region=1&period=today",
    );
    expect(within(rows[2]).getByRole("link", { name: "Navoiy viloyati tafsiloti" })).toHaveAttribute(
      "href",
      "/regions?region=4&period=today",
    );
    expect(within(rows[3]).queryAllByRole("link")).toHaveLength(0);
  });

  it("«Barchasi» — sanasiz so'rov", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/);
    await user.click(screen.getByRole("radio", { name: "Barchasi" }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith("region/stats/all", { params: {} }));
    // LG-3: «Tafsilot» shu davr bilan ochiladi (aks holda `/regions` «Bugun» da boshqa raqamlar ko'rsatardi).
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Samarqand viloyati tafsiloti" })).toHaveAttribute(
        "href",
        "/regions?region=1&period=all",
      ),
    );
  });

  it("kuryerlar soni noma'lum (identity javob bermadi) — «—», yolg'on 0 emas", async () => {
    mocks.get.mockResolvedValue({
      data: { data: { regions: [region(1, "Samarqand viloyati", ME, [10, 5, 1], [null, null])] } },
    });
    renderPage();
    await screen.findByText(/Sizga biriktirilgan 1 ta viloyat/);
    const kpis = screen.getByRole("region", { name: "Viloyatlarim bo'yicha umumiy ko'rsatkichlar" });
    expect(within(kpis).getByText("—")).toBeInTheDocument();
    expect(within(kpis).queryByRole("meter", { name: /Faol kuryerlar/ })).not.toBeInTheDocument();
  });
});

describe("LogistDashboardPage — holatlar", () => {
  it("foydalanuvchi id'si hali noma'lum — yuklanish, yolg'on «viloyat biriktirilmagan» emas", async () => {
    let resolved = false;
    mocks.get.mockImplementation(async () => {
      resolved = true;
      return { data: STATS };
    });
    renderPage(null);
    await waitFor(() => expect(resolved).toBe(true));
    // So'rov javobi kelgandan keyin ham id yo'q — bo'sh holat chiqmaydi, skeletonlar qoladi.
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(screen.getByRole("heading", { level: 2, name: /^Viloyatlarim/ }).closest("[aria-busy=true]")).not.toBeNull();
    expect(screen.queryByText("Sizga hali viloyat biriktirilmagan")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sizga biriktirilgan/)).not.toBeInTheDocument();
  });

  it("viloyat biriktirilmagan — bo'sh holat", async () => {
    mocks.get.mockResolvedValue({ data: { data: { regions: [region(3, "Toshkent shahri", "7", [5, 1, 1])] } } });
    renderPage();
    expect(await screen.findByText("Sizga hali viloyat biriktirilmagan")).toBeInTheDocument();
    expect(
      screen.getByText("Administrator viloyat biriktirgach, uning statistikasi shu yerda chiqadi."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Viloyatlarim bo'yicha umumiy ko'rsatkichlar" })).not.toBeInTheDocument();
  });

  it("xato — tushunarli matn va «Qayta urinish»; backend matni ko'rsatilmaydi", async () => {
    const user = userEvent.setup();
    mocks.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500, data: { message: "Internal RPC timeout logistics.region.stats_all" } },
    });
    renderPage();
    expect(await screen.findByText("Viloyatlar statistikasini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText(/RPC timeout/)).not.toBeInTheDocument();
    // Maket «Yuklashda xato»: danger `.el-alert` (sarlavha + izoh), «Qayta urinish» — uning OSTIDA, alert ichida emas.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Viloyatlar statistikasini yuklab bo'lmadi");
    expect(alert).toHaveTextContent("Internet aloqasini tekshirib, qayta urining.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/)).toBeInTheDocument();
  });
});

describe("LogistDashboardPage — oflayn", () => {
  it("internet yo'q (so'rov `isPaused`) — «Internet aloqasi yo'q», yolg'on «viloyat biriktirilmagan» emas", async () => {
    onlineManager.setOnline(false);
    renderPage();
    expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.queryByText("Sizga hali viloyat biriktirilmagan")).not.toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();

    // Aloqa qaytdi — so'rov ketadi, viloyatlar chiqadi.
    act(() => onlineManager.setOnline(true));
    expect(await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/)).toBeInTheDocument();
  });
});

describe("LogistDashboardPage — en birlik shakli", () => {
  it("bitta viloyat / tuman — «1 region», «1 district» («1 regions» emas)", async () => {
    await i18n.changeLanguage("en");
    mocks.get.mockResolvedValue({
      data: { data: { regions: [region(1, "Samarqand viloyati", ME, [10, 5, 1], [2, 3], 1)] } },
    });
    renderPage();
    const kpis = await screen.findByRole("region", { name: "Overall figures for my regions" });
    await waitFor(() => expect(within(kpis).getByText("In progress: 4 · 1 region")).toBeInTheDocument());
    expect(screen.getByText(/· my 1 region$/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "My regions table" });
    expect(within(table).getByText("1 district")).toBeInTheDocument();
    expect(within(table).getByText("Total · 1 region")).toBeInTheDocument();
    expect(within(table).getByRole("img", { name: /: 10 orders$/ })).toBeInTheDocument();
  });
});

describe("LogistDashboardPage — telefon (390)", () => {
  it("«Viloyatlarim» kartalarda, «Jami» qatorisiz", async () => {
    asPhone();
    renderPage();
    await screen.findByText(/Sizga biriktirilgan 3 ta viloyat/);
    const card = section("Viloyatlarim");
    expect(within(card).queryByRole("table")).not.toBeInTheDocument();
    const items = within(card).getAllByRole("listitem").filter((item) => item.closest("ul")?.getAttribute("aria-label"));
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Samarqand86 ta"),
      expect.stringContaining("Qashqadaryo12 ta"),
      expect.stringContaining("Navoiy5 ta"),
    ]);
    expect(within(card).getByText("67,4% sotildi · 18 / 22 kuryer")).toBeInTheDocument();
    expect(within(card).queryByText(/Jami ·/)).not.toBeInTheDocument();
    // LG-3: butun karta — viloyat tafsiloti havolasi.
    expect(items[0].querySelector("a")).toHaveAttribute("href", "/regions?region=1&period=today");
  });
});
