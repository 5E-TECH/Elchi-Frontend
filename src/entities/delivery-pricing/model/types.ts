/**
 * YETKAZISH NARXI (backend DAqXPeSy, logistics `delivery-pricing`). Formula — elchipochta.uz kalkulyatori bilan
 * AYNI: hajmli vazn U×K×B / 5000, hisob vazni 0,1 kg qadam bilan yuqoriga, birinchi kg(lar) asosiy narxda, har
 * qo'shimcha kg — tarif narxi, jami `round_to` (500) ga karrali. Narxni server hisoblaydi — UI faqat ko'rsatadi
 * (`total` qayta yaxlitlanmaydi).
 */

/** Tarif kodlari — `POST /delivery/quote/by-tariff` javobidagi `quotes` kalitlari bilan bir xil. */
export const DELIVERY_TARIFF_IDS = ["city", "center", "address"] as const;
export type DeliveryTariffId = (typeof DELIVERY_TARIFF_IDS)[number];

/** Narx so'rovi elementi — to'g'ridan o'lchov (mahsulot formasi, kalkulyator). */
export type DeliveryMeasureItem = {
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volumetric_enabled: boolean;
};

/** `POST /delivery/quote/by-tariff` tanasi. */
export type DeliveryQuoteByTariffRequest = {
  items: DeliveryMeasureItem[];
  express?: boolean;
};

/** Bitta tarif bo'yicha hisob (`DeliveryQuoteResultDto` dan UI'ga kerakli qismi). */
export type DeliveryQuote = {
  tariffId: DeliveryTariffId;
  /** Asosiy narx (birinchi kg(lar) kiradi), so'm. */
  base: number;
  /** Har qo'shimcha kg narxi, so'm. */
  perExtraKg: number;
  actualKg: number;
  volumetricKg: number;
  /** Hisob vazni, kg (0,1 kg qadam). */
  billableKg: number;
  /** Asosiy narxdan ortiq to'liq kg soni. */
  extraKg: number;
  extra: number;
  /** Buyurtmaga yoziladigan narx — `round_to` ga karrali (UI qayta yaxlitlamaydi). */
  total: number;
  basis: "weight" | "volume" | null;
  daysMin: number | null;
  daysMax: number | null;
};

/** Uchala tarif: faol versiyasi yo'q tarif — `null`. */
export type DeliveryQuotesByTariff = Record<DeliveryTariffId, DeliveryQuote | null>;

/** `GET /delivery/pricing-settings` — faol versiya (faqat superadmin, admin). */
export type DeliveryPricingSettings = {
  id: string;
  /** Hajmli vazn bo'luvchisi — doimiy (ega qarori, 5000), UI faqat ko'rsatadi. */
  volumetricDivisor: number;
  /** Asosiy narxga kiradigan og'irlik (qo'shimcha haq chegarasi), kg. */
  firstKgIncluded: number;
  minBillableKg: number;
  billableStepKg: number;
  /** Jami shu songa karrali, so'm. */
  roundTo: number;
  pickupFee: number;
  /** `null` — pickup hech qachon tekin emas. */
  pickupFreeFromCount: number | null;
  expressMultiplier: number;
};
