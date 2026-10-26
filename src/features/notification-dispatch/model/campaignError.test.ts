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

describe("classifyCampaignError — SMS kanali (KM-5, 9D1Gl9MS)", () => {
  const sms = { smsEnabled: true, optOutConfigured: true, fanoutExceeded: false, maxFanout: 2 };

  it("409 sms_disabled / opt_out_not_configured — by the backend reason, even without the preview", () => {
    expect(
      classifyCampaignError(
        http(409, "SMS o'chiq (SMS_ENABLED=false) — SMS kanali bilan kampaniya yaratilmadi (sms_disabled)"),
      ),
    ).toEqual({ kind: "error", messageKey: "campaign.createError.smsDisabled" });
    expect(classifyCampaignError(http(409, "SMS kanali sozlanmagan (sms_disabled)"))).toMatchObject({
      messageKey: "campaign.createError.smsDisabled",
    });
    expect(
      classifyCampaignError(
        http(409, "Reklama SMS uchun bekor qilish havolasi sozlanmagan (SMS_OPT_OUT_BASE_URL, SMS_DLR_SECRET) — kampaniya yaratilmadi (opt_out_not_configured)"),
      ),
    ).toMatchObject({ messageKey: "campaign.createError.smsOptOut" });
  });

  it("409 without a reason text — from the SMS preview block; a plain 409 stays a key conflict", () => {
    expect(
      classifyCampaignError(http(409), { total: 2, campaignMax: 20000, sms: { ...sms, smsEnabled: false } }),
    ).toMatchObject({ messageKey: "campaign.createError.smsDisabled" });
    expect(
      classifyCampaignError(http(409), { total: 2, campaignMax: 20000, sms: { ...sms, optOutConfigured: false } }),
    ).toMatchObject({ messageKey: "campaign.createError.smsOptOut" });
    expect(classifyCampaignError(http(409), { total: 2, campaignMax: 20000, sms })).toMatchObject({
      messageKey: "campaign.createError.conflict",
    });
  });

  it("400 SMS_MAX_FANOUT — the limit from the backend text (prod 2), else from the preview", () => {
    expect(
      classifyCampaignError(
        http(
          400,
          "SMS kanali bilan kampaniya auditoriyasi 5 — chegara 2 (SMS_MAX_FANOUT). Nishonni toraytiring yoki SMS kanalisiz yuboring — jimgina kesilmaydi.",
        ),
        { total: 5, campaignMax: 20000, sms },
      ),
    ).toEqual({ kind: "error", messageKey: "campaign.createError.smsFanout", values: { total: 5, max: 2 } });
    expect(
      classifyCampaignError(http(400), {
        total: 5,
        campaignMax: 20000,
        sms: { ...sms, fanoutExceeded: true, maxFanout: 2 },
      }),
    ).toEqual({ kind: "error", messageKey: "campaign.createError.smsFanout", values: { max: 2 } });
    // SMS'siz 400 — avvalgidek.
    expect(classifyCampaignError(http(400), { total: 0, campaignMax: 20000, sms })).toMatchObject({
      messageKey: "campaign.createError.empty",
    });
  });
});
