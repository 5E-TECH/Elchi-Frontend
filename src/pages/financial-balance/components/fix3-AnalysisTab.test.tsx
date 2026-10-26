import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import AnalysisTab, { type AnalysisPreset } from "./AnalysisTab";
import { getTodayRange, type ISODateRange } from "../../../shared/lib/dateRange";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * C2 / CODE-22: moliyaviy balans tahlili sana chegaralarini oddiy YYYY-MM-DD
 * yuboradi (backend Toshkent kuni deb oladi), `T00:00:00.000Z` siz.
 * Dizayn v2: davr segmenti «Bugun / Bu hafta / Bu oy / Barchasi» (ega qarori Q7 — «Yil» o'rniga
 * «Barchasi» = sana paramsiz); top tranzaksiyalar — server sahifalashi (backend `limit` ni 100 ga qisadi).
 */

const calls = vi.hoisted(() => ({
  analytics: [] as unknown[],
  topImpacts: [] as unknown[],
  analyticsData: undefined as unknown,
  topData: undefined as unknown,
  // Serverdek: `page`/`limit` bo'yicha qatorlar va `pagination` (vmLTsAok). Berilsa `topData` o'rniga.
  topImpactsResponse: undefined as undefined | ((params: { page: number; limit: number }) => unknown),
}));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetFinancialBalanceAnalytics: (_enabled: boolean, params: unknown) => {
      calls.analytics.push(params);
      return { data: calls.analyticsData, isLoading: false, isError: false, refetch: vi.fn() };
    },
    useGetFinancialBalanceTopImpacts: (_enabled: boolean, params: { page: number; limit: number }) => {
      calls.topImpacts.push(params);
      const data = calls.topImpactsResponse ? calls.topImpactsResponse(params) : calls.topData;
      return { data, isLoading: false, isError: false, refetch: vi.fn() };
    },
  }),
}));

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const topItem = (id: number, amount: number, extra: Record<string, unknown> = {}) => ({
  id: String(id),
  createdAt: "2026-10-06T12:02:00.000Z",
  source_type: amount > 0 ? "manual_income" : "salary",
  amount,
  balance_before: 0,
  balance_after: 0,
  created_by: "1",
  ...extra,
});

beforeEach(() => {
  calls.analytics.length = 0;
  calls.topImpacts.length = 0;
  calls.analyticsData = undefined;
  calls.topData = undefined;
});

describe("AnalysisTab date params (C2)", () => {
  it("requests today's range as plain YYYY-MM-DD for analytics and top impacts", () => {
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });
    const today = toDateInputValue(new Date());

    expect(calls.analytics.at(-1)).toEqual({ fromDate: today, toDate: today });
    expect(calls.topImpacts.at(-1)).toEqual({ fromDate: today, toDate: today, page: 1, limit: 10 });
    expect(JSON.stringify([...calls.analytics, ...calls.topImpacts])).not.toMatch(/T\d{2}:\d{2}/);
  });

  it("«Barchasi» — sana paramsiz (butun daftar), «Bugun» tanlangan holatdan", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });
    const period = screen.getByRole("radiogroup", { name: "Davr" });
    expect(within(period).getByRole("radio", { name: "Bugun" })).toHaveAttribute("aria-checked", "true");
    expect(within(period).queryByRole("radio", { name: "Yil" })).not.toBeInTheDocument();

    await user.click(within(period).getByRole("radio", { name: "Barchasi" }));

    expect(calls.analytics.at(-1)).toEqual({});
    expect(calls.topImpacts.at(-1)).toEqual({ page: 1, limit: 10 });
    expect(within(period).getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true");
  });

  it("«Bu oy» — oyning 1-kunidan bugungacha", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });
    const now = new Date();
    const first = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));

    await user.click(screen.getByRole("radio", { name: "Bu oy" }));

    expect(calls.analytics.at(-1)).toEqual({ fromDate: first, toDate: toDateInputValue(now) });
  });
});

/**
 * Dushanba kuni «Bu hafta», oyning 1-kunida «Bu oy» oralig'i «Bugun» bilan bir xil — avval segment oraliqdan
 * topilgani uchun doim «Bugun» belgilanardi (e2e `balance-analysis-period` har dushanba yiqilardi).
 */
