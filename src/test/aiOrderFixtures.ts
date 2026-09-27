import type { AiPreviewOrder } from "../entities/ai-order";

/** AI buyurtma testlari uchun umumiy namunalar. */

export const aiPreview = (overrides: Partial<AiPreviewOrder> = {}): AiPreviewOrder => ({
  customer_name: "Aliyev Vali",
  phone_number: "+998901234567",
  extra_number: null,
  region_id: "11",
  region_name: "Toshkent shahri",
  region_given: true,
  district_id: "101",
  district_name: "Chilonzor",
  district_candidates: [],
  address: "",
  items: [
    {
      name: "telefon ushlagich",
      quantity: 1,
      product_id: "501",
      resolved_name: "Telefon ushlagich",
      candidates: [],
    },
  ],
  total_price: 150000,
  comment: "",
  operator: "",
  where_deliver: "center",
  ...overrides,
});

export const aiRegions = [
  { id: 11, name: "Toshkent shahri", sato_code: "1726" },
  { id: 12, name: "Samarqand viloyati", sato_code: "1718" },
];

export const aiDistrictsByRegion: Record<string, Array<{ id: number; name: string; sato_code: string }>> = {
  "11": [
    { id: 101, name: "Chilonzor", sato_code: "1726269" },
    { id: 102, name: "Yunusobod", sato_code: "1726266" },
  ],
  "12": [{ id: 201, name: "Urgut", sato_code: "1718236" }],
};

export const aiProducts = [
  { id: 501, name: "Telefon ushlagich", price: 45000 },
  { id: 502, name: "Avto changyutgich", price: 120000 },
];

/**
 * `api.get` uchun soxta javoblar — gateway qobig'i `{ statusCode, data }`
 * bilan, haqiqiy javoblarga o'xshab.
 */
export const aiApiGet = (url: string) => {
  const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });
  if (url === "region") return ok(aiRegions);
  const region = url.match(/^region\/(\d+)$/);
  if (region) return Promise.resolve({ data: { districts: aiDistrictsByRegion[region[1]] ?? [] } });
  if (url.startsWith("product/")) return ok(aiProducts);
  if (url.startsWith("orders/markets/")) return ok([]);
  return ok([]);
};
