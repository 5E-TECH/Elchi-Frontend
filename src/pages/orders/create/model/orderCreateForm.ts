import * as yup from "yup";
import type { CreateOrderRequest, DeliveryType, OrderItem } from "../../../../entities/order/types/order";

export interface MarketOption {
  id: number;
  name: string;
  phone_number?: string;
  phone?: string;
}

export interface OrderCreateFormValues {
  market: MarketOption | null;
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
        ? marketSchema.required("Davom etish uchun avval market tanlang")
        : marketSchema,
      customer: yup.object({
        phone: yup
          .string()
          .required("Mijozning telefon raqamini kiriting")
          .matches(/^\d{9}$/, "Telefon raqam 9 ta raqamdan iborat bo'lishi kerak"),
        extra_phone: yup
          .string()
          .default("")
          .test(
            "extra-phone-length",
            "Qo'shimcha raqam kiritilsa, u 9 ta raqamdan iborat bo'lishi kerak",
            (value) => !value || /^\d{9}$/.test(value),
          ),
        name: yup.string().trim().required("Mijoz ismini kiriting"),
        region_id: yup.string().required("Viloyatni tanlang"),
        district_id: yup.string().required("Tumanni tanlang"),
        address: yup.string().trim().default(""),
      }),
      details: yup.object({
        items: yup
          .array()
          .of(
            yup.object({
              product_id: yup.string().required(),
              quantity: yup.number().required().min(1),
            }),
          )
          .min(1, "Kamida bitta mahsulot tanlang")
          .required(),
        total_price: yup
          .string()
          .required("Buyurtmaning umumiy summasini kiriting")
          .test("positive-price", "Umumiy summa 0 dan katta bo'lishi kerak", (value) => {
            const amount = Number((value ?? "").replace(/\D/g, ""));
            return amount > 0;
          }),
        where_deliver: yup
          .mixed<DeliveryType>()
          .oneOf(["center", "address"])
          .required(),
        operator: yup.string().optional(),
        comment: yup.string().optional(),
      }),
    })
    .required();

export const orderCreateSchema = createOrderSchema();

export const stripPhone = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 9);

export const formatPhone = (raw: string): string => {
  const digits = stripPhone(raw);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 7) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
};

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

export const buildCreateOrderPayload = (
  values: OrderCreateFormValues,
  options?: {
    includeMarketId?: boolean;
  },
): CreateOrderRequest => {
  const includeMarketId = options?.includeMarketId ?? true;
  const market = values.market;
  const address = values.customer.address.trim();
  const comment = values.details.comment.trim();
  const operator = values.details.operator.trim();

  return {
    ...(includeMarketId && market ? { market_id: String(market.id) } : {}),
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
  };
};
