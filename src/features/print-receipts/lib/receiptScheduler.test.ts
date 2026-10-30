import { afterEach, describe, expect, it, vi } from "vitest";
import { createReceiptScheduler, RECEIPT_SLICE_MS, yieldToMain } from "./receiptScheduler";

/** HJ5sLHiz, TZ qabul 8 — chop etish ishi vaqt bo'yicha bo'laklanadi (UI 100 ms dan ortiq qotmaydi). */

/** Soxta soat: har `tick` — shuncha ms ish. */
const fakeClock = () => {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms) };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createReceiptScheduler", () => {
  it("yields only after a slice of ≥ 32 ms of work, then starts a new slice", async () => {
    const clock = fakeClock();
    const yieldTo = vi.fn(() => Promise.resolve());
    const scheduler = createReceiptScheduler({ now: clock.now, yieldTo });
    expect(RECEIPT_SLICE_MS).toBeLessThanOrEqual(40);

    // 10 ms li birliklar: 4-sidan keyin (40 ms ≥ 32) navbat, keyin hisob qaytadan.
    const yieldedAfter: number[] = [];
    for (let unit = 1; unit <= 12; unit += 1) {
      clock.advance(10);
      const before = yieldTo.mock.calls.length;
      await scheduler.checkpoint();
      if (yieldTo.mock.calls.length > before) yieldedAfter.push(unit);
    }
    expect(yieldedAfter).toEqual([4, 8, 12]);
    expect(scheduler.yields).toBe(3);
  });

  it("a slow unit (≥ slice) yields right after it; fast units do not yield at all", async () => {
    const clock = fakeClock();
    const yieldTo = vi.fn(() => Promise.resolve());
    const scheduler = createReceiptScheduler({ now: clock.now, yieldTo });
    for (let unit = 0; unit < 100; unit += 1) {
      clock.advance(0.1);
      await scheduler.checkpoint();
    }
    expect(yieldTo).not.toHaveBeenCalled();
    clock.advance(50);
    await scheduler.checkpoint();
    expect(yieldTo).toHaveBeenCalledTimes(1);
  });

  it("works with performance.now stubbed (default clock) and fake timers (setTimeout fallback)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let time = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    vi.stubGlobal("MessageChannel", undefined);
    try {
      const scheduler = createReceiptScheduler();
      time += 33;
      let resumed = false;
      const pending = scheduler.checkpoint().then(() => {
        resumed = true;
      });
      // Navbat berildi: ish taymer (hodisalar tsikli) kelmaguncha davom etmaydi.
      await Promise.resolve();
      expect(resumed).toBe(false);
      await vi.runAllTimersAsync();
      await pending;
      expect(resumed).toBe(true);
      expect(scheduler.yields).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("yieldToMain", () => {
  it("resumes in a later task through MessageChannel (no 4 ms timer clamp)", async () => {
    const order: string[] = [];
    const yielded = yieldToMain().then(() => order.push("yield"));
    void Promise.resolve().then(() => order.push("microtask"));
    await yielded;
    expect(order).toEqual(["microtask", "yield"]);
  });
});
