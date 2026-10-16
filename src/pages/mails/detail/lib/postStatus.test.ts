import { describe, expect, it } from "vitest";
import { getPostStatusBadge } from "./postStatus";

describe("getPostStatusBadge (4YZcTTDQ)", () => {
  it.each([
    ["new", "info", "statusNew"],
    ["sent", "warning", "statusSent"],
    ["received", "success", "statusReceived"],
    ["canceled", "danger", "statusRejected"],
    ["canceled_received", "neutral", "statusReturned"],
    ["CANCELLED RECEIVED", "neutral", "statusReturned"],
  ])("%s → %s", (status, tone, labelKey) => {
    expect(getPostStatusBadge(status)).toEqual({ tone, labelKey });
  });

  it("noma'lum yoki bo'sh holat — badge yo'q", () => {
    expect(getPostStatusBadge("mystery")).toBeNull();
    expect(getPostStatusBadge(undefined)).toBeNull();
    expect(getPostStatusBadge("")).toBeNull();
  });
});
