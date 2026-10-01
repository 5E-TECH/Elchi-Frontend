import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import i18n from "../../../../i18n";
import {
  RECEIVE_SEARCH_KEYS,
  getReceiveDetailTarget,
  toBranchCourierOptions,
  toBranchManagerOptions,
  toHqCourierOptions,
  useReceiveOptions,
  type ReceiveOption,
} from "./receiveOptions";

const queries = vi.hoisted(() => ({
  managers: undefined as unknown,
  couriers: undefined as unknown,
  hqCouriers: undefined as unknown,
  enabled: { managers: [] as boolean[], couriers: [] as boolean[], hqCouriers: [] as boolean[] },
}));

// Disabled react-query so'rovi `data` bermaydi — mock ham shunday ishlaydi.
vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetManagers: (_params: unknown, enabled: boolean) => {
      queries.enabled.managers.push(enabled);
      return { data: enabled ? queries.managers : undefined, isLoading: false };
    },
    useGetCouriers: (_params: unknown, enabled: boolean) => {
      queries.enabled.couriers.push(enabled);
      return { data: enabled ? queries.couriers : undefined, isLoading: false };
    },
  }),
}));

vi.mock("../../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetHqCourierReceivables: (enabled: boolean) => {
      queries.enabled.hqCouriers.push(enabled);
      return { data: enabled ? queries.hqCouriers : undefined, isLoading: false };
    },
  }),
}));

const t = i18n.getFixedT("uz", "payments");

/** GET /managers javobi (gateway har menejerga filial va kassani qo'shadi). */
const managersResponse = {
  statusCode: 200,
  data: {
    items: [
      {
        id: "198",
        name: "Sirdaryo menejeri",
        phone_number: "+998903009002",
        branch_id: "15",
        branch: {
          id: "15",
          name: "E2E Filial Sirdaryo",
          type: "REGIONAL",
          region: { id: "4", name: "Sirdaryo" },
        },
        payable_to_hq: 120000,
        berilishi_kerak: 120000,
      },
      {
        // Eski HQ menejeri — HQ'da menejer bo'lmaydi, qator ko'rsatilmaydi.
        id: "5",
        name: "HQ menejeri",
        phone_number: "+998900000005",
        branch_id: "1",
        branch: { id: "1", name: "Bosh ofis", type: "HQ" },
        berilishi_kerak: 999000,
      },
      {
        id: "210",
        name: "",
        phone_number: "+998901112233",
        branch: { id: "14", name: "Filial 14", type: "HYBRID" },
        cashbox: { berilishi_kerak: 30000 },
      },
    ],
  },
};

/** GET /finance/cashbox/hq-couriers javobi (C1). */
const hqCouriersResponse = {
  statusCode: 200,
  message: "ok",
  data: {
    items: [
      {
        id: "263",
        name: "Ali Valiyev",
        phone_number: "+998901234567",
        status: "active",
        balance: 250000,
        cashbox: { id: "70", balance: 250000, balance_cash: 250000, balance_card: 0 },
      },
      {
        // Filial 14 bilan bir xil ID — kalitlar aralashmasligi kerak.
        id: "14",
        name: "",
        phone_number: "+998907654321",
        status: "blocked",
        balance: 50000,
        cashbox: { id: "71", balance: 50000, balance_cash: 50000, balance_card: 0 },
      },
      {
        id: "300",
        name: null,
        phone_number: null,
        status: "active",
        balance: 1000,
        cashbox: { id: "72", balance: 1000, balance_cash: 1000, balance_card: 0 },
      },
    ],
    total: 3,
    hq_branch_id: "1",
  },
};

/** GET /couriers javobi (menejer — o'z filiali kuryerlari). */
const branchCouriersResponse = {
  statusCode: 200,
  data: {
    items: [
      {
        id: "209",
        name: "Filial kuryeri",
        phone_number: "+998909998877",
        region: { id: "4", name: "Sirdaryo" },
        cashbox: { balance: 70000 },
      },
    ],
  },
};

const STRING_FIELDS: (keyof ReceiveOption)[] = [
  "key",
  "kind",
  "id",
  "name",
  "phone_number",
  "subtitle",
  "region",
  "branch_name",
];

const expectNoUndefinedStrings = (options: ReceiveOption[]) => {
  options.forEach((option) => {
    STRING_FIELDS.forEach((field) => {
      expect(typeof option[field], `${option.key}.${field}`).toBe("string");
    });
    // PopupSelect qidiruvi `String(item[key])` qiladi.
    RECEIVE_SEARCH_KEYS.forEach((field) => {
      expect(String(option[field])).not.toMatch(/undefined|null/);
    });
    expect(Number.isFinite(option.amount)).toBe(true);
  });
};

describe("toBranchManagerOptions", () => {
  it("drops the HQ branch row (no managers on HQ) and keys rows by branch", () => {
    const options = toBranchManagerOptions(managersResponse, t);

    expect(options.map((option) => option.key)).toEqual(["branch:15", "branch:14"]);
    expect(options.some((option) => option.id === "1")).toBe(false);
    expect(options[0]).toEqual({
      key: "branch:15",
      kind: "branch",
      id: "15",
      name: "Sirdaryo menejeri",
      phone_number: "+998903009002",
      subtitle: "E2E Filial Sirdaryo",
      region: "Sirdaryo",
      branch_name: "E2E Filial Sirdaryo",
      amount: 120000,
    });
  });

  it("falls back to the phone for a nameless manager and reads the amount from the cashbox", () => {
    const [, second] = toBranchManagerOptions(managersResponse, t);

    expect(second.name).toBe("+998901112233");
    expect(second.region).toBe("Noma'lum");
    expect(second.amount).toBe(30000);
  });

  it("skips rows without a branch id and duplicate branches", () => {
    const options = toBranchManagerOptions(
      [
        { id: "1", name: "No branch" },
        { id: "2", name: "A", branch: { id: "20", type: "REGIONAL" } },
        { id: "3", name: "B", branch: { id: "20", type: "REGIONAL" } },
      ],
      t,
    );

    expect(options.map((option) => option.key)).toEqual(["branch:20"]);
  });
});

