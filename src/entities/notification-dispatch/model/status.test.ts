import { TriangleAlert } from "lucide-react";
import {
  DELIVERY_META,
  bucketCounts,
  channelBadge,
  deliveryBucket,
  deriveDispatchStatus,
  externalChannels,
  failureBadge,
  isDispatchLive,
} from "./status";

describe("notification-dispatch status (ega S3 ranglari)", () => {
  it("maps backend delivery statuses to buckets; unknown statuses are not counted", () => {
    expect(deliveryBucket("sent")).toBe("sent");
    expect(deliveryBucket("emitted")).toBe("sent");
    expect(deliveryBucket("queued")).toBe("queued");
    expect(deliveryBucket("pending")).toBe("queued");
    expect(deliveryBucket("accepted")).toBe("queued");
    expect(deliveryBucket("failed")).toBe("failed");
    expect(deliveryBucket("no_provider")).toBe("no_provider");
    for (const status of ["skipped", "not_eligible", "no_subscription", "blocked"]) {
      expect(deliveryBucket(status)).toBe("skipped");
    }
    expect(deliveryBucket("something_new")).toBeNull();
    expect(bucketCounts({ queued: 131, skipped: 17, something_new: 4, failed: -1 })).toEqual({
      sent: 0,
      queued: 131,
      failed: 0,
      skipped: 17,
      no_provider: 0,
    });
  });

  it("channel badge: queued wins (yellow), a single bucket is itself, sent + failures is «Qisman»", () => {
    expect(channelBadge(bucketCounts({ queued: 131, skipped: 17 }))).toMatchObject({
      tone: "warning",
      labelKey: "dispatch.delivery.queued",
    });
    expect(channelBadge(bucketCounts({ emitted: 148 }))).toMatchObject({
      tone: "success",
      labelKey: "dispatch.delivery.sent",
    });
    expect(channelBadge(bucketCounts({ sent: 125, failed: 6, skipped: 17 }))).toMatchObject({
      tone: "warning",
      labelKey: "dispatch.delivery.partial",
    });
    expect(channelBadge(bucketCounts({ no_provider: 12 }))).toMatchObject({
      tone: "neutral",
      labelKey: "dispatch.delivery.no_provider",
    });
    expect(channelBadge(bucketCounts({ failed: 2, skipped: 1 }))).toMatchObject({ tone: "danger" });
    expect(channelBadge(bucketCounts({}))).toBeNull();
    // «O'tkazib yuborildi» hech qachon yashil emas.
    expect(failureBadge("skipped")).toMatchObject({ tone: "neutral" });
    expect(failureBadge("failed")).toMatchObject({ tone: "danger" });
    expect(failureBadge("no_provider")).toMatchObject({ labelKey: "dispatch.delivery.no_provider" });
  });

  it("derives the status of a fresh dispatch the same way the backend writes history", () => {
    const base = { dispatched: 10, skipped_by_preference: 0 };
    expect(deriveDispatchStatus({ ...base, channels: ["in_app"], by_channel: { in_app: 10 } })).toBe("sent");
    expect(
      deriveDispatchStatus({ ...base, channels: ["in_app", "telegram", "sms"], by_channel: { telegram: 8, sms: 3 } }),
    ).toBe("sent");
    expect(
      deriveDispatchStatus({ ...base, channels: ["in_app", "telegram", "sms"], by_channel: { telegram: 8, sms: 0 } }),
    ).toBe("partial");
    expect(deriveDispatchStatus({ ...base, channels: ["in_app", "sms"], by_channel: { sms: 0 } })).toBe("inbox_only");
    expect(
      deriveDispatchStatus({ dispatched: 0, skipped_by_preference: 4, channels: ["in_app", "sms"], by_channel: {} }),
    ).toBe("skipped");
  });

  it("external channels keep the mockup order and drop in_app / email", () => {
    expect(externalChannels(["in_app", "sms", "telegram"], { push: { queued: 1 }, email: { no_provider: 1 } })).toEqual([
      "telegram",
      "sms",
      "push",
    ]);
  });

  it("is live while running or while an external channel is still queued", () => {
    expect(isDispatchLive("running", null)).toBe(true);
    expect(isDispatchLive("partial", { telegram: { queued: 1, sent: 3 } })).toBe(true);
    expect(isDispatchLive("sent", { in_app: { pending: 1 }, telegram: { sent: 4 } })).toBe(false);
    expect(isDispatchLive("failed", null)).toBe(false);
  });
  it("«Provayder ulanmagan» — neutral tone with the warning triangle (maket send-result, inbox-only)", () => {
    expect(DELIVERY_META.no_provider.tone).toBe("neutral");
    expect(DELIVERY_META.no_provider.icon).toBe(TriangleAlert);
  });
});
