import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Asosiy kassa — smena (kfdfYDik, CB-1; ega javoblari CB-S1…S5) va FIX3B:
 *  - holat: `GET /finance/shift/current` (superadmin, admin, menejer — kassa doirasi JWT'dan). Smena yo'q →
 *    «Smena boshlanmagan» banneri, «Tezkor amallar» qulfi («Smena ochilgach ishlaydi»), «Smenani ochish» asosiy
 *    tugma → ochish oynasi → `POST /finance/shift/open { comment? }`;
 *  - smena ochiq → «Smena ochiq · … · Ochgan xodim: <ism>» (boshqa xodim — `GET users/:id`), «Smenani yopish» →
 *    sanash oynasi → `POST /finance/shift/close { shift_id, closing_balance_cash, closing_balance_card?, comment? }`
 *    → natija oynasi (POST javobidan) + Excel avtomatik;
 *  - xatoda oyna ochiq qoladi, xom backend matni ko'rsatilmaydi; holat noma'lum (403) — amal va qulf yo'q.
 *  - «Marketga to'lov» menejerga ko'rsatilmaydi; D1 — SA/admin tarixi faqat asosiy kassa.
 *
 * Haqiqiy `useCashBox` (react-query) va haqiqiy oynalar — faqat HTTP qatlami (`api`) almashtirilgan.
 */

type RequestConfig = { params?: Record<string, unknown> };
type ShiftRow = { id: string; opened_by: string; opened_at?: string };

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const exportReport = vi.hoisted(() => vi.fn());
/** Serverdagi smena holati (finance-service `shifts`). */
const server = vi.hoisted(() => ({
  openShift: null as null | ShiftRow,
  currentError: null as null | number,
  openError: false,
  closeError: null as null | { status: number; message: string },
  historyItems: [] as Array<Record<string, unknown>>,
  users: {} as Record<string, string>,
  lastCloseBody: null as null | Record<string, unknown>,
}));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: exportReport }));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./CashboxFormPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));
vi.mock("../../../shared/components/popupSelect", () => ({ default: () => null }));

const CURRENT_URL = "finance/shift/current";
const HISTORY_URL = "finance/history";
const MAIN_URL = "finance/cashbox/main";
const SHIFT_OPEN_URL = "finance/shift/open";
const SHIFT_CLOSE_URL = "finance/shift/close";

const OPEN_SHIFT = "Smenani ochish";
const CLOSE_SHIFT = "Smenani yopish";

const userSlice = (user: Record<string, unknown>) => ({
  user,
  isAuthenticated: true,
  accessToken: "token",
  loading: false,
  isAppInitializing: false,
  error: null,
});
const superadmin = {
  role: { id: "1", role: "superadmin", region: null, name: "Shodiyor Ergashev" },
  user: userSlice({ id: "1", name: "Shodiyor Ergashev", role: "superadmin" }),
} as never;
const admin = {
  role: { id: "7", role: "admin", region: null, name: "Admin 7" },
  user: userSlice({ id: "7", name: "Admin 7", role: "admin" }),
} as never;
/** HQ menejeri — ilgari "Marketga to'lov" faqat REGIONAL/HYBRID menejerdan yashirilardi. */
const hqManager = {
  role: { id: "198", role: "manager", region: null, name: "HQ menejeri" },
  user: userSlice({
    id: "198",
    name: "Ravshan Ortiqov",
    role: "manager",
    branch: { id: "1", branch: { id: "1", name: "Urgut filiali", type: "HQ" } },
  }),
} as never;

const open = (preloadedState: never) =>
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState });

const historyCalls = () =>
  http.get.mock.calls
    .filter(([url]) => url === HISTORY_URL)
    .map(([, config]) => (config as RequestConfig | undefined)?.params);
const currentCalls = () => http.get.mock.calls.filter(([url]) => url === CURRENT_URL);
const postsTo = (url: string) =>
  http.post.mock.calls.filter(([postUrl]) => postUrl === url).map(([, body]) => body);

const httpError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { statusCode: status, message } },
  });

