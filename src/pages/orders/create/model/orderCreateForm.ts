import * as yup from "yup";
import type {
  CreateOrderRequest,
  DeliveryType,
  OrderFulfillmentChoice,
  OrderItem,
} from "../../../../entities/order/types/order";
import i18n from "../../../../i18n";

export interface MarketOption {
  id: number;
  name: string;
  phone_number?: string;
  phone?: string;
  status?: "active" | "inactive" | "blocked" | string;
}

/** Mijoz maydonlari — mavjud mijoz bog'lanishida «o'zgarmadimi» shu qiymatlar bo'yicha solishtiriladi. */
export type CustomerFieldValues = OrderCreateFormValues["customer"];

/**
 * TAKLIFDAN TANLANGAN MAVJUD MIJOZ (CS-A, hiqRNhkI). `filled` — tanlangandan keyingi maydonlar (shular
 * o'zgarmasa `customer_id` yuboriladi), `previous` — tanlashdan oldingi qiymatlar («Bekor qilish» qaytaradi).
 * Telefon o'zgarsa bog'lanish uziladi (`null`).
 */
export interface ExistingCustomerLink {
  id: string;
  name: string;
  orders_count: number | null;
  new_orders_count: number;
  new_order_ids: string[];
  last_order_at: string | null;
  filled: CustomerFieldValues;
  previous: CustomerFieldValues;
}

export interface OrderCreateFormValues {
  market: MarketOption | null;
  /** Bog'langan mavjud mijoz (`null` — yangi mijoz yoki taklif tanlanmagan). */
  existingCustomer: ExistingCustomerLink | null;
  /**
   * Yetkazish turi qo'lda tanlanganmi (CS-B). `false` bo'lsa tur market kartasidagi sukut (`default_tariff`) ga
   * moslanadi; qo'lda tanlangani ustidan yozilmaydi. Payload'ga kirmaydi.
   */
  deliveryTypeTouched: boolean;
  /**
   * Sukut turi qaysi market uchun qo'llangan (yoki forma boshlangani uchun ataylab qo'llanmagan) — market id'si.
   * Boshqa market tanlansa (qadamlar orasida ham saqlanadi) yangi marketning sukuti forma boshlangan bo'lsa ham
   * qo'llanadi (IT1YpboR). Payload'ga kirmaydi.
   */
  deliveryDefaultFor: string | null;
  /**
   * «Umumiy summa» mahsulotlar narxidan avtomatik to'ldiriladimi (CS-B). Qo'lda yozilsa `false` — taklif faqat
   * «Mahsulotlar bo'yicha: … · Qo'llash» qatorida turadi, maydon ustidan yozilmaydi. Payload'ga kirmaydi.
   */
  totalPriceAuto: boolean;
  /**
   * 6kHnNH9j: «Qayerdan yuboriladi» — `auto` (sukut: ombor yetsa ombordan, aks holda HQ) yoki `hq` (yaratuvchi HQ'ni
   * tanladi). Faqat manba bloki ko'rinadigan rollarda payload'ga kiradi (`includeFulfillment`).
   */
  fulfillment: OrderFulfillmentChoice;
  customer: {
    phone: string;
    extra_phone: string;
    name: string;
    region_id: string;
    district_id: string;
    address: string;
  };
  details: {
    items: OrderItem[];
    total_price: string;
    where_deliver: DeliveryType;
    operator: string;
    comment: string;
  };
}

export const ORDER_CREATE_DEFAULT_VALUES: OrderCreateFormValues = {
  market: null,
  existingCustomer: null,
  deliveryTypeTouched: false,
  deliveryDefaultFor: null,
  totalPriceAuto: true,
  fulfillment: "auto",
  customer: {
    phone: "",
    extra_phone: "",
    name: "",
    region_id: "",
    district_id: "",
    address: "",
  },
  details: {
    items: [],
    total_price: "",
    where_deliver: "center",
    operator: "",
    comment: "",
  },
};

