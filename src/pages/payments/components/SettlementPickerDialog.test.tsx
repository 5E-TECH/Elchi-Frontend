import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SettlementPickerDialog, { type SettlementPickerKind } from "./SettlementPickerDialog";
import { renderWithProviders } from "../../../test/test-utils";

const state = vi.hoisted(() => ({
  markets: { data: undefined, isLoading: false, isError: false } as Record<string, unknown>,
  marketParams: [] as unknown[],
  marketsRefetch: vi.fn(),
  couriers: { data: undefined, isLoading: false, isError: false } as Record<string, unknown>,
  couriersRefetch: vi.fn(),
  managers: undefined as unknown,
  hqCouriers: undefined as unknown,
  managerMarkets: { data: undefined, isLoading: false, isError: false, error: null, isFetching: false } as Record<string, unknown>,
  managerMarketsEnabled: [] as boolean[],
  managerMarketsRefetch: vi.fn(),
}));

// 63HO6cBU (BE PR-C): menejer «Berilishi kerak» — GET /finance/cashbox/manager/markets.
vi.mock("../../../entities/payments/managerMarkets", () => ({
  useManagerMarkets: (enabled: boolean) => {
    state.managerMarketsEnabled.push(enabled);
    return enabled
      ? { ...state.managerMarkets, refetch: state.managerMarketsRefetch }
      : { data: undefined, isLoading: false, isError: false, error: null, isFetching: false, refetch: vi.fn() };
  },
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: (params: unknown, enabled: boolean) => {
      if (enabled) state.marketParams.push(params);
      return enabled ? { ...state.markets, refetch: state.marketsRefetch } : { data: undefined, isLoading: false };
    },
  }),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetManagers: () => ({ data: state.managers, isLoading: false }),
    useGetCouriers: (_params: unknown, enabled: boolean) =>
      enabled ? { ...state.couriers, refetch: state.couriersRefetch } : { data: undefined, isLoading: false },
  }),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({ useGetHqCourierReceivables: () => ({ data: state.hqCouriers, isLoading: false }) }),
}));

vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const managerRole = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

const open = (
  kind: SettlementPickerKind,
  props: { total?: number; branchName?: string } = {},
  preloadedState = superadmin,
) => {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <SettlementPickerDialog kind={kind} open onClose={onClose} onSelect={onSelect} {...props} />,
    { preloadedState },
  );
  return { onSelect, onClose };
};

beforeEach(() => {
  state.markets = { data: undefined, isLoading: false, isError: false };
  state.marketParams = [];
  state.marketsRefetch.mockClear();
  state.couriers = { data: undefined, isLoading: false, isError: false };
  state.couriersRefetch.mockClear();
  state.managers = undefined;
  state.hqCouriers = undefined;
  state.managerMarkets = { data: undefined, isLoading: false, isError: false, error: null, isFetching: false };
  state.managerMarketsEnabled = [];
  state.managerMarketsRefetch.mockClear();
});

/** Oynadagi qatorlar tartibi (nom bo'yicha). */
const optionNames = (dialog: HTMLElement, names: readonly string[]) =>
  within(dialog)
    .getAllByRole("option")
    .map((option) => names.find((name) => option.textContent?.includes(name)) ?? option.textContent);

