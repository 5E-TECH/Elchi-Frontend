import { describe, expect, it } from "vitest";
import {
  buildCreateOrderPayload,
  createOrderSchema,
  isExistingCustomerUnchanged,
  ORDER_CREATE_DEFAULT_VALUES,
  orderCreateBlockers,
  orderCreateBlockersFromMessage,
  orderCreatePayloadBlockers,
  pendingOrderCreateBlockers,
  type OrderCreateFormValues,
} from "./orderCreateForm";

const validBaseValues = (whereDeliver: OrderCreateFormValues["details"]["where_deliver"]) => ({
  ...ORDER_CREATE_DEFAULT_VALUES,
  customer: {
    ...ORDER_CREATE_DEFAULT_VALUES.customer,
    phone: "901234567",
    name: "Mijoz",
    region_id: "region-1",
    district_id: "district-1",
  },
  details: {
    ...ORDER_CREATE_DEFAULT_VALUES.details,
    items: [{ product_id: "product-1", quantity: 1 }],
    total_price: "100000",
    where_deliver: whereDeliver,
  },
});

describe("createOrderSchema", () => {
  it("allows center delivery without address", async () => {
    await expect(
      createOrderSchema(false).validate(validBaseValues("center"), { abortEarly: false }),
    ).resolves.toBeTruthy();
  });

  it("requires address only for home delivery", async () => {
    try {
      await createOrderSchema(false).validate(validBaseValues("address"), {
        abortEarly: false,
      });
      throw new Error("Expected schema to reject missing address");
    } catch (error) {
      const validationError = error as { inner?: Array<{ path?: string }> };
      expect(validationError.inner?.some((item) => item.path === "customer.address")).toBe(true);
    }
  });
});

describe("buildCreateOrderPayload", () => {
  const formValues: OrderCreateFormValues = {
    market: {
      id: 42,
      name: "Market",
      phone_number: "+998901112233",
      status: "active",
    },
    existingCustomer: null,
    deliveryTypeTouched: true,
    deliveryDefaultFor: null,
    totalPriceAuto: false,
    fulfillment: "auto",
    customer: {
      phone: "901234567",
      extra_phone: "991112233",
      name: "  Mijoz  ",
      region_id: "region-1",
      district_id: "district-1",
      address: "  Toshkent, Yunusobod  ",
    },
    details: {
      items: [
        { product_id: "product-1", quantity: 2 },
        { product_id: "product-2", quantity: 1 },
      ],
      total_price: "1 250 000",
      where_deliver: "address",
      operator: "  Operator  ",
      comment: "  Izoh  ",
    },
  };

  it("includes market_id for manager/admin order creation", () => {
    expect(buildCreateOrderPayload(formValues, { includeMarketId: true })).toMatchObject({
      market_id: "42",
      customer: {
        name: "Mijoz",
        phone_number: "+998901234567",
        district_id: "district-1",
        extra_number: "99-111-22-33",
        address: "Toshkent, Yunusobod",
      },
      district_id: "district-1",
      region_id: "region-1",
      total_price: 1250000,
      where_deliver: "address",
      address: "Toshkent, Yunusobod",
      comment: "Izoh",
      operator: "Operator",
    });
  });

  it("omits market_id for market role order creation", () => {
    const payload = buildCreateOrderPayload(formValues, { includeMarketId: false });

    expect(payload).not.toHaveProperty("market_id");
  });

  it("omits optional empty fields from payload", () => {
    const payload = buildCreateOrderPayload(
      {
        ...formValues,
        customer: {
          ...formValues.customer,
          extra_phone: "",
          address: "",
        },
        details: {
          ...formValues.details,
          where_deliver: "center",
          operator: "",
          comment: "",
        },
      },
      { includeMarketId: true },
    );

    expect(payload.customer).not.toHaveProperty("extra_number");
    expect(payload.customer).not.toHaveProperty("address");
    expect(payload).not.toHaveProperty("address");
    expect(payload).not.toHaveProperty("comment");
    expect(payload).not.toHaveProperty("operator");
  });

  // 6kHnNH9j: manba bloki ko'rinadigan rollarda `fulfillment` (auto | hq), qolganlarida — yuborilmaydi (backend `auto`).
  it("fulfillment: faqat includeFulfillment bilan, tanlov — auto yoki hq", () => {
    expect(buildCreateOrderPayload(formValues, { includeMarketId: true })).not.toHaveProperty("fulfillment");
    expect(buildCreateOrderPayload(formValues, { includeMarketId: true, includeFulfillment: true })).toMatchObject({
      fulfillment: "auto",
    });
    expect(
      buildCreateOrderPayload({ ...formValues, fulfillment: "hq" }, { includeMarketId: true, includeFulfillment: true }),
    ).toMatchObject({ fulfillment: "hq" });
  });
});

