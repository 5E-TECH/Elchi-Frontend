import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { MERGE_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import {
  classifyMergeError,
  deleteBlockedUsage,
  formatElapsed,
  httpStatusOf,
  mergeCandidates,
  mergeErrorVariant,
  mergeReasonLines,
  mergeReducer,
  MERGE_IDLE,
  parseDistrictUsage,
  parseMergeErrorDetails,
  parseMergeOutcome,
  type MergeDistrict,
  type MergeErrorDetails,
  type MergeState,
} from "./districtMerge";

const BOZ: MergeDistrict = { id: "11", name: "Bo'z tumani", regionId: "2", regionName: "Andijon" };
const IZBOSKAN: MergeDistrict = { id: "12", name: "Izboskan tumani", regionId: "2", regionName: "Andijon" };
const CHILONZOR: MergeDistrict = { id: "3", name: "Chilonzor", regionId: "1", regionName: "Toshkent sh." };

const axiosError = (status: number | null, code?: string, data: unknown = { message: "server matni" }) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    "fail",
    code,
    config,
    {},
    status == null ? undefined : { status, statusText: "", headers: {}, config, data },
  );
};

/** tf324cXN — 409 javobi (backend CHANGELOG 2026-10-24 namunasi). */
const COUNT_MISMATCH_BODY = {
  statusCode: 409,
  message: "Birlashtirish bekor qilindi: tekshiruv mos kelmadi — …",
  data: {
    reason: "count_mismatch",
    details: {
      reason: "count_mismatch",
      kind: "orders",
      mismatches: [{ kind: "orders", district: "target", expected: 1254, actual: 1255 }],
      from_district_id: "11",
      to_district_id: "12",
      manual_fix: false,
    },
  },
  trace_id: "7d0c2a4e",
};

const details = (patch: Partial<MergeErrorDetails> = {}): MergeErrorDetails => ({
  reason: "count_mismatch",
  kind: "orders",
  timeoutMs: null,
  mismatches: [],
  manualFix: false,
  stranded: [],
  rolledBack: null,
  strandedOrderIds: [],
  traceId: null,
  ...patch,
});

describe("mergeReducer — idle → confirm → progress → result | error | unknown", () => {
  const confirm = mergeReducer(MERGE_IDLE, { type: "open", source: BOZ });
  const progress = mergeReducer(
    mergeReducer(confirm, { type: "select", targetId: IZBOSKAN.id }),
    { type: "submit", target: IZBOSKAN, at: 1000 },
  );

  it("opens the confirm step; a preselected target is kept unless it is the source itself", () => {
    expect(confirm).toEqual({ phase: "confirm", source: BOZ, targetId: null });
    expect(mergeReducer(MERGE_IDLE, { type: "open", source: BOZ, targetId: "12" })).toMatchObject({ targetId: "12" });
    expect(mergeReducer(MERGE_IDLE, { type: "open", source: BOZ, targetId: "11" })).toMatchObject({ targetId: null });
  });

  it("submits only from confirm, never to the source itself or to another region (owner S2)", () => {
    expect(progress).toEqual({ phase: "progress", source: BOZ, target: IZBOSKAN, startedAt: 1000 });
    expect(mergeReducer(confirm, { type: "submit", target: BOZ, at: 1 })).toBe(confirm);
    expect(mergeReducer(confirm, { type: "submit", target: CHILONZOR, at: 1 })).toBe(confirm);
    expect(mergeReducer(MERGE_IDLE, { type: "submit", target: IZBOSKAN, at: 1 })).toBe(MERGE_IDLE);
  });

  it("resumes a request that is still running (page reopened) instead of starting a new one", () => {
    const resumed = mergeReducer(MERGE_IDLE, { type: "resume", source: BOZ, target: IZBOSKAN, startedAt: 1000 });
    expect(resumed).toEqual(progress);
    expect(mergeReducer(confirm, { type: "resume", source: BOZ, target: IZBOSKAN, startedAt: 1000 })).toEqual(progress);
    expect(mergeReducer(progress, { type: "resume", source: IZBOSKAN, target: BOZ, startedAt: 5 })).toBe(progress);
  });

  it("cannot be closed or reopened while the request is running", () => {
    expect(mergeReducer(progress, { type: "close" })).toBe(progress);
    expect(mergeReducer(progress, { type: "open", source: IZBOSKAN })).toBe(progress);
    expect(mergeReducer(progress, { type: "select", targetId: null })).toBe(progress);
  });

  it("finishes with result, unknown or error", () => {
    const outcome = { before: null, after: null, moved: null };
    expect(mergeReducer(progress, { type: "succeed", outcome })).toEqual({
      phase: "result",
      source: BOZ,
      target: IZBOSKAN,
      outcome,
    });
    expect(mergeReducer(progress, { type: "fail", failure: { kind: "unknown", status: 504 } })).toEqual({
      phase: "unknown",
      source: BOZ,
      target: IZBOSKAN,
    });
    expect(mergeReducer(progress, { type: "fail", failure: { kind: "error", status: 409 } })).toEqual({
      phase: "error",
      source: BOZ,
      target: IZBOSKAN,
      status: 409,
      details: null,
    });
    // Natija faqat jarayondan keladi.
    expect(mergeReducer(confirm, { type: "succeed", outcome })).toBe(confirm);
  });

  it("closes every finished state back to idle", () => {
    const finished: MergeState[] = [
      confirm,
      { phase: "result", source: BOZ, target: IZBOSKAN, outcome: { before: null, after: null, moved: null } },
      { phase: "unknown", source: BOZ, target: IZBOSKAN },
      { phase: "error", source: BOZ, target: IZBOSKAN, status: 409, details: null },
    ];
    for (const state of finished) expect(mergeReducer(state, { type: "close" })).toBe(MERGE_IDLE);
  });

  it("retries a rolled-back error with the same pair, never a manual-fix one", () => {
    const rolledBack = mergeReducer(progress, {
      type: "fail",
      failure: { kind: "error", status: 409, details: details() },
    });
    expect(rolledBack).toMatchObject({ phase: "error", details: { reason: "count_mismatch" } });
    expect(mergeReducer(rolledBack, { type: "retry", at: 5 })).toEqual({
      phase: "progress",
      source: BOZ,
      target: IZBOSKAN,
      startedAt: 5,
    });
    const manual = mergeReducer(progress, {
      type: "fail",
      failure: { kind: "error", status: 503, details: details({ manualFix: true }) },
    });
    expect(mergeReducer(manual, { type: "retry", at: 5 })).toBe(manual);
    // Sababsiz xato (oyna yo'q) va boshqa holatlardan qayta urinilmaydi.
    const plain = mergeReducer(progress, { type: "fail", failure: { kind: "error", status: 404 } });
    expect(mergeReducer(plain, { type: "retry", at: 5 })).toBe(plain);
    expect(mergeReducer(confirm, { type: "retry", at: 5 })).toBe(confirm);
  });
});

