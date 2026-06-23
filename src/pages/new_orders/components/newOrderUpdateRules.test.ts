import { describe, expect, it } from "vitest";
import {
  buildAddressUpdatePayload,
  buildCustomerUpdatePayload,
  buildOrderUpdatePayload,
  getAddressUpdateValidationError,
  getCustomerUpdateValidationError,
  isActionableOrderStatus,
  isOrderReceivedOrLater,
  isOrderSentToBranch,
  normalizeOrderStatus,
  parseOrderTotalPrice,
  type EditableOrderSnapshot,
} from "./newOrderUpdateRules";

const order: EditableOrderSnapshot = {
  status: "received",
  where_deliver: "center",
  total_price: 100_000,
  comment: "old",
  address: "Old address",
  district_id: "district-1",
  district: { id: "district-1", region_id: "region-1" },
  items: [
    { id: "item-1", quantity: 1, product: { id: "product-1" } },
  ],
  customer: { name: "Ali", phone_number: "+998901234567" },
};

describe("new order update rules", () => {
  it("locks products from received and destination after branch transfer", () => {
    expect(isOrderReceivedOrLater("RECEIVED")).toBe(true);
    expect(isOrderReceivedOrLater("new")).toBe(false);
    expect(isOrderSentToBranch({ ...order, status: "on_the_road" })).toBe(true);
    expect(isOrderSentToBranch({ ...order, status: "received" })).toBe(false);
    expect(isOrderSentToBranch({ ...order, status: "received", batch_id: "batch-1" })).toBe(true);
    expect(isOrderReceivedOrLater("partly_paid")).toBe(true);
    expect(isOrderSentToBranch({ ...order, status: "cancelled_sent" })).toBe(true);
  });

  it("normalizes backend status variants for labels and actions", () => {
    expect(normalizeOrderStatus(" ON_THE_ROAD ")).toBe("on the road");
    expect(normalizeOrderStatus("on   the road")).toBe("on the road");
    expect(normalizeOrderStatus("CANCELLED_SENT")).toBe("cancelled (sent)");
    expect(isActionableOrderStatus("on_the_road")).toBe(true);
    expect(isActionableOrderStatus("ON THE ROAD")).toBe(true);
    expect(isActionableOrderStatus("sold")).toBe(false);
  });

  it("sends only changed unlocked order fields", () => {
    expect(
      buildOrderUpdatePayload(
        order,
        {
          where_deliver: "center",
          total_price: "100000",
          comment: "old",
          items: order.items,
        },
        { products: false, destination: false },
      ),
    ).toEqual({});

    expect(
      buildOrderUpdatePayload(
        order,
        {
          where_deliver: "address",
          total_price: "200000",
          comment: "new",
          items: [{ id: "item-1", quantity: 2, product: { id: "product-1" } }],
        },
        { products: true, destination: true },
      ),
    ).toEqual({ comment: "new" });

    expect(
      buildOrderUpdatePayload(
        order,
        {
          where_deliver: "address",
          total_price: "200000",
          comment: "old",
          items: [{ id: "item-1", quantity: 2, product: { id: "product-1" } }],
        },
        { products: false, destination: false },
      ),
    ).toEqual({
      where_deliver: "address",
      total_price: 200000,
      items: [{ product_id: "product-1", quantity: 2 }],
    });
  });

  it("requires an explicit valid total amount while allowing zero", () => {
    expect(parseOrderTotalPrice("")).toBeNull();
    expect(parseOrderTotalPrice("   ")).toBeNull();
    expect(parseOrderTotalPrice("not-a-number")).toBeNull();
    expect(parseOrderTotalPrice("-1")).toBeNull();
    expect(parseOrderTotalPrice("0")).toBe(0);
    expect(parseOrderTotalPrice("150000")).toBe(150000);

    expect(
      buildOrderUpdatePayload(
        order,
        {
          where_deliver: order.where_deliver,
          total_price: "",
          comment: order.comment ?? "",
          items: order.items,
        },
        { products: false, destination: false },
      ),
    ).not.toHaveProperty("total_price");
  });

  it("builds changed-only customer and address payloads", () => {
    expect(
      buildAddressUpdatePayload(order, {
        region_id: "region-1",
        district_id: "district-2",
        address: "Old address",
      }),
    ).toEqual({ district_id: "district-2" });

    expect(buildCustomerUpdatePayload(order, {
      name: " Ali ",
      phone: "+998 90 999 99 99",
    })).toEqual({ phone_number: "+998909999999" });
  });

  it("validates required customer and address fields", () => {
    expect(getAddressUpdateValidationError({ region_id: "", district_id: "district-1" })).toBe("region");
    expect(getAddressUpdateValidationError({ region_id: "region-1", district_id: "" })).toBe("district");
    expect(getAddressUpdateValidationError({ region_id: "region-1", district_id: "district-1" })).toBeNull();

    expect(getCustomerUpdateValidationError({ name: "   ", phone: "+998901234567" })).toBe("name");
    expect(getCustomerUpdateValidationError({ name: "Ali", phone: "" })).toBe("phoneRequired");
    expect(getCustomerUpdateValidationError({ name: "Ali", phone: "90123" })).toBe("phoneFormat");
    expect(getCustomerUpdateValidationError({ name: "Ali", phone: "+998 90 123 45 67" })).toBeNull();

    expect(buildAddressUpdatePayload(order, {
      region_id: "",
      district_id: "district-1",
      address: "New address",
    })).toEqual({});
    expect(buildCustomerUpdatePayload(order, {
      name: "",
      phone: "+998 90 999 99 99",
    })).toEqual({});
  });

});
