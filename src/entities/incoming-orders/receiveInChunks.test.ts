import { describe, expect, it, vi } from "vitest";
import { RECEIVE_BY_SCAN_MAX_TOKENS, receiveTokensInChunks } from "./index";

/**
 * SKANERLAB QABUL QILISH — 200 TADAN BO'LIB YUBORISH.
 *
 * ⚠️ Backend bir so'rovda 200 tadan ortiq tokenni 400 bilan rad etadi.
 * Ilgari hamma tokenlar bitta so'rovda ketardi, ya'ni 200 dan ko'p posilka
 * skanerlangan qop umuman qabul qilinmasdi (V74wNugv).
 */
const tokens = (count: number) => Array.from({ length: count }, (_, i) => `token-${i + 1}`);

describe("receiveTokensInChunks", () => {
  it("backend chegarasi 200", () => {
    expect(RECEIVE_BY_SCAN_MAX_TOKENS).toBe(200);
  });

  it("250 ta token → 200 + 50 ikki so'rov, natijalar jamlanadi", async () => {
    const send = vi.fn((chunk: string[]) =>
      Promise.resolve({ received: chunk.length, unmatched: [] }),
    );

    const result = await receiveTokensInChunks(tokens(250), send);

    expect(send.mock.calls.map(([chunk]) => chunk.length)).toEqual([200, 50]);
    expect(send.mock.calls[1][0][49]).toBe("token-250");
    expect(result).toEqual({ received: 250, unmatched: [] });
  });

  it("aynan 200 ta token → bitta so'rov; 201 ta → ikkita", async () => {
    const send = vi.fn((chunk: string[]) => Promise.resolve({ received: chunk.length, unmatched: [] }));

    await receiveTokensInChunks(tokens(200), send);
    expect(send).toHaveBeenCalledTimes(1);

    send.mockClear();
    await receiveTokensInChunks(tokens(201), send);
    expect(send.mock.calls.map(([chunk]) => chunk.length)).toEqual([200, 1]);
  });

  it("har bo'lakdagi qabul qilinmaganlar sababi bilan saqlanadi", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ received: 199, unmatched: [{ token: "token-7", reason: "allaqachon received" }] })
      .mockResolvedValueOnce({ received: 49, unmatched: [{ token: "token-230", reason: "tizimda topilmadi" }] });

    const result = await receiveTokensInChunks(tokens(250), send);

    expect(result.received).toBe(248);
    expect(result.unmatched).toEqual([
      { token: "token-7", reason: "allaqachon received" },
      { token: "token-230", reason: "tizimda topilmadi" },
    ]);
  });

  it("2-bo'lak yiqilsa 1-bo'lakda qabul qilinganlar yo'qolmaydi, qolganlar sababi bilan qaytadi", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ received: 200, unmatched: [] })
      .mockRejectedValueOnce({ response: { status: 500, data: { message: "Buyurtma xizmati javob bermadi" } } });

    const result = await receiveTokensInChunks(tokens(250), send);

    expect(result.received).toBe(200);
    expect(result.unmatched).toHaveLength(50);
    expect(result.unmatched[0]).toEqual({ token: "token-201", reason: "Buyurtma xizmati javob bermadi" });
  });

  it("1-bo'lak yiqilsa hech narsa qabul qilinmagan — xato yuqoriga chiqadi", async () => {
    const error = { response: { status: 400, data: { message: "tokens is required" } } };
    const send = vi.fn().mockRejectedValueOnce(error);

    await expect(receiveTokensInChunks(tokens(3), send)).rejects.toBe(error);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
