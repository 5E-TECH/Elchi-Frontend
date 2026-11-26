/**
 * Tanlash ro'yxatlari (marketlar, kuryerlar, menejerlar, xodimlar, filiallar) uchun «to'liq ro'yxat» limiti.
 *
 * Backend (`LOOKUP_LIST_MAX_LIMIT`, identity `normalizeQuery` va branch-service) shu qiymatgacha bir sahifada
 * qaytaradi — ilgari 100 bilan kesardi, shuning uchun qidiruvli tanlash oynasida 101-market (masalan «To'lovlar →
 * Berilishi kerak») qidirilsa ham chiqmasdi. Ro'yxat ichida qidiruv qiladigan joy shu limit bilan so'rashi kerak;
 * juda katta ro'yxatlar (buyurtmalar, pochtalar, mijozlar) — server qidiruvi (`search`) va sahifalash bilan.
 */
export const FULL_LIST_LIMIT = 10_000;
