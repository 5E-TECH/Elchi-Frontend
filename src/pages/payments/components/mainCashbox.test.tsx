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

vi.mock("../../../shared/ui/DateRangePicker", () => ({ default: () => null }));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./CashboxFormPopup", () => ({ default: () => null }));
vi.mock("./CloseShiftPopup", () => ({ default: () => null }));
vi.mock("./PaymentHistoryList", () => ({ default: () => null }));

// Ochiq oyna qatorlarini tugma qilib chiqaradi; kalit `keyExtractor` dan.
vi.mock("../../../shared/components/popupSelect", () => ({
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

  it("superadmin: 'Qabul qilish' lists branch managers + HQ couriers and an HQ courier opens ?type=courier", async () => {
    const user = userEvent.setup();
    open(superadmin);

    const action = screen.getByRole("button", { name: "Qabul qilish" });
    expect(action).toHaveAttribute("title", "Filial menejeri yoki HQ kuryeridan qabul qilish");
    await user.click(action);

    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });
    expect(within(dialog).getAllByRole("button").map((row) => row.getAttribute("data-key"))).toEqual([
      "branch:15",
      "courier:263",
    ]);
    expect(within(dialog).getByText("Filial menejeri yoki HQ kuryerini tanlang")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Ali Valiyev" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/263");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
    expect(JSON.parse(screen.getByTestId("state").textContent || "null")).toEqual(
      expect.objectContaining({ type: "courier" }),
    );
  });

  it("superadmin: a branch manager row opens the branch cashbox (?type=branch)", async () => {
    const user = userEvent.setup();
    open(superadmin);

    await user.click(screen.getByRole("button", { name: "Qabul qilish" }));
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });
    await user.click(within(dialog).getByRole("button", { name: "Sirdaryo menejeri" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/15");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=branch");
  });

  it("manager: the action stays 'Kuryer' and lists only the own branch couriers", async () => {
    const user = userEvent.setup();
    open(manager);

    await user.click(screen.getByRole("button", { name: "Kuryer" }));
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });

    expect(within(dialog).getAllByRole("button").map((row) => row.getAttribute("data-key"))).toEqual([
      "courier:209",
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Filial kuryeri" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/209");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=courier");
  });
});
