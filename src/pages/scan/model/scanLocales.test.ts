import { describe, expect, it } from "vitest";
import en from "../../../locales/en/scan.json";
import ru from "../../../locales/ru/scan.json";
import uz from "../../../locales/uz/scan.json";

/** Kalitlar ro'yxati; ko'plik qo'shimchalari (`_one`, `_few`, `_many`, `_other`) bitta kalit sanaladi. */
const keysOf = (value: unknown, prefix = ""): string[] =>
  Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    child && typeof child === "object"
      ? keysOf(child, `${prefix}${key}.`)
      : [`${prefix}${key.replace(/_(one|few|many|other)$/, "")}`],
  );

const unique = (keys: string[]) => [...new Set(keys)].sort();

const valuesOf = (value: unknown): string[] =>
  Object.values(value as Record<string, unknown>).flatMap((child) =>
    child && typeof child === "object" ? valuesOf(child) : [String(child)],
  );

describe("scan locales", () => {
  it("uz / ru / en have the same keys", () => {
    const base = unique(keysOf(uz));
    expect(unique(keysOf(ru))).toEqual(base);
    expect(unique(keysOf(en))).toEqual(base);
  });

  it("uz texts use the mockup wording (no English words like order / scan)", () => {
    const texts = valuesOf(uz).join("\n").replace(/\{\{\w+\}\}/g, "").toLowerCase();
    for (const word of ["order", "scanner", "scan ", "courier", "package"]) {
      expect(texts).not.toContain(word);
    }
  });
});
