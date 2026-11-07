import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_TIMEOUT_MS } from "../api/api";
import { capInvalidateWait, INVALIDATE_WAIT_MS, isSettledQuery } from "./invalidateWait";

/**
 * Sekin internet (2026-11-07): yozuvdan keyingi `invalidateQueries` kutilishi 20 s bilan chegaralangan — qotgan
 * liniyada amal tugmasi ~2 daqiqa aylanib turmaydi; yangilash fonda davom etadi.
 */
let unsubscribe: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  vi.useRealTimers();
});

const watch = (client: QueryClient, queryFn: () => Promise<string>) => {
  const observer = new QueryObserver(client, { queryKey: ["orders"], queryFn, retry: false });
  unsubscribe = observer.subscribe(() => undefined);
  return observer;
};

describe("capInvalidateWait", () => {
  it("chegara — oldingi o'qish vaqti (API_TIMEOUT_MS, 20 s)", () => {
    expect(INVALIDATE_WAIT_MS).toBe(API_TIMEOUT_MS);
  });

  it("qotgan yangilash: 20 s da qaytadi, so'rov fonda davom etadi va kelganda ma'lumot yangilanadi", async () => {
    const client = capInvalidateWait(new QueryClient());
    let release: (value: string) => void = () => undefined;
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("eski")
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const observer = watch(client, queryFn);
    await vi.advanceTimersByTimeAsync(0);
    expect(observer.getCurrentResult().data).toBe("eski");

    let settled = false;
    const wait = client.invalidateQueries({ queryKey: ["orders"] }).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(INVALIDATE_WAIT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(settled).toBe(true);
    expect(observer.getCurrentResult().isFetching).toBe(true);

    release("yangi");
    await vi.advanceTimersByTimeAsync(0);
    expect(observer.getCurrentResult().data).toBe("yangi");
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("tez yangilash: kutmasdan, yangi ma'lumot bilan qaytadi", async () => {
    const client = capInvalidateWait(new QueryClient());
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("eski")
      .mockResolvedValueOnce("yangi");
    watch(client, queryFn);
    await vi.advanceTimersByTimeAsync(0);

    // Soxta vaqt surilmaydi — qaytgani chegarani kutmaganini bildiradi; chegara taymeri ham qolmaydi.
    const timersBefore = vi.getTimerCount();
    await client.invalidateQueries({ queryKey: ["orders"] });
    expect(client.getQueryData(["orders"])).toBe("yangi");
    expect(vi.getTimerCount()).toBe(timersBefore);
  });

  it("throwOnError: chegaradan oldin kelgan xato o'tkaziladi", async () => {
    const client = capInvalidateWait(new QueryClient());
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("eski")
      .mockRejectedValueOnce(new Error("500"));
    watch(client, queryFn);
    await vi.advanceTimersByTimeAsync(0);

    await expect(
      client.invalidateQueries({ queryKey: ["orders"] }, { throwOnError: true }),
    ).rejects.toThrow("500");
  });
});

describe("isSettledQuery", () => {
  it("amaldan keyin qayta o'qilayotgan eski qoldiq — hozirgi emas; yangi javob kelganda — hozirgi", async () => {
    const client = capInvalidateWait(new QueryClient());
    let release: (value: string) => void = () => undefined;
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("1000")
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const observer = watch(client, queryFn);
    await vi.advanceTimersByTimeAsync(0);
    expect(isSettledQuery(observer.getCurrentResult())).toBe(true);

    const wait = client.invalidateQueries({ queryKey: ["orders"] });
    await vi.advanceTimersByTimeAsync(INVALIDATE_WAIT_MS);
    await wait;
    expect(observer.getCurrentResult()).toMatchObject({ isSuccess: true, data: "1000" });
    expect(isSettledQuery(observer.getCurrentResult())).toBe(false);

    release("900");
    await vi.advanceTimersByTimeAsync(0);
    expect(observer.getCurrentResult().data).toBe("900");
    expect(isSettledQuery(observer.getCurrentResult())).toBe(true);
  });

  it("hali kelmagan yoki xato — hozirgi emas", () => {
    expect(isSettledQuery({ isSuccess: false, isFetching: true, isStale: true })).toBe(false);
    expect(isSettledQuery({ isSuccess: false, isFetching: false, isStale: true })).toBe(false);
  });

  it("yangi (eskirmagan) ma'lumotni fonda tekshirish qiymatni yashirmaydi", () => {
    expect(isSettledQuery({ isSuccess: true, isFetching: true, isStale: false })).toBe(true);
  });
});
