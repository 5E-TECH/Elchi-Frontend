import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatLinkTimeLeft } from "../lib/linkTime";
import { normalizeGroupLinkCode, requestGroupLinkCode } from "./telegramLinkApi";

/**
 * TG-A: market guruhi havolasi umumiy API'da (`features/telegram-link`) — bildirishnoma qo'shish oynasi va
 * «Telegram guruhi» kartasi shu yerdan oladi. Sanoq formati — `LinkCountdown`.
 */

const apiPost = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

describe("requestGroupLinkCode", () => {
  beforeEach(() => apiPost.mockReset());

  it("POST /telegram/link-code ga purpose, group_type va market_id yuboradi, javobni normallashtiradi", async () => {
    apiPost.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "ok",
        data: {
          token: "G123",
          purpose: "market_group",
          group_type: "cancel",
          expires_at: "2026-10-21T10:10:00.000Z",
          deep_link: "https://t.me/elchi_bot?startgroup=G123",
          command: "/start G123",
        },
      },
    });

    const code = await requestGroupLinkCode({ purpose: "market_group", group_type: "cancel", market_id: "37" });

    expect(apiPost).toHaveBeenCalledWith("telegram/link-code", {
      purpose: "market_group",
      group_type: "cancel",
      market_id: "37",
    });
    expect(code).toEqual({
      token: "G123",
      purpose: "market_group",
      group_type: "cancel",
      expires_at: "2026-10-21T10:10:00.000Z",
      deep_link: "https://t.me/elchi_bot?startgroup=G123",
      command: "/start G123",
    });
  });

  it("market o'zi so'raganda market_id yuborilmaydi", async () => {
    apiPost.mockResolvedValue({ data: { token: "G1", deep_link: null } });

    await requestGroupLinkCode({ purpose: "market_group", group_type: "create" });

    expect(apiPost).toHaveBeenCalledWith("telegram/link-code", { purpose: "market_group", group_type: "create" });
  });
});

describe("normalizeGroupLinkCode", () => {
  it("konvertsiz javob, bot nomi yo'q (deep_link null) — buyruq tokendan tuziladi", () => {
    expect(normalizeGroupLinkCode({ token: "T9", group_type: "create", deep_link: "", expires_at: null })).toEqual({
      token: "T9",
      purpose: "market_group",
      group_type: "create",
      expires_at: "",
      deep_link: null,
      command: "/start T9",
    });
  });

  it("noma'lum tur — «create», bo'sh javob — bo'sh kod", () => {
    expect(normalizeGroupLinkCode(null)).toEqual({
      token: "",
      purpose: "market_group",
      group_type: "create",
      expires_at: "",
      deep_link: null,
      command: "",
    });
  });
});

describe("formatLinkTimeLeft", () => {
  it.each([
    [600_000, "10:00"],
    [581_000, "9:41"],
    [7_200, "0:08"],
    [0, "0:00"],
    [-5_000, "0:00"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatLinkTimeLeft(ms)).toBe(text);
  });
});