describe("parseMergeOutcome", () => {
  it("reads live target_before / target_after counts (deleted records are not counted)", () => {
    const outcome = parseMergeOutcome({
      statusCode: 200,
      message: "District merged",
      data: {
        moved: { orders: 130, users: 6, branches: 1 },
        target_before: { orders: 1126, users: 13, branches: 1, transfer_batches: 0, deleted: { orders: 4, users: 0, branches: 0, transfer_batches: 0 } },
        target_after: { orders: "1254", users: 19, branches: 2, transfer_batches: 0, deleted: { orders: 6, users: 0, branches: 0, transfer_batches: 0 } },
      },
    });
    expect(outcome).toEqual({
      before: { orders: 1126, users: 13, branches: 1 },
      after: { orders: 1254, users: 19, branches: 2 },
      // `moved_live` yo'q eski javob — jami `moved`.
      moved: { orders: 130, users: 6, branches: 1 },
    });
  });

  it("«Ko'chirildi» takes only live records (moved_live, vsmpTweI), not moved", () => {
    const outcome = parseMergeOutcome({
      statusCode: 200,
      data: {
        moved: { orders: 130, users: 6, branches: 1 },
        moved_live: { orders: 128, users: 6, branches: 1 },
        target_before: { orders: 1126, users: 13, branches: 1 },
        target_after: { orders: 1254, users: 19, branches: 2 },
      },
    });
    expect(outcome.moved).toEqual({ orders: 128, users: 6, branches: 1 });
  });

  it("returns nulls for a missing or broken body instead of inventing numbers", () => {
    expect(parseMergeOutcome(undefined)).toEqual({ before: null, after: null, moved: null });
    expect(parseMergeOutcome({ data: { target_after: { orders: 1, users: -1, branches: 0 } } })).toEqual({
      before: null,
      after: null,
      moved: null,
    });
  });
});