beforeEach(() => {
  server.openShift = null;
  server.currentError = null;
  server.openError = false;
  server.closeError = null;
  server.historyItems = [];
  server.users = {};
  server.lastCloseBody = null;
  exportReport.mockReset();
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();

  http.get.mockImplementation(async (url: string) => {
    if (url === CURRENT_URL) {
      if (server.currentError) throw httpError(server.currentError, "Managerning branch'i topilmadi");
      return {
        data: {
          statusCode: 200,
          message: server.openShift ? "Current shift" : "Ochiq smena yo'q",
          data: {
            shift: server.openShift
              ? { opened_at: "2026-10-01T04:00:00.000Z", ...server.openShift, status: "open", closed_by: null }
              : null,
            required: false,
            cashbox_user_id: "0",
          },
        },
      };
    }
    if (url === MAIN_URL) {
      return {
        data: {
          statusCode: 200,
          data: { cashbox: { balance: 24_615_000, balance_cash: 18_240_000, balance_card: 6_375_000 }, cashboxHistory: [] },
        },
      };
    }
    if (url === HISTORY_URL) {
      return {
        data: {
          statusCode: 200,
          data: { items: server.historyItems, pagination: { total: server.historyItems.length, page: 1, limit: 10000 } },
        },
      };
    }
    const userMatch = /^users\/(\d+)$/.exec(url);
    if (userMatch) {
      const name = server.users[userMatch[1]];
      if (!name) throw httpError(404, "User not found");
      return { data: { statusCode: 200, data: { id: userMatch[1], name } } };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });

  http.post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
    if (url === SHIFT_OPEN_URL) {
      if (server.openError) throw httpError(400, "Bu kassada allaqachon ochiq smena bor (smena #9)");
      server.openShift = { id: "13", opened_by: "1", opened_at: new Date().toISOString() };
      return { data: { statusCode: 201, message: "Shift opened", data: { id: "13", status: "open" } } };
    }
    if (url === SHIFT_CLOSE_URL) {
      if (server.closeError) {
        const { status, message } = server.closeError;
        throw httpError(status, message);
      }
      server.lastCloseBody = body;
      const shift = server.openShift;
      server.openShift = null;
      const cash = Number(body.closing_balance_cash);
      const card = body.closing_balance_card === undefined ? null : Number(body.closing_balance_card);
      return {
        data: {
          statusCode: 200,
          message: "Shift closed",
          data: {
            id: shift?.id ?? String(body.shift_id),
            opened_by: shift?.opened_by ?? "1",
            closed_by: "1",
            status: "closed",
            opened_at: "2026-10-01T04:00:00.000Z",
            closed_at: "2026-10-01T13:05:00.000Z",
            opening_balance_cash: "11270000.00",
            opening_balance_card: "8775000.00",
            total_income_cash: "6970000.00",
            total_income_card: "0.00",
            total_expense_cash: "0.00",
            total_expense_card: "2400000.00",
            expected_balance_cash: "18240000.00",
            expected_balance_card: "6375000.00",
            closing_balance_cash: cash,
            closing_balance_card: card ?? 0,
            discrepancy_cash: cash - 18_240_000,
            discrepancy_card: card === null ? null : card - 6_375_000,
            comment: body.comment ?? null,
          },
        },
      };
    }
    throw new Error(`unexpected POST ${url}`);
  });
});

const actionTile = (name: RegExp) => screen.getByRole("button", { name });

