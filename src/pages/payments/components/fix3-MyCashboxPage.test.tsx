import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MyCashboxPage from "./MyCashboxPage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * C2 / CODE-22: "Mening kassam" sana filtri oddiy YYYY-MM-DD yuboradi —
 * backend uni Toshkent kuni deb oladi. Ilgari `T00:00:00.000Z` (UTC)
 * qo'shilardi va Toshkent bo'yicha 02:30 dagi yozuv oldingi kunga tushardi.
 */

const myCashboxParams = vi.hoisted(() => [] as unknown[]);

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashboxMyCashbox: (params: unknown) => {
      myCashboxParams.push(params);
      return {
        data: { data: { cashbox: { id: "70", cashbox_type: "couriers", balance: 0 }, cashboxHistory: [] } },
        isLoading: false,
      };
    },
  }),
}));
vi.mock("../../../shared/ui/DateRangePicker", () => ({
  default: ({ onChange }: { onChange: (range: { startDate: Date | null; endDate: Date | null }) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 2) })}
    >
      set-range
    </button>
  ),
}));
vi.mock("./PaymentHistoryList", () => ({ default: () => null }));

const courier = { role: { id: "263", role: "courier", region: null, name: "Kuryer" } } as never;

describe("MyCashboxPage date filter (C2)", () => {
  it("sends plain YYYY-MM-DD bounds, without a UTC time suffix", async () => {
    renderWithProviders(<MyCashboxPage />, { route: "/my-cashbox", preloadedState: courier });

    await userEvent.setup().click(screen.getByRole("button", { name: "set-range" }));

    await waitFor(() =>
      expect(myCashboxParams.at(-1)).toEqual({ fromDate: "2026-10-01", toDate: "2026-10-02" }),
    );
    expect(JSON.stringify(myCashboxParams)).not.toContain("T00:00:00");
    expect(JSON.stringify(myCashboxParams)).not.toContain("T23:59:59");
  });
});
