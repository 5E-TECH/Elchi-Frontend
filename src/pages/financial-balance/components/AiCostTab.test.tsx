import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAiMargin, normalizeAiOrders, normalizeAiUsageDashboard } from "../../../entities/ai-usage";
import { renderWithProviders } from "../../../test/test-utils";
import FinancialBalance from "../index";

/**
 * Celz3rKJ — «Balans → AI xarajat» tabi: `GET /ai-usage/dashboard` va `/ai-usage/ai-orders` (soxta hook'lar,
 * javob — haqiqiy normalizatsiyadan). TC: tab ochiladi; summary so'm + USD; feature kesimi; Toshkent kunlari;
 * manba ulushi (AI / qo'lda / bot); order-service tushsa — 0 emas, xato.
 */
const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  orders: vi.fn(),
  margin: vi.fn(),
}));

// qzjTMWPb: kunlik agregatlar bu testda emas — 403 holati: bloklar chizilmaydi, sahifa o'zgarmaydi.
vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => {
  const forbidden = () => ({ isError: true, error: { response: { status: 403 } }, isLoading: false, refetch: vi.fn() });
  return {
    ...(await importOriginal<object>()),
    useFinanceHistoryDaily: forbidden,
    useFinancialBalanceDaily: forbidden,
  };
});

vi.mock("../../../entities/ai-usage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/ai-usage")>()),
  useAiUsageDashboard: (...args: unknown[]) => mocks.dashboard(...args),
  useAiOrders: (...args: unknown[]) => mocks.orders(...args),
  useAiMargin: (...args: unknown[]) => mocks.margin(...args),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinancialBalance: () => ({ data: { data: { balance: 1000, main: { balance: 1000 } } }, isLoading: false, isError: false, refetch: vi.fn() }),
  }),
}));
vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({ createFinancialBalanceEntry: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("./Statistics", () => ({ default: () => <div data-testid="overview-tab" /> }));
vi.mock("./SettlementRanks", () => ({ default: () => <div data-testid="overview-ranks" /> }));

const days = Array.from({ length: 3 }, (_, index) => `2026-10-${String(24 + index).padStart(2, "0")}`);

const dashboardPayload = (overrides: Record<string, unknown> = {}) =>
  normalizeAiUsageDashboard({
    statusCode: 200,
    data: {
      from: days[0],
      to: days[2],
      usdUzsRate: 12650,
      summary: {
        totalCostUsd: 1.25,
        totalCostUzs: 15812,
        totalCalls: 41,
        cacheSavedUzs: 3000,
        aiOrderCount: 9,
        orderCostUzs: 13500,
        avgCostPerAiOrderUzs: 1500,
        avgCostPerAiOrderUsd: 0.12,
      },
      byFeature: [
        { feature: "order_extract_multi", area: "order", calls: 11, inputTokens: 5400, outputTokens: 1300, costUsd: 1.05, costUzs: 13282 },
        { feature: "order_district", area: "order", calls: 30, inputTokens: 900, outputTokens: 60, costUsd: 0.2, costUzs: 2530 },
      ],
      byModel: [{ model: "claude-haiku-4-5", calls: 41, costUsd: 1.25, costUzs: 15812 }],
      dailySeries: days.map((day, index) => ({ day, costUsd: index * 0.5, costUzs: index * 6325, calls: index * 10, aiOrders: index * 3 })),
      orderSources: {
        total: 100,
        ai: 9,
        manual: 70,
        bot: 6,
        external: 10,
        branch: 5,
        shares: { ai: 9, manual: 70, bot: 6, external: 10, branch: 5 },
      },
      degraded: false,
      failed_parts: [],
      ...overrides,
    },
  });

const ordersPayload = normalizeAiOrders({
  data: {
    total: 1,
    limit: 100,
    items: [
      {
        orderId: 81,
        orderNumber: "EL-100081",
        status: "sold",
        totalPrice: 185000,
        model: "claude-haiku-4-5",
        createdAt: "2026-10-26T07:00:00.000Z",
        draftCostUzs: 1265,
        draftCostUsd: 0.1,
        draftOrders: 3,
      },
    ],
    degraded: false,
  },
});

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  ...extra,
});

const marginPayload = normalizeAiMargin({
  statusCode: 200,
  data: {
    totals: { chargedUzs: 12_000, costUzs: 15_000, marginUzs: -3_000, aiOrders: 40, marginNegative: true },
    markets: [
      { marketId: 7, marketName: "Baraka Shop", chargedUzs: 10_000, costUzs: 4_000, marginUzs: 6_000, aiOrders: 30, marginNegative: false },
      { marketId: 9, marketName: "Nur Market", chargedUzs: 2_000, costUzs: 11_000, marginUzs: -9_000, aiOrders: 10, marginNegative: true },
    ],
  },
});

