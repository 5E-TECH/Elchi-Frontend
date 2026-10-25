import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import store from "./store";

/**
 * iR4B6hcP — store'da faqat ishlatiladigan reduserlar. `pagination` reduseri ulangan, lekin hech qayerda o'qilmas va
 * amali yuborilmas edi (sahifalash URL'da — `usePagination`): «ikkita sahifalash manbai» degan chalg'itish. Har reduser
 * holati o'qilishi (`state.<kalit>`) shart; faqat yoziladigan ko'zgu — sababi va yuboriladigan amali bilan istisno.
 */
const SRC = path.resolve(__dirname, "../..");
const SELF = path.resolve(__dirname, "store.ts");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && full !== SELF ? [full] : [];
  });

const sources = sourceFiles(SRC).map((file) => readFileSync(file, "utf8"));
const isRead = (key: string) => sources.some((source) => new RegExp(`\\b(?:state|getState\\(\\))\\.${key}\\b`).test(source));

/** Holati o'qilmaydigan, lekin amallari yuboriladigan reduserlar (Redux ko'zgusi; manba — URL). */
const WRITE_ONLY: Record<string, { reason: string; dispatched: RegExp }> = {
  search: {
    reason: "/orders qidiruvining ko'zgusi — manba URL (`orderSearch`); yo'l o'zgarganda tozalanadi",
    dispatched: /dispatch\((?:setSearchValue|clearAllSearch)\(/,
  },
};

describe("store — faqat ishlatiladigan reduserlar (iR4B6hcP)", () => {
  const keys = Object.keys(store.getState());

  it("o'lik `pagination` reduseri yo'q", () => {
    expect(keys).not.toContain("pagination");
  });

  it.each(keys)("%s — holati o'qiladi (yoki sababli ko'zgu: amali yuboriladi)", (key) => {
    const writeOnly = WRITE_ONLY[key];
    if (!writeOnly) {
      expect(isRead(key), `state.${key} hech qayerda o'qilmaydi — reduserni olib tashlang`).toBe(true);
      return;
    }
    expect(isRead(key), `state.${key} endi o'qiladi — WRITE_ONLY dan olib tashlang`).toBe(false);
    expect(sources.some((source) => writeOnly.dispatched.test(source))).toBe(true);
  });

  it("istisnolar faqat store'dagi reduserlar uchun", () => {
    for (const key of Object.keys(WRITE_ONLY)) expect(keys).toContain(key);
  });
});
