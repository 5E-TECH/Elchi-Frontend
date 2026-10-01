import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * FIX3B — Asosiy kassa:
 *  - FE-PAY-06: "Smenani ochish / yopish" faqat superadmin/admin uchun.
 *    GET /finance/shift?status=open&opened_by=<o'zi> → ochiq smena yo'q bo'lsa
 *    "Smenani ochish" (POST /finance/shift/open { opened_by }), bor bo'lsa
 *    "Smenani yopish" (POST /finance/shift/close { closed_by, shift_id,
 *    comment? }) va keyin Excel hisobot. Menejerga ko'rsatilmaydi.
 *  - "Marketga to'lov" menejerga (HQ menejeri ham) ko'rsatilmaydi — backend
 *    POST /finance/cashbox/payment/market faqat SUPERADMIN/ADMIN.
 *
 * Haqiqiy `useCashBox` (react-query) va haqiqiy `CloseShiftPopup` ishlatiladi —
 * faqat HTTP qatlami (`api`) almashtirilgan, so'rov tanasi aynan tekshiriladi.
 */

type RequestConfig = { params?: Record<string, unknown> };

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const exportReport = vi.hoisted(() => vi.fn());
/** Serverdagi smena holati (finance-service `shifts`). */
const server = vi.hoisted(() => ({
  openShift: null as null | { id: string; opened_by: string },
  failShiftList: false,
  closeError: null as null | { status: number; message: string },
}));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: exportReport }));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../../../shared/ui/DateRangePicker", () => ({ default: () => null }));
vi.mock("./PaymentHistoryList", () => ({ default: () => null }));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./CashboxFormPopup", () => ({ default: () => null }));
vi.mock("../../../shared/components/popupSelect", () => ({ default: () => null }));

const SHIFT_URL = "finance/shift";
const SHIFT_OPEN_URL = "finance/shift/open";
const SHIFT_CLOSE_URL = "finance/shift/close";

