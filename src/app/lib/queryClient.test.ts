import { MutationObserver, onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "./provider";

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
