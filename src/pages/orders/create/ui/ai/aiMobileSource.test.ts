import { describe, expect, it } from "vitest";

/**
 * JzQIec06: AI oqimida hech qayerda 12px dan kichik matn yo'q (telefonda
 * 10-11px o'qilmaydi). Manba darajasidagi qo'riqchi — qaytib kirmasin.
 */
describe("AI buyurtma — 390px manba qo'riqchisi", () => {
  it("AI fayllarida text-[10px] / text-[11px] yo'q", () => {
    const sources = import.meta.glob(["./*.tsx", "../formFieldStyles.tsx", "../CreateModeTabs.tsx"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const files = Object.entries(sources).filter(([path]) => !path.includes(".test."));
    expect(files.length).toBeGreaterThan(5);

    const offenders = files.filter(([, source]) => /text-\[(?:[0-9]|1[01])px\]/.test(source)).map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