const marketSchema = yup
  .object({
    id: yup.number().required(),
    name: yup.string().required(),
    phone_number: yup.string().default(""),
    phone: yup.string().default(""),
  })
  .nullable()
  .default(null);

export const createOrderSchema = (requireMarket: boolean = true) =>
  yup
    .object({
      market: requireMarket
        ? marketSchema.required(i18n.t("orders:validationSelectMarket"))
        : marketSchema,
      // Bog'lanish holati (tekshirilmaydi) — `buildCreateOrderPayload` `customer_id` ni shundan oladi.
      existingCustomer: yup.mixed<ExistingCustomerLink>().nullable().default(null),
      // Forma holati (tekshirilmaydi, payload'ga kirmaydi) — CS-B.
      deliveryTypeTouched: yup.boolean().default(false),
      deliveryDefaultFor: yup.string().nullable().default(null),
      totalPriceAuto: yup.boolean().default(true),
      fulfillment: yup.mixed<OrderFulfillmentChoice>().oneOf(["auto", "hq"]).default("auto"),
      customer: yup.object({
        phone: yup
          .string()
          .required(i18n.t("orders:validationPhoneRequired"))
          .matches(/^\d{9}$/, i18n.t("orders:validationPhoneFormat")),
        extra_phone: yup
          .string()
          .default("")
          .test(
            "extra-phone-length",
            i18n.t("orders:validationExtraPhoneFormat"),
            (value) => !value || /^\d{9}$/.test(value),
          ),
        name: yup.string().trim().required(i18n.t("orders:validationCustomerName")),
        region_id: yup.string().required(i18n.t("orders:validationRegion")),
        district_id: yup.string().required(i18n.t("orders:validationDistrict")),
        address: yup.string().trim().default(""),
      }),
      details: yup.object({
        items: yup
          .array()
          .of(
            yup
              .object({
                // #1 — katalog mahsuloti (product_id) YOKI erkin-matnli
                // "maxsus" mahsulot (product_name). Kamida bittasi bo'lishi shart.
                product_id: yup.string().nullable().defined(),
                product_name: yup.string().optional(),
                quantity: yup.number().required().min(1),
              })
              .test(
                "product-id-or-name",
                i18n.t("orders:validationSelectProduct"),
                (item) => Boolean(item?.product_id || item?.product_name),
              ),
          )
          .min(1, i18n.t("orders:validationSelectProduct"))
          .required(),
        total_price: yup
          .string()
          .required(i18n.t("orders:validationTotalPriceRequired"))
          .test("price-entered", i18n.t("orders:validationTotalPriceRequired"), (value) => {
            const amount = (value ?? "").replace(/\D/g, "");
            return amount.length > 0;
          }),
        where_deliver: yup
          .mixed<DeliveryType>()
          .oneOf(["center", "address"])
          .required(),
        operator: yup.string().optional(),
        comment: yup.string().optional(),
      }),
    })
    .test(
      "address-required-for-home-delivery",
      i18n.t("orders:validationAddressRequired"),
      function validateAddressForHomeDelivery(value) {
        if (value?.details?.where_deliver !== "address") return true;
        if (value.customer?.address?.trim()) return true;

        return this.createError({
          path: "customer.address",
          message: i18n.t("orders:validationAddressRequired"),
        });
      },
    )
    .required();

export const orderCreateSchema = createOrderSchema();

// Telefon niqobi formada — `TextInput mode="phone"`; bu yordamchi faqat `formatExtraNumber` uchun.
const stripPhone = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 9);