describe("AnalysisTab — oraliqlari bir xil tez tanlovlar (dushanba, oyning 1-kuni)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const checked = (name: string) =>
    within(screen.getByRole("radiogroup", { name: "Davr" })).getByRole("radio", { name }).getAttribute("aria-checked");

  it("⭐ dushanba: «Bu hafta» bosilsa o'zi belgilanadi, «Bugun» — qayta bosilsa «Bugun»", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 26, 10)); // dushanba
    const user = userEvent.setup();
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });
    expect(checked("Bugun")).toBe("true");

    await user.click(screen.getByRole("radio", { name: "Bu hafta" }));
    expect(checked("Bu hafta")).toBe("true");
    expect(checked("Bugun")).toBe("false");
    expect(calls.analytics.at(-1)).toEqual({ fromDate: "2026-10-26", toDate: "2026-10-26" });

    await user.click(screen.getByRole("radio", { name: "Bugun" }));
    expect(checked("Bugun")).toBe("true");
    expect(checked("Bu hafta")).toBe("false");
  });

  it("⭐ oyning 1-kuni: «Bu oy» bosilsa o'zi belgilanadi", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1, 10)); // payshanba, 1-oktabr
    const user = userEvent.setup();
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    await user.click(screen.getByRole("radio", { name: "Bu oy" }));
    expect(checked("Bu oy")).toBe("true");
    expect(checked("Bugun")).toBe("false");
  });

  it("tanlov sahifada turadi: tab almashib qaytganda (komponent qayta chizilsa) ham «Bu hafta»", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 26, 10));
    const user = userEvent.setup();
    const Host = () => {
      const [range, setRange] = useState<ISODateRange>(getTodayRange);
      const [preset, setPreset] = useState<AnalysisPreset | null>(null);
      const [shown, setShown] = useState(true);
      return (
        <>
          {shown ? <AnalysisTab range={range} onRangeChange={setRange} preset={preset} onPresetChange={setPreset} /> : null}
          <button type="button" onClick={() => setShown((value) => !value)}>
            tab
          </button>
        </>
      );
    };
    renderWithProviders(<Host />, { route: "/financial-balance?tab=analysis" });

    await user.click(screen.getByRole("radio", { name: "Bu hafta" }));
    await user.click(screen.getByRole("button", { name: "tab" }));
    await user.click(screen.getByRole("button", { name: "tab" }));

    expect(checked("Bu hafta")).toBe("true");
  });
});

describe("AnalysisTab — top tranzaksiyalar server sahifalashi (vmLTsAok)", () => {
  // Bug: `limit=10000` + mijozda sahifalash — backend `limit` ni 100 ga qisgani uchun 100 dan keyingi
  // tranzaksiyalarga yetib bo'lmasdi, footer esa noto'g'ri jami ko'rsatardi.
  it("jami serverning `pagination.total` idan, keyingi sahifa serverdan so'raladi", async () => {
    const user = userEvent.setup();
    calls.topData = {
      data: {
        items: Array.from({ length: 10 }, (_, index) => topItem(index + 1, 1_000_000 - index * 1000)),
        pagination: { total: 186, page: 1, limit: 10, totalPages: 19 },
      },
    };
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    expect(screen.getByText("1–10 / 186 ta tranzaksiya")).toBeInTheDocument();
    expect(screen.getByText("186 ta jami")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(calls.topImpacts.at(-1)).toMatchObject({ page: 2, limit: 10 });
  });
});

describe("AnalysisTab — eng katta tranzaksiyalar server sahifalashi (vmLTsAok, dev)", () => {
  const TOTAL = 186;
  const serverPage = ({ page, limit }: { page: number; limit: number }) => {
    const from = (page - 1) * limit;
    const items = Array.from({ length: Math.max(0, Math.min(limit, TOTAL - from)) }, (_, index) => ({
      id: String(from + index + 1),
      amount: 1_000_000 - (from + index) * 1000,
      operation_type: "income",
      source_type: "manual_income",
      payment_date: "2026-10-17T05:00:00.000Z",
    }));
    return { statusCode: 200, data: { items, pagination: { total: TOTAL, page, limit, totalPages: Math.ceil(TOTAL / limit) } } };
  };
  /** Jadvaldagi «#» ustuni (tartib raqami). */
  const indexes = () =>
    within(screen.getByRole("table", { name: "Eng katta ta'sir ko'rsatgan tranzaksiyalar" }))
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelectorAll("td")[0]?.textContent);

  beforeEach(() => {
    calls.topImpactsResponse = serverPage;
  });

  afterEach(() => {
    calls.topImpactsResponse = undefined;
  });

  it("⭐ TC2/TC3: so'rovda `limit` 10 (≤ 100); sarlavhadagi «jami» — `pagination.total`, sahifalar soni u bilan mos (186 → 19)", () => {
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    expect(calls.topImpacts.every((params) => (params as { limit: number }).limit <= 100)).toBe(true);
    expect(screen.getByText("186 ta jami")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "19" })).toBeInTheDocument();
    expect(indexes()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("⭐ TC1: 11-sahifaga o'tiladi — server `page: 11` so'raladi va 101–110 qatorlar keladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    // v2 `Pagination` 1-sahifada «1 2 3 … 19» ko'rsatadi — 11-sahifaga «Keyingi» bilan.
    for (let step = 0; step < 10; step += 1) await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));

    await waitFor(() => expect(calls.topImpacts.at(-1)).toMatchObject({ page: 11, limit: 10 }));
    expect(indexes()[0]).toBe("101");
    expect(indexes().at(-1)).toBe("110");
    expect(indexes()).not.toContain("100");

    // Oxirgi sahifa — 19 (181–186), «Keyingi» o'chiq.
    await user.click(screen.getByRole("button", { name: "19" }));
    await waitFor(() => expect(calls.topImpacts.at(-1)).toMatchObject({ page: 19 }));
    expect(indexes()).toEqual(["181", "182", "183", "184", "185", "186"]);
    expect(screen.getByRole("button", { name: "Keyingi sahifa" })).toBeDisabled();
  });

  it("jami va manbalar bitta sahifadagi qatorlardan yasalmaydi (analytics'da ta'sirlar yo'q — reytinglar bo'sh)", () => {
    calls.analyticsData = { data: { currentBalance: 1_000_000 } };
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    const positive = screen.getByRole("region", { name: "Musbatga tortuvchi manbalar" });
    expect(within(positive).getByText("Bu davrda kirim yo'q")).toBeInTheDocument();
    expect(within(positive).queryByText("Qo'lda kirim")).not.toBeInTheDocument();
  });
});