describe("SettlementPickerDialog", () => {
  it("give: mockup texts, list without status=active, negative amount with the minus sign, select → market cashbox", async () => {
    state.markets = {
      data: {
        data: [
          { id: "201", name: "Baraka Shop", status: "active", cashbox: { balance: 4_820_000 } },
          { id: "205", name: "Qarzdor market", status: "active", cashbox: { balance: -85_000 } },
        ],
      },
      isLoading: false,
      isError: false,
    };
    const { onSelect } = open("give");

    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByText("Pul to'lanadigan marketni tanlang")).toBeInTheDocument();
    expect(within(dialog).getByText("1 ta market, jami 4 820 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Qidirish...")).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Marketni nomi bo'yicha qidirish" })).toBeInTheDocument();
    expect(state.marketParams.at(-1)).toEqual({ limit: 10000 });
    expect(within(dialog).getByText("−85 000 so'm")).toHaveClass("text-danger-fg");

    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("option", { name: /Baraka Shop/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tanlash" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      path: "/payments/cash-detail/201?type=market",
      state: {
        type: "market",
        entity: expect.objectContaining({ id: "201", name: "Baraka Shop", amount: 4_820_000, is_inactive: false }),
      },
    });
  });

  it("double click selects once (no second onSelect)", async () => {
    state.markets = {
      data: { data: [{ id: "201", name: "Baraka Shop", status: "active", cashbox: { balance: 10 } }] },
      isLoading: false,
      isError: false,
    };
    const { onSelect } = open("give");

    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    const user = userEvent.setup();
    await user.dblClick(within(dialog).getByRole("option", { name: /Baraka Shop/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    // Oyna yopilayotganda «Tanlash» yoki Enter qayta bosilsa ham ikkinchi navigatsiya yo'q.
    await user.click(within(dialog).getByRole("button", { name: "Tanlash" }));
    await user.type(within(dialog).getByRole("combobox"), "{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("loading: skeleton instead of «Yuklanmoqda…» text; empty list: «Qarzdorlik yo'q»", async () => {
    state.markets = { data: undefined, isLoading: true, isError: false };
    open("give");
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByRole("status", { name: "Ro'yxat yuklanmoqda" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("listbox")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tanlash" })).toBeDisabled();
  });

  it("empty list: «Qarzdorlik yo'q»", async () => {
    state.markets = { data: { data: [] }, isLoading: false, isError: false };
    open("give");
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByText("Qarzdorlik yo'q")).toBeInTheDocument();
  });

  it("error: «Ro'yxatni yuklab bo'lmadi» with a retry", async () => {
    state.markets = { data: undefined, isLoading: false, isError: true };
    open("give");
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByText("Ro'yxatni yuklab bo'lmadi")).toBeInTheDocument();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(state.marketsRefetch).toHaveBeenCalled();
  });

  it("courier (manager): title, total, branch group with count, «tuman · telefon» subtitle, zero amount shown", async () => {
    state.couriers = {
      data: {
        data: {
          items: [
            { id: "1", name: "Bekzod Normurodov", phone_number: "+998902145508", region: { name: "Urgut tumani" }, cashbox: { balance: 1_280_000 } },
            { id: "2", name: "Bo'sh kuryer", region: { name: "Jomboy tumani" }, cashbox: { balance: 0 } },
          ],
        },
      },
      isLoading: false,
      isError: false,
    };
    open("courier", { total: 2_940_000, branchName: "Urgut filiali" });

    const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });
    expect(within(dialog).getByText("Qabul qilinishi kerak: jami 2 940 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByText("Urgut filiali kuryerlari · 2 ta")).toBeInTheDocument();
    expect(within(dialog).getByText("Urgut tumani · +998 90 214 55 08")).toBeInTheDocument();
    expect(within(dialog).getByText("0 so'm")).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Kuryerni qidirish" })).toHaveAttribute(
      "placeholder",
      "Ism, telefon yoki tuman",
    );
  });

  describe("Spt8Cj7m: summa bo'yicha kamayish tartibida, manfiy oxirida (maketlar *-payments-to-*-dialog)", () => {
    it("give: eng katta qarzdor tepada, «Nofaol» — summasiga qarab, manfiy pastda, 0 qoldiqli — faqat qidiruvda", async () => {
      state.markets = {
        data: {
          data: [
            { id: "1", name: "QA Market", status: "active", cashbox: { balance: 0 } },
            { id: "2", name: "Grand Moda", status: "blocked", cashbox: { balance: 512_000 } },
            { id: "3", name: "Qarzdor market", status: "active", cashbox: { balance: -85_000 } },
            { id: "4", name: "Baraka Shop", status: "active", cashbox: { balance: 4_820_000 } },
            { id: "5", name: "Ipak Yo'li Savdo", status: "active", cashbox: { balance: 1_784_000 } },
          ],
        },
        isLoading: false,
        isError: false,
      };
      open("give");
      const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
      expect(optionNames(dialog, ["Baraka Shop", "Ipak Yo'li Savdo", "Grand Moda", "QA Market", "Qarzdor market"])).toEqual([
        "Baraka Shop",
        "Ipak Yo'li Savdo",
        "Grand Moda",
        "Qarzdor market",
      ]);

      await userEvent.setup().type(within(dialog).getByRole("combobox"), "QA Mar");
      expect(within(dialog).getByRole("option", { name: /QA Market/ })).toBeInTheDocument();
    });

    it("give: hamma market 0 qoldiqli — «topilmadi» emas, bo'sh ro'yxat holati", async () => {
      state.markets = {
        data: { data: [{ id: "1", name: "QA Market", status: "active", cashbox: { balance: 0 } }] },
        isLoading: false,
        isError: false,
      };
      open("give");
      const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
      expect(within(dialog).queryByRole("option")).not.toBeInTheDocument();
      expect(within(dialog).getByText("Qarzdorlik yo'q")).toBeInTheDocument();
    });

    it("courier (menejer): kuryerlar summa bo'yicha, manfiy oxirida", async () => {
      state.couriers = {
        data: {
          data: {
            items: [
              { id: "1", name: "Bo'sh kuryer", cashbox: { balance: 0 } },
              { id: "2", name: "Qarzdor kuryer", cashbox: { balance: -40_000 } },
              { id: "3", name: "Bekzod", cashbox: { balance: 1_280_000 } },
              { id: "4", name: "Jasur", cashbox: { balance: 2_100_000 } },
            ],
          },
        },
        isLoading: false,
        isError: false,
      };
      open("courier");
      const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });
      expect(optionNames(dialog, ["Jasur", "Bekzod", "Bo'sh kuryer", "Qarzdor kuryer"])).toEqual([
        "Jasur",
        "Bekzod",
        "Bo'sh kuryer",
        "Qarzdor kuryer",
      ]);
    });

    it("receive: filiallar va HQ kuryerlari guruhlari o'z o'rnida, har biri ichida — summa bo'yicha", async () => {
      const manager = (id: string, name: string, amount: number, status = "active") => ({
        id,
        name,
        status,
        branch: { id: `b${id}`, name: `${name} filiali`, type: "REGIONAL" },
        berilishi_kerak: amount,
      });
      state.managers = {
        data: [
          manager("1", "Buxoro", 410_000),
          manager("2", "Ravshan Ortiqov", 4_250_000),
          manager("3", "Anvar Qodirov", 620_000, "blocked"),
          manager("4", "Dilshod Yo'ldoshev", 1_340_000),
        ],
      };
      state.hqCouriers = {
        data: [
          { id: "h1", name: "Rustam Qosimov", balance: -85_000 },
          { id: "h2", name: "Jasur Tursunov", balance: 1_155_000 },
        ],
      };
      open("receive");
      const dialog = await screen.findByRole("dialog", { name: "Qabul qilinishi kerak" });
      const names = ["Ravshan Ortiqov", "Dilshod Yo'ldoshev", "Anvar Qodirov", "Buxoro", "Jasur Tursunov", "Rustam Qosimov"];
      expect(optionNames(dialog, names)).toEqual(names);
    });
  });

  it("courier without a branch name: «Kuryerlar · N ta»", async () => {
    state.couriers = {
      data: { data: { items: [{ id: "1", name: "Bekzod", cashbox: { balance: 5 } }] } },
      isLoading: false,
      isError: false,
    };
    open("courier");
    const dialog = await screen.findByRole("dialog", { name: "Kuryerni tanlang" });
    expect(within(dialog).getByText("Kuryerlar · 1 ta")).toBeInTheDocument();
  });

  /**
   * Qidiruv limitlari (2026-11-27, Dilshod: «to'lovlarga kirib marketga to'lov qilmoqchi bo'lsam shu market
   * chiqmiyabdi»): backend ilgari 100 tadan ortig'ini qaytarmasdi. Endi 150 marketdan oxirgisi (0 so'm — sukut
   * bo'yicha yashirin) nomi, telefoni yoki ID si bo'yicha topiladi.
   */
  it("⭐ give: 150 market — 101-dan keyingi market nomi, telefoni yoki ID si bo'yicha topiladi", async () => {
    const items = Array.from({ length: 149 }, (_, index) => ({
      id: String(index + 1),
      name: `Do'kon ${index + 1}`,
      phone_number: `+99890000${String(index + 1).padStart(4, "0")}`,
      status: "active",
      cashbox: { balance: 1000 },
    }));
    items.push({ id: "9150", name: "Eski Baraka", phone_number: "+998937771122", status: "active", cashbox: { balance: 0 } });
    state.markets = { data: { data: { items } }, isLoading: false, isError: false };
    open("give");

    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(state.marketParams.at(-1)).toEqual({ limit: 10000 });
    expect(within(dialog).getAllByRole("option")).toHaveLength(149);
    expect(within(dialog).queryByRole("option", { name: /Eski Baraka/ })).not.toBeInTheDocument();

    const user = userEvent.setup();
    const search = within(dialog).getByRole("combobox", { name: "Marketni nomi bo'yicha qidirish" });
    for (const query of ["eski bar", "93 777 11 22", "9150"]) {
      await user.clear(search);
      await user.type(search, query);
      expect(within(dialog).getByRole("option", { name: /Eski Baraka/ })).toBeInTheDocument();
    }
  });
});

