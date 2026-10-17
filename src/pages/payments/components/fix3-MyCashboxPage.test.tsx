import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import MyCashboxPage from "./MyCashboxPage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * C2 / CODE-22: "Mening kassam" sana filtri oddiy YYYY-MM-DD yuboradi —
 * backend uni Toshkent kuni deb oladi. Ilgari `T00:00:00.000Z` (UTC)
 * qo'shilardi va Toshkent bo'yicha 02:30 dagi yozuv oldingi kunga tushardi.
 * (Dizayn v2: sana tanlovi — `DateRange` primitivi.)
 */

const myCashboxParams = vi.hoisted(() => [] as unknown[]);

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashboxMyCashbox: (params: unknown) => {
      myCashboxParams.push(params);
      return {
        data: { data: { cashbox: { id: "70", cashbox_type: "couriers", balance: 0 }, cashboxHistory: [] } },
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: () => undefined,
      };
    },
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false, refetch: () => undefined }),
  }),
}));

const courier = { role: { id: "263", role: "courier", region: null, name: "Kuryer" } } as never;

beforeEach(() => {
  myCashboxParams.length = 0;
  // Faqat `Date` soxta: kalendar 2026-yil oktabrda ochiladi, taymerlar haqiqiy (userEvent).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 8, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MyCashboxPage date filter (C2)", () => {
  it("sends plain YYYY-MM-DD bounds, without a UTC time suffix", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: courier });

    await user.click(screen.getByRole("button", { name: /^Sana oralig'i:/ }));
    const dialog = screen.getByRole("dialog", { name: "Sana oralig'ini tanlash" });
    const october = within(dialog).getAllByRole("grid")[0];
    await user.click(within(october).getByRole("gridcell", { name: "1-oktabr" }));
    await user.click(within(october).getByRole("gridcell", { name: "2-oktabr" }));

    await waitFor(() =>
      // Oxirgi render: tarix so'rovi (tanlangan oraliq) + «Bugun» bloki so'rovi — tarix kaliti aynan shu.
      expect(myCashboxParams.slice(-2)).toContainEqual({ fromDate: "2026-10-01", toDate: "2026-10-02" }),
    );
    expect(JSON.stringify(myCashboxParams)).not.toContain("T00:00:00");
    expect(JSON.stringify(myCashboxParams)).not.toContain("T23:59:59");
  });
});