describe("Shift state — GET finance/shift/current (kfdfYDik)", () => {
  it("superadmin without a shift: banner, locked quick actions and a primary «Smenani ochish»", async () => {
    open(superadmin);

    const openButton = await screen.findByRole("button", { name: OPEN_SHIFT });
    expect(currentCalls()[0]).toEqual([CURRENT_URL]);
    expect(screen.queryByRole("button", { name: CLOSE_SHIFT })).not.toBeInTheDocument();
    expect(screen.getByText("Asosiy kassa boshqaruvi · smena yopiq")).toBeInTheDocument();

    const banner = screen.getByTestId("shift-banner");
    expect(within(banner).getByText("Smena boshlanmagan")).toBeInTheDocument();
    expect(within(banner).getByText(/Pul qabul qilish, marketga to'lov, xarajat va kassani to'ldirish/)).toBeInTheDocument();

    expect(screen.getByText("Smena ochilgach ishlaydi")).toBeInTheDocument();
    for (const name of [/Pul qabul qilish/, /Marketga to'lov/, /Kassadan xarajat/, /Kassani to'ldirish/]) {
      expect(actionTile(name)).toBeDisabled();
      expect(actionTile(name)).toHaveAccessibleDescription("Smena ochilgach ishlaydi");
    }
    // Excel har doim ishlaydi.
    expect(screen.getByRole("button", { name: /Excelga yuklash/ })).toBeEnabled();
    expect(openButton).toBeEnabled();
  });

  it("an open shift by another admin: no lock, «Smena ochiq · … · Ochgan xodim» with the name from GET users/:id", async () => {
    server.openShift = { id: "12", opened_by: "5" };
    server.users = { "5": "Nilufar Rashidova" };
    open(superadmin);

    expect(await screen.findByRole("button", { name: CLOSE_SHIFT })).toBeInTheDocument();
    expect(screen.getByText("Asosiy kassa boshqaruvi · smena ochiq")).toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
    expect(actionTile(/Kassadan xarajat/)).toBeEnabled();
    expect(screen.getByText(/^Smena ochiq · 01\.10\.2026, \d{2}:\d{2} dan$/)).toBeInTheDocument();
    expect(await screen.findByText("Ochgan xodim: Nilufar Rashidova")).toBeInTheDocument();
  });

  it("the opener name falls back to «—» when GET users/:id fails", async () => {
    server.openShift = { id: "12", opened_by: "5" };
    open(superadmin);

    expect(await screen.findByText("Ochgan xodim: —")).toBeInTheDocument();
  });

  it("when shift/current fails (403), no shift action, no banner and no lock (fail open for the tiles)", async () => {
    server.currentError = 403;
    open(hqManager);

    await waitFor(() => expect(currentCalls()).toHaveLength(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole("button", { name: OPEN_SHIFT })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CLOSE_SHIFT })).not.toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
    expect(actionTile(/Kassadan xarajat/)).toBeEnabled();
    // Xom backend matni chiqmaydi (so'rov jim).
    expect(screen.queryByText("Managerning branch'i topilmadi")).not.toBeInTheDocument();
  });
});