/**
 * 63HO6cBU (P0, BE PR-C): menejer «Berilishi kerak» — faqat o'z filiali marketlari (`GET /finance/cashbox/manager/markets`,
 * `GET /markets` EMAS), qator summasi — «To'lash mumkin» (`payable`), filial ulushi (`branch_share`) emas. «To'lash
 * mumkin» 0 — ro'yxatda, lekin tanlanmaydi. Bo'sh — «Bu filialga buyurtma topshiradigan market yo'q»; 503 — xato holati.
 */
describe("SettlementPickerDialog — menejer «Berilishi kerak» (63HO6cBU, BE PR-C)", () => {
  const share = (marketId: string, name: string, branchShare: number, payable: number, status = "active") => ({
    marketId,
    name,
    status,
    branchShare,
    payable,
  });
  const managerList = (items: ReturnType<typeof share>[], totalPayable: number | null = null) => {
    state.managerMarkets = {
      data: { branchId: "16", items, totalShare: null, totalPayable, total: items.length },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    };
  };

  it("⭐ manba — manager/markets (GET /markets so'ralmaydi); qator summasi — payable (ulush emas); 0 — tanlanmaydi", async () => {
    managerList(
      [
        // Ulush 4,82 mln, lekin marketga qarz 1,2 mln — «To'lash mumkin» 1,2 mln.
        share("2", "Baraka Shop", 4_820_000, 1_200_000),
        share("3", "Ipak Yo'li Savdo", 900_000, 900_000),
        // HQ oldindan to'lagan: ulush bor, to'lash mumkin — 0.
        share("5", "Oila Market", 300_000, 0),
      ],
      2_100_000,
    );
    const { onSelect } = open("give", {}, managerRole);

    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(state.marketParams).toEqual([]);
    expect(state.managerMarketsEnabled.at(-1)).toBe(true);
    expect(dialog).toHaveAccessibleDescription(
      "Pul to'lanadigan marketni tanlang · 2 ta market, to'lash mumkin: jami 2 100 000 so'm",
    );
    // Summa bir qatorda (raqam o'rtasida bo'linmaydi).
    expect(within(dialog).getByText("2 100 000 so'm")).toHaveClass("whitespace-nowrap");

    const baraka = within(dialog).getByRole("option", { name: /Baraka Shop/ });
    expect(baraka).toHaveTextContent("1 200 000 so'm");
    expect(baraka).not.toHaveTextContent("4 820 000");
    expect(optionNames(dialog, ["Baraka Shop", "Ipak Yo'li Savdo", "Oila Market"])).toEqual([
      "Baraka Shop",
      "Ipak Yo'li Savdo",
      "Oila Market",
    ]);

    // «To'lash mumkin» 0 — ro'yxatda, xira, bosilsa ham tanlanmaydi.
    const oila = within(dialog).getByRole("option", { name: /Oila Market/ });
    expect(oila).toHaveAttribute("aria-disabled", "true");
    expect(oila).toHaveTextContent("0 so'm");
    const user = userEvent.setup();
    await user.click(oila);
    expect(oila).toHaveAttribute("aria-selected", "false");
    expect(within(dialog).getByRole("button", { name: "Tanlash" })).toBeDisabled();
    await user.dblClick(oila);
    expect(onSelect).not.toHaveBeenCalled();

    // Klaviatura ham o'tkazib yuboradi: End → oxirgi TANLANADIGAN qator, ↓ — boshiga aylanadi.
    const search = within(dialog).getByRole("combobox", { name: "Marketni nomi bo'yicha qidirish" });
    await user.type(search, "{End}");
    expect(within(dialog).getByRole("option", { name: /Ipak Yo'li Savdo/ })).toHaveAttribute("aria-selected", "true");
    await user.type(search, "{ArrowDown}");
    expect(within(dialog).getByRole("option", { name: /Baraka Shop/ })).toHaveAttribute("aria-selected", "true");

    await user.click(within(dialog).getByRole("button", { name: "Tanlash" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      path: "/payments/cash-detail/2?type=market",
      state: {
        type: "market",
        entity: expect.objectContaining({ id: "2", name: "Baraka Shop", amount: 1_200_000, is_inactive: false }),
      },
    });
  });

  it("qidiruv — nomi yoki ID si bo'yicha; «Nofaol» belgisi", async () => {
    managerList([share("2", "Baraka Shop", 100, 100), share("201", "Grand Moda", 50, 50, "blocked")]);
    open("give", {}, managerRole);
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByRole("option", { name: /Grand Moda/ })).toHaveTextContent("Nofaol");

    await userEvent.setup().type(within(dialog).getByRole("combobox"), "201");
    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    expect(within(dialog).getByRole("option", { name: /Grand Moda/ })).toBeInTheDocument();
  });

  it("bo'sh ro'yxat — «Bu filialga buyurtma topshiradigan market yo'q»", async () => {
    managerList([]);
    open("give", {}, managerRole);
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByText("Bu filialga buyurtma topshiradigan market yo'q")).toBeInTheDocument();
    expect(within(dialog).queryByText("Qarzdorlik yo'q")).not.toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("Pul to'lanadigan marketni tanlang");
  });

  it("hammasi «To'lash mumkin» 0 — bo'sh holat emas, qatorlar xira ko'rinadi", async () => {
    managerList([share("5", "Oila Market", 300_000, 0)]);
    open("give", {}, managerRole);
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByRole("option", { name: /Oila Market/ })).toHaveAttribute("aria-disabled", "true");
    expect(dialog).toHaveAccessibleDescription("Pul to'lanadigan marketni tanlang · 0 ta market, to'lash mumkin: jami 0 so'm");
  });

  it("⭐ 503 — bo'sh ro'yxat emas: «Filial ulushini tekshirib bo'lmadi …» + «Qayta urinish»", async () => {
    const message = "Filial ulushini tekshirib bo'lmadi — birozdan so'ng qayta urinib ko'ring";
    state.managerMarkets = {
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      error: Object.assign(new Error("Service Unavailable"), {
        isAxiosError: true,
        response: { status: 503, data: { statusCode: 503, message } },
      }),
    };
    open("give", {}, managerRole);
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByText("Ro'yxatni yuklab bo'lmadi")).toBeInTheDocument();
    expect(within(dialog).getByText(message)).toBeInTheDocument();
    expect(within(dialog).queryByText("Bu filialga buyurtma topshiradigan market yo'q")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(state.managerMarketsRefetch).toHaveBeenCalled();
  });

  it("yuklanmoqda — skelet", async () => {
    state.managerMarkets = { data: undefined, isLoading: true, isError: false, error: null, isFetching: true };
    open("give", {}, managerRole);
    const dialog = await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(within(dialog).getByRole("status", { name: "Ro'yxat yuklanmoqda" })).toBeInTheDocument();
  });

  it("superadmin — avvalgidek GET /markets (manager/markets so'ralmaydi)", async () => {
    state.markets = {
      data: { data: [{ id: "201", name: "Baraka Shop", status: "active", cashbox: { balance: 10 } }] },
      isLoading: false,
      isError: false,
    };
    open("give");
    await screen.findByRole("dialog", { name: "Berilishi kerak" });
    expect(state.marketParams.at(-1)).toEqual({ limit: 10000 });
    expect(state.managerMarketsEnabled.every((enabled) => !enabled)).toBe(true);
  });
});