beforeEach(() => {
  mocks.dashboard.mockReset();
  mocks.orders.mockReset();
  mocks.margin.mockReset();
  mocks.dashboard.mockReturnValue(query(dashboardPayload()));
  mocks.orders.mockReturnValue(query(ordersPayload));
  mocks.margin.mockReturnValue(query(marginPayload));
});

describe("Balans → «AI xarajat» (Celz3rKJ)", () => {
  it("tab sarlavhalar qatorida; boshqa tablarda /ai-usage so'ralmaydi, bosilganda ochiladi va URL'ga yoziladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance" });

    const tablist = screen.getByRole("tablist", { name: "Balans bo'limlari" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Umumiy ko'rinish",
      "Tarix",
      "Tahlil",
      "AI xarajat",
    ]);
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(mocks.orders).not.toHaveBeenCalled();

    await user.click(within(tablist).getByRole("tab", { name: "AI xarajat" }));
    expect(within(tablist).getByRole("tab", { name: "AI xarajat" })).toHaveAttribute("aria-selected", "true");
    expect(mocks.dashboard).toHaveBeenCalled();
    // Sukut — oxirgi 30 kun (backend sukuti bilan bir xil), «30 kun» belgilangan.
    const [range] = mocks.dashboard.mock.calls.at(-1) as [{ from: string; to: string }];
    expect(Date.parse(range.to) - Date.parse(range.from)).toBe(29 * 86_400_000);
    expect(screen.getByRole("radio", { name: "30 kun" })).toHaveAttribute("aria-checked", "true");
  });

  it("KPI: jami xarajat so'm + USD, chaqiruvlar, AI buyurtmalar, o'rtacha narx", () => {
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });
    const kpis = screen.getByRole("region", { name: "AI xarajati ko'rsatkichlari" });
    const cost = kpis.querySelector('[data-kpi="cost"]') as HTMLElement;
    expect(cost).toHaveTextContent("Jami AI xarajat");
    expect(cost).toHaveTextContent("15,8 ming so'm");
    expect(cost).toHaveTextContent("1,25 $");
    expect(kpis.querySelector('[data-kpi="calls"]')).toHaveTextContent("41");
    expect(kpis.querySelector('[data-kpi="calls"]')).toHaveTextContent("keshdan tejaldi: 3 ming so'm");
    expect(kpis.querySelector('[data-kpi="orders"]')).toHaveTextContent("9");
    expect(kpis.querySelector('[data-kpi="average"]')).toHaveTextContent("1 500 so'm");
  });

  it("funksiya kesimi (order_extract_multi, order_district), model, manba ulushi AI / Qo'lda / Telegram bot", () => {
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });

    const features = screen.getByRole("heading", { name: "Funksiyalar bo'yicha" }).closest("section") as HTMLElement;
    expect(features).toHaveTextContent("Matndan buyurtma ajratish");
    expect(features).toHaveTextContent("order_extract_multi");
    expect(features).toHaveTextContent("Tumanni aniqlash");
    expect(features).toHaveTextContent("13 282 so'm");

    const models = screen.getByRole("heading", { name: "Modellar bo'yicha" }).closest("section") as HTMLElement;
    expect(models).toHaveTextContent("claude-haiku-4-5");

    const sources = screen.getByRole("heading", { name: "Buyurtma manbasi" }).closest("section") as HTMLElement;
    expect(within(sources).getByRole("img", { name: /AI 9%.*Qo'lda 70%.*Telegram bot 6%/ })).toBeInTheDocument();
    expect(sources).toHaveTextContent("Telegram bot");
    expect(sources).toHaveTextContent("6 ta");
  });

  it("kunlik trend Toshkent kunlari bo'yicha (backend `day`) — «Jadval» egizagi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });
    const trend = screen.getByRole("heading", { name: "Kunlik xarajat" }).closest("section") as HTMLElement;
    expect(within(trend).getByRole("img", { name: /Kunlik AI xarajati/ })).toBeInTheDocument();

    await user.click(within(trend).getByRole("radio", { name: "Jadval" }));
    const table = within(trend).getByRole("table", { name: "Kunlik xarajat" });
    expect(within(table).getByText("26.10.2026")).toBeInTheDocument();
    expect(within(table).getByText("12 650 so'm")).toBeInTheDocument();
  });

  it("order-service javob bermadi (`orderSources: null`) — manba joyida 0 emas, xato + «Qayta urinish»; xarajat ko'rinadi", async () => {
    const refetch = vi.fn();
    mocks.dashboard.mockReturnValue(
      query(dashboardPayload({ orderSources: null, degraded: true, failed_parts: ["orderSources"] }), { refetch }),
    );
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });

    const sources = screen.getByRole("heading", { name: "Buyurtma manbasi" }).closest("section") as HTMLElement;
    expect(sources).toHaveTextContent("Buyurtma manbasini yuklab bo'lmadi");
    expect(sources).not.toHaveTextContent("0 ta");
    await userEvent.setup().click(within(sources).getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "AI xarajati ko'rsatkichlari" })).toHaveTextContent("15,8 ming so'm");
  });

  it("«AI buyurtmalar»: raqam buyurtma sahifasiga havola, holat, summa, draft xarajati", () => {
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });
    const card = screen.getByRole("heading", { name: "AI buyurtmalar" }).closest("section") as HTMLElement;
    const link = within(card).getAllByRole("link", { name: /№EL-100081/ })[0];
    expect(link).toHaveAttribute("href", "/orders/edit/81");
    expect(card).toHaveTextContent("185 000 so'm");
    expect(card).toHaveTextContent("1 265 so'm · 3 ta buyurtmaga");
  });

  it("dashboard so'rovi yiqilsa — xato va «Qayta urinish»", async () => {
    const refetch = vi.fn();
    mocks.dashboard.mockReturnValue(query(undefined, { isError: true, error: new Error("403"), refetch }));
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });
    expect(screen.getByText("AI xarajatini yuklab bo'lmadi")).toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Qayta urinish" })[0]);
    expect(refetch).toHaveBeenCalled();
  });
});

