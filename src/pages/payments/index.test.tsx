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
  hqCouriers: undefined as unknown,
  hqCouriersEnabled: [] as boolean[],
}));

vi.mock("../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxInfo: () => ({ data: pageState.cashboxInfo, isLoading: false }),
    useGetFinanceHistory: (params: unknown) => getFinanceHistoryMock(params),
    useGetHqCourierReceivables: (enabled: boolean) => {
      pageState.hqCouriersEnabled.push(enabled);
      return { data: enabled ? pageState.hqCouriers : undefined, isLoading: false };
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
    useGetUser: () => ({ data: { data: { items: [] } }, isLoading: false }),
    useGetManagers: (_params: unknown, enabled: boolean) => ({
      data: enabled ? pageState.managers : undefined,
      isLoading: false,
    }),
    useGetCouriers: (_params: unknown, enabled: boolean) => ({
      data: enabled ? pageState.couriers : undefined,
      isLoading: false,
    }),
  }),
}));

vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: { data: [] }, isLoading: false }),
  }),
}));

vi.mock("./components/patmentHistoryTable", () => ({
  default: () => <div data-testid="payment-history-table" />,
}));

// Ochiq oyna qatorlarini tugma qilib chiqaradi; kalit `keyExtractor` dan.
vi.mock("../../shared/components/popupSelect", () => ({
  default: ({
    isOpen,
    data,
    title,
    description,
    keyExtractor,
    onSelect,
  }: {
    isOpen: boolean;
    data?: { name: string }[];
    title: string;
    description?: string;
    keyExtractor: (item: { name: string }) => string | number;
    onSelect: (item: { name: string }) => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        {(data ?? []).map((item) => (
          <button
            key={keyExtractor(item)}
            type="button"
            data-key={keyExtractor(item)}
            onClick={() => onSelect(item)}
          >
            {item.name}
          </button>
        ))}
      </div>
    ) : null,
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

/** uz-UZ guruhlash belgisi U+00A0 — Testing Library matnni oddiy bo'shliqqa normallaydi. */
const amountText = (amount: number) => amount.toLocaleString("uz-UZ").replace(/\s+/g, " ");

describe("Payments filters", () => {
  // jsdom does not implement scrollIntoView; FilterSelect calls it when its
  // dropdown opens. Pre-existing gap, unrelated to this fix — stub locally.
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

  beforeEach(() => {
    getFinanceHistoryMock.mockClear();
  });

  it("restores the operation_type filter from the URL after a refresh", async () => {
    open("/payments?operation_type=income");

    await waitFor(() => {
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation_type: "income" }),
      );
    });
  });

  it("does not reset the saved page while restoring a filter from the URL", async () => {
    open("/payments?operation_type=income&paymentsPage=4");

    await waitFor(() => {
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation_type: "income", page: 4 }),
      );
    });
  });

  it("writes the selected filter to the URL immediately, so a refresh keeps it", async () => {
    const user = userEvent.setup();
    open("/payments");

    await user.click(screen.getByLabelText("Operatsiya turi"));
    const incomeOption = await screen.findByRole("option", { name: "Kirim" });
    await user.click(incomeOption);

    await waitFor(() => expect(currentSearch()).toContain("operation_type=income"));
  });

  it("goes back to page 1 together with a new filter, without a request for the new filter on the old page", async () => {
    const user = userEvent.setup();
    open("/payments?paymentsPage=3");

    await user.click(screen.getByLabelText("Operatsiya turi"));
    const incomeOption = await screen.findByRole("option", { name: "Kirim" });
    getFinanceHistoryMock.mockClear();
    await user.click(incomeOption);

    await waitFor(() => expect(currentSearch()).toContain("operation_type=income"));
    expect(currentSearch()).toContain("paymentsPage=1");
    expect(getFinanceHistoryMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ operation_type: "income", page: 3 }),
    );
    expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation_type: "income", page: 1 }),
    );
  });

  it("clears the filter from the URL (not just the form) when 'Tozalash' is clicked", async () => {
    const user = userEvent.setup();
    open("/payments?operation_type=income");

    await waitFor(() => expect(currentSearch()).toContain("operation_type=income"));

    await user.click(screen.getByRole("button", { name: "Tozalash" }));

    await waitFor(() => expect(currentSearch()).not.toContain("operation_type=income"));
    expect(screen.getByLabelText("Operatsiya turi")).toHaveTextContent("Tanlang");
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

  const openReceivePopup = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByText("Qabul qilinishi kerak"));
    return { user, dialog: await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" }) };
  };

  const currentState = () => JSON.parse(screen.getByTestId("state").textContent || "null");

  beforeEach(() => {
    pageState.cashboxInfo = { data: {} };
    pageState.managers = managersResponse;
    pageState.couriers = branchCouriersResponse;
    pageState.hqCouriers = hqCouriersResponse;
    pageState.hqCouriersEnabled = [];
  });

  it("superadmin: lists branch managers (no HQ row) and HQ couriers with unique keys", async () => {
    open(superadmin);
    const { dialog } = await openReceivePopup();

    const rows = within(dialog).getAllByRole("button");
    expect(rows.map((row) => row.getAttribute("data-key"))).toEqual([
      "branch:15",
      "courier:263",
      "courier:15",
    ]);
    expect(within(dialog).queryByText("HQ menejeri")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Filial menejeri yoki HQ kuryerini tanlang")).toBeInTheDocument();
  });

  it("superadmin: an HQ courier opens its courier cashbox (?type=courier) — even when its id equals a branch id", async () => {
    open(superadmin);
    const { user, dialog } = await openReceivePopup();

    await user.click(within(dialog).getByRole("button", { name: "Bobur Karimov" }));

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

  it("superadmin: a branch manager row opens the branch cashbox (?type=branch)", async () => {
    open(superadmin);
    const { user, dialog } = await openReceivePopup();

    await user.click(within(dialog).getByRole("button", { name: "Sirdaryo menejeri" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/15");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=branch");
    expect(currentState()).toEqual(expect.objectContaining({ type: "branch" }));
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

    expect(screen.getByText(amountText(1620000))).toBeInTheDocument();
  });

  it("manager: lists only the own branch couriers; the HQ courier list is never requested", async () => {
    open(manager);
    const { user, dialog } = await openReceivePopup();

    const rows = within(dialog).getAllByRole("button");
    expect(rows.map((row) => row.getAttribute("data-key"))).toEqual(["courier:209"]);
    expect(pageState.hqCouriersEnabled.some(Boolean)).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Filial kuryeri" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/209");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
  });
});
