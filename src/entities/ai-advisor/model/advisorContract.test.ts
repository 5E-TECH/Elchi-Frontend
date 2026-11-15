import { describe, expect, it } from "vitest";
import contract from "../../../test/aiAdvisorContractExamples.json";
import { advisorHttpError } from "../../../test/aiAdvisorFixtures";
import { classifyProbeError, readAdvisorError } from "./advisorErrors";
import {
  normalizeAlertDetail,
  normalizeAlertList,
  normalizeExplainResult,
  normalizeOverview,
  normalizeSettings,
} from "./advisorNormalize";

/**
 * Shartnoma v0.3 namunalari (`src/test/aiAdvisorContractExamples.json` — `openapi-fragment.json` dagi javoblar,
 * o'zgartirmasdan): har muvaffaqiyatli namuna normalizatordan maydon yo'qotmay va o'zgartirmay o'tadi
 * (`toMatchObject` — server bergan har maydon natijada ayni qiymat bilan), har xato namunasi — kodi va ruxsat etilgan
 * har maydoni bilan (`readAdvisorError`). Shartnoma v0.4 da namunalar yangilansa, bu test farqni ko'rsatadi.
 */

type Example = { statusCode: number; message?: string; data?: unknown } & Record<string, unknown>;
const examples = contract.examples as unknown as Record<string, Example>;

const pick = (prefix: string): Array<[string, Example]> =>
  Object.entries(examples).filter(([key]) => key.startsWith(prefix));

const SUCCESS: Array<[string, (payload: unknown) => unknown]> = [
  ["GET /ai/advisor/overview 200", normalizeOverview],
  ["GET /ai/advisor/alerts 200", normalizeAlertList],
  ["GET /ai/advisor/alerts/{id} 200", normalizeAlertDetail],
  ["PATCH /ai/advisor/alerts/{id} 200", normalizeAlertDetail],
  ["POST /ai/advisor/alerts/{id}/explain 202", normalizeExplainResult],
  ["GET /ai/advisor/settings 200", normalizeSettings],
  ["PATCH /ai/advisor/settings 200", normalizeSettings],
];

/** Xato tanasidagi `AdvisorErrorFields` ga kiradigan maydonlar (qolganlari — `statusCode`, `message`, `code`, `error`). */
const ERROR_FIELDS = [
  "field",
  "min",
  "max",
  "reason",
  "min_length",
  "max_length",
  "scope",
  "period",
  "reset_at",
  "retry_after_seconds",
  "alert_status",
  "version",
] as const;

describe("shartnoma v0.3 namunalari — muvaffaqiyatli javoblar", () => {
  const cases = SUCCESS.flatMap(([prefix, normalize]) => pick(prefix).map(([key, body]) => [key, body, normalize] as const));

  it("namunalar to'liq (har endpoint bor)", () => {
    expect(cases.map(([key]) => key)).toHaveLength(12);
  });

  it.each(cases)("%s — maydon yo'qolmaydi va o'zgarmaydi", (_key, body, normalize) => {
    expect(body.data).toBeDefined();
    expect(normalize(body)).toMatchObject(body.data as Record<string, unknown>);
  });
});

describe("shartnoma v0.3 namunalari — xatolar", () => {
  const cases = Object.entries(examples).filter(([, body]) => body && body.statusCode >= 400);

  it.each(cases)("%s — holat, kod va ruxsat etilgan maydonlar", (_key, body) => {
    const info = readAdvisorError(advisorHttpError(body.statusCode, body));
    expect(info.status).toBe(body.statusCode);
    expect(info.code).toBe(typeof body.code === "string" ? body.code : null);
    for (const field of ERROR_FIELDS) {
      if (field in body) expect(info.fields[field], field).toBe(body[field]);
    }
  });

  it("zond tasnifi: 404 — yo'q, 403 — ruxsat yo'q, 504 — vaqtinchalik", () => {
    const error = (key: string) => advisorHttpError(examples[key].statusCode, examples[key]);
    expect(classifyProbeError(error("GET /ai/advisor/alerts/{id} 404 not_found"))).toBe("absent");
    expect(classifyProbeError(error("GET /ai/advisor/overview 403 forbidden"))).toBe("forbidden");
    expect(classifyProbeError(error("GET /ai/advisor/overview 504 timeout"))).toBe("transient");
  });
});