/** NFiXfmq6 — «olingan narx va tannarx» bir ekranda: manfiy marja danger tokenida, bo'sh davr xatosiz. */
describe("Balans → «AI xarajat» → marja (NFiXfmq6)", () => {
  const marginCard = async () => {
    renderWithProviders(<FinancialBalance />, { route: "/financial-balance?tab=ai" });
    const heading = await screen.findByRole("heading", { name: "Marja — marketlar kesimida" });
    return heading.closest("section") as HTMLElement;
  };

  it("⭐ eng past marja birinchi; manfiy marja minus belgi va danger token bilan, musbati oddiy", async () => {
    const card = await marginCard();
    const table = within(card).getByRole("table", { name: "Marja — marketlar kesimida" });
    const [, first, second] = within(table).getAllByRole("row");

    expect(first).toHaveTextContent("Nur Market");
    const negative = within(first).getByText(/[-−]9.000 so'm/);
    expect(negative).toHaveClass("text-danger-fg");
    expect(second).toHaveTextContent("Baraka Shop");
    const positive = within(second).getByText(/\+6.000 so'm/);
    expect(positive).not.toHaveClass("text-danger-fg");
    expect(positive).toHaveClass("text-text");
  });

  it("jami qatorida ham manfiy marja danger tonida", async () => {
    const card = await marginCard();
    const total = within(card).getByText("Marja", { selector: "dt" }).parentElement as HTMLElement;
    expect(within(total).getByText(/[-−]3.000 so'm/)).toHaveClass("text-danger-fg");
  });

  it("⭐ bo'sh davr — xatosiz EmptyState, jadval yo'q", async () => {
    mocks.margin.mockReturnValue(query(normalizeAiMargin({ statusCode: 200, data: { totals: { chargedUzs: 0, costUzs: 0, marginUzs: 0 }, markets: [] } })));
    const card = await marginCard();

    expect(within(card).getByText("Bu davrda AI to'lovi va xarajati yo'q")).toBeInTheDocument();
    expect(within(card).queryByRole("table")).toBeNull();
  });

  it("⭐ marja so'rovi yiqilsa — faqat shu blokda xato, KPI va buyurtmalar joyida", async () => {
    mocks.margin.mockReturnValue(query(undefined, { isError: true, error: new Error("500") }));
    const card = await marginCard();

    expect(within(card).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "AI xarajati ko'rsatkichlari" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI buyurtmalar" })).toBeInTheDocument();
  });

  it("market nomi kelmasa — raqami bilan", async () => {
    mocks.margin.mockReturnValue(query(normalizeAiMargin({ data: { markets: [{ marketId: 12, chargedUzs: 300, costUzs: 100 }] } })));
    const card = await marginCard();

    expect(within(card).getByRole("cell", { name: "Market #12" })).toBeInTheDocument();
  });
});
