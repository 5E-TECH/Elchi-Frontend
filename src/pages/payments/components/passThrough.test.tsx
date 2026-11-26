import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import PaymentHistoryList from "./PaymentHistoryList";
import PaymentHistoryTable, { type PaymentRow } from "./patmentHistoryTable";
import { buildDailyBalanceSeries, groupBySource, summarizeHistory } from "./lib/mainCashboxStats";
import { collapsePassThroughPairs, isPassThroughRow, passThroughView } from "./lib/passThrough";

/**
 * O'TKAZMA IZI (ega 2026-11-26; BE #800): kuryer pulni to'g'ridan-to'g'ri marketga o'tkazganda asosiy / filial
 * kassasida bir to'lovda «Kirim +X» va «Chiqim −X» qoladi (sof 0). Backend ularga `pass_through: true` qo'yadi.
 * Ro'yxatda — bitta kulrang qator («Marketga o'tkazma · Kuryer → Market · Kassaga kirmadi», ishorasiz summa),
 * jamilarda — yo'q; tafsilotda ikkala yozuv.
 */

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  }),
}));

const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

const AT = "2026-11-26T09:15:00.000Z";

const incomeLeg: PaymentRow = {
  id: "4512",
  amount: 300_000,
  operation_type: "income",
  source_type: "courier_payment",
  cashbox_type: "main",
  payment_method: "click_to_market",
  balance_after: 2_300_000,
  transfer_id: "t-1",
  pass_through: true,
  pass_through_pair_id: "4513",
  created_by_user: { id: "7", name: "Shodiyor Ergashev" },
  source_user: { id: "8", name: "Kuryer Ali" },
  payment_date: AT,
};

const expenseLeg: PaymentRow = {
  id: "4513",
  amount: 300_000,
  operation_type: "expense",
  source_type: "market_payment",
  cashbox_type: "main",
  payment_method: "click_to_market",
  balance_after: 2_000_000,
  transfer_id: "t-1",
  pass_through: true,
  pass_through_pair_id: "4512",
  created_by_user: { id: "7", name: "Shodiyor Ergashev" },
  source_user: { id: "3", name: "Baraka Shop" },
  payment_date: AT,
};

const sale: PaymentRow = {
  id: "4500",
  amount: 120_000,
  operation_type: "income",
  source_type: "sell",
  source_id: "10237",
  cashbox_type: "main",
  balance_after: 2_000_000,
  created_by_user: { id: "7", name: "Shodiyor Ergashev" },
  payment_date: "2026-11-26T08:00:00.000Z",
};

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

describe("collapsePassThroughPairs / passThroughView", () => {
  it("returns the very same array when there is no trace", () => {
    const rows = [sale];
    expect(collapsePassThroughPairs(rows)).toBe(rows);
  });

  it("keeps the first leg of a pair with its partner and drops the second", () => {
    const collapsed = collapsePassThroughPairs([expenseLeg, incomeLeg, sale]);
    expect(collapsed.map((row) => row.id)).toEqual(["4513", "4500"]);
    expect(collapsed[0].pass_through_partner?.id).toBe("4512");
    expect(isPassThroughRow(collapsed[0])).toBe(true);
    expect(isPassThroughRow(sale)).toBe(false);
  });

  it("keeps a lone leg (its pair is on another page) as a trace row", () => {
    const collapsed = collapsePassThroughPairs([incomeLeg, sale]);
    expect(collapsed.map((row) => row.id)).toEqual(["4512", "4500"]);
    expect(collapsed[0].pass_through_partner).toBeUndefined();
  });

  it("names the route courier → market and takes the balance of the later leg", () => {
    const [row] = collapsePassThroughPairs([incomeLeg, expenseLeg]);
    const view = passThroughView(row, t);
    expect(view.title).toBe("v2Common.passThrough.title");
    expect(view.from).toBe("Kuryer Ali");
    expect(view.to).toBe("Baraka Shop");
    expect(view.balanceAfter).toBe(2_000_000);
    expect(view.legs.map((leg) => leg.id)).toEqual(["4512", "4513"]);
  });

  it("titles a branch → market trace and falls back to role names", () => {
    const branchIncome: PaymentRow = {
      ...incomeLeg,
      source_type: "branch_to_main",
      source_user: null,
    };
    const view = passThroughView(branchIncome, t);
    expect(view.title).toBe("v2Common.passThrough.titleBranch");
    expect(view.from).toBe("v2Common.passThrough.party.branch");
    expect(view.to).toBe("v2Common.passThrough.party.market");
  });
});

