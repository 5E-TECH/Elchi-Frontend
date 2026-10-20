import browserslist from "browserslist";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json?raw";
import viteConfig from "../../vite.config.ts?raw";

/**
 * BRAUZER BAZASI (js9ndYwA): `package.json` → `browserslist` va `vite.config.ts` → `build.target` bir-biridan
 * ajralib ketmasin. Baza — Chrome / Edge / Firefox 90+, Safari / iOS 15.4+ (iPhone'da eski iOS 15 qurilmalari).
 */
const query = (JSON.parse(packageJson) as { browserslist?: string[] }).browserslist ?? [];
const resolved = browserslist(query);
const target = /target:\s*\[([^\]]*)\]/.exec(viteConfig)?.[1]?.match(/"([^"]+)"/g)?.map((item) => item.slice(1, -1)) ?? [];

/** Shu brauzerning bazadagi eng past versiyasi (`ios_saf 15.6-15.8` → 15.6). */
const minVersion = (name: string) =>
  Math.min(...resolved.filter((entry) => entry.startsWith(`${name} `)).map((entry) => Number.parseFloat(entry.split(" ")[1])));

describe("brauzer bazasi", () => {
  it("`npx browserslist` chiqishida iOS Safari 15.x bor (15.4 dan)", () => {
    expect(query).toEqual(["chrome >= 90", "safari >= 15.4", "ios_saf >= 15.4", "firefox >= 90", "edge >= 90"]);
    expect(resolved.some((entry) => /^ios_saf 15\./.test(entry))).toBe(true);
    expect(minVersion("ios_saf")).toBe(15.4);
    expect(minVersion("safari")).toBe(15.4);
  });

  it("build.target bazaga mos: es2020, safari15, chrome90 (drift yo'q)", () => {
    expect(target).toEqual(["es2020", "safari15", "chrome90"]);
    expect(Number(target.find((item) => item.startsWith("safari"))?.slice(6))).toBe(Math.floor(minVersion("safari")));
    expect(Number(target.find((item) => item.startsWith("chrome"))?.slice(6))).toBe(minVersion("chrome"));
  });
});
