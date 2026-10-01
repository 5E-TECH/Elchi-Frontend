import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import i18n from "../../../../i18n";
import {
  isInactiveStatus,
  isListedSettlementRow,
  toBranchCourierOptions,
  toBranchManagerOptions,
  toHqCourierOptions,
  toUnmanagedBranchOptions,
  useReceiveOptions,
} from "./receiveOptions";

const queries = vi.hoisted(() => ({
  params: { managers: [] as unknown[], couriers: [] as unknown[], branches: [] as unknown[] },
  branchesEnabled: [] as boolean[],
  managers: undefined as unknown,
  branches: undefined as unknown,
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetManagers: (params: unknown, enabled: boolean) => {
      queries.params.managers.push(params);
      return { data: enabled ? queries.managers : undefined, isLoading: false };
    },
    useGetCouriers: (params: unknown) => {
      queries.params.couriers.push(params);
      return { data: undefined, isLoading: false };
    },
  }),
}));
vi.mock("../../../../entities/branch/api/useBranches", () => ({
  useBranches: (params: unknown, enabled: boolean) => {
    queries.params.branches.push(params);
    queries.branchesEnabled.push(enabled);
    return { data: enabled ? queries.branches : undefined, isLoading: false };
  },
}));
vi.mock("../../../../entities/payments", () => ({
  useCashBox: () => ({ useGetHqCourierReceivables: () => ({ data: undefined, isLoading: false }) }),
}));

const t = i18n.getFixedT("uz", "payments");

describe("status helpers (FE-PAY-13 / CODE-19)", () => {
  it("treats only a non-empty, non-active status as inactive", () => {
    expect(isInactiveStatus("inactive")).toBe(true);
    expect(isInactiveStatus("blocked")).toBe(true);
    expect(isInactiveStatus("ACTIVE")).toBe(false);
    expect(isInactiveStatus("active")).toBe(false);
    expect(isInactiveStatus(undefined)).toBe(false);
    expect(isInactiveStatus("")).toBe(false);
  });

  it("lists an inactive row only while it still has money", () => {
    expect(isListedSettlementRow({ is_inactive: false, amount: 0 })).toBe(true);
    expect(isListedSettlementRow({ is_inactive: true, amount: 1000 })).toBe(true);
    expect(isListedSettlementRow({ is_inactive: true, amount: -500 })).toBe(true);
    expect(isListedSettlementRow({ is_inactive: true, amount: 0 })).toBe(false);
  });
});

describe("toBranchManagerOptions with blocked managers", () => {
  it("keeps the active manager's row when an old blocked manager maps to the same branch", () => {
    const options = toBranchManagerOptions(
      [
        { id: "1", name: "Eski menejer", status: "inactive", branch_id: "15", berilishi_kerak: 120000 },
        { id: "2", name: "Yangi menejer", status: "active", branch_id: "15", berilishi_kerak: 120000 },
      ],
      t,
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toEqual(expect.objectContaining({ key: "branch:15", name: "Yangi menejer", is_inactive: false }));
  });

  it("drops a blocked manager whose branch owes nothing", () => {
    expect(
      toBranchManagerOptions([{ id: "1", name: "X", status: "inactive", branch_id: "15", berilishi_kerak: 0 }], t),
    ).toEqual([]);
  });
});

describe("toBranchCourierOptions / toHqCourierOptions flags", () => {
  it("flags inactive couriers and keeps them only with money", () => {
    const options = toBranchCourierOptions(
      [
        { id: "1", name: "A", status: "inactive", cashbox: { balance: 1000 } },
        { id: "2", name: "B", status: "inactive", cashbox: { balance: 0 } },
      ],
      t,
    );
    expect(options.map((option) => [option.key, option.is_inactive])).toEqual([["courier:1", true]]);
    expect(toHqCourierOptions([{ id: "9", name: "C", status: "blocked", balance: 50 }], t)[0].is_inactive).toBe(true);
  });
});

describe("toUnmanagedBranchOptions (CODE-27)", () => {
  const branches = {
    data: [
      { id: "1", name: "Bosh ofis", type: "HQ", status: "active", berilishi_kerak: 900 },
      { id: "15", name: "Sirdaryo", type: "REGIONAL", status: "active", berilishi_kerak: 120000 },
      { id: "19", name: "Menejersiz", type: "HYBRID", status: "active", berilishi_kerak: 50000, region: { name: "Samarqand" } },
      { id: "20", name: "Qarzsiz", type: "REGIONAL", status: "active", berilishi_kerak: 0 },
      { id: "21", name: "Nofaol", type: "REGIONAL", status: "inactive", berilishi_kerak: 7000 },
    ],
  };

  it("adds only non-HQ active branches with money that are not already listed", () => {
    const options = toUnmanagedBranchOptions(branches, new Set(["branch:15"]), t);

    expect(options).toEqual([
      {
        key: "branch:19",
        kind: "branch",
        id: "19",
        name: "Menejersiz",
        phone_number: "",
        subtitle: "Menejer biriktirilmagan filial",
        region: "Samarqand",
        branch_name: "Menejersiz",
        amount: 50000,
        is_inactive: false,
      },
    ]);
  });
});

describe("useReceiveOptions requests", () => {
  beforeEach(() => {
    queries.params = { managers: [], couriers: [], branches: [] };
    queries.branchesEnabled = [];
    queries.managers = undefined;
    queries.branches = undefined;
  });

  it("superadmin: no status filter on managers; active branches list (same source as the card)", () => {
    queries.managers = { data: { items: [{ id: "198", name: "M", branch_id: "15", berilishi_kerak: 1 }] } };
    queries.branches = { data: [{ id: "19", name: "Menejersiz", type: "REGIONAL", status: "active", berilishi_kerak: 5 }] };
    const { result } = renderHook(() => useReceiveOptions({ isManagerRole: false, enabled: true }));

    expect(queries.params.managers.at(-1)).not.toHaveProperty("status");
    expect(queries.params.branches.at(-1)).toEqual({ status: "active", page: 1, limit: 100 });
    expect(result.current.options.map((option) => option.key)).toEqual(["branch:15", "branch:19"]);
  });

  it("manager: no status filter on couriers and the branches list is never requested", () => {
    renderHook(() => useReceiveOptions({ isManagerRole: true, enabled: true }));

    expect(queries.params.couriers.at(-1)).not.toHaveProperty("status");
    expect(queries.branchesEnabled.some(Boolean)).toBe(false);
  });
});