describe("buildCreateOrderPayload — mavjud mijoz (CS-A, hiqRNhkI)", () => {
  const base = validBaseValues("center");
  const linked = (customer = base.customer): OrderCreateFormValues => ({
    ...base,
    existingCustomer: {
      id: "55",
      name: "Mijoz",
      orders_count: 4,
      new_orders_count: 0,
      new_order_ids: [],
      last_order_at: null,
      filled: { ...customer },
      previous: { ...ORDER_CREATE_DEFAULT_VALUES.customer },
    },
  });

  it("bog'lanmagan mijoz — `customer_id` yo'q", () => {
    expect(buildCreateOrderPayload(base)).not.toHaveProperty("customer_id");
  });

  it("bog'langan va o'zgarmagan — `customer_id` va `customer` obyekti birga", () => {
    const values = linked();
    expect(isExistingCustomerUnchanged(values)).toBe(true);
    const payload = buildCreateOrderPayload(values);
    expect(payload.customer_id).toBe("55");
    expect(payload.customer).toMatchObject({ name: "Mijoz", phone_number: "+998901234567", district_id: "district-1" });
  });

  it("bo'sh joy farqi o'zgarish emas; ism, tuman yoki qo'shimcha raqam o'zgarsa — `customer_id` yuborilmaydi", () => {
    const values = linked();
    expect(isExistingCustomerUnchanged({ ...values, customer: { ...values.customer, name: " Mijoz " } })).toBe(true);
    for (const patch of [{ name: "Boshqa" }, { district_id: "district-2" }, { extra_phone: "991234567" }, { address: "Yangi" }]) {
      const changed = { ...values, customer: { ...values.customer, ...patch } };
      expect(isExistingCustomerUnchanged(changed), JSON.stringify(patch)).toBe(false);
      expect(buildCreateOrderPayload(changed), JSON.stringify(patch)).not.toHaveProperty("customer_id");
    }
  });

  it("sxema bog'lanish holatini tekshirmaydi (yuborishga tayyorlikka ta'sir qilmaydi)", async () => {
    await expect(createOrderSchema(false).validate(linked(), { abortEarly: false })).resolves.toBeTruthy();
  });
});

describe("IR2OHIiN — mahsulotsiz va tumansiz buyurtma to'siqlari", () => {
  const complete: OrderCreateFormValues = validBaseValues("center");
  const withItems = (items: OrderCreateFormValues["details"]["items"]): OrderCreateFormValues => ({
    ...complete,
    details: { ...complete.details, items },
  });
  const withDistrict = (district_id: string): OrderCreateFormValues => ({
    ...complete,
    customer: { ...complete.customer, district_id },
  });

  it("orderCreateBlockers: to'liq forma — to'siq yo'q; mahsulot / tuman / miqdor 0 — to'siq", () => {
    expect(orderCreateBlockers(complete)).toEqual([]);
    expect(orderCreateBlockers(withItems([]))).toEqual(["items"]);
    expect(orderCreateBlockers(withItems([{ product_id: "p1", quantity: 0 }]))).toEqual(["items"]);
    expect(orderCreateBlockers(withItems([{ product_id: null, product_name: "  ", quantity: 1 }]))).toEqual(["items"]);
    expect(orderCreateBlockers(withItems([{ product_id: null, product_name: "Kitob", quantity: 2 }]))).toEqual([]);
    expect(orderCreateBlockers(withDistrict(""))).toEqual(["district"]);
    expect(orderCreateBlockers({ ...withItems([]), customer: { ...complete.customer, district_id: "" } })).toEqual([
      "items",
      "district",
    ]);
  });

  it("pendingOrderCreateBlockers: faqat mahsulot / tuman yetishmasa qaytadi, boshqa maydon ham bo'sh bo'lsa — []", () => {
    const schema = createOrderSchema(false);
    const values = (v: OrderCreateFormValues) => ({ ...v, market: null });
    expect(pendingOrderCreateBlockers(schema, values(complete))).toEqual([]);
    expect(pendingOrderCreateBlockers(schema, values(withItems([])))).toEqual(["items"]);
    expect(pendingOrderCreateBlockers(schema, values(withDistrict("")))).toEqual(["district"]);
    // Telefon ham yo'q — umumiy matn qoladi.
    expect(
      pendingOrderCreateBlockers(schema, values({ ...withItems([]), customer: { ...complete.customer, phone: "" } })),
    ).toEqual([]);
    expect(pendingOrderCreateBlockers(schema, values(ORDER_CREATE_DEFAULT_VALUES))).toEqual([]);
  });

  it("orderCreatePayloadBlockers: payload'da mahsulot va tuman (buyurtma yoki mijozdagi) shart", () => {
    const payload = buildCreateOrderPayload(complete, { includeMarketId: false });
    expect(orderCreatePayloadBlockers(payload)).toEqual([]);
    expect(orderCreatePayloadBlockers({ ...payload, items: [] })).toEqual(["items"]);
    expect(orderCreatePayloadBlockers({ ...payload, items: [{ product_id: "p1", quantity: 0 }] })).toEqual(["items"]);
    expect(orderCreatePayloadBlockers({ ...payload, district_id: "" })).toEqual([]);
    expect(
      orderCreatePayloadBlockers({ ...payload, district_id: "", customer: { ...payload.customer, district_id: "" } }),
    ).toEqual(["district"]);
  });

  it("orderCreateBlockersFromMessage: backend 400 matnlari (apostrof turidan qat'i nazar)", () => {
    expect(orderCreateBlockersFromMessage("Buyurtmada kamida bitta mahsulot bo‘lishi kerak")).toEqual(["items"]);
    expect(orderCreateBlockersFromMessage("Buyurtmada kamida bitta mahsulot bo'lishi kerak")).toEqual(["items"]);
    expect(
      orderCreateBlockersFromMessage("Mahsulot miqdori (quantity) kamida 1 va butun son bo‘lishi kerak"),
    ).toEqual(["items"]);
    expect(orderCreateBlockersFromMessage("Buyurtma uchun tuman tanlanmagan")).toEqual(["district"]);
    expect(
      orderCreateBlockersFromMessage("Buyurtmada kamida bitta mahsulot bo‘lishi kerak, Buyurtma uchun tuman tanlanmagan"),
    ).toEqual(["items", "district"]);
    expect(orderCreateBlockersFromMessage("Telefon noto'g'ri")).toEqual([]);
  });
});
