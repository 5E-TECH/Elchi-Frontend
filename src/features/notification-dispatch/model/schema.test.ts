import { describe, expect, it } from "vitest";
import { toAudienceTarget } from "../../../entities/notification-campaign";
import * as schemaModule from "./schema";
import {
  RECIPIENT_MODES,
  buildCampaignPayload,
  buildDispatchPayload,
  createDefaultValues,
  createDispatchSchema,
  type DispatchFormValues,
} from "./schema";

const t = (key: string) => key;
const base = (patch: Partial<DispatchFormValues>): DispatchFormValues => ({
  ...createDefaultValues(),
  title: "Ish vaqti",
  body: "Ertaga 9:00 dan",
  group_key: "xabar-1",
  ...patch,
});

describe("buildDispatchPayload", () => {
  it("targets one user with recipient_id", () => {
    const payload = buildDispatchPayload(base({ mode: "single", recipient_id: "56" }));
    expect(payload).toMatchObject({ recipient_id: "56", title: "Ish vaqti", body: "Ertaga 9:00 dan", group_key: "xabar-1" });
    expect(payload).not.toHaveProperty("roles");
    expect(payload).not.toHaveProperty("broadcast");
  });

  it("the «Rol» mode is gone — no roles field ever reaches the dispatch payload (KM-2)", () => {
    expect(buildDispatchPayload(base({ mode: "all" }))).not.toHaveProperty("roles");
  });

  it("KM-2 item 10 regression: modes are exactly single · list · audience · all, no DISPATCH_ROLES", () => {
    expect(RECIPIENT_MODES).toEqual(["single", "list", "audience", "all"]);
    expect(schemaModule).not.toHaveProperty("DISPATCH_ROLES");
    expect(schemaModule).not.toHaveProperty("DISABLED_DISPATCH_ROLES");
  });

  it("targets a picked list with recipient_ids", () => {
    expect(buildDispatchPayload(base({ mode: "list", recipient_ids: ["3", "16"] }))).toMatchObject({ recipient_ids: ["3", "16"] });
  });

  it("targets everyone with broadcast: true", () => {
    const payload = buildDispatchPayload(base({ mode: "all" }));
    expect(payload.broadcast).toBe(true);
    expect(payload).not.toHaveProperty("recipient_id");
  });

  it("always includes in_app and never sends sms or push", () => {
    expect(buildDispatchPayload(base({ realtime: false, telegram: false })).channels).toEqual(["in_app"]);
    const all = buildDispatchPayload(base({ realtime: true, telegram: true, telegram_market_id: "3" }));
    expect(all.channels).toEqual(["in_app", "realtime", "telegram"]);
    expect(all.channels).not.toContain("sms");
    expect(all.channels).not.toContain("push");
    expect(all.telegram).toEqual({ market_id: "3" });
  });

  it("Telegram without a market: channel kept, no telegram target (personal chats)", () => {
    const payload = buildDispatchPayload(base({ mode: "list", recipient_ids: ["56"], telegram: true, telegram_market_id: "" }));
    expect(payload.channels).toEqual(["in_app", "realtime", "telegram"]);
    expect(payload).not.toHaveProperty("telegram");
  });

  it("a market left over from an unchecked Telegram channel is not sent", () => {
    const payload = buildDispatchPayload(base({ telegram: false, telegram_market_id: "3" }));
    expect(payload.channels).not.toContain("telegram");
    expect(payload).not.toHaveProperty("telegram");
  });

  it("sends the backend-required type and drops empty optional fields", () => {
    const payload = buildDispatchPayload(base({ body: "  ", link: " ", category: "finance" }));
    expect(payload.type).toBe("finance.manual");
    expect(payload).not.toHaveProperty("body");
    expect(payload).not.toHaveProperty("link");
  });
});

describe("createDispatchSchema", () => {
  const schema = createDispatchSchema(t);

  it("rejects a title over 255 and a body over 4096 characters", async () => {
    await expect(schema.validate(base({ mode: "all", title: "a".repeat(256) }))).rejects.toThrow("dispatch.errors.tooLong");
    await expect(schema.validate(base({ mode: "all", body: "a".repeat(4097) }))).rejects.toThrow("dispatch.errors.tooLong");
    await expect(schema.validate(base({ mode: "all", title: "a".repeat(255), body: "a".repeat(4096) }))).resolves.toBeTruthy();
  });

  it("requires a group key and a target for the chosen mode", async () => {
    await expect(schema.validate(base({ mode: "all", group_key: " " }))).rejects.toThrow("dispatch.errors.groupKey");
    await expect(schema.validate(base({ mode: "single", recipient_id: "" }))).rejects.toThrow("dispatch.errors.recipient");
    await expect(schema.validate(base({ mode: "list", recipient_ids: [] }))).rejects.toThrow("dispatch.errors.recipients");
  });

  it("«Auditoriya» needs no group key (the campaign has none)", async () => {
    await expect(schema.validate(base({ mode: "audience", group_key: "" }))).resolves.toBeTruthy();
  });

  it("Telegram market is optional — without it Telegram goes to personal chats (TgYRqaTk)", async () => {
    await expect(schema.validate(base({ mode: "all", telegram: true, telegram_market_id: "" }))).resolves.toMatchObject({
      telegram: true,
      telegram_market_id: "",
    });
    await expect(schema.validate(base({ mode: "all", telegram: true, telegram_market_id: "3" }))).resolves.toMatchObject({
      telegram_market_id: "3",
    });
  });
});

describe("buildCampaignPayload", () => {
  const target = toAudienceTarget({
    kinds: ["customer", "staff"],
    staffRoles: ["courier"],
    customerSegment: { region_id: "5" },
    allCustomers: false,
  });

  it("sends the audience target, the type and only campaign channels — no Telegram, SMS or group key", () => {
    const payload = buildCampaignPayload(
      base({ mode: "audience", category: "marketing", realtime: true, telegram: true, sms: true, push: true }),
      target!,
    );
    expect(payload).toEqual({
      roles: ["courier"],
      include_customers: true,
      segment: { region_id: "5" },
      type: "marketing.manual",
      category: "marketing",
      priority: "normal",
      title: "Ish vaqti",
      body: "Ertaga 9:00 dan",
      channels: ["in_app", "realtime", "push"],
    });
  });

  it("drops empty optional fields and keeps in_app alone", () => {
    const payload = buildCampaignPayload(base({ mode: "audience", body: " ", link: "", realtime: false }), target!);
    expect(payload.channels).toEqual(["in_app"]);
    expect(payload).not.toHaveProperty("body");
    expect(payload).not.toHaveProperty("link");
    expect(payload).not.toHaveProperty("group_key");
  });
});
