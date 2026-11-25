import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * KRN902pg — `/payments/main-cashbox`: «To'lov usuli» va «Karta» filtrlari (URL'da, tarix so'roviga ketadi,
 * «Filtrlarni tozalash» ularni ham tozalaydi). Menejer (filial kassasi) — «Karta» yo'q.
 */
const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const state = vi.hoisted(() => ({
  historyParams: [] as Array<Record<string, unknown>>,
  cardsEnabled: [] as boolean[],
}));
const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const emptyQuery = { data: undefined, isLoading: false, isFetching: false };

vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => {
  const forbidden = () => ({ isError: true, error: { response: { status: 403 } }, isLoading: false, refetch: vi.fn() });
  return {
    ...(await importOriginal<object>()),
    useFinanceHistoryDaily: forbidden,
    useFinancialBalanceDaily: forbidden,
  };
});

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => emptyQuery,
    useGetUserById: () => emptyQuery,
    useGetManagers: () => emptyQuery,
    useGetCouriers: () => emptyQuery,
  }),
}));

vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) }),
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => emptyQuery }),
}));

vi.mock("../../../entities/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/payments")>()),
  useCashBox: () => ({
    cashboxSpand: idleMutation,
    cashboxFill: idleMutation,
    openShift: idleMutation,
    closeShift: idleMutation,
    useGetCurrentShift: () => ({ data: undefined, isLoading: false, isSuccess: false, isError: false, refetch: vi.fn() }),
    useGetCashBoxInfo: () => emptyQuery,
    useGetFinanceHistory: (params: Record<string, unknown>) => {
      state.historyParams.push(params);
      return { data: { data: { items: [] } }, isLoading: false, isFetching: false };
    },
    useGetFinanceHistoryById: () => emptyQuery,
    useGetCashBoxMain: () => emptyQuery,
    useGetHqCourierReceivables: () => emptyQuery,
  }),
}));

vi.mock("../../../entities/payments/cashboxCards", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCashboxCards: ({ enabled = true }: { enabled?: boolean } = {}) => {
    state.cardsEnabled.push(enabled);
    return {
      data: enabled
        ? {
            cashbox_type: "main",
            cards: [
              { id: "1", name: "Asosiy karta", is_default: true, is_active: true, last4: null },
              { id: "3", name: "Humo 1", is_default: false, is_active: true, last4: "4455" },
            ],
          }
        : undefined,
      isLoading: false,
    };
  },
}));

vi.mock("../../../widgets/Sidebar/model/menuConfig", () => ({ getUserBranchType: () => null }));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./CashboxFormPopup", () => ({ default: () => null }));
vi.mock("./CloseShiftPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

const open = (route: string, preloadedState: never) =>
  renderWithProviders(
    <>
      <MainCashbox />
      <LocationProbe />
    </>,
    { route, preloadedState },
  );
const currentSearch = () => screen.getByTestId("search").textContent ?? "";
const lastHistoryParams = () => state.historyParams.at(-1);
// Kompyuter (`max-md:hidden`) va telefon (`md:hidden`) qatorlari ikkalasi ham DOM'da — birinchisi kompyuterniki.
const field = (label: string) => screen.getAllByLabelText(label)[0];

describe("KRN902pg — MainCashbox tarix filtrlari", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  beforeEach(() => {
    state.historyParams = [];
    state.cardsEnabled = [];
  });

  it("TC6: superadmin — URL'dagi usul va karta asosiy kassa tarixi so'roviga ketadi (F5)", async () => {
    open("/payments/main-cashbox?payment_method=cash&card_id=3", superadmin);

    await waitFor(() =>
      expect(lastHistoryParams()).toEqual(
        expect.objectContaining({ cashbox_type: "main", payment_method: "cash", card_id: "3" }),
      ),
    );
    expect(field("To'lov usuli")).toHaveTextContent("Naqd");
    await waitFor(() => expect(field("Karta")).toHaveTextContent("Humo 1"));
  });

  it("TC6: tanlov URL'ga yoziladi va so'rovga ketadi; «Filtrlarni tozalash» ikkalasini ham olib tashlaydi", async () => {
    const user = userEvent.setup();
    open("/payments/main-cashbox", superadmin);

    expect(state.cardsEnabled.every((enabled) => !enabled)).toBe(true);
    expect(screen.queryByRole("button", { name: "Filtrlarni tozalash" })).not.toBeInTheDocument();

    await user.click(field("To'lov usuli"));
    await user.click(await screen.findByRole("option", { name: "Marketga o'tkazma" }));
    await waitFor(() => expect(currentSearch()).toContain("payment_method=click_to_market"));
    expect(lastHistoryParams()).toEqual(expect.objectContaining({ payment_method: "click_to_market" }));

    await user.click(field("Karta"));
    await user.click(await screen.findByRole("option", { name: /^Belgilanmagan/ }));
    await waitFor(() => expect(currentSearch()).toContain("card_id=none"));
    expect(lastHistoryParams()).toEqual(expect.objectContaining({ payment_method: "click_to_market", card_id: "none" }));

    await user.click(screen.getAllByRole("button", { name: "Filtrlarni tozalash" })[0]);
    await waitFor(() => expect(currentSearch()).not.toContain("payment_method"));
    expect(currentSearch()).not.toContain("card_id");
    expect(lastHistoryParams()).not.toHaveProperty("payment_method");
    expect(lastHistoryParams()).not.toHaveProperty("card_id");
  });

  it("menejer (filial kassasi): «To'lov usuli» bor, «Karta» yo'q — card_id so'rovga ketmaydi", async () => {
    open("/payments/main-cashbox?payment_method=click&card_id=3", manager);

    await waitFor(() => expect(lastHistoryParams()).toEqual(expect.objectContaining({ payment_method: "click" })));
    expect(lastHistoryParams()).not.toHaveProperty("card_id");
    expect(lastHistoryParams()).not.toHaveProperty("cashbox_type");
    expect(field("To'lov usuli")).toBeInTheDocument();
    expect(screen.queryByLabelText("Karta")).not.toBeInTheDocument();
    expect(state.cardsEnabled.every((enabled) => !enabled)).toBe(true);
  });
});
