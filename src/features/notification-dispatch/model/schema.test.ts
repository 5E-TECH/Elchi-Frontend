import { describe, expect, it } from "vitest";
import { buildDispatchPayload, createDefaultValues, createDispatchSchema, type DispatchFormValues } from "./schema";

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

  it("targets roles with a roles array", () => {
    expect(buildDispatchPayload(base({ mode: "roles", roles: ["courier", "market"] }))).toMatchObject({ roles: ["courier", "market"] });
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
    await expect(schema.validate(base({ mode: "roles", roles: [] }))).rejects.toThrow("dispatch.errors.roles");
    await expect(schema.validate(base({ mode: "list", recipient_ids: [] }))).rejects.toThrow("dispatch.errors.recipients");
    await expect(schema.validate(base({ mode: "all", telegram: true, telegram_market_id: "" }))).rejects.toThrow("dispatch.errors.telegramMarket");
  });
});
