import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { MERGE_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import {
  classifyMergeError,
  formatElapsed,
  httpStatusOf,
  mergeCandidates,
  mergeReducer,
  MERGE_IDLE,
  parseMergeOutcome,
  type MergeDistrict,
  type MergeState,
} from "./districtMerge";

const BOZ: MergeDistrict = { id: "11", name: "Bo'z tumani", regionId: "2", regionName: "Andijon" };
const IZBOSKAN: MergeDistrict = { id: "12", name: "Izboskan tumani", regionId: "2", regionName: "Andijon" };
const CHILONZOR: MergeDistrict = { id: "3", name: "Chilonzor", regionId: "1", regionName: "Toshkent sh." };

const axiosError = (status: number | null, code?: string) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    "fail",
    code,
    config,
    {},
    status == null
      ? undefined
      : { status, statusText: "", headers: {}, config, data: { message: "server matni" } },
  );
};

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
    const outcome = { before: null, after: null };
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
    });
    // Natija faqat jarayondan keladi.
    expect(mergeReducer(confirm, { type: "succeed", outcome })).toBe(confirm);
  });

  it("closes every finished state back to idle", () => {
    const finished: MergeState[] = [
      confirm,
      { phase: "result", source: BOZ, target: IZBOSKAN, outcome: { before: null, after: null } },
      { phase: "unknown", source: BOZ, target: IZBOSKAN },
      { phase: "error", source: BOZ, target: IZBOSKAN, status: 409 },
    ];
    for (const state of finished) expect(mergeReducer(state, { type: "close" })).toBe(MERGE_IDLE);
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
    });
  });

  it("returns nulls for a missing or broken body instead of inventing numbers", () => {
    expect(parseMergeOutcome(undefined)).toEqual({ before: null, after: null });
    expect(parseMergeOutcome({ data: { target_after: { orders: 1, users: -1, branches: 0 } } })).toEqual({
      before: null,
      after: null,
    });
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

  it("treats an explicit server refusal as an error", () => {
    for (const status of [400, 403, 404, 409, 503]) {
      expect(classifyMergeError(axiosError(status))).toEqual({ kind: "error", status });
    }
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
