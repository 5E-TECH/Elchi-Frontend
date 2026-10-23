import { describe, expect, it } from "vitest";
import { classifyCampaignError } from "./campaignError";

const http = (status: number, message = "raw backend text") =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { message } },
  });

describe("classifyCampaignError (KM-2)", () => {
  it("no answer / 502–504 — unknown (retry with the same key)", () => {
    expect(classifyCampaignError(new Error("Network Error"))).toEqual({ kind: "unknown" });
    expect(classifyCampaignError(http(504))).toEqual({ kind: "unknown" });
  });

  it("400 — a clear text from the preview limits", () => {
    expect(classifyCampaignError(http(400), { total: 24310, campaignMax: 20000 })).toEqual({
      kind: "error",
      messageKey: "campaign.createError.overCap",
      values: { total: 24310, max: 20000 },
    });
    expect(classifyCampaignError(http(400), { total: 0, campaignMax: 20000 })).toMatchObject({
      messageKey: "campaign.createError.empty",
    });
    expect(classifyCampaignError(http(400), { total: 10, campaignMax: 20000 })).toMatchObject({
      messageKey: "campaign.createError.badRequest",
    });
  });

  it("other statuses map to fixed texts", () => {
    expect(classifyCampaignError(http(403))).toMatchObject({
      messageKey: "campaign.createError.forbidden",
    });
    expect(classifyCampaignError(http(409))).toMatchObject({
      messageKey: "campaign.createError.conflict",
    });
    expect(classifyCampaignError(http(429))).toMatchObject({
      messageKey: "campaign.createError.tooMany",
    });
    expect(classifyCampaignError(http(500))).toMatchObject({
      messageKey: "campaign.createError.server",
    });
    expect(classifyCampaignError(http(418))).toMatchObject({
      messageKey: "campaign.createError.generic",
    });
  });
});
