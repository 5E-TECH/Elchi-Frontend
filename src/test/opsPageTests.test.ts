import { describe, expect, it } from "vitest";

/**
 * OPS SAHIFALARI TEST QOPLAMI — META-TEST (Trello LJt0G1y1 «ab8daf»).
 *
 * Ops testlari ilgari API javobini noto'g'ri shaklda (`{ data: [] }`) mocklagan va P0 xatolarni o'tkazib yuborgan.
 * Har `src/pages/*-ops` sahifasi testlarida majburiy (yordamchilar — `src/test/mockEnvelope.ts`):
 *   1. haqiqiy konvert: `mockEnvelope(...)` (`{ statusCode, message, data }`); eski `mockResolvedValue({ data: [] })`
 *      / `({ data: {} })` shakli yo'q;
 *   2. «so'rov rad etildi → xato ko'rinadi (i18n, xom backend matni yo'q)»: `mockRejection(...)` +
 *      `expectNoRawBackendText()`;
 *   3. sahifada yozuv amali (`.mutate(` / `.mutateAsync(`) bo'lsa — so'rov tanasi shakli: `expectRequestBody(...)`.
 * Yangi `*-ops` sahifa shu uchtasisiz qo'shilsa — bu test yiqiladi.
 */

const pageSources = import.meta.glob(["../pages/*-ops/**/*.{ts,tsx}", "!../pages/*-ops/**/*.test.{ts,tsx}"], {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const testSources = import.meta.glob("../pages/*-ops/**/*.test.{ts,tsx}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const pageDirOf = (path: string) => /^\.\.\/pages\/([^/]+-ops)\//.exec(path)?.[1] ?? null;

const groupByDir = (sources: Record<string, string>) => {
  const groups = new Map<string, string[]>();
  for (const [path, text] of Object.entries(sources)) {
    const dir = pageDirOf(path);
    if (!dir) continue;
    groups.set(dir, [...(groups.get(dir) ?? []), text]);
  }
  return groups;
};

const WRITE_ACTION = /\.mutate(?:Async)?\(/;
const LEGACY_SHAPE = /mockResolvedValue(?:Once)?\(\{\s*data:\s*(?:\[\s*\]|\{\s*\})\s*\}\)/;

/** Bitta ops sahifasi uchun yetishmayotgan talablar (bo'sh — hammasi joyida). */
const missingRequirements = (sources: string[], tests: string[]): string[] => {
  const all = tests.join("\n");
  const missing: string[] = [];
  if (tests.length === 0) return ["test fayli yo'q"];
  if (!/\bmockEnvelope\(/.test(all)) missing.push("mockEnvelope(...) — haqiqiy konvert");
  if (LEGACY_SHAPE.test(all)) missing.push("eski shakl mockResolvedValue({ data: [] | {} }) olib tashlansin");
  if (!/\bmockRejection\(/.test(all) || !/\bexpectNoRawBackendText\(/.test(all)) {
    missing.push("rad etilgan so'rov testi: mockRejection(...) + expectNoRawBackendText()");
  }
  if (sources.some((text) => WRITE_ACTION.test(text)) && !/\bexpectRequestBody\(/.test(all)) {
    missing.push("yozuv amali tanasi: expectRequestBody(...)");
  }
  return missing;
};

describe("ops sahifalari test qoplami (LJt0G1y1)", () => {
  const pages = groupByDir(pageSources);
  const tests = groupByDir(testSources);

  it("barcha *-ops sahifalari topildi (qo'riqchi bo'sh ro'yxatda yurmasin)", () => {
    expect([...pages.keys()].sort()).toEqual(
      expect.arrayContaining(["branch-ops", "identity-ops", "integrations-ops", "investors-ops", "logistics-ops", "system-ops"]),
    );
  });

  it("har *-ops sahifasida: mockEnvelope, «so'rov rad etildi» testi, yozuv amalida POST tanasi", () => {
    const report = [...pages.entries()]
      .map(([dir, sources]) => ({ dir, missing: missingRequirements(sources, tests.get(dir) ?? []) }))
      .filter(({ missing }) => missing.length > 0)
      .map(({ dir, missing }) => `src/pages/${dir}: ${missing.join("; ")}`);
    expect(report).toEqual([]);
  });

  it("tekshiruvchining o'zi: testsiz yoki eski shakldagi yangi sahifa yiqiladi", () => {
    const page = `export const P = () => { cancel.mutate({ id }); return null; };`;
    expect(missingRequirements([page], [])).toEqual(["test fayli yo'q"]);
    expect(missingRequirements([page], [`apiGetMock.mockResolvedValue({ data: [] });`])).toEqual([
      "mockEnvelope(...) — haqiqiy konvert",
      "eski shakl mockResolvedValue({ data: [] | {} }) olib tashlansin",
      "rad etilgan so'rov testi: mockRejection(...) + expectNoRawBackendText()",
      "yozuv amali tanasi: expectRequestBody(...)",
    ]);
    const complete = `mockEnvelope([]); mockRejection(400); expectNoRawBackendText(); expectRequestBody(m, "x", {});`;
    expect(missingRequirements([page], [complete])).toEqual([]);
    // Faqat o'qiydigan sahifaga tana testi shart emas.
    expect(missingRequirements([`export const P = () => null;`], [`mockEnvelope([]); mockRejection(500); expectNoRawBackendText();`])).toEqual([]);
  });
});
