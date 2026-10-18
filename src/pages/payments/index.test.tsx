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
  shiftOpenedBy: [] as unknown[],
  mainCashbox: undefined as unknown,
  mainCashboxParams: [] as unknown[],
}));

vi.mock("../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxInfo: () => ({ data: pageState.cashboxInfo, isLoading: false }),
    useGetFinanceHistory: (params: unknown) => getFinanceHistoryMock(params),
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false }),
    useGetHqCourierReceivables: (enabled: boolean) => {
      pageState.hqCouriersEnabled.push(enabled);
      return { data: enabled ? pageState.hqCouriers : undefined, isLoading: false };
    },
    useGetCurrentShift: (openedBy: unknown, enabled: boolean) => {
      if (enabled) pageState.shiftOpenedBy.push(openedBy);
      return enabled ? pageState.currentShift : { isSuccess: false, data: undefined };
    },
    useGetCashBoxMain: (params: unknown) => {
      pageState.mainCashboxParams.push(params);
      return { data: pageState.mainCashbox, isLoading: false };
    },
  }),
}));

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
  pageState.shiftOpenedBy = [];
  pageState.mainCashbox = undefined;
  pageState.mainCashboxParams = [];
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
    pageState.currentShift = { isSuccess: true, data: { data: { items: [{ id: "4", status: "open" }] } } };
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
    // Smena — o'zining ID si bilan; naqd/karta — bugungi kun bilan cheklangan yengil so'rov.
    expect(pageState.shiftOpenedBy).toContain("1");
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

  it("manager: full values, HQ share meta, «Yetarli» badge; no shift / main-cashbox split requests", () => {
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

    expect(pageState.shiftOpenedBy).toEqual([]);
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

  it("manager: without a branch id the «HQ'ga o'tkazish» action is not shown", () => {
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
