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
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: (_params: unknown, enabled: boolean) =>
      enabled ? { ...state.couriers, refetch: state.couriersRefetch } : { data: undefined, isLoading: false },
  }),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({ useGetHqCourierReceivables: () => ({ data: undefined, isLoading: false }) }),
}));

vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));

const open = (kind: SettlementPickerKind, props: { total?: number; branchName?: string } = {}) => {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <SettlementPickerDialog kind={kind} open onClose={onClose} onSelect={onSelect} {...props} />,
  );
  return { onSelect, onClose };
};

beforeEach(() => {
  state.markets = { data: undefined, isLoading: false, isError: false };
  state.marketParams = [];
  state.marketsRefetch.mockClear();
  state.couriers = { data: undefined, isLoading: false, isError: false };
  state.couriersRefetch.mockClear();
});

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
});