describe("AnalysisTab — «Daftar qoldig'i harakati» va manbalar", () => {
  const analytics = {
    data: {
      currentBalance: 8_437_500,
      summary: { totalPositive: 9_836_500, totalNegative: 8_906_000, netChange: 930_500, totalCount: 186 },
      positiveImpact: [
        { source_type: "manual_income", total_amount: 5_000_000, percentage: 50.83 },
        { source_type: "sell_profit", total_amount: 4_836_500, percentage: 49.17 },
      ],
      negativeImpact: [{ source_type: "salary", total_amount: 8_906_000, percentage: 100 }],
    },
  };

  it("4 son, sharshara (davr boshi → manbalar → hozir) va ikki reyting", () => {
    calls.analyticsData = analytics;
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    expect(screen.getByRole("heading", { name: "Daftar qoldig'i harakati" })).toBeInTheDocument();
    expect(screen.getAllByText("8 437 500 so'm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+9 836 500 so'm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("−8 906 000 so'm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+930 500 so'm").length).toBeGreaterThan(0);
    expect(screen.getByText("186 ta tranzaksiya")).toBeInTheDocument();

    // Davr boshi = hozirgi qoldiq − sof o'zgarish = 7 507 000.
    const chart = screen.getAllByRole("img").find((node) => node.getAttribute("aria-label")?.startsWith("Daftar qoldig'i"));
    expect(chart?.getAttribute("aria-label")).toContain("Davr boshi 7 507 000 so'm");
    expect(chart?.getAttribute("aria-label")).toContain("Qo'lda kirim +5 000 000 so'm");
    expect(chart?.getAttribute("aria-label")).toContain("Maosh −8 906 000 so'm");
    expect(chart?.getAttribute("aria-label")).toContain("Hozir 8 437 500 so'm");
    expect(screen.getByText("Davr boshi = hozirgi qoldiq − sof o'zgarish")).toBeInTheDocument();

    const positive = screen.getByRole("region", { name: "Musbatga tortuvchi manbalar" });
    expect(within(positive).getByText("kirimning 50,8%")).toBeInTheDocument();
    const negative = screen.getByRole("region", { name: "Manfiyga tortuvchi manbalar" });
    expect(within(negative).getByText("chiqimning 100%")).toBeInTheDocument();
  });

  it("«Jadval» egizagi bosqichlarni qoldiq bilan ko'rsatadi", async () => {
    const user = userEvent.setup();
    calls.analyticsData = analytics;
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    // Desktop va telefon nusxasi (CSS bilan bittasi yashirin) — birinchisi.
    await user.click(screen.getAllByRole("radio", { name: "Jadval" })[0]);

    const table = screen.getByRole("table", { name: "Daftar qoldig'i harakati" });
    expect(within(table).getByText("Davr boshi")).toBeInTheDocument();
    expect(within(table).getByText("7 507 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("Hozir")).toBeInTheDocument();
  });

  it("davr bugungacha bo'lmasa davr boshi/oxiri chizilmaydi (hozirgi qoldiq o'sha davrga tegishli emas)", () => {
    calls.analyticsData = analytics;
    renderWithProviders(<AnalysisTab range={{ from: "2026-09-01", to: "2026-09-30" }} onRangeChange={vi.fn()} />, {
      route: "/financial-balance?tab=analysis",
    });

    const chart = screen.getAllByRole("img").find((node) => node.getAttribute("aria-label")?.startsWith("Daftar qoldig'i"));
    expect(chart?.getAttribute("aria-label")).not.toContain("Davr boshi");
    expect(chart?.getAttribute("aria-label")).not.toContain("Hozir");
    expect(screen.getByText(/Davr bugungacha davom etmaydi/)).toBeInTheDocument();
  });
});
