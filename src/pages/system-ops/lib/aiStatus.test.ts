import { describe, expect, it } from "vitest";
import { readAiStatus } from "./aiStatus";

/** Backend `origin/main` `AiStatusResponse` (ai-service `buildStatus`) — hammasi joyida. */
const status = (patch: Record<string, unknown> = {}, capPatch: Record<string, unknown> = {}) => ({
  enabled: true,
  key_state: "ok",
  models: { order: "claude-sonnet-5", vision: "claude-sonnet-5", classify: "claude-haiku-4-5" },
  model_policy: { ok: true, order: "ok", vision: "ok", classify: "ok" },
  cap: {
    period_key: "2026-10-21",
    spent_usd: 5.82,
    cap_usd: 25,
    override_usd: 0,
    effective_cap_usd: 25,
    ratio: 0.2328,
    state: "ok",
    reset_at: "2026-10-21T19:00:00.000Z",
    ...capPatch,
  },
  usage_persist_failures: 0,
  ...patch,
});

describe("readAiStatus", () => {
  it("hammasi joyida — «Yoqilgan», sababsiz, foiz butun", () => {
    const summary = readAiStatus(status(), true);
    expect(summary).toMatchObject({
      overall: "enabled",
      offReasons: [],
      keyState: "ok",
      weakModels: [],
      unknownModels: [],
      persistFailures: 0,
      cap: { state: "ok", spentUsd: 5.82, capUsd: 25, overrideUsd: 0, effectiveCapUsd: 25, percent: 23 },
    });
    expect(summary?.models.map((row) => [row.slot, row.model, row.verdict])).toEqual([
      ["order", "claude-sonnet-5", "ok"],
      ["vision", "claude-sonnet-5", "ok"],
      ["classify", "claude-haiku-4-5", "ok"],
    ]);
  });

  it("javob shakli buzuq (models / cap yo'q, massiv, null) — null", () => {
    expect(readAiStatus(null)).toBeNull();
    expect(readAiStatus([])).toBeNull();
    expect(readAiStatus({ enabled: true })).toBeNull();
    expect(readAiStatus({ ...status(), cap: undefined })).toBeNull();
    expect(readAiStatus({ ...status(), models: "x" })).toBeNull();
  });

  it("S3: kalit yo'q / noto'g'ri nom — «AI o'chiq», sabab bilan", () => {
    expect(readAiStatus(status({ enabled: false, key_state: "missing" }))).toMatchObject({
      overall: "off",
      offReasons: ["keyMissing"],
      keyState: "missing",
    });
    expect(readAiStatus(status({ enabled: false, key_state: "misnamed" }))).toMatchObject({
      overall: "off",
      offReasons: ["keyMisnamed"],
    });
  });

  it("gateway bayrog'i o'chiq (`orders/ai-availability.enabled: false`) — «AI o'chiq»; noma'lum bo'lsa hisobga olinmaydi", () => {
    expect(readAiStatus(status(), false)).toMatchObject({ overall: "off", offReasons: ["flagOff"] });
    expect(readAiStatus(status({ key_state: "missing", enabled: false }), false)?.offReasons).toEqual([
      "flagOff",
      "keyMissing",
    ]);
    expect(readAiStatus(status(), undefined)?.overall).toBe("enabled");
    expect(readAiStatus(status(), null)?.overall).toBe("enabled");
  });

  it("kalit ok, lekin `enabled: false` — «AI o'chiq» (disabled)", () => {
    expect(readAiStatus(status({ enabled: false }))).toMatchObject({ overall: "off", offReasons: ["disabled"] });
  });

  it("limit tugadi — «Limit tugadi» («AI o'chiq» emas); ogohlantirish — «Yoqilgan»", () => {
    expect(readAiStatus(status({}, { spent_usd: 25, ratio: 1, state: "exceeded" }))).toMatchObject({
      overall: "capExceeded",
      cap: { percent: 100, state: "exceeded" },
    });
    expect(
      readAiStatus(status({}, { spent_usd: 29.4, override_usd: 10, effective_cap_usd: 35, ratio: 0.84, state: "warn" })),
    ).toMatchObject({ overall: "enabled", cap: { percent: 84, overrideUsd: 10, effectiveCapUsd: 35 } });
  });

  it("limit holatini o'qib bo'lmadi (`cap.state: unknown`) yoki noma'lum holat — «Noma'lum»", () => {
    expect(readAiStatus(status({}, { state: "unknown" }))?.overall).toBe("unknown");
    expect(readAiStatus(status({}, { state: "weird" }))?.cap.state).toBe("unknown");
  });

  it("model siyosati: zaif va noma'lum modellar ajratiladi; noma'lum verdict — `unknown`", () => {
    const summary = readAiStatus(
      status({
        models: { order: "claude-sonnet-4-6", vision: " claude-sonet-5 ", classify: "claude-haiku-4-5" },
        model_policy: { ok: false, order: "weak", vision: "unknown", classify: "strange" },
      }),
    );
    expect(summary?.weakModels.map((row) => row.slot)).toEqual(["order"]);
    expect(summary?.unknownModels.map((row) => [row.slot, row.model])).toEqual([
      ["vision", "claude-sonet-5"],
      ["classify", "claude-haiku-4-5"],
    ]);
  });

  it("noma'lum kalit holati — `unknown` (o'chiq sababi emas, `enabled` ga qaraladi)", () => {
    expect(readAiStatus(status({ key_state: "rotated" }))).toMatchObject({ keyState: "unknown", overall: "enabled" });
  });

  it("sonlar: manfiy / son emas — 0; `ratio` yo'q bo'lsa hisoblanadi; `effective_cap` yo'q — asosiy + qo'shimcha", () => {
    const summary = readAiStatus(
      status(
        { usage_persist_failures: "3" },
        { spent_usd: "7.5", ratio: undefined, effective_cap_usd: undefined, cap_usd: 20, override_usd: 5 },
      ),
    );
    expect(summary?.persistFailures).toBe(3);
    expect(summary?.cap).toMatchObject({ spentUsd: 7.5, effectiveCapUsd: 25, percent: 30 });
    expect(readAiStatus(status({ usage_persist_failures: -2 }, { spent_usd: -1 }))).toMatchObject({
      persistFailures: 0,
      cap: { spentUsd: 0 },
    });
  });

  it("foiz: limit tugamaguncha pastga yaxlitlanadi (0,995 → 99%, 100% emas); suzuvchi nuqta xatosi yo'q (0,29 → 29%)", () => {
    expect(readAiStatus(status({}, { ratio: 0.995, state: "warn" }))?.cap.percent).toBe(99);
    expect(readAiStatus(status({}, { ratio: 0.29, state: "ok" }))?.cap.percent).toBe(29);
    expect(readAiStatus(status({}, { ratio: 1.004, state: "exceeded" }))?.cap.percent).toBe(100);
  });
});
