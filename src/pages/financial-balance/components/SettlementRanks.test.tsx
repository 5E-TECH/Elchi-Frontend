import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { normalizeFinancialBalance } from "../lib/financialBalance";
import SettlementRanks from "./SettlementRanks";

const device = vi.hoisted(() => ({ phone: false }));

vi.mock("../../../shared/ui/primitives/date/useIsPhone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/ui/primitives/date/useIsPhone")>()),
  useIsPhone: () => device.phone,
}));

const MARKETS = "Marketlar bilan hisob-kitob";
const COURIERS = "Kuryerlar bilan hisob-kitob";

const party = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i + 1}`, balance: 100_000 * (count - i), user: { name: `${prefix} ${i + 1}` } }));

const render = (markets: Record<string, unknown>, couriers: Record<string, unknown> = { allCourierCashboxes: [] }) => {
  const data = normalizeFinancialBalance({ statusCode: 200, data: { main: { balance: 0 }, markets, couriers } });
  if (!data) throw new Error("normalizeFinancialBalance null qaytardi");
  return renderWithProviders(<SettlementRanks data={data} />);
};

const rowsOf = (title: string) => within(screen.getByRole("list", { name: title })).getAllByRole("listitem");

describe("SettlementRanks — marketlar va kuryerlar ro'yxati (IaMK2tf2)", () => {
  beforeEach(() => {
    device.phone = false;
  });

  it("⭐ oldindan to'lagan (backendda manfiy balansli) market manfiy ko'rsatilmaydi; biz qarzdor market — manfiy", () => {
    render({
      allMarketCashboxes: [
        { id: "1", balance: 4_820_000, user: { name: "Baraka Shop" } },
        { id: "2", balance: -150_000, user: { name: "Oldindan to'lagan" } },
      ],
      marketsTotalBalans: -4_670_000,
    });

    const [debt, prepaid] = rowsOf(MARKETS);
    expect(debt).toHaveTextContent("Baraka Shop");
    expect(debt).toHaveTextContent(formatMoneyLocalized(-4_820_000, { language: "uz" }));
    expect(prepaid).toHaveTextContent("Oldindan to'lagan");
    expect(prepaid).toHaveTextContent(formatMoneyLocalized(150_000, { language: "uz" }));
    expect(prepaid).not.toHaveTextContent(formatMoneyLocalized(-150_000, { language: "uz" }));
  });

  it("⭐ ro'yxat to'liq bo'lsa qatorlar yig'indisi karta pastidagi «Jami» bilan teng; «eng katta N tasi» izohi yo'q", () => {
    render({
      allMarketCashboxes: [
        { id: "1", balance: 4_820_000, user: { name: "Baraka Shop" } },
        { id: "2", balance: 3_145_500, user: { name: "Nur Elektronika" } },
        { id: "3", balance: -150_000, user: { name: "Oldindan to'lagan" } },
      ],
      nonZeroCount: 3,
      truncated: false,
      // Backend jami: −(4 820 000 + 3 145 500 − 150 000).
      marketsTotalBalans: -7_815_500,
    });

    const card = screen.getByRole("list", { name: MARKETS }).closest("[data-card-variant]") as HTMLElement;
    const rows = rowsOf(MARKETS);
    expect(rows).toHaveLength(3);
    // −4 820 000 + (−3 145 500) + 150 000 = −7 815 500.
    expect(rows[0]).toHaveTextContent(formatMoneyLocalized(-4_820_000, { language: "uz" }));
    expect(rows[1]).toHaveTextContent(formatMoneyLocalized(-3_145_500, { language: "uz" }));
    expect(rows[2]).toHaveTextContent(formatMoneyLocalized(150_000, { language: "uz" }));
    expect(within(card).getByText("3 ta")).toBeInTheDocument();
    expect(within(card).getByText(formatMoneyLocalized(-7_815_500, { language: "uz" }))).toBeInTheDocument();
    expect(screen.queryByText(/Eng katta/)).not.toBeInTheDocument();
  });

  it("⭐ sanoq `nonZeroCount` dan; kesilgan ro'yxat — «Yana ko'rsatish · N ta» ochiladigan qatorlar, keyin «eng katta N tasi» izohi", async () => {
    const user = userEvent.setup();
    render({ allMarketCashboxes: party(20, "Market"), nonZeroCount: 57, truncated: true, marketsTotalBalans: -1 });

    expect(screen.getByText("57 ta")).toBeInTheDocument();
    expect(rowsOf(MARKETS)).toHaveLength(10);
    expect(screen.queryByText(/Eng katta/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yana ko'rsatish · 10 ta" }));

    expect(rowsOf(MARKETS)).toHaveLength(20);
    expect(screen.getByText("Eng katta 20 tasi ko'rsatilgan · jami 57 ta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kamroq ko'rsatish" })).toHaveAttribute("aria-expanded", "true");
  });

  it("kesilgan ro'yxat sig'adigan bo'lsa — tugma yo'q, izoh darhol; sanoq kuryerlarda ham `nonZeroCount` dan", () => {
    render({ allMarketCashboxes: [] }, { allCourierCashboxes: party(5, "Kuryer"), nonZeroCount: 8, truncated: true });

    expect(rowsOf(COURIERS)).toHaveLength(5);
    expect(screen.getByText("8 ta")).toBeInTheDocument();
    expect(screen.getByText("Eng katta 5 tasi ko'rsatilgan · jami 8 ta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yana ko'rsatish/ })).not.toBeInTheDocument();
  });

  it("telefonda (maket) — 3 qator va «Yana ko'rsatish · 3 ta»; eski javobda sanoq yuklangan qatorlardan, izoh yo'q", async () => {
    device.phone = true;
    const user = userEvent.setup();
    render({ allMarketCashboxes: party(6, "Market"), marketsTotalBalans: -1 });

    expect(screen.getByText("6 ta")).toBeInTheDocument();
    expect(rowsOf(MARKETS)).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Yana ko'rsatish · 3 ta" }));

    expect(rowsOf(MARKETS)).toHaveLength(6);
    expect(screen.queryByText(/Eng katta/)).not.toBeInTheDocument();
  });
});
