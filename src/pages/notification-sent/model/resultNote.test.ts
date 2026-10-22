import type { SentListItem } from "../../../entities/notification-dispatch";
import { requestedChannels, resultNote } from "./resultNote";

const item = (overrides: Partial<SentListItem>): SentListItem => ({
  dispatch_id: "d1",
  status: "sent",
  type: "system.manual",
  title: "Xabar",
  body_preview: null,
  channels: ["in_app", "realtime", "telegram"],
  recipients: 10,
  dispatched: 10,
  skipped_by_preference: 0,
  by_channel: {},
  channel_status: null,
  no_provider: [],
  audience: null,
  created_by: null,
  created_at: null,
  finished_at: null,
  ...overrides,
});

describe("resultNote (the line under the «Natija» badge)", () => {
  it("running, failed and sent", () => {
    expect(resultNote(item({ status: "running" }))).toEqual([{ kind: "running" }]);
    expect(resultNote(item({ status: "failed" }))).toEqual([{ kind: "failed" }]);
    expect(resultNote(item({ status: "sent", channel_status: { telegram: { queued: 4 } } }))).toEqual([]);
  });

  it("skipped — how many turned notifications off", () => {
    expect(resultNote(item({ status: "skipped", skipped_by_preference: 3 }))).toEqual([{ kind: "muted", value: 3 }]);
    expect(resultNote(item({ status: "skipped" }))).toEqual([]);
  });

  it("partial — skipped / failed counts per channel in the mockup order", () => {
    expect(
      resultNote(
        item({
          status: "partial",
          channels: ["in_app", "sms", "telegram"],
          channel_status: {
            in_app: { sent: 148 },
            sms: { queued: 139, skipped: 9 },
            telegram: { queued: 131, skipped: 17, failed: 2 },
          },
        }),
      ),
    ).toEqual([
      { kind: "failedChannels", counts: [["telegram", 2]] },
      { kind: "skippedChannels", counts: [["telegram", 17], ["sms", 9]] },
    ]);
  });

  it("provider not connected wins over that channel's counts", () => {
    expect(
      resultNote(
        item({
          status: "inbox_only",
          channels: ["in_app", "sms"],
          no_provider: ["sms"],
          channel_status: { sms: { no_provider: 12, skipped: 1 } },
        }),
      ),
    ).toEqual([{ kind: "noProvider", channels: ["sms"] }]);
    expect(resultNote(item({ status: "partial", channels: ["in_app", "push"], channel_status: { push: { no_provider: 3 } } }))).toEqual([
      { kind: "noProvider", channels: ["push"] },
    ]);
  });

  it("partial without a snapshot falls back to muted recipients, else nothing", () => {
    expect(resultNote(item({ status: "partial", skipped_by_preference: 2 }))).toEqual([{ kind: "muted", value: 2 }]);
    expect(resultNote(item({ status: "inbox_only" }))).toEqual([]);
  });

  it("channel chips: external channels only, in order", () => {
    expect(requestedChannels({ channels: ["sms", "in_app", "email", "realtime", "push"] })).toEqual(["realtime", "sms", "push"]);
  });
});