describe("mainCashboxStats — a trace is neither income nor expense", () => {
  it("summarizeHistory and groupBySource skip trace legs", () => {
    const rows = [incomeLeg, expenseLeg, sale];
    expect(summarizeHistory(rows)).toEqual({ income: 120_000, expense: 0 });
    expect(groupBySource(rows, "income").map((bucket) => bucket.sourceType)).toEqual(["sell"]);
    expect(groupBySource(rows, "expense")).toEqual([]);
  });

  it("daily balance series keeps the balance chain but not the trace flows", () => {
    const points = buildDailyBalanceSeries([sale, incomeLeg, expenseLeg], {
      from: "2026-11-26",
      to: "2026-11-26",
      now: new Date(2026, 10, 26, 18),
    });
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ income: 120_000, expense: 0, balance: 2_000_000 });
  });
});

describe("history lists — one grey row per trace pair", () => {
  it("cash-detail list shows one «Kassaga kirmadi» row with the route and an unsigned amount", () => {
    renderWithProviders(<PaymentHistoryList data={[expenseLeg, incomeLeg, sale]} />, {
      preloadedState: asRole("superadmin"),
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const trace = items[0];
    expect(within(trace).getByText("Marketga o'tkazma")).toBeInTheDocument();
    expect(within(trace).getByText("Kuryer Ali → Baraka Shop")).toBeInTheDocument();
    expect(within(trace).getByText("Kassaga kirmadi")).toBeInTheDocument();
    const amount = within(trace).getByText(/^300\s000 so'm$/);
    expect(amount).toHaveClass("text-text-muted");
    expect(within(trace).queryByText(/[+−]300/)).not.toBeInTheDocument();
  });

  it("payments overview table shows one trace row instead of +X / −X", () => {
    renderWithProviders(<PaymentHistoryTable data={[incomeLeg, expenseLeg, sale]} viewerRole="superadmin" />, {
      preloadedState: asRole("superadmin"),
    });
    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByText("Marketga o'tkazma")).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText("Kuryer Ali → Baraka Shop")).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText("Kassaga kirmadi")).toBeInTheDocument();
    expect(within(table).queryByText(/\+300\s000/)).not.toBeInTheDocument();
    expect(within(table).queryByText(/−300\s000/)).not.toBeInTheDocument();
  });
});

describe("server-collapsed list (`collapse_pass_through`, BE #800)", () => {
  it("uses the partner the server attached: one row, full route, later-leg balance", () => {
    const serverRow: PaymentRow = { ...incomeLeg, pass_through_partner: expenseLeg };
    const collapsed = collapsePassThroughPairs([serverRow, sale]);
    expect(collapsed[0]).toBe(serverRow);
    const view = passThroughView(serverRow, t);
    expect(view.route).toBe('v2Common.passThrough.route:{"from":"Kuryer Ali","to":"Baraka Shop"}');
    expect(view.balanceAfter).toBe(2_000_000);

    renderWithProviders(<PaymentHistoryTable data={[serverRow, sale]} viewerRole="superadmin" />, {
      preloadedState: asRole("superadmin"),
    });
    const bodyRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByText("Kuryer Ali → Baraka Shop")).toBeInTheDocument();
  });
});

describe("history detail — a trace explains itself and lists both records", () => {
  it("shows the neutral title, the note and both cashbox records", async () => {
    const [row] = collapsePassThroughPairs([incomeLeg, expenseLeg]);
    renderWithProviders(<FinanceHistoryDetailPopup row={row} onClose={vi.fn()} />, {
      preloadedState: asRole("superadmin"),
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "O'tkazma izi" })).toBeInTheDocument();
    const block = within(dialog).getByRole("region", { name: "Kassaga kirmadi" });
    expect(within(block).getByText(/Kuryer Ali → Baraka Shop/)).toBeInTheDocument();
    const legs = within(within(block).getByRole("list", { name: "Kassadagi yozuvlar" })).getAllByRole("listitem");
    expect(legs.map((leg) => leg.textContent)).toEqual([
      expect.stringMatching(/^#4512 · Kirim\+300\s000 so'm$/),
      expect.stringMatching(/^#4513 · Chiqim−300\s000 so'm$/),
    ]);
    // Qoldiq — juftdan keyingi (2 000 000), oraliq 2 300 000 emas.
    expect(within(dialog).getByText(/^2\s000\s000 so'm$/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/^2\s300\s000 so'm$/)).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  });
});
