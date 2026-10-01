import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { useCashBox } from "./index";

/**
 * FIX3B / FE-PAY-06 — smena so'rovlari gateway DTO'lariga aynan mos
 * (forbidNonWhitelisted): GET /finance/shift?status=open&opened_by=<o'zi>,
 * POST /finance/shift/open { opened_by }, POST /finance/shift/close
 * { closed_by, shift_id, comment? }.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: apiMock }));

const SHIFT_URL = "finance/shift";
const SHIFT_OPEN_URL = "finance/shift/open";
const SHIFT_CLOSE_URL = "finance/shift/close";

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

const shiftGets = () => apiMock.get.mock.calls.filter(([url]) => url === SHIFT_URL);

const openShiftBody = {
  statusCode: 200,
  message: "Shifts list",
  data: {
    items: [{ id: "12", opened_by: "1", status: "open", opened_at: "2026-10-01T04:00:00.000Z" }],
    pagination: { total: 1, page: 1, limit: 1, totalPages: 1 },
  },
};

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.get.mockResolvedValue({ data: openShiftBody });
  apiMock.post.mockResolvedValue({ data: { statusCode: 201, message: "ok", data: {} } });
});

describe("useCashBox — shift hooks (FE-PAY-06)", () => {
  it("useGetCurrentShift asks for the user's own open shift", async () => {
    const { result } = renderHook(() => useCashBox().useGetCurrentShift("1", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(shiftGets()).toHaveLength(1);
    expect(shiftGets()[0][1]).toEqual({ params: { status: "open", opened_by: "1", limit: 1 } });
    expect(result.current.data?.data.items[0]).toEqual(
      expect.objectContaining({ id: "12", status: "open" }),
    );
  });

  it("useGetCurrentShift does not request anything when disabled or without a user id", async () => {
    renderHook(() => useCashBox().useGetCurrentShift("1", false), { wrapper: createWrapper() });
    renderHook(() => useCashBox().useGetCurrentShift("", true), { wrapper: createWrapper() });
    renderHook(() => useCashBox().useGetCurrentShift(undefined, true), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(shiftGets()).toHaveLength(0);
  });

  it("openShift posts exactly { opened_by } (OpenShiftRequestDto)", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    await act(() => result.current.openShift.mutateAsync({ opened_by: "1" }));

    expect(apiMock.post).toHaveBeenCalledTimes(1);
    expect(apiMock.post).toHaveBeenCalledWith(SHIFT_OPEN_URL, { opened_by: "1" });
  });

  it("closeShift posts exactly { closed_by, shift_id, comment } (CloseShiftRequestDto)", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    await act(() =>
      result.current.closeShift.mutateAsync({
        closed_by: "1",
        shift_id: "12",
        comment: "Kun yakuni",
      }),
    );

    expect(apiMock.post).toHaveBeenCalledWith(SHIFT_CLOSE_URL, {
      closed_by: "1",
      shift_id: "12",
      comment: "Kun yakuni",
    });
  });

  it("closeShift omits an empty comment", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    await act(() =>
      result.current.closeShift.mutateAsync({ closed_by: "1", shift_id: "12", comment: "" }),
    );
    await act(() => result.current.closeShift.mutateAsync({ closed_by: "1", shift_id: "12" }));

    expect(apiMock.post.mock.calls.map(([, body]) => body)).toEqual([
      { closed_by: "1", shift_id: "12" },
      { closed_by: "1", shift_id: "12" },
    ]);
  });

  it("open and close refetch the open-shift query before resolving", async () => {
    const { result } = renderHook(
      () => {
        const cashBox = useCashBox();
        return { cashBox, current: cashBox.useGetCurrentShift("1", true) };
      },
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.current.isSuccess).toBe(true));
    expect(shiftGets()).toHaveLength(1);

    await act(() => result.current.cashBox.openShift.mutateAsync({ opened_by: "1" }));
    // `mutateAsync` tugaganda smena holati allaqachon qayta o'qilgan.
    expect(shiftGets()).toHaveLength(2);

    await act(() =>
      result.current.cashBox.closeShift.mutateAsync({ closed_by: "1", shift_id: "12" }),
    );
    expect(shiftGets()).toHaveLength(3);
  });
});
