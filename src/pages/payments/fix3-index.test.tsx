import type { ReactNode } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import Payments from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * FIX3 — /payments:
 *  - FE-PAY-13 / CODE-19: bloklangan, lekin puli qolgan market/menejer
 *    ro'yxatda (belgi bilan), puli yo'q bloklangani — yo'q;
 *  - CODE-27: menejeri yo'q, lekin qarzi bor filial ham "Qabul qilinishi kerak"da.
 * FE-PAY-01 qaytarildi (foydalanuvchi qarori #7) — fix3b-index.test.tsx.
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

const page = vi.hoisted(() => ({
  cashboxInfo: { data: {} } as unknown,
  markets: undefined as unknown,
  marketParams: [] as unknown[],
  managers: undefined as unknown,
  managerParams: [] as unknown[],
  couriers: undefined as unknown,
  courierParams: [] as unknown[],
  branches: undefined as unknown,
  hqCouriers: undefined as unknown,
}));

vi.mock("../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxInfo: () => ({ data: page.cashboxInfo, isLoading: false }),
    useGetFinanceHistory: () => ({ data: { data: { items: [] } }, isLoading: false }),
    useGetHqCourierReceivables: (enabled: boolean) => ({
      data: enabled ? page.hqCouriers : undefined,
      isLoading: false,
    }),
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
    useGetManagers: (params: unknown, enabled: boolean) => {
      if (enabled) page.managerParams.push(params);
      return { data: enabled ? page.managers : undefined, isLoading: false };
    },
    useGetCouriers: (params: unknown, enabled: boolean) => {
      if (enabled) page.courierParams.push(params);
      return { data: enabled ? page.couriers : undefined, isLoading: false };
    },
  }),
}));

vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: (params: unknown, enabled: boolean) => {
      if (enabled) page.marketParams.push(params);
      return { data: enabled ? page.markets : undefined, isLoading: false };
    },
  }),
}));

vi.mock("../../entities/branch/api/useBranches", () => ({
  useBranches: (_params: unknown, enabled: boolean) => ({
    data: enabled ? page.branches : undefined,
    isLoading: false,
  }),
}));

vi.mock("./components/patmentHistoryTable", () => ({
  default: () => <div data-testid="payment-history-table" />,
}));

