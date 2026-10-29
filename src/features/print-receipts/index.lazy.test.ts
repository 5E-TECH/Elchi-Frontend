import { describe, expect, it } from "vitest";

/**
 * HJ5sLHiz (TZ qabul 10): chek moduli sahifa bo'laklariga og'irlik qo'shmaydi. Sahifalar faqat barrelni (`index.ts`)
 * statik import qiladi; barreldan statik (qiymat) importlar orqali jsPDF, `qrcode`, shriftlar (`?url` TTF), GPOS
 * kerning va joylash moduliga yetib bo'lmaydi — ular faqat `import()` bilan, birinchi chop etish / namuna / QR'da.
 * (`npm run build` + `npm run check:bundle` — haqiqiy bo'laklar; bu test — manba darajasidagi tez qo'riqchi.)
 */

const featureSources = import.meta.glob<string>(["./**/*.ts", "./**/*.tsx", "!./**/*.test.*"], {
  eager: true,
  query: "?raw",
  import: "default",
});

const consumerSources = import.meta.glob<string>(
  [
    "../../pages/**/*.{ts,tsx}",
    "../../widgets/**/*.{ts,tsx}",
    "../../features/**/*.{ts,tsx}",
    "!../../features/print-receipts/**",
    "!../../**/*.test.*",
  ],
  { eager: true, query: "?raw", import: "default" },
);

/** Statik qiymat importlari (`import type` / `export type` va `import()` hisobga olinmaydi). */
const staticImports = (source: string): string[] => {
  const out: string[] = [];
  const statement = /^\s*(import|export)\s+(?!type\b)([\s\S]*?)\bfrom\s+["']([^"']+)["']/gm;
  for (const match of source.matchAll(statement)) {
    // `import { type A, type B } from` — faqat tiplar.
    const names = match[2].replace(/[{}\s]/g, "");
    if (names && names.split(",").every((name) => !name || name.startsWith("type"))) continue;
    out.push(match[3]);
  }
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(match[1]);
  return out;
};

const resolve = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith(".")) return null;
  const base = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") base.pop();
    else if (part !== ".") base.push(part);
  }
  const path = base.join("/");
  return [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`].find((file) => file in featureSources) ?? path;
};

/** Barreldan statik importlar bilan yetib boriladigan modullar va tashqi paketlar. */
const reachable = () => {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = ["./index.ts"];
  while (queue.length) {
    const file = queue.shift()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of staticImports(featureSources[file] ?? "")) {
      const target = resolve(file, specifier);
      if (target === null) packages.add(specifier);
      else if (target in featureSources) queue.push(target);
      else packages.add(specifier);
    }
  }
  return { files, packages };
};

describe("print-receipts barrel is lazy", () => {
  it("static imports from index.ts never reach jsPDF, qrcode, fonts, kerning or layout", () => {
    const { files, packages } = reachable();
    expect([...files].sort()).toEqual([
      "./index.ts",
      "./lib/receiptContact.ts",
      "./lib/receiptErrors.ts",
      "./model/useReceiptPrint.ts",
      "./ui/ReceiptQr.tsx",
    ]);
    for (const heavy of ["jspdf", "qrcode"]) expect(packages).not.toContain(heavy);
    expect([...packages].some((specifier) => specifier.includes("?url"))).toBe(false);
    // Og'ir modullar faqat `import()` bilan.
    expect(featureSources["./index.ts"]).toContain('import("./lib/printReceipts")');
    expect(featureSources["./index.ts"]).toContain('import("./lib/receiptPreview")');
    expect(featureSources["./ui/ReceiptQr.tsx"]).toContain('import("../lib/printReceiptQr")');
  });

  it("pages, widgets and other features import only the barrel (no deep lib/ imports)", () => {
    const deep = Object.entries(consumerSources).flatMap(([file, source]) =>
      staticImports(source)
        .filter((specifier) => /features\/print-receipts\/(lib|model|ui)\//.test(specifier))
        .map((specifier) => `${file} → ${specifier}`),
    );
    expect(deep).toEqual([]);
  });
});
