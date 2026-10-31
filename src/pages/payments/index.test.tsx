import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import Payments from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * ⚠️ `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL holati router'ning
 * o'zidan (`useLocation`) o'qiladi, `window.location`dan emas.
 */
const LocationProbe = () => {
  const { pathname, search, state } = useLocation();
  return (
    <>
      <span data-testid="pathname">{pathname}</span>
      <span data-testid="search">{search}</span>
      <span data-testid="state">{JSON.stringify(state ?? null)}</span>
    </>
  );
};

const getFinanceHistoryMock = vi.fn((params: unknown) => {
  void params;
  return {
    data: { data: { items: [], pagination: { total: 0, page: 1, limit: 10 } } },
    isLoading: false,
  };
});

const pageState = vi.hoisted(() => ({
  cashboxInfo: { data: {} } as unknown,
  managers: undefined as unknown,
  couriers: undefined as unknown,
  courierParams: [] as unknown[],
  hqCouriers: undefined as unknown,
  hqCouriersEnabled: [] as boolean[],
  currentShift: { isSuccess: false, data: undefined } as { isSuccess: boolean; data: unknown },
  /** `useGetCurrentShift(enabled)` chaqiruvlari (faqat yoqilganlari). */
  shiftRequests: 0,
  /**
   * Yoqilgan `useGetCurrentShift` chaqiruvchisi: `"lock"` — CB-2 qulfi (`useCashboxShift`), `"summary"` —
   * `PaymentSummaryCards` (faqat superadmin/admin — asosiy kassa bo'linishi uchun).
   */
  shiftCallers: [] as string[],
  /** `useGetUserById` ga berilgan ID lar (ochgan xodim ismi — CB-2 ekranlari so'ramaydi). */
  userByIdCalls: [] as unknown[],
  /** Qayta chizish (`setCurrentShift`) — mock `useSyncExternalStore` bilan obuna. */
  shiftVersion: 0,
  shiftListeners: new Set<() => void>(),
  mainCashbox: undefined as unknown,
  mainCashboxParams: [] as unknown[],
  /** uzWcMR1C — `useGetPaymentsMeta` holati va `enabled` qiymatlari. */
  paymentsMeta: { data: undefined, isLoading: false, isError: false } as { data: unknown; isLoading: boolean; isError: boolean },
  paymentsMetaEnabled: [] as boolean[],
}));
/** CB-2: `POST finance/shift/open` (menejer «To'lovlar» — smena yopiq). */
const openShiftMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
/** «Server» dagi joriy smenani almashtiradi (qayta o'qish natijasi) va obunachilarni qayta chizadi. */
const setCurrentShift = (shift: Record<string, unknown> | null) => {
  const refetch = (pageState.currentShift as { refetch?: unknown }).refetch;
  pageState.currentShift = { isSuccess: true, data: { data: { shift, required: true } }, ...(refetch ? { refetch } : {}) } as never;
  pageState.shiftVersion += 1;
  pageState.shiftListeners.forEach((listener) => listener());
};

// qzjTMWPb: kunlik agregatlar bu testda emas — 403 holati: bloklar chizilmaydi, sahifa o'zgarmaydi.
// «Kassa holati» kartasi KPI matnlarini takrorlaydi — alohida testda (`CashStateCard.test.tsx`).
vi.mock("./components/CashStateCard", () => ({ default: () => null }));

vi.mock("../../entities/payments/financeDaily", async (importOriginal) => {
  const forbidden = () => ({ isError: true, error: { response: { status: 403 } }, isLoading: false, refetch: vi.fn() });
  return {
    ...(await importOriginal<object>()),
    useFinanceHistoryDaily: forbidden,
    useFinancialBalanceDaily: forbidden,
  };
});

vi.mock("../../entities/payments", async (importOriginal) => {
  const { useSyncExternalStore } = await vi.importActual<typeof import("react")>("react");
  return {
    ...(await importOriginal<typeof import("../../entities/payments")>()),
    useCashBox: () => ({
      useGetCashBoxInfo: () => ({ data: pageState.cashboxInfo, isLoading: false }),
      useGetFinanceHistory: (params: unknown) => getFinanceHistoryMock(params),
      useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false }),
      useGetHqCourierReceivables: (enabled: boolean) => {
        pageState.hqCouriersEnabled.push(enabled);
        return { data: enabled ? pageState.hqCouriers : undefined, isLoading: false };
      },
      useGetCurrentShift: (enabled: boolean) => {
        useSyncExternalStore(
          (listener) => {
            pageState.shiftListeners.add(listener);
            return () => void pageState.shiftListeners.delete(listener);
          },
          () => pageState.shiftVersion,
        );
        if (enabled) {
          pageState.shiftRequests += 1;
          const stack = new Error().stack ?? "";
          pageState.shiftCallers.push(
            stack.includes("useCashboxShift") ? "lock" : stack.includes("PaymentSummaryCards") ? "summary" : "other",
          );
        }
        return enabled ? pageState.currentShift : { isSuccess: false, data: undefined };
      },
      // `enabled` (CB-2) — smena ochish oynasi qoldiqni faqat ochiq bo'lganda so'raydi; sukut — so'raladi.
      useGetCashBoxMain: (params: unknown, enabled: boolean = true) => {
        if (!enabled) return { data: undefined, isLoading: false, isSuccess: false };
        pageState.mainCashboxParams.push(params);
        return { data: pageState.mainCashbox, isLoading: false, isSuccess: pageState.mainCashbox !== undefined };
      },
      useGetPaymentsMeta: (enabled: boolean) => {
        pageState.paymentsMetaEnabled.push(enabled);
        return enabled ? pageState.paymentsMeta : { data: undefined, isLoading: false, isError: false };
      },
      openShift: openShiftMutation,
    }),
  };
});

vi.mock("../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetManagerSettlement: () => ({ data: undefined }),
    useGetManagerPayableToHq: () => ({ data: undefined }),
  }),
}));

vi.mock("../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({
      data: { data: { items: [{ id: "7", name: "Shodiyor Ergashev" }] } },
      isLoading: false,
    }),
    useGetManagers: (_params: unknown, enabled: boolean) => ({
      data: enabled ? pageState.managers : undefined,
      isLoading: false,
    }),
    useGetUserById: (id: unknown) => {
      pageState.userByIdCalls.push(id);
      return { data: undefined };
    },
    useGetCouriers: (params: unknown, enabled: boolean) => {
      if (enabled) pageState.courierParams.push(params);
      return { data: enabled ? pageState.couriers : undefined, isLoading: false };
    },
  }),
}));

// GET /branches (menejersiz filiallar / HQ filial sahifasidagi server summasi).
vi.mock("../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) }),
}));

vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: { data: [] }, isLoading: false }),
  }),
}));

vi.mock("./components/patmentHistoryTable", () => ({
  default: () => <div data-testid="payment-history-table" />,
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

const managersResponse = {
  statusCode: 200,
  data: {
    items: [
      {
        id: "198",
        name: "Sirdaryo menejeri",
        phone_number: "+998903009002",
        branch_id: "15",
        branch: { id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL", region: { name: "Sirdaryo" } },
        berilishi_kerak: 120000,
      },
      {
        id: "5",
        name: "HQ menejeri",
        branch_id: "1",
        branch: { id: "1", name: "Bosh ofis", type: "HQ" },
        berilishi_kerak: 999000,
      },
    ],
  },
};

const hqCouriersResponse = {
  statusCode: 200,
  data: {
    items: [
      { id: "263", name: "Ali Valiyev", phone_number: "+998901234567", status: "active", balance: 250000 },
      // Filial 15 bilan bir xil ID.
      { id: "15", name: "Bobur Karimov", phone_number: "+998907654321", status: "blocked", balance: 50000 },
    ],
    total: 2,
    hq_branch_id: "1",
  },
};

const branchCouriersResponse = {
  statusCode: 200,
  data: { items: [{ id: "209", name: "Filial kuryeri", region: { name: "Sirdaryo" }, cashbox: { balance: 70000 } }] },
};

beforeEach(() => {
  getFinanceHistoryMock.mockClear();
  pageState.cashboxInfo = { data: {} };
  pageState.managers = managersResponse;
  pageState.couriers = branchCouriersResponse;
  pageState.courierParams = [];
  pageState.hqCouriers = hqCouriersResponse;
  pageState.hqCouriersEnabled = [];
  pageState.currentShift = { isSuccess: false, data: undefined };
  pageState.shiftRequests = 0;
  pageState.shiftCallers = [];
  pageState.userByIdCalls = [];
  pageState.mainCashbox = undefined;
  pageState.mainCashboxParams = [];
  pageState.paymentsMeta = { data: undefined, isLoading: false, isError: false };
  pageState.paymentsMetaEnabled = [];
});

describe("Payments filters", () => {
  // jsdom does not implement scrollIntoView; Select calls it when its list opens.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  const open = (route = "/payments") =>
    renderWithProviders(
      <>
        <Payments />
        <LocationProbe />
      </>,
      { route },
    );

  const currentSearch = () => screen.getByTestId("search").textContent ?? "";

  it("restores the operation_type filter (tab) from the URL after a refresh", async () => {
    open("/payments?operation_type=income");

    await waitFor(() => {
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation_type: "income" }),
      );
    });
    expect(screen.getByRole("tab", { name: "Kirim" })).toHaveAttribute("aria-selected", "true");
  });

  it("does not reset the saved page while restoring a filter from the URL", async () => {
    open("/payments?operation_type=income&paymentsPage=4");

    await waitFor(() => {
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation_type: "income", page: 4 }),
      );
    });
  });

  it("writes the selected tab to the URL immediately, so a refresh keeps it", async () => {
    const user = userEvent.setup();
    open("/payments");

    await user.click(screen.getByRole("tab", { name: "Kirim" }));

    await waitFor(() => expect(currentSearch()).toContain("operation_type=income"));
  });

  it("goes back to page 1 together with a new filter, without a request for the new filter on the old page", async () => {
    const user = userEvent.setup();
    open("/payments?paymentsPage=3");

    getFinanceHistoryMock.mockClear();
    await user.click(screen.getByRole("tab", { name: "Chiqim" }));

    await waitFor(() => expect(currentSearch()).toContain("operation_type=expense"));
    expect(currentSearch()).toContain("paymentsPage=1");
    expect(getFinanceHistoryMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ operation_type: "expense", page: 3 }),
    );
    expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation_type: "expense", page: 1 }),
    );
  });

  it("«Barchasi» tab removes operation_type from the URL", async () => {
    const user = userEvent.setup();
    open("/payments?operation_type=expense");

    await user.click(screen.getByRole("tab", { name: "Barchasi" }));

    await waitFor(() => expect(currentSearch()).not.toContain("operation_type"));
    expect(getFinanceHistoryMock.mock.lastCall?.[0]).not.toHaveProperty("operation_type");
  });

  it("a source-type option is written to the URL with page 1 and sent to GET /finance/history", async () => {
    const user = userEvent.setup();
    open("/payments?paymentsPage=2");

    await user.click(screen.getByLabelText("Manba turi"));
    await user.click(await screen.findByRole("option", { name: "Sotuv" }));

    await waitFor(() => expect(currentSearch()).toContain("source_type=sell"));
    expect(currentSearch()).toContain("paymentsPage=1");
    expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ source_type: "sell", page: 1 }),
    );
  });

  it("sends the date filter from the URL as from_date / to_date (YYYY-MM-DD); a malformed date is ignored", async () => {
    const { unmount } = open("/payments?from_date=2026-10-01&to_date=2026-10-08");

    await waitFor(() =>
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ from_date: "2026-10-01", to_date: "2026-10-08" }),
      ),
    );
    unmount();

    getFinanceHistoryMock.mockClear();
    open("/payments?from_date=01.10.2026&to_date=2026-10-08");
    await waitFor(() => expect(getFinanceHistoryMock).toHaveBeenCalled());
    expect(getFinanceHistoryMock.mock.lastCall?.[0]).not.toHaveProperty("from_date");
    expect(getFinanceHistoryMock.mock.lastCall?.[0]).toEqual(expect.objectContaining({ to_date: "2026-10-08" }));
  });

  it("«Filtrlarni tozalash» clears the select and date filters from the URL (not just the form), keeps the tab", async () => {
    const user = userEvent.setup();
    open("/payments?operation_type=income&source_type=sell&cashbox_type=main&from_date=2026-10-01&to_date=2026-10-08&paymentsPage=3");

    await waitFor(() => expect(currentSearch()).toContain("source_type=sell"));
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));

    await waitFor(() => expect(currentSearch()).not.toContain("source_type"));
    expect(currentSearch()).not.toContain("cashbox_type");
    expect(currentSearch()).not.toContain("from_date");
    expect(currentSearch()).not.toContain("to_date");
    expect(currentSearch()).toContain("operation_type=income");
    expect(currentSearch()).toContain("paymentsPage=1");
    expect(screen.getByLabelText("Manba turi")).toHaveTextContent("Barchasi");
    expect(screen.queryByRole("button", { name: "Filtrlarni tozalash" })).not.toBeInTheDocument();
  });

  it("filtr maydonidagi × «Tozalash» faqat shu filtrni «Barchasi» ga qaytaradi (URL'dan ham)", async () => {
    const user = userEvent.setup();
    open("/payments?source_type=sell&cashbox_type=main");

    await waitFor(() => expect(currentSearch()).toContain("source_type=sell"));
    const field = screen.getByLabelText("Manba turi");
    expect(field).toHaveTextContent("Sotuv");

    await user.click(screen.getByRole("button", { name: "Tozalash", description: "Manba turi" }));

    await waitFor(() => expect(currentSearch()).not.toContain("source_type=sell"));
    expect(currentSearch()).toContain("cashbox_type=main");
    expect(field).toHaveTextContent("Barchasi");
  });
});

describe("Payments — header and KPI cards", () => {
  const open = (preloadedState: never) =>
    renderWithProviders(
      <>
        <Payments />
        <LocationProbe />
      </>,
      { route: "/payments", preloadedState },
    );

  it("superadmin: KPI cards in the mockup order, compact values, shift meta and cash/card split", () => {
    pageState.cashboxInfo = {
      data: {
        mainCashboxTotal: 24_615_000,
        kassadagi_summa: 24_615_000,
        berilishi_kerak: 13_458_000,
        branch_managers_receivable: 8_800_000,
        hq_couriers_receivable: 1_070_000,
        olinishi_kerak: 9_870_000,
        courierCashboxTotal: 9_870_000,
      },
    };
    // GET finance/shift/current — asosiy kassaning ochiq smenasi (kim ochganidan qat'i nazar).
    pageState.currentShift = {
      isSuccess: true,
      data: { data: { shift: { id: "4", opened_by: "9", status: "open" }, required: true } },
    };
    pageState.mainCashbox = { data: { cashbox: { balance: 24_615_000, balance_cash: 18_240_000, balance_card: 6_375_000 } } };
    open(superadmin);

    const kpis = within(screen.getByRole("region", { name: "Kassa ko'rsatkichlari" }));
    const labels = ["Kassadagi summa", "Qabul qilinishi kerak", "Berilishi kerak"].map((label) => kpis.getByText(label));
    expect(labels[0].compareDocumentPosition(labels[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(labels[1].compareDocumentPosition(labels[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const mainCard = screen.getByRole("link", { name: /Kassadagi summa/ });
    expect(mainCard).toHaveAttribute("href", "/payments/main-cashbox");
    expect(within(mainCard).getByText("24,6")).toBeInTheDocument();
    expect(within(mainCard).getByText("Asosiy kassa · smena ochiq")).toBeInTheDocument();
    expect(within(mainCard).getByRole("img", { name: "Naqd 18 240 000 so'm, karta 6 375 000 so'm" })).toBeInTheDocument();
    // Smena — shift/current (asosiy kassa); naqd/karta — bugungi kun bilan cheklangan yengil so'rov.
    expect(pageState.shiftRequests).toBeGreaterThan(0);
    // KPI kartasi so'raydi; CB-2 qulfi superadmin uchun so'ramaydi (sarlavha o'zgarmaydi).
    expect(pageState.shiftCallers).toContain("summary");
    expect(pageState.shiftCallers).not.toContain("lock");
    expect(pageState.mainCashboxParams.at(-1)).toEqual({
      fromDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      toDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });

    const receiveCard = screen.getByRole("button", { name: /Qabul qilinishi kerak/ });
    expect(within(receiveCard).getByText("9,9")).toBeInTheDocument();
    expect(
      within(receiveCard).getByRole("img", { name: "Filiallar 8 800 000 so'm, HQ kuryerlari 1 070 000 so'm" }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Berilishi kerak/ })).getByText("13,5")).toBeInTheDocument();
  });

  describe("KPI meta (uzWcMR1C, `*-payments-overview`)", () => {
    const paymentsMeta = (data: unknown) => ({ data: { statusCode: 200, data }, isLoading: false, isError: false });
    const fullMeta = {
      receivable: {
        amount: 9_870_000,
        branches: { count: 5, amount: 8_770_000 },
        hq_couriers: { count: 2, amount: 1_100_000 },
      },
      payable: {
        markets_count: 6,
        amount: 13_458_000,
        top_markets: [
          { market_id: "101", cashbox_id: "55", name: "Baraka Shop", amount: 4_820_000, share: 35.8 },
          { market_id: "102", cashbox_id: "56", name: "Nur Elektronika", amount: 3_146_000, share: 23.4 },
          { market_id: "103", cashbox_id: "57", name: null, amount: 2_260_000, share: 16.8 },
        ],
        others: { count: 3, amount: 3_232_000, share: 24 },
      },
    };
    const receiveCard = () => screen.getByRole("button", { name: /Qabul qilinishi kerak/ });
    const giveCard = () => screen.getByRole("button", { name: /Berilishi kerak/ });

    it("superadmin: counts, top-market segbar and legend from the aggregate", () => {
      pageState.paymentsMeta = paymentsMeta(fullMeta);
      open(superadmin);

      expect(pageState.paymentsMetaEnabled).toContain(true);
      expect(within(receiveCard()).getByText("5 ta filial · 2 ta HQ kuryeri")).toBeInTheDocument();
      expect(within(giveCard()).getByText("6 ta marketga")).toBeInTheDocument();
      expect(
        within(giveCard()).getByRole("img", {
          name: "Baraka Shop 36%, Nur Elektronika 23%, Market #103 17%, yana 3 ta market 24%",
        }),
      ).toBeInTheDocument();
      expect(within(giveCard()).getByText("Baraka Shop")).toBeInTheDocument();
      expect(within(giveCard()).getByText("4,8 mln")).toBeInTheDocument();
      // `name: null` (identity javob bermadi) — bo'sh yorliq emas.
      expect(within(giveCard()).getByText("Market #103")).toBeInTheDocument();
      expect(within(giveCard()).getByText("Yana 3 ta")).toBeInTheDocument();
      expect(within(giveCard()).getByText("3,2 mln")).toBeInTheDocument();
    });

    it("admin: asks for the aggregate too", () => {
      pageState.paymentsMeta = paymentsMeta(fullMeta);
      open({ role: { id: "2", role: "admin", region: null, name: "Admin" } } as never);
      expect(within(giveCard()).getByText("6 ta marketga")).toBeInTheDocument();
    });

    it("no «Yana N ta» when every market is in the top", () => {
      pageState.paymentsMeta = paymentsMeta({
        ...fullMeta,
        payable: {
          ...fullMeta.payable,
          markets_count: 3,
          others: { count: 0, amount: 0, share: 0 },
        },
      });
      open(superadmin);
      expect(within(giveCard()).getByText("3 ta marketga")).toBeInTheDocument();
      expect(within(giveCard()).queryByText(/^Yana/)).not.toBeInTheDocument();
    });

    it("a backend `null` block is skipped, not shown as 0", () => {
      pageState.paymentsMeta = paymentsMeta({
        receivable: { amount: 8_770_000, branches: { count: 5, amount: 8_770_000 }, hq_couriers: null },
        payable: null,
      });
      open(superadmin);
      expect(within(receiveCard()).getByText("5 ta filial")).toBeInTheDocument();
      expect(screen.queryByText(/HQ kuryeri$/)).not.toBeInTheDocument();
      expect(within(giveCard()).queryByText(/ta marketga/)).not.toBeInTheDocument();
      expect(within(giveCard()).queryByRole("img")).not.toBeInTheDocument();
    });

    it("a real zero from the backend stays a zero", () => {
      pageState.paymentsMeta = paymentsMeta({
        receivable: {
          amount: 769_000,
          branches: { count: 2, amount: 769_000 },
          hq_couriers: { count: 0, amount: 0 },
        },
        payable: { markets_count: 0, amount: 0, top_markets: [], others: { count: 0, amount: 0, share: 0 } },
      });
      open(superadmin);
      expect(within(receiveCard()).getByText("2 ta filial · 0 ta HQ kuryeri")).toBeInTheDocument();
      expect(within(giveCard()).getByText("0 ta marketga")).toBeInTheDocument();
      expect(within(giveCard()).queryByRole("img")).not.toBeInTheDocument();
    });

    it("403 or error: cards keep working, counts simply do not appear (also over stale data)", () => {
      pageState.cashboxInfo = {
        data: { kassadagi_summa: 24_615_000, olinishi_kerak: 9_870_000, berilishi_kerak: 13_458_000 },
      };
      pageState.paymentsMeta = { ...paymentsMeta(fullMeta), isError: true };
      open(superadmin);
      expect(within(receiveCard()).getByText("9,9")).toBeInTheDocument();
      expect(within(giveCard()).getByText("13,5")).toBeInTheDocument();
      expect(screen.queryByText(/ta filial/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ta marketga/)).not.toBeInTheDocument();
      expect(within(giveCard()).queryByRole("img")).not.toBeInTheDocument();
    });

    it("loading: skeleton in place of counts, no «0 ta»", () => {
      pageState.paymentsMeta = { data: undefined, isLoading: true, isError: false };
      open(superadmin);
      expect(giveCard().querySelectorAll("[data-skeleton]")).toHaveLength(2);
      expect(receiveCard().querySelectorAll("[data-skeleton]")).toHaveLength(1);
      expect(screen.queryByText(/0 ta/)).not.toBeInTheDocument();
    });

    it("manager: the aggregate is never requested (superadmin/admin only)", () => {
      pageState.paymentsMeta = paymentsMeta(fullMeta);
      open(manager);
      expect(pageState.paymentsMetaEnabled).not.toContain(true);
      expect(screen.queryByText(/ta marketga/)).not.toBeInTheDocument();
    });
  });

  it("superadmin: shift/current without a shift → «Asosiy kassa · smena yopiq»", () => {
    pageState.currentShift = { isSuccess: true, data: { data: { shift: null, required: false } } };
    open(superadmin);
    const mainCard = screen.getByRole("link", { name: /Kassadagi summa/ });
    expect(within(mainCard).getByText("Asosiy kassa · smena yopiq")).toBeInTheDocument();
  });

  it("superadmin: unknown shift state shows only «Asosiy kassa» (no guess)", () => {
    open(superadmin);
    const mainCard = screen.getByRole("link", { name: /Kassadagi summa/ });
    expect(within(mainCard).getByText("Asosiy kassa")).toBeInTheDocument();
  });

  it("superadmin: header actions open the 'Berilishi kerak' and 'Qabul qilinishi kerak' pickers", async () => {
    const user = userEvent.setup();
    open(superadmin);

    await user.click(screen.getByRole("button", { name: "Marketga to'lov" }));
    expect(await screen.findByRole("dialog", { name: "Berilishi kerak" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Pul qabul qilish" }));
    expect(await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" })).toBeInTheDocument();
  });

  it("manager: full values, HQ share meta, «Yetarli» badge; no main-cashbox split request (shift — CB-2 only)", () => {
    pageState.cashboxInfo = { data: { kassadagi_summa: 3_785_000, berilishi_kerak: 3_460_000, olinishi_kerak: 2_940_000 } };
    pageState.couriers = {
      data: {
        items: [
          { id: "1", name: "Bekzod Normurodov", cashbox: { balance: 1_280_000 } },
          { id: "2", name: "Sardor Qurbonov", cashbox: { balance: 860_000 } },
          { id: "3", name: "Jasur Tursunov", cashbox: { balance: 540_000 } },
          { id: "4", name: "Bo'sh kuryer", cashbox: { balance: 0 } },
          { id: "5", name: "Farhod Jo'rayev", status: "inactive", cashbox: { balance: -85_000 } },
        ],
      },
    };
    open(manager);

    expect(within(screen.getByRole("link", { name: /Kassadagi summa/ })).getByText("3 785 000")).toBeInTheDocument();
    const receiveCard = screen.getByRole("button", { name: /Qabul qilinishi kerak/ });
    expect(within(receiveCard).getByText("2 940 000")).toBeInTheDocument();
    expect(within(receiveCard).getByText("Filial kuryerlaridan · 3 ta kuryerda")).toBeInTheDocument();
    expect(within(receiveCard).getByText("Bekzod N.")).toBeInTheDocument();
    expect(within(receiveCard).getByText("Boshqa")).toBeInTheDocument();

    const giveCard = screen.getByRole("button", { name: /Berilishi kerak/ });
    expect(within(giveCard).getByText("HQ'ga · kassaning 91,4%i")).toBeInTheDocument();
    expect(within(giveCard).getByText("Kassada qoladi: 325 000 so'm")).toBeInTheDocument();
    expect(within(giveCard).getByText("Yetarli")).toBeInTheDocument();

    // CB-2: menejer o'z filiali kassasi smenasini so'raydi (faqat qulf); KPI kartasi (asosiy kassa bo'linishi) — yo'q.
    expect(pageState.shiftCallers).toContain("lock");
    expect(pageState.shiftCallers).not.toContain("summary");
    expect(pageState.shiftCallers).not.toContain("other");
    expect(pageState.mainCashboxParams).toEqual([]);
  });

  it("manager: «Kuryerlardagi pul» — ONE GET /couriers without status=active, ranking, debtor row, note", () => {
    pageState.cashboxInfo = { data: { kassadagi_summa: 3_785_000, berilishi_kerak: 3_460_000, olinishi_kerak: 2_940_000 } };
    pageState.couriers = {
      data: {
        items: [
          { id: "1", name: "Bekzod Normurodov", cashbox: { balance: 1_280_000 } },
          { id: "2", name: "Sardor Qurbonov", cashbox: { balance: 860_000 } },
          { id: "4", name: "Bo'sh kuryer", cashbox: { balance: 0 } },
          { id: "5", name: "Farhod Jo'rayev", status: "inactive", cashbox: { balance: -85_000 } },
        ],
      },
    };
    open(manager);

    expect(pageState.courierParams.length).toBeGreaterThan(0);
    pageState.courierParams.forEach((params) => {
      expect(params).toEqual({ limit: 10000 });
    });

    const card = screen.getByRole("region", { name: "Kuryerlardagi pul" });
    const rows = within(within(card).getByRole("list", { name: "Kuryerlar kassasidagi pul" })).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByText(/Normurodov|Qurbonov/).textContent)).toEqual([
      "Bekzod Normurodov",
      "Sardor Qurbonov",
    ]);
    expect(within(rows[0]).getByText("1 280 000 so'm")).toBeInTheDocument();
    // Ulush = 1 280 000 / (1 280 000 + 860 000) = 59,8%.
    expect(within(rows[0]).getByText("59,8%")).toBeInTheDocument();
    expect(within(card).getByText("Farhod Jo'rayev")).toBeInTheDocument();
    expect(within(card).getByText("Nofaol · qarzdor")).toBeInTheDocument();
    expect(within(card).getByText("−85 000 so'm")).toBeInTheDocument();
    expect(
      within(card).getByText("Yana 1 ta kuryerda pul yo'q · ulush = kuryer summasi / musbat qoldiqlar jami"),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Barcha kuryerlar · 4 ta" })).toBeInTheDocument();
  });

  it("manager: «HQ'ga o'tkazish» is never shown (ega qarori #7 — HQ takes the branch money itself)", () => {
    open(manager);
    expect(screen.queryByRole("button", { name: "HQ'ga o'tkazish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
  });
});

describe("Payments — 'Qabul qilinishi kerak'", () => {
  const open = (preloadedState: never) =>
    renderWithProviders(
      <>
        <Payments />
        <LocationProbe />
      </>,
      { route: "/payments", preloadedState },
    );

  const openReceivePopup = async (name = "Qabul qilinishi kerak") => {
    const user = userEvent.setup();
    await user.click(screen.getByText("Qabul qilinishi kerak"));
    return { user, dialog: await screen.findByRole("dialog", { name }) };
  };

  const currentState = () => JSON.parse(screen.getByTestId("state").textContent || "null");

  it("superadmin: lists branch managers (no HQ row) and HQ couriers with unique keys, grouped", async () => {
    open(superadmin);
    const { dialog } = await openReceivePopup();

    const rows = within(dialog).getAllByRole("option");
    expect(rows.map((row) => row.getAttribute("data-key"))).toEqual([
      "branch:15",
      "courier:263",
      "courier:15",
    ]);
    expect(within(dialog).queryByText("HQ menejeri")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Filial menejeri yoki HQ kuryerini tanlang")).toBeInTheDocument();
    expect(within(dialog).getByText("Filiallar")).toBeInTheDocument();
    expect(within(dialog).getByText("HQ kuryerlari")).toBeInTheDocument();
    expect(within(dialog).getByText("HQ kuryeri · +998 90 765 43 21")).toBeInTheDocument();
  });

  it("superadmin: an HQ courier opens its courier cashbox (?type=courier) — even when its id equals a branch id", async () => {
    open(superadmin);
    const { user, dialog } = await openReceivePopup();

    const select = within(dialog).getByRole("button", { name: "Tanlash" });
    expect(select).toBeDisabled();
    await user.click(within(dialog).getByRole("option", { name: /Bobur Karimov/ }));
    expect(within(dialog).getByRole("option", { name: /Bobur Karimov/ })).toHaveAttribute("aria-selected", "true");
    // Faqat bitta qator tanlangan (filial 15 emas).
    expect(within(dialog).getByRole("option", { name: /Sirdaryo menejeri/ })).toHaveAttribute("aria-selected", "false");
    await user.click(select);

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/15");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
    expect(currentState()).toEqual({
      type: "courier",
      entity: {
        id: "15",
        name: "Bobur Karimov",
        phone_number: "+998907654321",
        role: "courier",
        amount: 50000,
      },
    });
  });

  it("superadmin: a branch manager row opens the branch cashbox (?type=branch) on double click", async () => {
    open(superadmin);
    const { user, dialog } = await openReceivePopup();

    await user.dblClick(within(dialog).getByRole("option", { name: /Sirdaryo menejeri/ }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/15");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=branch");
    expect(currentState()).toEqual(
      expect.objectContaining({
        type: "branch",
        entity: expect.objectContaining({ id: "15", branch_name: "E2E Filial Sirdaryo" }),
      }),
    );
  });

  it("superadmin: the card total reads all-info olinishi_kerak (branch managers + HQ couriers)", () => {
    pageState.cashboxInfo = {
      data: {
        mainCashboxTotal: 5000000,
        marketCashboxTotal: 100000,
        kassadagi_summa: 5000000,
        berilishi_kerak: 100000,
        branch_managers_receivable: 1120000,
        hq_couriers_receivable: 500000,
        olinishi_kerak: 1620000,
        courierCashboxTotal: 1620000,
      },
    };
    open(superadmin);

    const card = screen.getByRole("button", { name: /Qabul qilinishi kerak/ });
    expect(within(card).getByText("1,6")).toBeInTheDocument();
    expect(within(card).getByText("mln so'm")).toBeInTheDocument();
  });

  it("superadmin: the picker shows the all-info total in its description", async () => {
    pageState.cashboxInfo = { data: { kassadagi_summa: 0, berilishi_kerak: 0, olinishi_kerak: 1_620_000 } };
    open(superadmin);
    const { dialog } = await openReceivePopup();
    expect(within(dialog).getByText("jami 1 620 000 so'm")).toBeInTheDocument();
  });

  it("manager: lists only the own branch couriers; the HQ courier list is never requested", async () => {
    open(manager);
    const { user, dialog } = await openReceivePopup("Kuryerni tanlang");

    const rows = within(dialog).getAllByRole("option");
    expect(rows.map((row) => row.getAttribute("data-key"))).toEqual(["courier:209"]);
    expect(pageState.hqCouriersEnabled.some(Boolean)).toBe(false);

    await user.dblClick(within(dialog).getByRole("option", { name: /Filial kuryeri/ }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/209");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
  });

  it("search filters the rows by name or phone; no match shows «Hech narsa topilmadi»", async () => {
    open(superadmin);
    const { user, dialog } = await openReceivePopup();

    await user.type(within(dialog).getByRole("combobox", { name: "Filial menejeri yoki kuryerni qidirish" }), "90 123");
    expect(within(dialog).getAllByRole("option").map((row) => row.getAttribute("data-key"))).toEqual(["courier:263"]);

    await user.clear(within(dialog).getByRole("combobox", { name: "Filial menejeri yoki kuryerni qidirish" }));
    await user.type(within(dialog).getByRole("combobox", { name: "Filial menejeri yoki kuryerni qidirish" }), "yo'q odam");
    expect(within(dialog).queryAllByRole("option")).toHaveLength(0);
    expect(within(dialog).getByText("Hech narsa topilmadi")).toBeInTheDocument();
  });

  it("keyboard: ↓ selects the first row and Enter chooses it", async () => {
    open(superadmin);
    const { user, dialog } = await openReceivePopup();

    await user.click(within(dialog).getByRole("combobox", { name: "Filial menejeri yoki kuryerni qidirish" }));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/15");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=branch");
  });
});

/**
 * CB-2 (kfdfYDik, ega javobi CB-S4): menejer «To'lovlar», filial kassasida smena yo'q — maket
 * `manager-payments-overview-shift-closed`: izoh «… · smena yopiq», ikki amal o'rnida bitta «Smenani ochish»,
 * «Smena boshlanmagan» banneri; KPI va tarix o'zgarmaydi.
 */
describe("Payments — menejer, smena yopiq (CB-2)", () => {
  const open = (preloadedState: never) =>
    renderWithProviders(
      <>
        <Payments />
        <LocationProbe />
      </>,
      { route: "/payments", preloadedState },
    );
  const withBranch = () => {
    // `branch_id` bor bo'lsa ham «HQ'ga o'tkazish» chiqmaydi (ega qarori #7: HQ filial pulini o'zi oladi).
    pageState.cashboxInfo = { data: { kassadagi_summa: 3_785_000, berilishi_kerak: 3_460_000, branch_id: "15" } };
  };

  afterEach(() => {
    openShiftMutation.mutateAsync.mockReset();
  });

  it("⭐ smena yo'q: «Smenani ochish» bitta asosiy amal, banner, sarlavha izohi; KPI va tarix qoladi", () => {
    withBranch();
    pageState.currentShift = { isSuccess: true, data: { data: { shift: null, required: true } } };
    open(manager);

    expect(screen.getByText("Kassa va to'lovlarni boshqarish · smena yopiq")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Smenani ochish" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("button", { name: "HQ'ga o'tkazish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kuryerdan qabul qilish" })).not.toBeInTheDocument();
    const banner = screen.getByTestId("shift-banner");
    expect(banner).toHaveTextContent("Smena boshlanmagan");
    expect(banner).toHaveTextContent(
      "Kuryerdan qabul qilish, xarajat va kassani to'ldirish filial kassasida smena ochilgandan keyin ishlaydi. Balans va operatsiyalar tarixi ko'rinib turadi.",
    );
    expect(screen.getByRole("link", { name: /Kassadagi summa/ })).toBeInTheDocument();
    expect(screen.getByTestId("payment-history-table")).toBeInTheDocument();
    // Qoldiq faqat oyna ochilganda so'raladi.
    expect(pageState.mainCashboxParams).toEqual([]);
  });

  it("⭐ «Smenani ochish» → oyna (filial kassasi, jonli qoldiq) → POST → «Smena ochildi»", async () => {
    pageState.currentShift = { isSuccess: true, data: { data: { shift: null, required: true } } };
    pageState.mainCashbox = { data: { cashbox: { balance_cash: 2_000_000, balance_card: 500_000 } } };
    openShiftMutation.mutateAsync.mockResolvedValue({ data: { id: "9", status: "open" } });
    const user = userEvent.setup();
    open(manager);

    await user.click(screen.getByRole("button", { name: "Smenani ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Smenani ochish" });
    expect(dialog).toHaveTextContent("Filial kassasi · yangi smena boshlanadi");
    expect(dialog).toHaveTextContent(/2\D000\D000/);
    expect(dialog).toHaveTextContent(/2\D500\D000/);
    expect(pageState.mainCashboxParams).toEqual([undefined]);

    await user.click(within(dialog).getByRole("button", { name: "Smenani ochish" }));
    expect(openShiftMutation.mutateAsync).toHaveBeenCalledWith({ comment: undefined });
    expect(await screen.findByText("Smena ochildi")).toBeInTheDocument();
  });

  it("smena ochiq: avvalgi amallar, banner yo'q", () => {
    withBranch();
    pageState.currentShift = {
      isSuccess: true,
      data: { data: { shift: { id: "5", status: "open", opened_by: "198" }, required: true } },
    };
    open(manager);

    expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HQ'ga o'tkazish" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
    expect(screen.getByText("Kassa va to'lovlarni boshqarish")).toBeInTheDocument();
  });

  it("holat noma'lum (403 / yuklanmoqda): avvalgi amallar, qulf taxmin qilinmaydi", () => {
    withBranch();
    pageState.currentShift = { isSuccess: false, data: undefined };
    open(manager);

    expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Smenani ochish" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
  });

  it("superadmin: sarlavha o'zgarmaydi (maketda smena holati yo'q) — «Marketga to'lov» / «Pul qabul qilish»", () => {
    pageState.currentShift = { isSuccess: true, data: { data: { shift: null, required: true } } };
    open(superadmin);

    expect(screen.getByRole("button", { name: "Pul qabul qilish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Smenani ochish" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
  });
  // Tugma yangi DOM — fokus <body> ga tushmasin.
  it("smena shu ekrandan ochildi: oyna yopiladi, fokus tiklangan birinchi amalga («Kuryerdan qabul qilish»)", async () => {
    pageState.currentShift = { isSuccess: true, data: { data: { shift: null, required: true } } };
    openShiftMutation.mutateAsync.mockImplementation(async () => {
      setCurrentShift({ id: "9", status: "open", opened_by: "198" });
      return { data: { id: "9", status: "open" } };
    });
    const user = userEvent.setup();
    open(manager);

    await user.click(screen.getByRole("button", { name: "Smenani ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Smenani ochish" });
    await user.click(within(dialog).getByRole("button", { name: "Smenani ochish" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Smenani ochish" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "HQ'ga o'tkazish" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toHaveFocus());
  });

  it("400 «allaqachon ochiq» (boshqa xodim ochgan): qayta o'qishdan keyin oyna yopiladi, avvalgi amallar", async () => {
    withBranch();
    pageState.currentShift = { isSuccess: true, data: { data: { shift: null, required: true } } };
    openShiftMutation.mutateAsync.mockRejectedValue(Object.assign(new Error("raw"), { response: { status: 400 } }));
    const refetch = vi.fn(() => setCurrentShift({ id: "9", status: "open", opened_by: "77" }));
    pageState.currentShift = { ...pageState.currentShift, refetch } as never;
    const user = userEvent.setup();
    open(manager);

    await user.click(screen.getByRole("button", { name: "Smenani ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Smenani ochish" });
    await user.click(within(dialog).getByRole("button", { name: "Smenani ochish" }));

    expect(refetch).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Smenani ochish" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
    expect(screen.queryByTestId("shift-banner")).not.toBeInTheDocument();
  });

  it("ochgan xodim ismi bu ekranda ko'rsatilmaydi — `GET users/:id` so'ralmaydi", () => {
    withBranch();
    pageState.currentShift = {
      isSuccess: true,
      data: { data: { shift: { id: "5", status: "open", opened_by: "77" }, required: true } },
    };
    open(manager);

    expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
    expect(pageState.userByIdCalls).not.toContain("77");
  });
});