// Ochiq oyna qatorlari haqiqiy `renderItem` bilan chiziladi (belgini ko'rish uchun).
vi.mock("../../shared/components/popupSelect", () => ({
  default: ({
    isOpen,
    data,
    title,
    keyExtractor,
    onSelect,
    renderItem,
  }: {
    isOpen: boolean;
    data?: { name: string }[];
    title: string;
    keyExtractor: (item: { name: string }) => string | number;
    onSelect: (item: { name: string }) => void;
    renderItem?: (item: { name: string }, isSelected: boolean) => ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {(data ?? []).map((item) => (
          <button
            key={keyExtractor(item)}
            type="button"
            data-key={keyExtractor(item)}
            onClick={() => onSelect(item)}
          >
            {renderItem ? renderItem(item, false) : item.name}
          </button>
        ))}
      </div>
    ) : null,
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

/** Prod my-profile (menejer 210): `branch` — branch_users QATORI (id 3), filial — 16. */
const managerProfile = {
  id: "210",
  name: "E2E Menejer REG",
  role: "manager",
  region: null,
  branch: {
    id: "3",
    branch_id: "16",
    user_id: "210",
    role: "MANAGER",
    branch: {
      id: "16",
      name: "E2E REGIONAL Samarqand",
      phone_number: "+998903009020",
      type: "REGIONAL",
      parent_id: "1",
    },
  },
};
const manager = {
  role: { id: "210", role: "manager", region: null, name: "Menejer" },
  user: {
    user: managerProfile,
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const open = (preloadedState: never) =>
  renderWithProviders(
    <>
      <Payments />
      <LocationProbe />
    </>,
    { route: "/payments", preloadedState },
  );

const rowKeys = (dialog: HTMLElement) =>
  within(dialog).getAllByRole("button").map((row) => row.getAttribute("data-key"));

beforeEach(() => {
  page.cashboxInfo = { data: {} };
  page.markets = undefined;
  page.marketParams = [];
  page.managers = undefined;
  page.managerParams = [];
  page.couriers = undefined;
  page.courierParams = [];
  page.branches = undefined;
  page.hqCouriers = undefined;
});

describe("FE-PAY-13 — 'Berilishi kerak' lists blocked markets that are still owed money", () => {
  it("requests markets without status=active; shows a blocked market with money (badge) and hides a blocked one with zero", async () => {
    page.markets = {
      data: {
        items: [
          { id: "201", name: "Yandex", status: "active", cashbox: { balance: 1_000_000 } },
          { id: "202", name: "Kimdur", status: "inactive", cashbox: { balance: 300_000 } },
          { id: "203", name: "Eski market", status: "inactive", cashbox: { balance: 0 } },
          { id: "204", name: "Yangi market", status: "active", cashbox: { balance: 0 } },
        ],
      },
    };
    open(superadmin);

    await userEvent.setup().click(screen.getByText("Berilishi kerak"));
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });

    expect(page.marketParams.at(-1)).not.toHaveProperty("status");
    expect(rowKeys(dialog)).toEqual(["201", "202", "204"]);
    const blockedRow = within(dialog).getByRole("button", { name: /Kimdur/ });
    expect(within(blockedRow).getByText("Bloklangan")).toBeInTheDocument();
    const activeRow = within(dialog).getByRole("button", { name: /Yandex/ });
    expect(within(activeRow).queryByText("Bloklangan")).not.toBeInTheDocument();
  });
});

describe("FE-PAY-13 / CODE-19 / CODE-27 — 'Qabul qilinishi kerak' (superadmin)", () => {
  it("lists a blocked manager with money (badge), and a branch with money but no manager row", async () => {
    page.managers = {
      data: {
        items: [
          {
            id: "198",
            name: "Sirdaryo menejeri",
            status: "active",
            branch_id: "15",
            branch: { id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL" },
            berilishi_kerak: 120_000,
          },
          {
            id: "199",
            name: "Bloklangan menejer",
            status: "inactive",
            branch_id: "17",
            branch: { id: "17", name: "Filial 17", type: "REGIONAL" },
            berilishi_kerak: 80_000,
          },
          {
            id: "200",
            name: "Bo'sh bloklangan",
            status: "inactive",
            branch_id: "18",
            branch: { id: "18", name: "Filial 18", type: "REGIONAL" },
            berilishi_kerak: 0,
          },
        ],
      },
    };
    page.branches = {
      data: [
        { id: "1", name: "Bosh ofis", type: "HQ", status: "active", berilishi_kerak: 0 },
        { id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL", status: "active", berilishi_kerak: 120_000 },
        { id: "19", name: "Menejersiz filial", type: "REGIONAL", status: "active", berilishi_kerak: 50_000, region: { id: "6", name: "Samarqand" } },
        { id: "20", name: "Qarzsiz filial", type: "REGIONAL", status: "active", berilishi_kerak: 0 },
      ],
    };
    page.hqCouriers = { data: { items: [], total: 0, hq_branch_id: "1" } };
    open(superadmin);

    await userEvent.setup().click(screen.getByText("Qabul qilinishi kerak"));
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });

    expect(page.managerParams.at(-1)).not.toHaveProperty("status");
    expect(rowKeys(dialog)).toEqual(["branch:15", "branch:17", "branch:19"]);
    expect(
      within(within(dialog).getByRole("button", { name: /Bloklangan menejer/ })).getByText("Bloklangan"),
    ).toBeInTheDocument();
    const unmanaged = within(dialog).getByRole("button", { name: /Menejersiz filial/ });
    expect(within(unmanaged).getByText("Menejer biriktirilmagan filial")).toBeInTheDocument();

    await userEvent.setup().click(unmanaged);
    expect(screen.getByTestId("pathname")).toHaveTextContent("/payments/cash-detail/19");
    expect(screen.getByTestId("search")).toHaveTextContent("?type=branch");
    expect(JSON.parse(screen.getByTestId("state").textContent || "null")).toEqual(
      expect.objectContaining({ type: "branch", entity: expect.objectContaining({ id: "19", amount: 50_000 }) }),
    );
  });

  it("manager: requests own branch couriers without status=active and keeps a blocked courier who still holds cash", async () => {
    page.couriers = {
      data: {
        items: [
          { id: "209", name: "Faol kuryer", status: "active", cashbox: { balance: 70_000 } },
          { id: "210", name: "Bloklangan kuryer", status: "inactive", cashbox: { balance: 30_000 } },
          { id: "211", name: "Puli yo'q bloklangan", status: "inactive", cashbox: { balance: 0 } },
        ],
      },
    };
    open(manager);

    await userEvent.setup().click(screen.getByText("Qabul qilinishi kerak"));
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });

    expect(page.courierParams.at(-1)).not.toHaveProperty("status");
    expect(rowKeys(dialog)).toEqual(["courier:209", "courier:210"]);
    expect(
      within(within(dialog).getByRole("button", { name: /Bloklangan kuryer/ })).getByText("Bloklangan"),
    ).toBeInTheDocument();
  });
});
