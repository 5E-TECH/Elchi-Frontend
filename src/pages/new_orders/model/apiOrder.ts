/**
 * BUYURTMA (API shakli) — «Qabul va yaratish» sahifalari, yorliq chop etish va pochta chop etish rejimi
 * ishlatadigan buyurtma turi. Ilgari v1 `components/OrderCard.tsx` ichida edi; karta o'chirilgach tur shu yerga
 * ko'chirildi (shakli o'zgarmagan).
 */
export interface ApiOrder {
  id: string;
  /** Inson o'qiydigan buyurtma raqami, masalan "EL-100081". Backend `enrichOrders` beradi. */
  order_number?: string | null;
  qr_code_token?: string | null;
  status: string;
  where_deliver: "center" | "home" | "address";
  total_price: number;
  paid_amount: number;
  to_be_paid: number;
  createdAt: string;
  comment: string | null;
  address: string | null;
  /**
   * ⚠️ `product` BO'LMASLIGI mumkin. Hamkor (Partner API) orqali kelgan
   * buyurtmalarda mahsulot katalogimizda yo'q — nomi `product_name` da
   * matn sifatida keladi, `product_id` esa bo'sh bo'ladi.
   */
  items?:
    | {
        id: string;
        quantity: number;
        product?: { id: string; name: string; image_url: string | null } | null;
        product_name?: string | null;
      }[]
    | null;
  customer: { id: string; name: string; phone_number: string; extra_number?: string | null; district?: { name: string }; region?: { name: string } };
  district?: { name: string };
  region?: { name: string };
}