describe("usage counts", () => {
  it("reads GET district/:id/usage and the DELETE 400 data.usage", () => {
    expect(parseDistrictUsage({ statusCode: 200, data: { orders: 128, users: 6, branches: 1 } })).toEqual({
      orders: 128,
      users: 6,
      branches: 1,
    });
    expect(parseDistrictUsage({ data: { orders: 1 } })).toBeNull();
    expect(
      deleteBlockedUsage(
        axiosError(400, undefined, {
          statusCode: 400,
          message: "Bu tumanda …",
          data: { reason: "district_in_use", usage: { orders: 5, users: 1, branches: 0, transfer_batches: 0 } },
        }),
      ),
    ).toEqual({ orders: 5, users: 1, branches: 0 });
    expect(deleteBlockedUsage(axiosError(400, undefined, { message: "x", data: null }))).toBeNull();
    expect(deleteBlockedUsage(new Error("x"))).toBeNull();
  });
});

describe("parseMergeErrorDetails (tf324cXN)", () => {
  it("reads reason, kind, mismatches and trace_id — never the message", () => {
    expect(parseMergeErrorDetails(COUNT_MISMATCH_BODY)).toEqual({
      reason: "count_mismatch",
      kind: "orders",
      timeoutMs: null,
      mismatches: [{ kind: "orders", district: "target", expected: 1254, actual: 1255 }],
      manualFix: false,
      stranded: [],
      rolledBack: null,
      strandedOrderIds: [],
      traceId: "7d0c2a4e",
    });
  });

  it("reads timeout_ms and manual_fix stranded rows (count / district null — unknown)", () => {
    const parsed = parseMergeErrorDetails({
      statusCode: 503,
      data: {
        reason: "timeout",
        details: {
          reason: "timeout",
          kind: "users",
          timeout_ms: 15000,
          manual_fix: true,
          stranded: [
            { kind: "orders", district_id: "12", count: 14 },
            { kind: "users", district_id: null, count: null },
            { kind: "posts", district_id: "12", count: 1 },
          ],
        },
      },
    });
    expect(parsed).toMatchObject({
      reason: "timeout",
      kind: "users",
      timeoutMs: 15000,
      manualFix: true,
      stranded: [
        { kind: "orders", districtId: "12", count: 14 },
        { kind: "users", districtId: null, count: null },
      ],
    });
  });

  it("Z1c1sNPT: reads flat rolled_back_* counts and stranded_order_ids (≤10); old body — rolledBack null", () => {
    const parsed = parseMergeErrorDetails({
      statusCode: 503,
      data: {
        reason: "timeout",
        details: {
          reason: "timeout",
          kind: "users",
          rolled_back_orders: 128,
          rolled_back_users: 0,
          rolled_back_branches: "1",
          manual_fix: true,
          stranded: [{ kind: "orders", district_id: "12", count: 14 }],
          stranded_order_ids: ["7001", 7002, "", null, "7003", "7004", "7005", "7006", "7007", "7008", "7009", "7010", "7011"],
        },
      },
    });
    expect(parsed?.rolledBack).toEqual({ orders: 128, users: 0, branches: 1 });
    expect(parsed?.strandedOrderIds).toEqual(["7001", "7002", "7003", "7004", "7005", "7006", "7007", "7008", "7009", "7010"]);

    const old = parseMergeErrorDetails(COUNT_MISMATCH_BODY);
    expect(old?.rolledBack).toBeNull();
    expect(old?.strandedOrderIds).toEqual([]);
  });

  it("returns null when the body is not machine-readable (no details.manual_fix)", () => {
    expect(parseMergeErrorDetails({ statusCode: 409, message: "Birlashtirish bekor qilindi" })).toBeNull();
    expect(parseMergeErrorDetails({ statusCode: 400, data: { reason: "district_in_use", usage: {} } })).toBeNull();
    expect(parseMergeErrorDetails(null)).toBeNull();
    // Noma'lum (yangi) kod — oyna bor, «Sabab» yo'q.
    expect(
      parseMergeErrorDetails({ data: { reason: "something_new", details: { reason: "something_new", manual_fix: false } } }),
    ).toMatchObject({ reason: null, manualFix: false });
  });
});

describe("mergeErrorVariant", () => {
  it("maps manual_fix, unavailable service and other refusals to the three dialogs", () => {
    expect(mergeErrorVariant(503, details({ reason: "timeout", manualFix: true }))).toBe("manual");
    expect(mergeErrorVariant(503, details({ reason: "timeout" }))).toBe("unavailable");
    expect(mergeErrorVariant(503, details({ reason: "remote_refused" }))).toBe("unavailable");
    expect(mergeErrorVariant(503, details({ reason: null }))).toBe("unavailable");
    expect(mergeErrorVariant(409, details({ reason: "remote_refused" }))).toBe("error");
    expect(mergeErrorVariant(409, details({ reason: "count_mismatch" }))).toBe("error");
    expect(mergeErrorVariant(503, details({ reason: "invalid_response" }))).toBe("error");
    expect(mergeErrorVariant(503, details({ reason: "delete_failed", kind: null }))).toBe("error");
  });
});