describe("Open shift dialog", () => {
  it("superadmin: the dialog shows the opener, «hozir» and the live opening balance; posts { comment }", async () => {
    const user = userEvent.setup();
    open(superadmin);

    await user.click(await screen.findByRole("button", { name: OPEN_SHIFT }));
    const dialog = await screen.findByRole("dialog", { name: OPEN_SHIFT });
    expect(within(dialog).getByText("Asosiy kassa · yangi smena boshlanadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Ochadigan xodim")).toBeInTheDocument();
    expect(within(dialog).getByText("Shodiyor Ergashev")).toBeInTheDocument();
    expect(within(dialog).getByText("hozir")).toBeInTheDocument();
    expect(within(dialog).getByText("18 240 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByText("Karta (Click)")).toBeInTheDocument();
    expect(within(dialog).getByText("6 375 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByText("24 615 000 so'm")).toBeInTheDocument();
    // Oxirgi smena ogohlantirishi — `last_closed` backendda yo'q, chizilmaydi.
    expect(within(dialog).queryByText(/Oxirgi smena/)).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Izoh/), "Kechki smena");
    await user.click(within(dialog).getByRole("button", { name: OPEN_SHIFT }));

    await waitFor(() => expect(postsTo(SHIFT_OPEN_URL)).toEqual([{ comment: "Kechki smena" }]));
    expect(await screen.findByText("Smena ochildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Holat qayta o'qildi — endi yopish taklif qilinadi, qulf olindi.
    expect(await screen.findByRole("button", { name: CLOSE_SHIFT })).toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
    expect(actionTile(/Kassadan xarajat/)).toBeEnabled();
    expect(screen.getByText("Ochgan xodim: Shodiyor Ergashev")).toBeInTheDocument();
  });

  it("a failed open keeps the dialog, shows a generic error (not the raw backend text)", async () => {
    server.openError = true;
    const user = userEvent.setup();
    open(superadmin);

    await user.click(await screen.findByRole("button", { name: OPEN_SHIFT }));
    const dialog = await screen.findByRole("dialog", { name: OPEN_SHIFT });
    await user.click(within(dialog).getByRole("button", { name: OPEN_SHIFT }));

    expect(await screen.findByText("Smenani ochishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.queryByText(/allaqachon ochiq smena bor/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: OPEN_SHIFT })).toBeInTheDocument();
    expect(postsTo(SHIFT_OPEN_URL)).toEqual([{}]);
  });

  it("manager: own branch — branch banner text, «Urgut filiali kassasi» and «Karta» in the dialog", async () => {
    const user = userEvent.setup();
    open(hqManager);

    expect(await screen.findByText("Urgut filiali · smena yopiq")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("shift-banner")).getByText(/^Kuryerdan qabul qilish, xarajat va kassani to'ldirish/),
    ).toBeInTheDocument();
    expect(actionTile(/Kuryerdan qabul qilish/)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: OPEN_SHIFT }));
    const dialog = await screen.findByRole("dialog", { name: OPEN_SHIFT });
    expect(within(dialog).getByText("Urgut filiali kassasi · yangi smena boshlanadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Ravshan Ortiqov")).toBeInTheDocument();
    expect(within(dialog).getByText("Karta")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: OPEN_SHIFT }));
    await waitFor(() => expect(postsTo(SHIFT_OPEN_URL)).toEqual([{}]));
  });
});

describe("Close shift dialog → result", () => {
  const openCloseDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: CLOSE_SHIFT }));
    return screen.findByRole("dialog", { name: CLOSE_SHIFT });
  };

  it("counted cash is required; nothing is posted without it", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    const user = userEvent.setup();
    open(superadmin);

    const dialog = await openCloseDialog(user);
    expect(within(dialog).getByText("Joriy smena")).toBeInTheDocument();
    expect(within(dialog).getByText(/01\.10\.2026, \d{2}:\d{2} dan/)).toBeInTheDocument();
    expect(within(dialog).getByText("Shodiyor Ergashev")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Sanalmadi")).toHaveLength(2);

    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    expect(await within(dialog).findByText("Sanalgan naqd summasini kiriting")).toBeInTheDocument();
    expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(0);
  });

  it("a shortage requires a comment; the result dialog shows the POST response and «Karta sanalmadi»; Excel downloads", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    const user = userEvent.setup();
    open(superadmin);

    const dialog = await openCloseDialog(user);
    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18090000");
    expect(within(dialog).getByText("−150 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByText("Kamomad")).toBeInTheDocument();
    expect(within(dialog).getByText("Farq bor — sababini izohga yozing")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    expect(await within(dialog).findByText("Farq bor — izoh yozing")).toBeInTheDocument();
    expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/^Izoh/), "Naqd ikki marta sanaldi");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));

    await waitFor(() => expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(1));
    expect(postsTo(SHIFT_CLOSE_URL)[0]).toEqual({
      shift_id: "12",
      closing_balance_cash: 18_090_000,
      comment: "Naqd ikki marta sanaldi",
    });
    await waitFor(() => expect(exportReport).toHaveBeenCalledTimes(1));

    const result = await screen.findByRole("dialog", { name: "Smena yopildi" });
    expect(within(result).getByText(/· Asosiy kassa$/)).toBeInTheDocument();
    const table = within(result).getByRole("table", { name: "Smena natijasi: naqd va karta" });
    expect(within(table).getByText("11 270 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("+6 970 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("−2 400 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("18 090 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("Kamomad")).toBeInTheDocument();
    expect(within(table).getAllByText("Sanalmadi")).toHaveLength(2);
    expect(within(result).getByText("Karta sanalmadi — karta bo'yicha farq hisoblanmadi.")).toBeInTheDocument();
    expect(within(result).getByText("Naqd ikki marta sanaldi")).toBeInTheDocument();
    expect(within(result).getByText("Excel hisobot yuklab olindi. Kerak bo'lsa qayta yuklang.")).toBeInTheDocument();

    await user.click(within(result).getByRole("button", { name: /Excelga yuklash/ }));
    expect(exportReport).toHaveBeenCalledTimes(2);
    await user.click(within(result).getByRole("button", { name: "Tayyor" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Smena yopildi — yana ochish taklif qilinadi, qulf qaytdi.
    expect(await screen.findByRole("button", { name: OPEN_SHIFT })).toBeInTheDocument();
    expect(screen.getByTestId("shift-banner")).toBeInTheDocument();
  });

  it("matching amounts need no comment and post the counted card too", async () => {
    server.openShift = { id: "21", opened_by: "7" };
    const user = userEvent.setup();
    open(admin);

    const dialog = await openCloseDialog(user);
    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    await user.type(within(dialog).getByLabelText(/^Sanalgan karta/), "6375000");
    expect(within(dialog).getAllByText("Mos keldi")).toHaveLength(2);
    expect(within(dialog).queryByText("Farq bor — sababini izohga yozing")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));

    await waitFor(() => expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(1));
    expect(postsTo(SHIFT_CLOSE_URL)[0]).toEqual({
      shift_id: "21",
      closing_balance_cash: 18_240_000,
      closing_balance_card: 6_375_000,
    });
    const result = await screen.findByRole("dialog", { name: "Smena yopildi" });
    expect(within(result).getAllByText("Mos keldi").length).toBeGreaterThan(0);
    expect(within(result).queryByText(/Karta sanalmadi/)).not.toBeInTheDocument();
    expect(within(result).getAllByText("Admin 7").length).toBeGreaterThan(0);
  });

  it("a surplus is shown as «Ortiqcha»", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    const user = userEvent.setup();
    open(superadmin);

    const dialog = await openCloseDialog(user);
    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18260000");
    expect(within(dialog).getByText("+20 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByText("Ortiqcha")).toBeInTheDocument();
  });

  it("a failed close keeps the dialog, shows a generic error and does not export", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    server.closeError = { status: 400, message: "Smena allaqachon yopilgan" };
    const user = userEvent.setup();
    open(superadmin);

    const dialog = await openCloseDialog(user);
    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));

    expect(await screen.findByText("Smenani yopishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.queryByText("Smena allaqachon yopilgan")).not.toBeInTheDocument();
    expect(exportReport).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: CLOSE_SHIFT })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Smena yopildi" })).not.toBeInTheDocument();
  });
});

