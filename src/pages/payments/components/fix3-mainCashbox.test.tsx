import type { ReactNode } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * FIX3 — Asosiy kassa:
 *  - FE-PAY-07: "Maosh to'lash" (har doim 400/403) ko'rsatilmaydi;
 *  - FE-PAY-13: "Marketga to'lov" ro'yxati status=active filtrisiz,
 *    bloklangan puli bor market belgi bilan.
 * FE-PAY-06 (smena ochish/yopish) endi ulangan — fix3b-mainCashbox.test.tsx.
 */

const page = vi.hoisted(() => ({ markets: undefined as unknown, marketParams: [] as unknown[] }));

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const emptyQuery = { data: undefined, isLoading: false, isFetching: false };

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => emptyQuery,
    useGetManagers: () => emptyQuery,
    useGetCouriers: () => emptyQuery,
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: (params: unknown, enabled: boolean) => {
      if (enabled) page.marketParams.push(params);
      return { data: enabled ? page.markets : undefined, isLoading: false };
    },
  }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    cashboxSpand: idleMutation,
    cashboxFill: idleMutation,
    openShift: idleMutation,
    closeShift: idleMutation,
    useGetCurrentShift: () => ({ data: undefined, isLoading: false, isSuccess: false }),
    useGetCashBoxInfo: () => emptyQuery,
    useGetFinanceHistory: () => emptyQuery,
    useGetCashBoxMain: () => emptyQuery,
    useGetHqCourierReceivables: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../widgets/Sidebar/model/menuConfig", () => ({ getUserBranchType: () => null }));
vi.mock("../../../shared/ui/DateRangePicker", () => ({ default: () => null }));
vi.mock("./PaymentHistoryList", () => ({ default: () => null }));
vi.mock("../../../shared/components/popupSelect", () => ({
  default: ({
    isOpen,
    data,
    title,
    keyExtractor,
    renderItem,
  }: {
    isOpen: boolean;
    data?: { name: string }[];
    title: string;
    keyExtractor: (item: { name: string }) => string | number;
    renderItem?: (item: { name: string }, isSelected: boolean) => ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {(data ?? []).map((item) => (
          <div key={keyExtractor(item)} data-testid="row" data-key={keyExtractor(item)}>
            {renderItem ? renderItem(item, false) : item.name}
          </div>
        ))}
      </div>
    ) : null,
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

const open = (preloadedState: never) =>
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState });

beforeEach(() => {
  page.markets = undefined;
  page.marketParams = [];
});

describe("MainCashbox — actions that cannot work yet are hidden", () => {
  it.each([
    ["superadmin", superadmin],
    ["manager", manager],
  ])("%s: no 'Maosh' action; Excel stays", (_label, preloadedState) => {
    open(preloadedState as never);

    expect(screen.queryByRole("button", { name: "Maosh" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Maosh to'lash")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excel/ })).toBeInTheDocument();
    // Qolgan amallar joyida.
    expect(screen.getByTitle("Kassadan xarajat")).toBeInTheDocument();
  });
});

describe("MainCashbox — 'Marketga to'lov' list (FE-PAY-13)", () => {
  it("requests markets without status=active and keeps a blocked market that is still owed money", async () => {
    page.markets = {
      data: {
        items: [
          { id: "201", name: "Yandex", status: "active", cashbox: { balance: 1_000_000 } },
          { id: "202", name: "Kimdur", status: "inactive", cashbox: { balance: 300_000 } },
          { id: "203", name: "Eski market", status: "inactive", cashbox: { balance: 0 } },
        ],
      },
    };
    open(superadmin);

    await userEvent.setup().click(screen.getByTitle("Marketga to'lov"));
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });

    expect(page.marketParams.at(-1)).not.toHaveProperty("status");
    const rows = within(dialog).getAllByTestId("row");
    expect(rows.map((row) => row.getAttribute("data-key"))).toEqual(["201", "202"]);
    expect(within(rows[1]).getByText("Bloklangan")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("Bloklangan")).not.toBeInTheDocument();
  });
});
