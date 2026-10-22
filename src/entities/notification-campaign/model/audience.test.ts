import { describe, expect, it } from "vitest";
import {
  audienceGate,
  audienceSegmentPayload,
  createAudienceDraft,
  draftFromSavedAudience,
  isAudienceSegmentEmpty,
  toAudienceTarget,
  type AudienceDraft,
} from "./audience";

const draft = (patch: Partial<AudienceDraft>): AudienceDraft => ({
  ...createAudienceDraft(),
  ...patch,
});

describe("audienceGate / toAudienceTarget (KM-2)", () => {
  it("nothing chosen — no target, «noKind»", () => {
    expect(audienceGate(createAudienceDraft())).toBe("noKind");
    expect(toAudienceTarget(createAudienceDraft())).toBeNull();
  });

  it("staff without a role is not ready; roles keep a stable order, market first", () => {
    expect(audienceGate(draft({ kinds: ["staff"] }))).toBe("noStaffRole");
    expect(
      toAudienceTarget(draft({ kinds: ["staff", "market"], staffRoles: ["logist", "admin"] })),
    ).toEqual({
      roles: ["market", "admin", "logist"],
    });
  });

  it("customers without a filter are NEVER sent bare — only with an explicit «all customers» tick", () => {
    expect(audienceGate(draft({ kinds: ["customer"] }))).toBe("needsCustomerFilter");
    expect(toAudienceTarget(draft({ kinds: ["customer", "market"] }))).toBeNull();
    expect(toAudienceTarget(draft({ kinds: ["customer"], allCustomers: true }))).toEqual({
      include_customers: true,
      confirm_all_customers: true,
    });
  });

  it("a customer filter goes as `segment` (Tashkent midnight bounds), without confirm_all_customers", () => {
    expect(
      toAudienceTarget(
        draft({
          kinds: ["customer"],
          allCustomers: true,
          customerSegment: {
            region_id: "5",
            last_order_from: "2026-07-01",
            last_order_to: "2026-09-30",
            min_orders: 2,
            max_orders: 10,
          },
        }),
      ),
    ).toEqual({
      include_customers: true,
      segment: {
        region_id: "5",
        last_order_from: "2026-07-01T00:00:00+05:00",
        last_order_to: "2026-10-01T00:00:00+05:00",
        min_orders: 2,
        max_orders: 10,
      },
    });
  });

  it("customer filters are not sent when «Mijoz» is not chosen", () => {
    expect(
      toAudienceTarget(draft({ kinds: ["market"], customerSegment: { region_id: "5" } })),
    ).toEqual({
      roles: ["market"],
    });
  });

  it("an inverted orders range blocks the request", () => {
    const inverted = draft({
      kinds: ["customer"],
      customerSegment: { min_orders: 10, max_orders: 2 },
    });
    expect(audienceGate(inverted)).toBe("invertedRange");
    expect(toAudienceTarget(inverted)).toBeNull();
  });
});

describe("draftFromSavedAudience", () => {
  it("restores kinds, staff roles and the customer segment (last day back from the strict bound)", () => {
    expect(
      draftFromSavedAudience({
        roles: ["market", "manager", "logist", "superadmin"],
        broadcast: true,
        include_customers: true,
        segment: {
          region_id: "1",
          district_id: 11,
          last_order_from: "2026-07-01T00:00:00+05:00",
          last_order_to: "2026-10-01T00:00:00+05:00",
          min_orders: 2,
          max_orders: "10",
        },
      }),
    ).toEqual({
      kinds: ["customer", "market", "staff"],
      staffRoles: ["manager", "logist"],
      customerSegment: {
        region_id: "1",
        district_id: "11",
        last_order_from: "2026-07-01",
        last_order_to: "2026-09-30",
        min_orders: 2,
        max_orders: 10,
      },
      allCustomers: false,
    });
  });

  it("all customers and garbage input", () => {
    expect(
      draftFromSavedAudience({ include_customers: true, confirm_all_customers: true }),
    ).toEqual({
      kinds: ["customer"],
      staffRoles: [],
      customerSegment: {},
      allCustomers: true,
    });
    expect(draftFromSavedAudience(null)).toEqual(createAudienceDraft());
  });

  it("round-trips through toAudienceTarget", () => {
    const original = draft({
      kinds: ["customer", "staff"],
      staffRoles: ["courier"],
      customerSegment: { district_id: "41", last_order_to: "2026-09-30" },
    });
    expect(draftFromSavedAudience(toAudienceTarget(original))).toEqual(original);
  });

  it("«dan 1» is not a customer filter (the backend ignores min_orders ≤ 1) — «Filtrsiz» is still required", () => {
    const onlyOne = draft({ kinds: ["customer"], customerSegment: { min_orders: 1 } });
    expect(audienceGate(onlyOne)).toBe("needsCustomerFilter");
    expect(toAudienceTarget(onlyOne)).toBeNull();
    expect(isAudienceSegmentEmpty(onlyOne.customerSegment)).toBe(true);
    expect(toAudienceTarget({ ...onlyOne, allCustomers: true })).toEqual({
      include_customers: true,
      confirm_all_customers: true,
    });
    expect(
      toAudienceTarget(draft({ kinds: ["customer"], customerSegment: { min_orders: 1, max_orders: 5 } })),
    ).toEqual({ include_customers: true, segment: { max_orders: 5 } });
    expect(audienceSegmentPayload({ min_orders: 2 })).toEqual({ min_orders: 2 });
  });
});
