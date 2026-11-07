import { MutationObserver, onlineManager, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "./provider";
import { INVALIDATE_WAIT_MS } from "../../shared/lib/invalidateWait";

/**
 * G6F68ti6 (2-band): oflaynda amal pauzaga tushmaydi (tugma to'xtamay aylanmaydi, aloqa qaytgach o'zi
 * jo'natilmaydi) — `mutationFn` darhol chaqiriladi, xato bo'lsa mutatsiya `error` holatiga o'tadi.
 */
describe("createAppQueryClient — mutatsiyalar oflaynda", () => {
  afterEach(() => onlineManager.setOnline(true));

  it("oflaynda mutationFn darhol chaqiriladi va xato bilan tugaydi (pauza yo'q)", async () => {
    const client = createAppQueryClient();
    const mutationFn = vi.fn(() => Promise.reject(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" })));
    onlineManager.setOnline(false);

    const observer = new MutationObserver(client, { mutationFn });
    await expect(observer.mutate()).rejects.toThrow("Network Error");

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isPaused).toBe(false);
    expect(observer.getCurrentResult().status).toBe("error");

    // Aloqa qaytsa qayta yuborilmaydi.
    onlineManager.setOnline(true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});

/**
 * Sekin internet (2026-11-07): amal `onSuccess` da yangilashni kutadi (buyurtma yaratish kabi) — qotgan liniyada
 * mutatsiya 20 s da tugaydi (tugma to'xtaydi, «Saqlandi» chiqadi), ~2 daqiqa emas.
 */
describe("createAppQueryClient — amaldan keyingi yangilash kutilishi", () => {
  afterEach(() => vi.useRealTimers());

  it("onSuccess qotgan yangilashni kutsa ham mutatsiya 20 s da muvaffaqiyat bilan tugaydi", async () => {
    vi.useFakeTimers();
    const client = createAppQueryClient();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("ro'yxat")
      .mockImplementation(() => new Promise<string>(() => undefined));
    const unsubscribe = new QueryObserver(client, { queryKey: ["orders"], queryFn }).subscribe(
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(0);

    const observer = new MutationObserver(client, {
      mutationFn: () => Promise.resolve({ id: "1" }),
      onSuccess: () => client.invalidateQueries({ queryKey: ["orders"] }),
    });
    const done = observer.mutate();
    await vi.advanceTimersByTimeAsync(INVALIDATE_WAIT_MS - 1);
    expect(observer.getCurrentResult().isPending).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await expect(done).resolves.toEqual({ id: "1" });
    expect(observer.getCurrentResult().status).toBe("success");
    unsubscribe();
  });
});
