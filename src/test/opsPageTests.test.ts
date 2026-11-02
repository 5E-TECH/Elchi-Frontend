import { describe, expect, it } from "vitest";

/**
 * OPS SAHIFALARI TEST QOPLAMI — META-TEST (Trello LJt0G1y1 «ab8daf»).
 *
 * Ops testlari ilgari API javobini noto'g'ri shaklda (`{ data: [] }`) mocklagan va P0 xatolarni o'tkazib yuborgan.
 * Har `src/pages/*-ops` sahifasi testlarida majburiy (yordamchilar — `src/test/mockEnvelope.ts`):
 *   1. haqiqiy konvert: `mockEnvelope(...)` (`{ statusCode, message, data }`); eski `mockResolvedValue({ data: [] })`
 *      / `({ data: {} })` shakli yo'q;
 *   2. «so'rov rad etildi → xato ko'rinadi (i18n, xom backend matni yo'q)»: `mockRejection(...)` (kamida bittasi
 *      4xx) + `expectNoRawBackendText()`;
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
/**
 * Eski (konvertsiz) javob shakllari: yalang'och massiv, `{ data: [...] }` (bo'sh yoki to'la), `{ data: {} }` —
 * `mockResolvedValue(Once)` da ham, `mockImplementation` ichidagi `Promise.resolve(...)` da ham.
 */
const LEGACY_SHAPE = /(?:mockResolvedValue(?:Once)?|Promise\.resolve)\(\s*(?:\[|\{\s*data:\s*(?:\[|\{\s*\}))/;
/**
 * Kamida bitta 4xx rad javobi: `ErrorState` ning sukut izohi aynan 4xx da backend xabarini (`getBackendMessage`)
 * ko'rsatadi — faqat `mockRejection(500)` bilan «xom matn yo'q» testi o'z-o'zidan o'tib ketadi.
 */
const CLIENT_REJECTION = /\bmockRejection\(\s*4\d\d\b/;

/** Bitta ops sahifasi uchun yetishmayotgan talablar (bo'sh — hammasi joyida). */
const missingRequirements = (sources: string[], tests: string[]): string[] => {
  const all = tests.join("\n");
  const missing: string[] = [];
  if (tests.length === 0) return ["test fayli yo'q"];
  if (!/\bmockEnvelope\(/.test(all)) missing.push("mockEnvelope(...) — haqiqiy konvert");
  if (LEGACY_SHAPE.test(all)) missing.push("eski shakl (massiv / { data: [...] | {} }) olib tashlansin");
  if (!/\bmockRejection\(/.test(all) || !/\bexpectNoRawBackendText\(/.test(all)) {
    missing.push("rad etilgan so'rov testi: mockRejection(...) + expectNoRawBackendText()");
  } else if (!CLIENT_REJECTION.test(all)) {
    missing.push("kamida bitta 4xx rad javobi: mockRejection(400 | 403 | 404 | 409 …)");
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
      expect.arrayContaining(["branch-ops", "identity-ops", "investors-ops", "logistics-ops", "system-ops"]),
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
      "eski shakl (massiv / { data: [...] | {} }) olib tashlansin",
      "rad etilgan so'rov testi: mockRejection(...) + expectNoRawBackendText()",
      "yozuv amali tanasi: expectRequestBody(...)",
    ]);
    const complete = `mockEnvelope([]); mockRejection(400); expectNoRawBackendText(); expectRequestBody(m, "x", {});`;
    expect(missingRequirements([page], [complete])).toEqual([]);
    // Faqat o'qiydigan sahifaga tana testi shart emas.
    expect(missingRequirements([`export const P = () => null;`], [`mockEnvelope([]); mockRejection(404); expectNoRawBackendText();`])).toEqual([]);
  });

  it("tekshiruvchining o'zi: faqat 5xx rad javobi yetmaydi (4xx da backend matni sizishi mumkin)", () => {
    const readOnly = `export const P = () => null;`;
    expect(missingRequirements([readOnly], [`mockEnvelope([]); mockRejection(500); expectNoRawBackendText();`])).toEqual([
      "kamida bitta 4xx rad javobi: mockRejection(400 | 403 | 404 | 409 …)",
    ]);
    expect(missingRequirements([readOnly], [`mockEnvelope([]); mockRejection( 403, "x"); expectNoRawBackendText();`])).toEqual([]);
  });

  it.each([
    ["yalang'och massiv", `api.mockResolvedValue([]);`],
    ["to'la { data: [...] }", `api.mockResolvedValueOnce({ data: [{ id: 1 }] });`],
    ["mockImplementation ichida Promise.resolve({ data: {} })", `api.mockImplementation(() => Promise.resolve({ data: {} }));`],
    ["ko'p qatorli", `api.mockResolvedValue(\n  { data: [] },\n);`],
  ])("tekshiruvchining o'zi: eski shakl topiladi — %s", (_kind, legacy) => {
    const tests = `mockEnvelope([]); mockRejection(400); expectNoRawBackendText(); ${legacy}`;
    expect(missingRequirements([`export const P = () => null;`], [tests])).toEqual([
      "eski shakl (massiv / { data: [...] | {} }) olib tashlansin",
    ]);
  });

  it("tekshiruvchining o'zi: konvert ichidagi javob (`{ data: { type, data } }`) eski shakl emas", () => {
    const tests = `mockEnvelope([]); mockRejection(400); expectNoRawBackendText(); Promise.resolve({ data: { type: "batch", data: {} } });`;
    expect(missingRequirements([`export const P = () => null;`], [tests])).toEqual([]);
  });
});