describe("toHqCourierOptions", () => {
  it("maps name → phone → 'Foydalanuvchi', subtitle 'HQ kuryeri · phone' and amount = balance", () => {
    const options = toHqCourierOptions(hqCouriersResponse, t);

    expect(options.map((option) => [option.key, option.name, option.subtitle, option.amount])).toEqual([
      ["courier:263", "Ali Valiyev", "HQ kuryeri · +998901234567", 250000],
      ["courier:14", "+998907654321", "HQ kuryeri · +998907654321", 50000],
      ["courier:300", "Foydalanuvchi", "HQ kuryeri", 1000],
    ]);
    expect(options.every((option) => option.kind === "courier")).toBe(true);
  });

  it("falls back to cashbox.balance when the top-level balance is missing", () => {
    const [option] = toHqCourierOptions([{ id: "7", name: "X", cashbox: { balance: 4200 } }], t);

    expect(option.amount).toBe(4200);
  });
});

describe("toBranchCourierOptions (manager)", () => {
  it("maps own branch couriers with the region as subtitle", () => {
    expect(toBranchCourierOptions(branchCouriersResponse, t)).toEqual([
      {
        key: "courier:209",
        kind: "courier",
        id: "209",
        name: "Filial kuryeri",
        phone_number: "+998909998877",
        subtitle: "Sirdaryo",
        region: "Sirdaryo",
        branch_name: "",
        amount: 70000,
      },
    ]);
  });
});

describe("receive option invariants", () => {
  it("keeps keys unique when a branch id equals a courier id", () => {
    const merged = [
      ...toBranchManagerOptions(managersResponse, t),
      ...toHqCourierOptions(hqCouriersResponse, t),
    ];
    const keys = merged.map((option) => option.key);

    expect(merged.filter((option) => option.id === "14").map((option) => option.key)).toEqual([
      "branch:14",
      "courier:14",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("never leaves a string field undefined, even for sparse rows", () => {
    const sparse = [{ id: "9" }, { id: 10, name: 42 }, { id: "11", branch: { id: "11" } }, {}];

    expectNoUndefinedStrings([
      ...toBranchManagerOptions(managersResponse, t),
      ...toBranchManagerOptions(sparse, t),
      ...toHqCourierOptions(hqCouriersResponse, t),
      ...toHqCourierOptions(sparse, t),
      ...toBranchCourierOptions(branchCouriersResponse, t),
      ...toBranchCourierOptions(sparse, t),
    ]);
  });

  it("builds the cash-detail target from the row kind, not from the viewer role", () => {
    const [courier] = toHqCourierOptions(hqCouriersResponse, t);
    const [branch] = toBranchManagerOptions(managersResponse, t);

    expect(getReceiveDetailTarget(courier)).toEqual({
      path: "/payments/cash-detail/263?type=courier",
      state: {
        type: "courier",
        entity: {
          id: "263",
          name: "Ali Valiyev",
          phone_number: "+998901234567",
          role: "courier",
          amount: 250000,
        },
      },
    });
    expect(getReceiveDetailTarget(branch).path).toBe("/payments/cash-detail/15?type=branch");
    expect(getReceiveDetailTarget(branch).state.type).toBe("branch");
  });
});

describe("useReceiveOptions", () => {
  beforeEach(() => {
    queries.managers = managersResponse;
    queries.couriers = branchCouriersResponse;
    queries.hqCouriers = hqCouriersResponse;
    queries.enabled = { managers: [], couriers: [], hqCouriers: [] };
  });

  it("superadmin/admin: branch managers followed by HQ couriers, never the /couriers list", () => {
    const { result } = renderHook(() => useReceiveOptions({ isManagerRole: false, enabled: true }));

    expect(result.current.options.map((option) => option.key)).toEqual([
      "branch:15",
      "branch:14",
      "courier:263",
      "courier:14",
      "courier:300",
    ]);
    expect(result.current.description).toBe("Filial menejeri yoki HQ kuryerini tanlang");
    expect(queries.enabled.couriers.every((enabled) => !enabled)).toBe(true);
  });

  it("manager: only the own branch couriers; managers and HQ couriers are never requested", () => {
    const { result } = renderHook(() => useReceiveOptions({ isManagerRole: true, enabled: true }));

    expect(result.current.options.map((option) => option.key)).toEqual(["courier:209"]);
    expect(result.current.description).toBe("Kuryerni tanlang");
    expect(queries.enabled.managers.every((enabled) => !enabled)).toBe(true);
    expect(queries.enabled.hqCouriers.every((enabled) => !enabled)).toBe(true);
  });

  it("loads nothing while the popup is closed", () => {
    const { result } = renderHook(() => useReceiveOptions({ isManagerRole: false, enabled: false }));

    expect(result.current.options).toEqual([]);
    expect(
      [...queries.enabled.managers, ...queries.enabled.couriers, ...queries.enabled.hqCouriers].some(Boolean),
    ).toBe(false);
  });
});
