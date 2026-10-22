import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { normalizeCashboxShift, refreshCashboxQueries, useCashBox } from "./index";

/**
 * Kassa smenasi so'rovlari (kfdfYDik, CB-1) — gateway DTO'lariga aynan mos (forbidNonWhitelisted):
 *  - holat: `GET /finance/shift/current` (parametrsiz — kassa doirasi JWT'dan; `data.shift` — ochiq smena yoki null);
 *  - ochish: `POST /finance/shift/open { comment? }` (ochgan xodim JWT'dan, `opened_by` yuborilmaydi);
 *  - yopish: `POST /finance/shift/close { shift_id, closing_balance_cash, closing_balance_card?, comment? }`
 *    (`closed_by` yuborilmaydi; sanalmagan karta va bo'sh izoh — maydonsiz).
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: apiMock }));

const CURRENT_URL = "finance/shift/current";
const SHIFT_OPEN_URL = "finance/shift/open";
const SHIFT_CLOSE_URL = "finance/shift/close";

const createWrapper = (client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

const currentGets = () => apiMock.get.mock.calls.filter(([url]) => url === CURRENT_URL);

const currentBody = {
  statusCode: 200,
  message: "Current shift",
  data: {
    shift: { id: "12", opened_by: "5", status: "open", opened_at: "2026-10-01T04:00:00.000Z" },
    required: true,
    cashbox_user_id: "0",
  },
};

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.get.mockResolvedValue({ data: currentBody });
  apiMock.post.mockResolvedValue({ data: { statusCode: 201, message: "ok", data: { id: "12", status: "open" } } });
});

describe("useCashBox — shift hooks (kfdfYDik)", () => {
  it("useGetCurrentShift reads GET finance/shift/current without params (scope comes from the JWT)", async () => {
    const { result } = renderHook(() => useCashBox().useGetCurrentShift(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(currentGets()).toHaveLength(1);
    expect(currentGets()[0]).toEqual([CURRENT_URL]);
    expect(result.current.data?.data.shift?.id).toBe("12");
  });

  it("useGetCurrentShift does not request anything when disabled", async () => {
    renderHook(() => useCashBox().useGetCurrentShift(false), { wrapper: createWrapper() });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(currentGets()).toHaveLength(0);
  });

  it("openShift posts only { comment } (no opened_by); an empty comment posts {}", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    await act(() => result.current.openShift.mutateAsync({ comment: "Kechki smena" }));
    await act(() => result.current.openShift.mutateAsync({}));

    expect(apiMock.post.mock.calls).toEqual([
      [SHIFT_OPEN_URL, { comment: "Kechki smena" }],
      [SHIFT_OPEN_URL, {}],
    ]);
  });

  it("closeShift posts { shift_id, closing_balance_cash, closing_balance_card, comment } and returns the shift row", async () => {
    apiMock.post.mockResolvedValueOnce({
      data: { statusCode: 200, message: "Shift closed", data: { id: "12", status: "closed", discrepancy_cash: "-150000.00" } },
    });
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    let response: unknown;
    await act(async () => {
      response = await result.current.closeShift.mutateAsync({
        shift_id: "12",
        closing_balance_cash: 18_090_000,
        closing_balance_card: 0,
        comment: "Naqd yetishmadi",
      });
    });

    expect(apiMock.post).toHaveBeenCalledWith(SHIFT_CLOSE_URL, {
      shift_id: "12",
      closing_balance_cash: 18_090_000,
      // Nol — haqiqiy sanalgan summa (yuboriladi), «Sanalmadi» emas.
      closing_balance_card: 0,
      comment: "Naqd yetishmadi",
    });
    expect(normalizeCashboxShift((response as { data: unknown }).data)?.discrepancy_cash).toBe(-150_000);
  });

  it("closeShift omits an uncounted card and an empty comment (no closed_by)", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    await act(() =>
      result.current.closeShift.mutateAsync({ shift_id: "12", closing_balance_cash: 0, closing_balance_card: null, comment: "" }),
    );

    expect(apiMock.post).toHaveBeenCalledWith(SHIFT_CLOSE_URL, { shift_id: "12", closing_balance_cash: 0 });
  });

  it("open and close refetch the current-shift query before resolving", async () => {
    const { result } = renderHook(
      () => {
        const cashBox = useCashBox();
        return { cashBox, current: cashBox.useGetCurrentShift() };
      },
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.current.isSuccess).toBe(true));
    expect(currentGets()).toHaveLength(1);

    await act(() => result.current.cashBox.openShift.mutateAsync({}));
    // `mutateAsync` tugaganda smena holati allaqachon qayta o'qilgan.
    expect(currentGets()).toHaveLength(2);

    await act(() => result.current.cashBox.closeShift.mutateAsync({ shift_id: "12", closing_balance_cash: 10 }));
    expect(currentGets()).toHaveLength(3);
  });
});

describe("normalizeCashboxShift", () => {
  it("stringifies ids, turns numeric strings into numbers and keeps null differences", () => {
    expect(
      normalizeCashboxShift({
        id: 12,
        opened_by: 5,
        closed_by: 7,
        status: "closed",
        opening_balance_cash: "11270000.00",
        total_income_cash: 6_970_000,
        expected_balance_cash: "18240000",
        discrepancy_cash: "-150000",
        discrepancy_card: null,
      }),
    ).toEqual(
      expect.objectContaining({
        id: "12",
        opened_by: "5",
        closed_by: "7",
        status: "closed",
        opening_balance_cash: 11_270_000,
        opening_balance_card: 0,
        total_income_cash: 6_970_000,
        expected_balance_cash: 18_240_000,
        expected_balance_card: null,
        discrepancy_cash: -150_000,
        discrepancy_card: null,
      }),
    );
  });

  it("returns null without a row or id", () => {
    expect(normalizeCashboxShift(null)).toBeNull();
    expect(normalizeCashboxShift({ status: "open" })).toBeNull();
  });
});

describe("refreshCashboxQueries (shared export)", () => {
  it("invalidates the cashbox and finance-history families", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    await refreshCashboxQueries(client);
    const keys = spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toEqual(expect.arrayContaining(["cashbox", "finance-history", "dashboard", "managers"]));
  });
});
