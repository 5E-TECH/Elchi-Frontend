import { describe, expect, it } from "vitest";
import type { AccountSession } from "../model/types";
import { currentSessionFirst, describeSessionDevice, shortUserAgent } from "./sessionDevice";

describe("describeSessionDevice", () => {
  it.each([
    ["Telefon · Android · Chrome", "phone", "Android · Chrome"],
    ["Planshet · iOS · Safari", "tablet", "iOS · Safari"],
    ["Kompyuter · Linux · Chrome", "desktop", "Linux · Chrome"],
    ["Kompyuter", "desktop", null],
  ])("server yorlig'i «%s» → tur va qolgan qism", (device_name, kind, detail) => {
    expect(describeSessionDevice({ device_name, user_agent: null })).toEqual({ kind, detail });
  });

  it("turi tanilmagan yorliq (mijoz `X-Device-Name` yuborgan) — o'zi, tursiz", () => {
    expect(describeSessionDevice({ device_name: "Android · Telegram", user_agent: null })).toEqual({
      kind: null,
      detail: "Android · Telegram",
    });
    expect(describeSessionDevice({ device_name: "Ombor planshet", user_agent: null })).toEqual({
      kind: null,
      detail: "Ombor planshet",
    });
  });

  it("yorliq yo'q — qisqa User-Agent; hech narsa yo'q — `null` (UI «Noma'lum qurilma»)", () => {
    expect(describeSessionDevice({ device_name: null, user_agent: "curl/8.4.0" })).toEqual({
      kind: null,
      detail: "curl/8.4.0",
    });
    expect(describeSessionDevice({ device_name: "  ", user_agent: null })).toEqual({ kind: null, detail: null });
  });
});

describe("shortUserAgent", () => {
  it("umumiy `Mozilla/5.0` bo'lagisiz; 40 belgidan uzun — so'z chegarasida «…»", () => {
    expect(shortUserAgent("PostmanRuntime/7.39.0")).toBe("PostmanRuntime/7.39.0");
    expect(shortUserAgent("Mozilla/5.0 (compatible; ExampleBot/2.1; +https://example.com/bot.html)")).toBe(
      "(compatible; ExampleBot/2.1…",
    );
    expect(shortUserAgent("   ")).toBeNull();
    expect(shortUserAgent(null)).toBeNull();
  });
});

describe("currentSessionFirst", () => {
  const session = (id: string, current = false) => ({ id, current }) as AccountSession;

  it("«Shu qurilma» tepada, qolgani server tartibida", () => {
    expect(currentSessionFirst([session("a"), session("b", true), session("c")]).map((s) => s.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});
