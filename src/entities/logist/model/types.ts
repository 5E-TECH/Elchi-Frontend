/** Logist holati (`GET /logists` → `status`). Nofaol logistga viloyat biriktirilmaydi (backend 400). */
export type LogistStatus = "active" | "inactive";

/** Logist — viloyatlar ustidan nazorat qiluvchi xodim (dzyVftBx). Filialga biriktirilmaydi. */
export type Logist = {
  id: string;
  name: string;
  phone_number: string;
  status: LogistStatus;
};

/** Viloyat va unga biriktirilgan logist (`GET /region` → `logist_id`, yo'q bo'lsa `null`). */
export type LogistRegion = {
  id: string;
  name: string;
  logistId: string | null;
};

/** `POST /region/logist/bulk` — `region_ids` dagilar logistga o'tadi, qolgan viloyatlaridan u olinadi. */
export type BulkAssignRegionLogistRequest = {
  logist_id: string;
  region_ids: string[];
};