describe("mergeReasonLines (reason → matn kaliti)", () => {
  it("builds one line per mismatch with expected / actual", () => {
    expect(
      mergeReasonLines(
        details({
          mismatches: [
            { kind: "orders", district: "target", expected: 1254, actual: 1255 },
            { kind: "users", district: "source", expected: 0, actual: 2 },
          ],
        }),
      ),
    ).toEqual([
      { key: "countMismatchTarget", kind: "orders", district: "target", expected: 1254, actual: 1255 },
      { key: "countMismatchSource", kind: "users", district: "source", expected: 0, actual: 2 },
    ]);
    expect(mergeReasonLines(details())).toEqual([{ key: "countMismatch", kind: "orders" }]);
  });

  it("covers timeout (seconds), refusal, invalid response, delete failure and unknown codes", () => {
    expect(mergeReasonLines(details({ reason: "timeout", kind: "users", timeoutMs: 15000 }))).toEqual([
      { key: "timeout", kind: "users", seconds: 15 },
    ]);
    expect(mergeReasonLines(details({ reason: "timeout", kind: "users" }))).toEqual([
      { key: "timeoutNoValue", kind: "users" },
    ]);
    expect(mergeReasonLines(details({ reason: "remote_refused", kind: "branches" }))).toEqual([
      { key: "remoteRefused", kind: "branches" },
    ]);
    expect(mergeReasonLines(details({ reason: "invalid_response", kind: "orders" }))).toEqual([
      { key: "invalidResponse", kind: "orders" },
    ]);
    expect(mergeReasonLines(details({ reason: "delete_failed", kind: null }))).toEqual([{ key: "deleteFailed" }]);
    expect(mergeReasonLines(details({ reason: null }))).toEqual([]);
  });
});

describe("classifyMergeError", () => {
  it("treats no response, timeouts and gateway errors as an unknown result", () => {
    expect(classifyMergeError(axiosError(null, "ECONNABORTED"))).toEqual({ kind: "unknown", status: null });
    expect(classifyMergeError(axiosError(null, "ERR_NETWORK"))).toEqual({ kind: "unknown", status: null });
    for (const status of [500, 502, 504, 524]) {
      expect(classifyMergeError(axiosError(status))).toEqual({ kind: "unknown", status });
    }
    expect(classifyMergeError(new Error("boom"))).toEqual({ kind: "unknown", status: null });
  });

  it("treats an explicit server refusal as an error (details only from a machine-readable body)", () => {
    for (const status of [400, 403, 404, 409, 503]) {
      expect(classifyMergeError(axiosError(status))).toEqual({ kind: "error", status, details: null });
    }
    expect(classifyMergeError(axiosError(409, undefined, COUNT_MISMATCH_BODY))).toMatchObject({
      kind: "error",
      status: 409,
      details: { reason: "count_mismatch", traceId: "7d0c2a4e" },
    });
  });

  it("httpStatusOf reads the response status only", () => {
    expect(httpStatusOf(axiosError(400))).toBe(400);
    expect(httpStatusOf(axiosError(null, "ECONNABORTED"))).toBeNull();
    expect(httpStatusOf("x")).toBeNull();
  });
});

describe("mergeCandidates", () => {
  it("offers only the other districts of the source region, sorted by name", () => {
    const regions = [
      { id: "1", name: "Toshkent sh.", districts: [{ id: "3", name: "Chilonzor" }] },
      {
        id: "2",
        name: "Andijon",
        districts: [
          { id: "13", name: "Asaka tumani" },
          { id: "11", name: "Bo'z tumani" },
          { id: "12", name: "Izboskan tumani" },
        ],
      },
    ];
    expect(mergeCandidates(regions, BOZ).map((d) => d.id)).toEqual(["13", "12"]);
    expect(mergeCandidates(regions, BOZ)[0]).toEqual({
      id: "13",
      name: "Asaka tumani",
      regionId: "2",
      regionName: "Andijon",
    });
    expect(mergeCandidates(regions, { id: "x", regionId: "404" })).toEqual([]);
  });
});

describe("formatElapsed", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(42_400)).toBe("0:42");
    expect(formatElapsed(125_000)).toBe("2:05");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("MERGE_REQUEST_TIMEOUT_MS", () => {
  it("waits longer than the gateway (rxjs timeout 120 s) so a 200/409/503 is not lost on the way", () => {
    expect(MERGE_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000 + 5_000);
  });
});
