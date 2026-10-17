import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

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

const lists = vi.hoisted(() => ({
  managers: undefined as unknown,
  couriers: undefined as unknown,
  hqCouriers: undefined as unknown,
}));

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const emptyQuery = { data: undefined, isLoading: false, isFetching: false };

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => emptyQuery,
    useGetManagers: (_params: unknown, enabled: boolean) => ({
      data: enabled ? lists.managers : undefined,
      isLoading: false,
    }),
    useGetCouriers: (_params: unknown, enabled: boolean) => ({
      data: enabled ? lists.couriers : undefined,
      isLoading: false,
    }),
  }),
}));

// GET /branches (menejersiz filiallar / HQ filial sahifasidagi server summasi).
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) }),
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => emptyQuery }),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    cashboxSpand: idleMutation,
    cashboxFill: idleMutation,
    openShift: idleMutation,
    closeShift: idleMutation,
    // Smena holati (FE-PAY-06) — bu testlarda ahamiyatsiz, tugma chiqmaydi.
    useGetCurrentShift: () => ({ data: undefined, isLoading: false, isSuccess: false }),
    useGetCashBoxInfo: () => emptyQuery,
    useGetFinanceHistory: () => emptyQuery,
    useGetFinanceHistoryById: () => emptyQuery,
    useGetCashBoxMain: () => emptyQuery,
    useGetHqCourierReceivables: (enabled: boolean) => ({
      data: enabled ? lists.hqCouriers : undefined,
      isLoading: false,
    }),
  }),
}));

vi.mock("../../../widgets/Sidebar/model/menuConfig", () => ({
  getUserBranchType: () => null,
}));

vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./CashboxFormPopup", () => ({ default: () => null }));
vi.mock("./CloseShiftPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

const open = (preloadedState: never) =>
  renderWithProviders(
    <>
      <MainCashbox />
      <LocationProbe />
    </>,
    { route: "/payments/main-cashbox", preloadedState },
  );

describe("MainCashbox — receive quick action", () => {
  beforeEach(() => {
    lists.managers = {
      data: {
        items: [
          {
            id: "198",
            name: "Sirdaryo menejeri",
            branch_id: "15",
            branch: { id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL" },
            berilishi_kerak: 120000,
          },
          { id: "5", name: "HQ menejeri", branch_id: "1", branch: { id: "1", type: "HQ" } },
        ],
      },
    };
    lists.hqCouriers = {
      data: {
        items: [{ id: "263", name: "Ali Valiyev", phone_number: "+998901234567", balance: 250000 }],
        total: 1,
        hq_branch_id: "1",
      },
    };
    lists.couriers = {
      data: { items: [{ id: "209", name: "Filial kuryeri", cashbox: { balance: 70000 } }] },
    };
  });

  it("superadmin: 'Pul qabul qilish' lists branch managers + HQ couriers and an HQ courier opens ?type=courier", async () => {
    const user = userEvent.setup();
    open(superadmin);

    const action = screen.getByRole("button", { name: /Pul qabul qilish/ });
    expect(action).toHaveTextContent("Filial yoki HQ kuryeridan");
    await user.click(action);

    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });
    // `${kind}:${id}` — filial 15 va kuryer 15 aralashib ketmasin.
    expect(within(dialog).getAllByRole("option").map((row) => row.getAttribute("data-key"))).toEqual([
      "branch:15",
      "courier:263",
    ]);
    expect(within(dialog).getByText("Filial menejeri yoki HQ kuryerini tanlang")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("option", { name: /Ali Valiyev/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tanlash" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/263");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
    expect(JSON.parse(screen.getByTestId("state").textContent || "null")).toEqual(
      expect.objectContaining({ type: "courier" }),
    );
  });

  it("superadmin: a branch manager row opens the branch cashbox (?type=branch)", async () => {
    const user = userEvent.setup();
    open(superadmin);

    await user.click(screen.getByRole("button", { name: /Pul qabul qilish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });
    // Ikki marta bosish — tanlab darhol o'tadi (eski oynadagi kabi).
    await user.dblClick(within(dialog).getByRole("option", { name: /Sirdaryo menejeri/ }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/15");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=branch");
  });

  it("manager: the action is 'Kuryerdan qabul qilish' and lists only the own branch couriers", async () => {
    const user = userEvent.setup();
    open(manager);

    expect(screen.queryByRole("button", { name: /Pul qabul qilish/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Kuryerdan qabul qilish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });

    expect(within(dialog).getAllByRole("option").map((row) => row.getAttribute("data-key"))).toEqual([
      "courier:209",
    ]);
    await user.click(within(dialog).getByRole("option", { name: /Filial kuryeri/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tanlash" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/209");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
  });
});

describe("MainCashbox — balance visibility", () => {
  it("the eye button hides and shows the amounts (aria-pressed follows)", async () => {
    const user = userEvent.setup();
    open(superadmin);

    const hide = screen.getByRole("button", { name: "Balansni yashirish" });
    expect(hide).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("••••••")).not.toBeInTheDocument();

    await user.click(hide);
    const show = screen.getByRole("button", { name: "Balansni ko'rsatish" });
    expect(show).toHaveAttribute("aria-pressed", "true");
    // Umumiy balans, naqd, karta va bugungi sof oqim — yashirin.
    expect(screen.getAllByText("••••••").length).toBeGreaterThanOrEqual(4);

    await user.click(show);
    expect(screen.queryByText("••••••")).not.toBeInTheDocument();
  });
});
