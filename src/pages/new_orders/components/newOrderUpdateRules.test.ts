import { describe, expect, it } from "vitest";
import {
  buildAddressUpdatePayload,
  buildCustomerUpdatePayload,
  buildOrderUpdatePayload,
  getBackend400Message,
  isOrderReceivedOrLater,
  isOrderSentToBranch,
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

  it("builds changed-only customer and address payloads", () => {
    expect(
      buildAddressUpdatePayload(order, {
        region_id: "region-1",
        district_id: "district-2",
        address: "Old address",
      }),
    ).toEqual({ district_id: "district-2" });

    expect(buildCustomerUpdatePayload(order, {
      name: "Ali",
      phone: "+998909999999",
    })).toEqual({ phone_number: "+998909999999" });
  });

  it("extracts only backend 400 message", () => {
    expect(getBackend400Message({
      response: { status: 400, data: { message: "Locked by backend" } },
    })).toBe("Locked by backend");
    expect(getBackend400Message({
      response: { status: 500, data: { message: "Internal" } },
    })).toBeNull();
  });
});
