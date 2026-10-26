import { getBackendErrorMessage } from "../../../../shared/lib/backendError";

/**
 * KURYER TUMANI (DtKKY0V8, FY-5) — `POST /couriers` va `PATCH /users/:id` dagi `district_id` (raqamli satr; `null` —
 * tozalash). Backend qoidasi (identity `resolveUserDistrictId`): tuman mavjud va kuryer viloyatiga (filial viloyati)
 * tegishli bo'lishi kerak, aks holda 400; logistika javob bermasa — 503, kuryer yaratilmaydi / saqlanmaydi.
 *
 * Xato turlari backend matnidan (holat kodi + o'zbekcha `message`) aniqlanadi va i18n matniga aylantiriladi —
 * server matni ru/en interfeysda ko'rsatilmaydi:
 *  - `notFound` — 400 «Tuman topilmadi»;
 *  - `wrongRegion` — 400 «Tuman foydalanuvchining viloyatiga tegishli emas»;
 *  - `invalid` — 400 «district_id raqamli ID bo'lishi kerak»;
 *  - `unavailable` — 503 «Tumanni tekshirib bo'lmadi — …» (tuman yuborilgan bo'lsa, matnsiz 503 ham).
 */
export type CourierDistrictErrorKind = "notFound" | "wrongRegion" | "invalid" | "unavailable";

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === "number" ? status : undefined;
};

export const courierDistrictErrorKind = (
  error: unknown,
  { districtSent }: { districtSent: boolean },
): CourierDistrictErrorKind | null => {
  const status = statusOf(error);
  const message = (getBackendErrorMessage(error) ?? "").toLowerCase();
  if (status === 400) {
    if (message.includes("tuman topilmadi")) return "notFound";
    if (message.includes("viloyatiga tegishli emas")) return "wrongRegion";
    if (message.includes("district_id")) return "invalid";
    return null;
  }
  if (status === 503 && (message.includes("tuman") || (districtSent && !message))) return "unavailable";
  return null;
};

/** `GET region/:id` dagi tumanlar → `Select` variantlari (nom bo'yicha). Noto'g'ri qatorlar tashlanadi. */
export const toDistrictOptions = (raw: unknown): Array<{ value: string; label: string }> => {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((row) => {
      const record = (row ?? {}) as { id?: unknown; name?: unknown };
      const id = typeof record.id === "number" || typeof record.id === "string" ? String(record.id).trim() : "";
      const name = typeof record.name === "string" ? record.name.trim() : "";
      return { value: id, label: name || `#${id}` };
    })
    .filter((option) => option.value !== "")
    .sort((left, right) => left.label.localeCompare(right.label, "uz"));
};
