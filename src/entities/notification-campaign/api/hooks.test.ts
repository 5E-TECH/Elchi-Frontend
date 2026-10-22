import { describe, expect, it } from "vitest";
import { normalizeCampaign } from "./campaignApi";
import {
  CAMPAIGN_PROGRESS_INTERVAL_MS,
  CAMPAIGN_SCHEDULED_INTERVAL_MS,
  campaignRefetchInterval,
} from "./hooks";

const httpError = (status: number) =>
  Object.assign(new Error("x"), { isAxiosError: true, response: { status, data: {} } });
const campaign = (data: Record<string, unknown>) =>
  normalizeCampaign({ data: { id: "7", total: 10, sent: 0, ...data } });

describe("campaignRefetchInterval (progress polling)", () => {
  it("stops on 403/404 instead of polling a failing request every 3 s", () => {
    expect(campaignRefetchInterval({ data: undefined, error: httpError(404) })).toBe(false);
    expect(campaignRefetchInterval({ data: undefined, error: httpError(403) })).toBe(false);
  });

  it("keeps polling through transient errors and until the first answer", () => {
    expect(campaignRefetchInterval({ data: undefined, error: null })).toBe(
      CAMPAIGN_PROGRESS_INTERVAL_MS,
    );
    expect(campaignRefetchInterval({ data: undefined, error: httpError(503) })).toBe(
      CAMPAIGN_PROGRESS_INTERVAL_MS,
    );
  });

  it("a scheduled campaign (e.g. shifted to 09:00 by the night ban) polls rarely; finished — never", () => {
    expect(
      campaignRefetchInterval({
        data: campaign({ status: "queued", display_status: "scheduled" }),
        error: null,
      }),
    ).toBe(CAMPAIGN_SCHEDULED_INTERVAL_MS);
    expect(
      campaignRefetchInterval({
        data: campaign({ status: "running", display_status: "sending" }),
        error: null,
      }),
    ).toBe(CAMPAIGN_PROGRESS_INTERVAL_MS);
    expect(
      campaignRefetchInterval({ data: campaign({ status: "done", display_status: "sent" }), error: null }),
    ).toBe(false);
  });
});
