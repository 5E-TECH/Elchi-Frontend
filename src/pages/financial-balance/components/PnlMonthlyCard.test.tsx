import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { api } from "../../../shared/api/api";
import { formatCompactMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { renderWithProviders } from "../../../test/test-utils";
import PnlMonthlyCard from "./PnlMonthlyCard";

/**
 * «Oylik daromad va sof foyda» (Balans → Tahlil, ega 2026-11-28): `GET /finance/pnl?granularity=month`, qiymatlar
 * backend'dan (qayta hisoblanmaydi), qo'lda kirim alohida, 403 — karta yashirinadi.
 */

const NOW = new Date("2026-11-28T10:00:00.000Z");

const item = (period: string, gross: number, opex: number, otherIncome = 0) => ({
  period,
  gross,
  opex,
  net: gross - opex,
  other_income: otherIncome,
});

const months = (fromDay: string) => {
  const [year, month] = fromDay.split("-").map(Number);
  const list: string[] = [];
  for (let index = year * 12 + month - 1; index <= 2026 * 12 + 10; index += 1) {
    list.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }
  return list;
};

const payload = (fromDay: string, values: Record<string, ReturnType<typeof item>>) => {
  const items = months(fromDay).map((period) => values[period] ?? item(period, 0, 0));
  const total = (key: "gross" | "opex" | "net" | "other_income") => items.reduce((sum, row) => sum + row[key], 0);
  return {
    statusCode: 200,
    data: {
      from_day: fromDay,
      to_day: "2026-11-28",
      granularity: "month",
      items,
      totals: { gross: total("gross"), opex: total("opex"), net: total("net"), other_income: total("other_income") },
    },
  };
};

const VALUES = {
  "2026-09": item("2026-09", 41_250_000, 18_400_000, 5_000_000),
  "2026-11": item("2026-11", 38_900_000, 41_300_000),
};

let getSpy: MockInstance<typeof api.get>;
let respond: (params: Record<string, unknown>) => unknown;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  respond = (params) => payload(String(params.from_day), VALUES);
  getSpy = vi.spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: Record<string, unknown> }) => {
    if (url !== "finance/pnl") throw new Error(`kutilmagan so'rov: ${url}`);
    const result = respond(config?.params ?? {});
    if (result instanceof Error) throw result;
    return { data: result };
  }) as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: {} } });

describe("PnlMonthlyCard", () => {
  it("⭐ 12 oy sukut: jami daromad / xarajat / sof foyda, legenda va izohlar", async () => {
    renderWithProviders(<PnlMonthlyCard />);

    await screen.findByText("Jami daromad");
    const card = screen.getByRole("region", { name: "Oylik daromad va sof foyda" });
    expect(getSpy).toHaveBeenCalledWith("finance/pnl", { params: { from_day: "2025-12-01", granularity: "month" } });
    expect(within(card).getByText("Butun tizim · dekabr 2025 – noyabr 2026")).toBeInTheDocument();

    const summary = within(card).getByText("Jami daromad").closest("dl") as HTMLElement;
    expect(within(summary).getByText(formatCompactMoneyLocalized(80_150_000, { language: "uz" }))).toBeInTheDocument();
    expect(within(summary).getByText(formatCompactMoneyLocalized(59_700_000, { language: "uz" }))).toBeInTheDocument();
    expect(within(summary).getByText(formatCompactMoneyLocalized(20_450_000, { language: "uz" }))).toBeInTheDocument();

    expect(within(card).getByRole("img", { name: /Oylik daromad, xarajat va sof foyda, dekabr 2025 – noyabr 2026/ })).toBeInTheDocument();
    expect(within(card).getByText("Sof foyda (daromad − xarajat)")).toBeInTheDocument();
    expect(within(card).getByText(/buyurtma qo'shimcha xarajati kirmaydi/)).toBeInTheDocument();
    expect(within(card).getByText(/Qo'lda kirim \(5 000 000 so'm\) sof foydaga qo'shilmagan/)).toBeInTheDocument();
    expect(within(card).getByText("Noyabr 2026 hali tugamagan — bugungacha.")).toBeInTheDocument();
  });

  it("6 oy tanlansa — yangi oraliq so'raladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PnlMonthlyCard />);
    await screen.findByText("Jami daromad");

    await user.click(screen.getByRole("radio", { name: "6 oy" }));

    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith("finance/pnl", { params: { from_day: "2026-06-01", granularity: "month" } }),
    );
    expect(await screen.findByText("Butun tizim · iyun 2026 – noyabr 2026")).toBeInTheDocument();
  });

  it("«Jadval»: yangi oy tepada, joriy oy belgisi, zarar qizil, qo'lda kirim ustuni, «Jami» qatori", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PnlMonthlyCard />);
    await screen.findByText("Jami daromad");

    await user.click(screen.getByRole("radio", { name: "Jadval" }));

    const table = screen.getByRole("table", { name: "Oylik daromad va sof foyda" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(13);
    expect(within(rows[0]).getByText("Noyabr 2026")).toBeInTheDocument();
    expect(within(rows[0]).getByText("joriy oy")).toBeInTheDocument();
    expect(within(rows[0]).getByText(formatSignedMoneyLocalized(-2_400_000, { language: "uz" }))).toHaveClass("text-danger-fg");
    expect(within(rows[2]).getByText("Sentabr 2026")).toBeInTheDocument();
    expect(within(rows[2]).getByText("5 000 000 so'm")).toBeInTheDocument();
    expect(within(rows[12]).getByText("Jami")).toBeInTheDocument();
    expect(within(rows[12]).getByText(formatSignedMoneyLocalized(20_450_000, { language: "uz" }))).toBeInTheDocument();
  });

  it("hamma oy 0 — bo'sh holat", async () => {
    respond = (params) => payload(String(params.from_day), {});
    renderWithProviders(<PnlMonthlyCard />);
    expect(await screen.findByText("Bu davrda daromad va xarajat yo'q")).toBeInTheDocument();
    expect(screen.queryByText("Jami daromad")).not.toBeInTheDocument();
  });

  it("xato — «Qayta urinish» bilan", async () => {
    respond = () => httpError(400);
    renderWithProviders(<PnlMonthlyCard />);
    expect(await screen.findByText("Oylik natijani yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
  });

  it("403 (boshqa rol) — karta umuman chizilmaydi", async () => {
    respond = () => httpError(403);
    const { container } = renderWithProviders(<PnlMonthlyCard />);
    await waitFor(() => expect(getSpy).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
    expect(screen.queryByText("Oylik natijani yuklab bo'lmadi")).not.toBeInTheDocument();
  });
});