const OPEN_SHIFT = "Smenani ochish";
const CLOSE_SHIFT = "Smenani yopish";

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const admin = {
  role: { id: "7", role: "admin", region: null, name: "Admin 7" },
  user: {
    user: { id: "7", name: "Admin 7", role: "admin" },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;
/** HQ menejeri — ilgari "Marketga to'lov" faqat REGIONAL/HYBRID menejerdan yashirilardi. */
const hqManager = {
  role: { id: "198", role: "manager", region: null, name: "HQ menejeri" },
  user: {
    user: {
      id: "198",
      name: "HQ menejeri",
      role: "manager",
      branch: { id: "1", name: "Bosh ofis", type: "HQ" },
    },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const open = (preloadedState: never) =>
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState });

const shiftListCalls = () =>
  http.get.mock.calls
    .filter(([url]) => url === SHIFT_URL)
    .map(([, config]) => (config as RequestConfig | undefined)?.params);
const postsTo = (url: string) =>
  http.post.mock.calls.filter(([postUrl]) => postUrl === url).map(([, body]) => body);

beforeEach(() => {
  server.openShift = null;
  server.failShiftList = false;
  server.closeError = null;
  exportReport.mockReset();
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();

  http.get.mockImplementation(async (url: string) => {
    if (url === SHIFT_URL) {
      if (server.failShiftList) {
        throw Object.assign(new Error("Request failed with status code 500"), {
          response: { status: 500, data: { statusCode: 500, message: "Internal server error" } },
        });
      }
      const items = server.openShift
        ? [
            {
              ...server.openShift,
              status: "open",
              opened_at: "2026-10-01T04:00:00.000Z",
              closed_by: null,
            },
          ]
        : [];
      return {
        data: {
          statusCode: 200,
          message: "Shifts list",
          data: {
            items,
            pagination: { total: items.length, page: 1, limit: 1, totalPages: items.length },
          },
        },
      };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });

  http.post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
    if (url === SHIFT_OPEN_URL) {
      server.openShift = { id: "13", opened_by: String(body.opened_by) };
      return {
        data: { statusCode: 201, message: "Shift opened", data: { id: "13", status: "open" } },
      };
    }
    if (url === SHIFT_CLOSE_URL) {
      if (server.closeError) {
        const { status, message } = server.closeError;
        throw Object.assign(new Error(`Request failed with status code ${status}`), {
          response: { status, data: { statusCode: status, message } },
        });
      }
      server.openShift = null;
      return {
        data: { statusCode: 200, message: "Shift closed", data: { id: "12", status: "closed" } },
      };
    }
    throw new Error(`unexpected POST ${url}`);
  });
});

describe("FE-PAY-06 — shift open/close on the main cashbox (superadmin/admin)", () => {
  it("superadmin without an open shift: asks for its own open shift, then 'Smenani ochish' posts exactly { opened_by }", async () => {
    open(superadmin);

    const openButton = await screen.findByRole("button", { name: OPEN_SHIFT });
    expect(screen.queryByRole("button", { name: CLOSE_SHIFT })).not.toBeInTheDocument();
    expect(shiftListCalls()[0]).toEqual({ status: "open", opened_by: "1", limit: 1 });

    await userEvent.setup().click(openButton);

    await waitFor(() => expect(postsTo(SHIFT_OPEN_URL)).toHaveLength(1));
    expect(postsTo(SHIFT_OPEN_URL)[0]).toEqual({ opened_by: "1" });
    expect(await screen.findByText("Smena ochildi")).toBeInTheDocument();
    // Smena holati qayta o'qildi — endi yopish taklif qilinadi.
    expect(await screen.findByRole("button", { name: CLOSE_SHIFT })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: OPEN_SHIFT })).not.toBeInTheDocument();
    expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(0);
  });

  it("superadmin with an open shift: 'Smenani yopish' posts { closed_by, shift_id, comment }, then downloads the Excel report", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    const user = userEvent.setup();
    open(superadmin);

    await user.click(await screen.findByRole("button", { name: CLOSE_SHIFT }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Excel hisobot yuklab olinadi/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Izoh (ixtiyoriy)"), "Kun yakuni");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));

    await waitFor(() => expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(1));
    expect(postsTo(SHIFT_CLOSE_URL)[0]).toEqual({
      closed_by: "1",
      shift_id: "12",
      comment: "Kun yakuni",
    });
    expect(await screen.findByText("Smena muvaffaqiyatli yopildi")).toBeInTheDocument();
    await waitFor(() => expect(exportReport).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Smena yopildi — yana ochish taklif qilinadi.
    expect(await screen.findByRole("button", { name: OPEN_SHIFT })).toBeInTheDocument();
    expect(postsTo(SHIFT_OPEN_URL)).toHaveLength(0);
  });

  it("closing without a comment sends no comment field", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    const user = userEvent.setup();
    open(superadmin);

    await user.click(await screen.findByRole("button", { name: CLOSE_SHIFT }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: CLOSE_SHIFT }),
    );

    await waitFor(() => expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(1));
    expect(postsTo(SHIFT_CLOSE_URL)[0]).toEqual({ closed_by: "1", shift_id: "12" });
  });

  it("a failed close shows the backend error, keeps the popup and does not export", async () => {
    server.openShift = { id: "12", opened_by: "1" };
    server.closeError = { status: 400, message: "Shift is already closed" };
    const user = userEvent.setup();
    open(superadmin);

    await user.click(await screen.findByRole("button", { name: CLOSE_SHIFT }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: CLOSE_SHIFT }),
    );

    expect(await screen.findByText("Shift is already closed")).toBeInTheDocument();
    expect(exportReport).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("admin: the shift is opened and closed under the admin's own id", async () => {
    server.openShift = { id: "21", opened_by: "7" };
    const user = userEvent.setup();
    open(admin);

    await user.click(await screen.findByRole("button", { name: CLOSE_SHIFT }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: CLOSE_SHIFT }),
    );

    await waitFor(() => expect(postsTo(SHIFT_CLOSE_URL)).toHaveLength(1));
    expect(shiftListCalls()[0]).toEqual({ status: "open", opened_by: "7", limit: 1 });
    expect(postsTo(SHIFT_CLOSE_URL)[0]).toEqual({ closed_by: "7", shift_id: "21" });

    await user.click(await screen.findByRole("button", { name: OPEN_SHIFT }));
    await waitFor(() => expect(postsTo(SHIFT_OPEN_URL)).toHaveLength(1));
    expect(postsTo(SHIFT_OPEN_URL)[0]).toEqual({ opened_by: "7" });
  });

  it("manager: no shift button and the shift list is never requested", async () => {
    open(hqManager);

    expect(await screen.findByRole("button", { name: /Excel/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: OPEN_SHIFT })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CLOSE_SHIFT })).not.toBeInTheDocument();
    expect(shiftListCalls()).toHaveLength(0);
  });

  it("when the open-shift lookup fails, no shift action is offered (fail closed) and Excel stays", async () => {
    server.failShiftList = true;
    open(superadmin);

    await waitFor(() => expect(shiftListCalls()).toHaveLength(1));
    // Xato holati react-query'da qayd etilguncha kutiladi.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole("button", { name: OPEN_SHIFT })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CLOSE_SHIFT })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excel/ })).toBeInTheDocument();
    expect(postsTo(SHIFT_OPEN_URL)).toHaveLength(0);
  });
});

describe("Market payout action — SUPERADMIN/ADMIN only (backend 403 for managers)", () => {
  it("HQ manager: no 'Marketga to'lov' action (the other actions stay)", async () => {
    open(hqManager);

    expect(await screen.findByTitle("Kassadan xarajat")).toBeInTheDocument();
    expect(screen.getByTitle("Kassani to'ldirish")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuryer" })).toBeInTheDocument();
    expect(screen.queryByTitle("Marketga to'lov")).not.toBeInTheDocument();
  });

  it.each([
    ["superadmin", superadmin],
    ["admin", admin],
  ])("%s: 'Marketga to'lov' is shown", async (_label, preloadedState) => {
    open(preloadedState as never);

    expect(await screen.findByTitle("Marketga to'lov")).toBeInTheDocument();
  });
});