export const formatPrice = (raw: string): string => {
  const amount = raw.replace(/\D/g, "");
  if (!amount) return "";
  return amount.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export const stripPrice = (value: string): string => value.replace(/\D/g, "");

export const formatExtraNumber = (raw: string): string => {
  const digits = stripPhone(raw);
  if (digits.length < 9) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
};

const sameCustomerFields = (a: CustomerFieldValues, b: CustomerFieldValues) =>
  a.phone === b.phone &&
  a.name.trim() === b.name.trim() &&
  (a.extra_phone ?? "") === (b.extra_phone ?? "") &&
  a.address.trim() === b.address.trim() &&
  a.region_id === b.region_id &&
  a.district_id === b.district_id;

/**
 * Mavjud mijoz bog'langan va uning maydonlari tanlangandan keyin o'zgarmaganmi — shunda buyurtma
 * `customer_id` bilan yuboriladi (identity mijoz kartasini ustidan yozmaydi). O'zgargan bo'lsa — avvalgi yo'l
 * (`customer` obyekti); «Mijoz kartasi ham yangilansinmi?» so'rovi backend bayrog'idan keyin (CS-D).
 */
export const isExistingCustomerUnchanged = (values: Pick<OrderCreateFormValues, "customer" | "existingCustomer">) =>
  values.existingCustomer != null && sameCustomerFields(values.customer, values.existingCustomer.filled);

export const buildCreateOrderPayload = (
  values: OrderCreateFormValues,
  options?: {
    includeMarketId?: boolean;
    /** 6kHnNH9j: manba bloki ko'rinadi — `fulfillment` yuboriladi (aks holda backend sukuti `auto`). */
    includeFulfillment?: boolean;
  },
): CreateOrderRequest => {
  const includeMarketId = options?.includeMarketId ?? true;
  const includeFulfillment = options?.includeFulfillment ?? false;
  const market = values.market;
  const address = values.customer.address.trim();
  const comment = values.details.comment.trim();
  const operator = values.details.operator.trim();

  const existingCustomerId = isExistingCustomerUnchanged(values) ? values.existingCustomer?.id : undefined;

  return {
    ...(includeMarketId && market ? { market_id: String(market.id) } : {}),
    // `customer` obyekti ham qoladi: market/menejer/registrator uchun backend `customer_id` ni doirada tekshiradi,
    // doiradan tashqari bo'lsa obyekt bo'yicha avvalgidek aniqlaydi (403 o'rniga).
    ...(existingCustomerId ? { customer_id: existingCustomerId } : {}),
    customer: {
      name: values.customer.name.trim(),
      phone_number: `+998${values.customer.phone}`,
      district_id: values.customer.district_id,
      ...(values.customer.extra_phone && {
        extra_number: formatExtraNumber(values.customer.extra_phone),
      }),
      ...(address && { address }),
    },
    items: values.details.items,
    district_id: values.customer.district_id,
    region_id: values.customer.region_id,
    total_price: Number(stripPrice(values.details.total_price)),
    where_deliver: values.details.where_deliver,
    ...(address && { address }),
    ...(comment && { comment }),
    ...(operator && { operator }),
    ...(includeFulfillment ? { fulfillment: values.fulfillment === "hq" ? "hq" : "auto" } : {}),
  };
};

/**
 * IR2OHIiN — mahsulotsiz yoki tumansiz buyurtma yaratilmaydi (ega qarori 2026-10-25). Backend ham rad etadi
 * (`POST /orders` 400), forma esa yuborishni o'zi to'xtatadi va sababini aniq aytadi.
 */
export type OrderCreateBlocker = "items" | "district";

/** To'siq → forma maydoni (xato matni shu maydon ostida chiqadi). */
export const ORDER_CREATE_BLOCKER_FIELD = {
  items: "details.items",
  district: "customer.district_id",
} as const satisfies Record<OrderCreateBlocker, string>;

const isOrderItemFilled = (item: Partial<OrderItem> | null | undefined): boolean => {
  if (!item) return false;
  const quantity = Number(item.quantity);
  return Boolean(item.product_id || item.product_name?.trim()) && Number.isInteger(quantity) && quantity >= 1;
};

/** Kamida bitta mahsulot va har qatorda miqdor ≥ 1 (butun) — backend qoidasi bilan bir xil. */
const hasOrderItems = (items: ReadonlyArray<Partial<OrderItem>> | null | undefined): boolean =>
  Array.isArray(items) && items.length > 0 && items.every(isOrderItemFilled);

/** Formadagi to'siqlar (mahsulot, tuman) — «Buyurtma xulosasi» holat qatori shu bo'yicha aniq sababni yozadi. */
export const orderCreateBlockers = (values: {
  customer: Pick<OrderCreateFormValues["customer"], "district_id">;
  details: Pick<OrderCreateFormValues["details"], "items">;
}): OrderCreateBlocker[] => {
  const blockers: OrderCreateBlocker[] = [];
  if (!hasOrderItems(values.details?.items)) blockers.push("items");
  if (!String(values.customer?.district_id ?? "").trim()) blockers.push("district");
  return blockers;
};

/**
 * Faqat mahsulot va/yoki tuman yetishmaydimi — qolgan majburiy maydonlar (telefon, ism, viloyat, summa, manzil …)
 * sxema bo'yicha to'liq bo'lsa to'siqlar qaytadi, aks holda `[]` (holat qatori umumiy «Majburiy maydonlarni …»
 * matnida qoladi — u yerda mahsulot ham aytilgan).
 */
export const pendingOrderCreateBlockers = (
  schema: { isValidSync: (value: unknown) => boolean },
  values: Pick<OrderCreateFormValues, "customer" | "details"> & { market: MarketOption | null },
): OrderCreateBlocker[] => {
  const blockers = orderCreateBlockers(values);
  if (blockers.length === 0) return [];
  const filled = {
    ...values,
    customer: blockers.includes("district") ? { ...values.customer, district_id: "_" } : values.customer,
    details: blockers.includes("items")
      ? { ...values.details, items: [{ product_id: "_", quantity: 1 }] }
      : values.details,
  };
  return schema.isValidSync(filled) ? blockers : [];
};

/**
 * Yuboriladigan payload'dagi to'siqlar — so'rov ketishidan oldingi oxirgi himoya (sxema allaqachon tekshirgan
 * bo'lsa ham). Tuman: buyurtmaniki yoki mijozniki (backend ikkinchisini buyurtmaga yozadi).
 */
export const orderCreatePayloadBlockers = (
  payload: Pick<CreateOrderRequest, "items" | "district_id"> & { customer?: { district_id?: string } | null },
): OrderCreateBlocker[] => {
  const blockers: OrderCreateBlocker[] = [];
  if (!hasOrderItems(payload.items)) blockers.push("items");
  const district = String(payload.district_id ?? "").trim() || String(payload.customer?.district_id ?? "").trim();
  if (!district) blockers.push("district");
  return blockers;
};

/**
 * Backend 400 matnidan to'siq (o'zbekcha, `Elchi-Backend` `libs/common/src/order/order-create-content.ts`):
 * «Buyurtmada kamida bitta mahsulot bo‘lishi kerak», «Mahsulot miqdori (quantity) kamida 1 …», «Buyurtma uchun
 * tuman tanlanmagan». Matnning o'zi forma tepasidagi xatoda o'zgarmasdan ko'rsatiladi; bu — maydonni belgilash uchun.
 */
export const orderCreateBlockersFromMessage = (message: string): OrderCreateBlocker[] => {
  const blockers: OrderCreateBlocker[] = [];
  if (/kamida bitta mahsulot|mahsulot miqdori/i.test(message)) blockers.push("items");
  if (/tuman tanlanmagan/i.test(message)) blockers.push("district");
  return blockers;
};

/** API javobidan ro'yxat: `[]` · `{ data: [] }` · `{ items: [] }` · `{ results: [] }`. */
export const toApiList = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "object" || value === null) return [];
  const record = value as { data?: unknown; items?: unknown; results?: unknown };
  if (Array.isArray(record.data)) return record.data as T[];
  if (Array.isArray(record.items)) return record.items as T[];
  if (Array.isArray(record.results)) return record.results as T[];
  return [];
};

/**
 * Katalog mahsuloti (`product_id`) YOKI erkin-matnli «maxsus» mahsulot (`product_name`, `product_id = null`)
 * uchun yagona kalit — bo'sh katalogli marketga ham buyurtma yaratish mumkin.
 */
export const orderItemKey = (item: OrderItem): string => item.product_id ?? `name:${item.product_name ?? ""}`;
