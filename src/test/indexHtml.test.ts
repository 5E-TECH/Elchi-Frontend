import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)?.[1] ?? "";

describe("index.html viewport", () => {
  it("opts into viewport-fit=cover so env(safe-area-inset-*) is not always 0px on iOS (I1s0yuns)", () => {
    expect(viewport).toContain("viewport-fit=cover");
  });

  it("does not disable zoom (maximum-scale / user-scalable=no break accessibility)", () => {
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
  });
});
