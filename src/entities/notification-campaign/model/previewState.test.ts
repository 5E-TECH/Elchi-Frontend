import { describe, expect, it } from "vitest";
import { normalizeAudiencePreview } from "../api/campaignApi";
import { audiencePreviewErrorKind, audiencePreviewState, canSendAudience } from "./previewState";

const preview = (data: Record<string, unknown>) =>
  normalizeAudiencePreview({
    data: { limits: { dispatch_max: 5000, campaign_max: 20000 }, ...data },
  });
const done = (data: ReturnType<typeof preview>) => ({
  current: true,
  settled: true,
  isError: false,
  isFetching: false,
  data,
});

describe("audiencePreviewState (maket `-send-states`)", () => {
  it("gate states come first", () => {
    const query = done(preview({ total: 5 }));
    expect(audiencePreviewState("noKind", query)).toBe("idle");
    expect(audiencePreviewState("noStaffRole", query)).toBe("idle");
    expect(audiencePreviewState("needsCustomerFilter", query)).toBe("needsFilter");
  });

  it("counting while the target changed or the request runs (old number is not used)", () => {
    expect(audiencePreviewState("ready", { ...done(preview({ total: 5 })), current: false })).toBe(
      "loading",
    );
    expect(
      audiencePreviewState("ready", {
        current: false,
        settled: true,
        isError: false,
        isFetching: true,
        data: undefined,
      }),
    ).toBe("loading");
  });

  it("error, empty, over the campaign cap, big and ready", () => {
    expect(
      audiencePreviewState("ready", {
        current: false,
        settled: true,
        isError: true,
        isFetching: false,
        data: undefined,
      }),
    ).toBe("error");
    expect(
      audiencePreviewState("ready", done(preview({ total: 0, campaign_allowed: false }))),
    ).toBe("empty");
    expect(
      audiencePreviewState("ready", done(preview({ total: 24310, campaign_allowed: false }))),
    ).toBe("overCap");
    expect(
      audiencePreviewState("ready", done(preview({ total: 8640, campaign_allowed: true }))),
    ).toBe("big");
    expect(
      audiencePreviewState("ready", done(preview({ total: 1308, campaign_allowed: true }))),
    ).toBe("ready");
  });

  it("only ready and big can be sent", () => {
    expect(["ready", "big"].every((state) => canSendAudience(state as never))).toBe(true);
    expect(
      ["idle", "needsFilter", "loading", "error", "empty", "overCap"].some((state) =>
        canSendAudience(state as never),
      ),
    ).toBe(false);
  });

  it("4xx is a filter problem (no retry), the rest — server/network (retry)", () => {
    const http = (status: number) => ({ isAxiosError: true, response: { status } });
    expect(audiencePreviewErrorKind(http(400))).toBe("badRequest");
    expect(audiencePreviewErrorKind(http(503))).toBe("unavailable");
    expect(audiencePreviewErrorKind(http(429))).toBe("unavailable");
    expect(audiencePreviewErrorKind(new Error("Network Error"))).toBe("unavailable");
  });
});