describe("Market payout action — SUPERADMIN/ADMIN only (backend 403 for managers)", () => {
  it("HQ manager: no 'Marketga to'lov' action (the other actions stay)", async () => {
    open(hqManager);

    expect(await screen.findByRole("button", { name: /Kassadan xarajat/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kassani to'ldirish/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kuryerdan qabul qilish/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marketga to'lov/ })).not.toBeInTheDocument();
  });

  it.each([
    ["superadmin", superadmin],
    ["admin", admin],
  ])("%s: 'Marketga to'lov' is shown", async (_label, preloadedState) => {
    open(preloadedState as never);

    expect(await screen.findByRole("button", { name: /Marketga to'lov/ })).toBeInTheDocument();
  });
});

describe("D1 — the main cashbox history is main-cashbox only for superadmin/admin", () => {
  it.each([
    ["superadmin", superadmin],
    ["admin", admin],
  ])("%s: GET /finance/history asks for cashbox_type=main", async (_label, preloadedState) => {
    open(preloadedState as never);

    await waitFor(() => expect(historyCalls().length).toBeGreaterThan(0));
    expect(historyCalls().at(-1)).toEqual({ page: 1, limit: 10000, cashbox_type: "main" });
  });

  it("manager: the history request is unchanged (no cashbox_type — the gateway pins the own branch cashbox)", async () => {
    open(hqManager);

    await waitFor(() => expect(historyCalls().length).toBeGreaterThan(0));
    expect(historyCalls().at(-1)).toEqual({ page: 1, limit: 10000 });
  });

  it("superadmin: the table and the Excel report use exactly the main-cashbox rows", async () => {
    server.historyItems = [
      {
        id: "501",
        amount: 2_000_000,
        operation_type: "income",
        source_type: "manual_income",
        payment_method: "cash",
        cashbox_type: "main",
        comment: "Bank hisobidan naqd olindi",
        balance_after: 24_615_000,
        createdAt: "2026-10-08T09:30:00.000Z",
      },
    ];
    const user = userEvent.setup();
    open(superadmin);

    expect((await screen.findAllByText("Qo'lda kirim")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Excelga yuklash/ }));

    expect(exportReport).toHaveBeenCalledTimes(1);
    expect(exportReport.mock.calls[0][0]).toEqual(
      expect.objectContaining({ rows: server.historyItems, fromDate: undefined, toDate: undefined }),
    );
  });
});
