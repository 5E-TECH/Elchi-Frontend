import { describe, expect, it } from "vitest";
import { buildDispatchPayload, createDefaultValues } from "./schema";

describe("dispatch channels", () => {
  it("SMS and push are off by default and added when ticked", () => {
    const base = { ...createDefaultValues(), title: "Salom", recipient_id: "7" };
    expect(buildDispatchPayload(base).channels).toEqual(["in_app", "realtime"]);
    expect(buildDispatchPayload({ ...base, sms: true, push: true }).channels).toEqual(["in_app", "realtime", "sms", "push"]);
  });
});
