/**
 * Mijoz taklifi — `GET customers/suggest` (backend `CustomerSuggestion`, hiqRNhkI).
 *
 * Doira backendda: superadmin/admin — barcha mijozlar (`market_id` berilsa son shu market bo'yicha); market,
 * menejer, registrator — faqat shu marketda buyurtmasi bor mijozlar. Javob — oq ro'yxatdagi maydonlar.
 */
export interface CustomerSuggestion {
  id: string;
  name: string | null;
  /** «+998901234567» yoki boshqa ko'rinishda — raqamlar `getUzbekistanPhoneDigits` bilan olinadi. */
  phone_number: string | null;
  /** Bazada «90-123-45-67» ko'rinishida. */
  extra_number: string | null;
  address: string | null;
  region_id: string | null;
  district_id: string | null;
  /** Shu marketdagi buyurtmalar soni; market konteksti bo'lmasa `null`. */
  orders_count: number | null;
  /** Shu marketdagi yangi (`created` / `new`) buyurtmalar soni. */
  new_orders_count: number | null;
  has_new_orders: boolean;
  /** Eng yangi yangi-holatdagi buyurtma id'lari (ko'pi bilan 5). */
  new_order_ids: string[];
  last_order_at: string | null;
  /**
   * 9444UAa8 — qaysi maydon mos keldi (`phone` · `extra_number` · `name`; ustuvorlik — asosiy telefon). Eski javob
   * yoki noma'lum qiymat — `null` (belgi taxmin qilinmaydi).
   */
  matched_by: CustomerSuggestMatch | null;
}

export type CustomerSuggestMatch = "phone" | "extra_number" | "name";

export type CustomerSuggestParams = {
  /** Faqat raqamlar (kamida 7 ta) — backend `parseUzPhoneSearch`. */
  phone: string;
  /** Market rolida yuborilmaydi (backend token bo'yicha aniqlaydi). */
  marketId?: string | null;
};

/** `GET district/:id` dan kerakli qism: nom va viloyat. */
export interface CustomerDistrict {
  id: string;
  name: string | null;
  region_id: string | null;
}
