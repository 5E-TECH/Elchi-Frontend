import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCashBox, type CashboxShift, type CurrentShiftResponse } from "./index";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: apiMock }));

/**
 * Sekin internet (2026-11-07): smena ochilgani / yopilgani server javobidan DARHOL keshga yoziladi. Qayta o'qish
 * (GET shift/current) qotgan bo'lsa ham kassa «smena yopiq» deb qulflangan qolmaydi va tugma xabar bilan bir vaqtda
 * almashadi (amal kutilishi 20 s bilan chegaralangan — `shared/lib/invalidateWait.ts`).
 */
const OPEN_SHIFT: CashboxShift = {
  id: "s-9",
  opened_by: "7",
  status: "open",
  opened_at: "2026-11-07T05:00:00Z",
};
const current = (shift: CashboxShift | null): CurrentShiftResponse => ({
  statusCode: 200,
  message: "ok",
  data: { shift, required: true, cashbox_user_id: "0" },
});

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const renderShift = () =>
  renderHook(
    () => {
      const cashbox = useCashBox();
      return { cashbox, currentShift: cashbox.useGetCurrentShift() };
    },
    { wrapper },
  );

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  apiMock.get.mockReset();
  apiMock.post.mockReset();
});

describe("smena ochish / yopish — kesh server javobidan", () => {
  it("ochildi: qayta o'qish qotgan bo'lsa ham holat darhol «ochiq»", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: current(null) })
      .mockImplementation(() => new Promise(() => undefined));
    apiMock.post.mockResolvedValue({ data: { statusCode: 201, message: "ok", data: OPEN_SHIFT } });
    const { result } = renderShift();
    await waitFor(() => expect(result.current.currentShift.data?.data.shift).toBeNull());

    act(() => result.current.cashbox.openShift.mutate({}));

    await waitFor(() => expect(result.current.currentShift.data?.data.shift).toEqual(OPEN_SHIFT));
    expect(result.current.currentShift.data?.data.required).toBe(true);
    expect(result.current.currentShift.isFetching).toBe(true);
    expect(apiMock.get).toHaveBeenCalledTimes(2);
  });

  it("yopildi: qayta o'qish qotgan bo'lsa ham holat darhol «smena yo'q»", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: current(OPEN_SHIFT) })
      .mockImplementation(() => new Promise(() => undefined));
    apiMock.post.mockResolvedValue({
      data: { statusCode: 201, message: "ok", data: { ...OPEN_SHIFT, status: "closed" } },
    });
    const { result } = renderShift();
    await waitFor(() => expect(result.current.currentShift.data?.data.shift).toEqual(OPEN_SHIFT));

    act(() =>
      result.current.cashbox.closeShift.mutate({ shift_id: "s-9", closing_balance_cash: 1000 }),
    );

    await waitFor(() => expect(result.current.currentShift.data?.data.shift).toBeNull());
    expect(result.current.currentShift.isFetching).toBe(true);
  });

  it("javobda smena qatori yo'q — kesh tegilmaydi (undefined yozilmaydi), faqat qayta o'qiladi", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: current(null) })
      .mockImplementation(() => new Promise(() => undefined));
    apiMock.post.mockResolvedValue({ data: { statusCode: 201, message: "ok" } });
    const { result } = renderShift();
    await waitFor(() => expect(result.current.currentShift.data?.data.shift).toBeNull());

    act(() => result.current.cashbox.openShift.mutate({}));

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
    expect(result.current.currentShift.data?.data.shift).toBeNull();
    expect(result.current.currentShift.data?.data.required).toBe(true);
  });
});
