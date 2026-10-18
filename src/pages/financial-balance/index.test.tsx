import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import FinancialBalance from "./index";
import { renderWithProviders } from "../../test/test-utils";

const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const mocks = vi.hoisted(() => ({
  download: vi.fn(() => Promise.resolve()),
  balance: {
    data: { data: { balance: 1000, main: { balance: 1000 } } } as unknown,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinancialBalance: () => ({ ...mocks.balance, refetch: vi.fn() }),
  }),
}));

vi.mock("../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({ createFinancialBalanceEntry: { mutate: vi.fn(), isPending: false } }),
}));

vi.mock("../../shared/lib/exportFile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/exportFile")>()),
  downloadXlsx: mocks.download,
}));

vi.mock("./components/Statistics", () => ({ default: () => <div data-testid="overview-tab" /> }));
vi.mock("./components/SettlementRanks", () => ({ default: () => <div data-testid="overview-ranks" /> }));
vi.mock("./components/HistoryTab", () => ({ default: () => <div data-testid="history-tab" /> }));
vi.mock("./components/AnalysisTab", () => ({ default: () => <div data-testid="analysis-tab" /> }));

const open = (route = "/financial-balance") =>
  renderWithProviders(
    <>
      <FinancialBalance />
      <LocationProbe />
    </>,
    { route },
  );

const currentSearch = () => screen.getByTestId("search").textContent ?? "";

const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  mocks.download.mockClear();
  mocks.balance = {
    data: { data: { balance: 1000, main: { balance: 1000 } } },
    isLoading: false,
    isError: false,
  };
});

describe("FinancialBalance tabs", () => {
  it("opens the History tab straight from a ?tab=history link (and after F5)", () => {
    open("/financial-balance?tab=history");

    expect(screen.getByTestId("history-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-tab")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tarix" })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to the overview tab for an unknown ?tab value", () => {
    open("/financial-balance?tab=bogus");

    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();
  });

  it("writes the selected tab to the URL", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole("tab", { name: "Tarix" }));

    expect(currentSearch()).toContain("tab=history");
    expect(screen.getByTestId("history-tab")).toBeInTheDocument();
  });

  it("drops the History tab's page/filter params when switching to another tab", async () => {
    const user = userEvent.setup();
    open(
      "/financial-balance?tab=history&financialBalanceHistoryPage=4&financialBalanceHistorySource=sell&keep=1",
    );

    await user.click(screen.getByRole("tab", { name: "Umumiy ko'rinish" }));

    expect(currentSearch()).toContain("tab=overview");
    expect(currentSearch()).toContain("keep=1");
    expect(currentSearch()).not.toContain("financialBalanceHistory");
  });
});

describe("FinancialBalance header (dizayn v2)", () => {
  it("shows the four KPIs, the formula note and both header actions on every tab", () => {
    mocks.balance = {
      data: {
        data: {
          currentSituation: 22_543_000,
          main: { balance: 24_615_000 },
          chain: { chainReceivable: 8_236_000, providerReceivable: 3_150_000 },
          markets: { marketsTotalBalans: -13_458_000 },
          couriers: { couriersTotalBalanse: 4_118_500 },
        },
      },
      isLoading: false,
      isError: false,
    };
    open("/financial-balance?tab=analysis");

    const kpis = screen.getByRole("region", { name: "Balans ko'rsatkichlari" });
    expect(within(kpis).getByText("Kassa")).toBeInTheDocument();
    expect(within(kpis).getByText("Yo'ldagi pul")).toBeInTheDocument();
    expect(within(kpis).getByText("Marketlar qarzi")).toBeInTheDocument();
    expect(within(kpis).getByText("Umumiy balans")).toBeInTheDocument();
    // Ixcham qiymatlar; marketlar qarzi haqiqiy minus bilan; umumiy balans «Ijobiy».
    expect(within(kpis).getByText("24,6")).toBeInTheDocument();
    expect(within(kpis).getByText("11,4")).toBeInTheDocument();
    expect(within(kpis).getByText("−13,5")).toBeInTheDocument();
    expect(within(kpis).getByText("Ijobiy")).toBeInTheDocument();
    expect(screen.getByText("Umumiy balans = kassa + yo'ldagi pul − marketlar qarzi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yozuv qo'shish" })).toBeInTheDocument();
  });

  it("a failed balance request shows an error with retry, but the tabs keep working", () => {
    mocks.balance = { data: undefined, isLoading: false, isError: true };
    open("/financial-balance?tab=history");

    expect(screen.getByRole("alert")).toHaveTextContent("Balansni yuklab bo'lmadi");
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.getByTestId("history-tab")).toBeInTheDocument();
  });

  it("\"Yozuv qo'shish\" opens the manual entry dialog from the header", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole("button", { name: "Yozuv qo'shish" }));

    expect(await screen.findByRole("dialog", { name: "Qo'lda yozuv qo'shish" })).toBeInTheDocument();
  });
});

describe("FinancialBalance — Excel faol tab paramlari bilan (GtAoqHlk)", () => {
  it("Tarix: jadvaldagi AYNAN o'sha URL filtrlari bilan yuklanadi", async () => {
    const user = userEvent.setup();
    open(
      "/financial-balance?tab=history&financialBalanceHistorySource=manual_expense&financialBalanceHistoryFrom=2026-10-01&financialBalanceHistoryTo=2026-10-05",
    );

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith(
        "export/financial-balance.xlsx",
        { source_type: "manual_expense", from_date: "2026-10-01", to_date: "2026-10-05" },
        "financial-balance.xlsx",
      ),
    );
  });

  it("Tarix: noto'g'ri URL qiymatlari eksportga ham tushmaydi", async () => {
    const user = userEvent.setup();
    open("/financial-balance?tab=history&financialBalanceHistorySource=sell&financialBalanceHistoryFrom=bad");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith("export/financial-balance.xlsx", {}, "financial-balance.xlsx"),
    );
  });

  it("Tahlil: tanlangan davr (sukut — bugun) bilan yuklanadi", async () => {
    const user = userEvent.setup();
    open("/financial-balance?tab=analysis");
    const today = toISODate(new Date());

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith(
        "export/financial-balance.xlsx",
        { from_date: today, to_date: today },
        "financial-balance.xlsx",
      ),
    );
  });

  it("Umumiy ko'rinish: paramsiz — butun daftar", async () => {
    const user = userEvent.setup();
    open("/financial-balance");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith("export/financial-balance.xlsx", {}, "financial-balance.xlsx"),
    );
  });

  it("eksport xatosi bildirishnoma bilan chiqadi", async () => {
    mocks.download.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    open("/financial-balance");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect(await screen.findByText("Excel faylni yuklab bo'lmadi")).toBeInTheDocument();
  });
});
