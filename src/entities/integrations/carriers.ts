import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { queryKeys } from "../../shared/config/queryKeys";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";

/**
 * CARRIER API AKKAUNTLARI — tashqi yetkazuvchi kompaniya bizda BITTA KURYER bo'lib ishlaydi va `/carrier/*` ga
 * `X-Api-Key` (`elc_…`) bilan kiradi. Boshqaruv — `admin/carriers` (SUPERADMIN, ADMIN; backend
 * `apps/api-gateway/src/carrier-admin-gateway.controller.ts`, mantiq `integration-service/src/carrier`).
 *
 * ⚠️ API KALIT FAQAT BIR MARTA keladi — yaratish va rotatsiya javobida (bazada sha256 hash). Shu sabab:
 *  - kalit HECH QACHON so'rov keshiga yozilmaydi: ro'yxat (`GET`) kalitsiz, yaratish/rotatsiya — mutatsiya;
 *  - mutatsiyalar `gcTime: 0` — chaqiruvchi kalitni oynaga olib, `reset()` qilgach u mutatsiya keshida ham qolmaydi;
 *  - kalit `localStorage` / URL'ga hech qachon tushmaydi (oyna holatida, yopilganda o'chiriladi).
 *
 * O'chirish (DELETE) backendda yo'q: ish tugasa akkaunt to'xtatiladi (`STATUS`), kuryer bo'shamaydi.
 */

export type CarrierAccount = {
  id: string;
  name: string;
  /** Bog'langan KURYER user id — akkaunt yaratilgach o'zgarmaydi. */
  courier_user_id: string;
  /** Kanonik IP qoidalari; `null` — cheklov yo'q. */
  ip_allowlist: string[] | null;
  /** `false` — kompaniya so'rovlari 403 «Carrier akkaunt faol emas». */
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCarrierAccountDto = {
  name: string;
  courier_id: string;
  ip_allowlist?: string[];
};

/** `PATCH` — faqat o'zgargan maydon; `ip_allowlist: []` — cheklov olib tashlanadi. */
export type UpdateCarrierAccountDto = {
  name?: string;
  ip_allowlist?: string[];
};

/** Yaratish javobi: akkaunt + `courier_name` + BIR MARTALIK `api_key`. */
export type CreatedCarrierAccount = CarrierAccount & {
  courier_name: string | null;
  api_key: string;
};
export type RotatedCarrierKey = { id: string; api_key: string };

/**
 * Yaratish, rotatsiya va yoqish — identity tekshiruvi (≤ 6,5 s) + DB; gateway `CARRIER_IDENTITY_TIMEOUT_MS` = 20 s
 * kutadi. Brauzer undan ko'proq kutadi: gateway javobi (504 ham) yo'lda qolmasin — aks holda kalit yaratilib,
 * hech kimga yetmay yo'qolardi. Vaqt tugasa natija noma'lum («Javob kelmadi» oynasi).
 */
export const CARRIER_IDENTITY_REQUEST_TIMEOUT_MS = 30_000;

/** Gateway `successRes` qobig'ini (`{ statusCode, message, data }`) bir qatlam ochadi. */
const unwrap = (raw: unknown): unknown =>
  raw && typeof raw === "object" && !Array.isArray(raw) && "data" in raw
    ? (raw as { data: unknown }).data
    : raw;

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const toAccount = (row: Record<string, unknown>): CarrierAccount => ({
  id: text(row.id),
  name: text(row.name),
  courier_user_id: text(row.courier_user_id),
  ip_allowlist: Array.isArray(row.ip_allowlist) ? row.ip_allowlist.map(text).filter(Boolean) : null,
  is_active: row.is_active === true,
  createdAt: text(row.createdAt),
  updatedAt: text(row.updatedAt),
});

/** `GET admin/carriers` javobi. Kutilmagan shakl — xato (bo'sh ro'yxat «hali yo'q» deb yolg'on ko'rsatardi). */
export const readCarrierAccounts = (raw: unknown): CarrierAccount[] => {
  const payload = unwrap(raw);
  if (!Array.isArray(payload))
    throw new Error("Carrier akkauntlar ro'yxati kutilmagan shaklda keldi");
  return payload
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map(toAccount);
};

/**
 * 2xx javob o'qilmadi (kalit yo'q yoki shakl kutilmagan). Server amalni BAJARGAN — akkaunt yaratilgan yoki kalit
 * almashtirilgan, lekin kalit bizga yetmadi: chaqiruvchi buni «natija noma'lum» deb ko'rsatadi (`classifyCarrierError`
 * → `unknown`: ro'yxatni yangilash, kalitni qayta yangilash), oddiy xato xabari emas.
 */
export class CarrierUnreadableResponseError extends Error {
  readonly kind = "unreadable" as const;
  constructor() {
    super("Javobda API kalit yo'q");
    this.name = "CarrierUnreadableResponseError";
  }
}

/**
 * `PATCH` javobi — saqlangan akkaunt (backend `toView`, ro'yxat qatori bilan bir xil shakl). Shakl kutilmagan bo'lsa
 * `null`: saqlash baribir bajarilgan, ro'yxat fonda yangilanadi.
 */
export const readUpdatedCarrier = (raw: unknown): CarrierAccount | null => {
  const payload = unwrap(raw);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const account = toAccount(payload as Record<string, unknown>);
  return account.id ? account : null;
};

/** Yaratish javobi — kalitsiz javob o'qilmaydi: kalitni boshqa joydan olib bo'lmaydi. */
export const readCreatedCarrier = (raw: unknown): CreatedCarrierAccount => {
  const payload = unwrap(raw);
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const apiKey = text(row.api_key);
  if (!apiKey) throw new CarrierUnreadableResponseError();
  return {
    ...toAccount(row),
    courier_name:
      row.courier_name === null || row.courier_name === undefined ? null : text(row.courier_name),
    api_key: apiKey,
  };
};

export const readRotatedKey = (raw: unknown): RotatedCarrierKey => {
  const payload = unwrap(raw);
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const apiKey = text(row.api_key);
  if (!apiKey) throw new CarrierUnreadableResponseError();
  return { id: text(row.id), api_key: apiKey };
};

/** `options.enabled` — faqat SUPERADMIN / ADMIN (`canManageCarrierAccounts`); boshqa rolda 403 bo'lardi. */
export const useCarrierAccounts = (options?: SilentErrorOption & { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.carrierAccounts.all,
    queryFn: () =>
      api.get(API_ENDPOINTS.CARRIERS.BASE).then((res) => readCarrierAccounts(res.data)),
    enabled: options?.enabled ?? true,
    ...silentErrorMeta(options),
  });

export const useCarrierAccountActions = () => {
  const client = useQueryClient();
  /**
   * Ro'yxat fonda yangilanadi — kalit oynasi refetch'ni kutmaydi. `onSettled`: XATODA HAM — natija noma'lum
   * (504, vaqt tugadi, tarmoq) bo'lsa akkaunt yaratilgan, kalit almashgan yoki holat o'zgargan bo'lishi mumkin;
   * 409 / 400 / 404 da ham ro'yxat eskirgan bo'lishi mumkin (poyga, kuryer o'zgargan).
   */
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.carrierAccounts.all });
  };

  const create = useMutation({
    mutationFn: (dto: CreateCarrierAccountDto) =>
      api
        .post(API_ENDPOINTS.CARRIERS.BASE, dto, { timeout: CARRIER_IDENTITY_REQUEST_TIMEOUT_MS })
        .then((res) => readCreatedCarrier(res.data)),
    // Kalit mutatsiya keshida qolmasin: chaqiruvchi `reset()` qilgach darhol yig'iladi.
    gcTime: 0,
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCarrierAccountDto }) =>
      api.patch(API_ENDPOINTS.CARRIERS.BY_ID(id), dto).then((res) => readUpdatedCarrier(res.data)),
    /**
     * Saqlangan akkaunt ro'yxat keshiga DARHOL yoziladi (fondagi yangilanishni kutmasdan): sekin tarmoqda saqlashdan
     * keyin darhol qayta ochilgan «Tahrirlash» eski nom / IP ro'yxatidan boshlanmasin.
     */
    onSuccess: (saved) => {
      if (!saved) return;
      client.setQueryData<CarrierAccount[]>(queryKeys.carrierAccounts.all, (list) =>
        list?.map((row) => (row.id === saved.id ? saved : row)),
      );
    },
    onSettled: invalidate,
  });

  const rotateKey = useMutation({
    mutationFn: (id: string) =>
      api
        .post(API_ENDPOINTS.CARRIERS.ROTATE_KEY(id), undefined, {
          timeout: CARRIER_IDENTITY_REQUEST_TIMEOUT_MS,
        })
        .then((res) => readRotatedKey(res.data)),
    gcTime: 0,
    onSettled: invalidate,
  });

  const setActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api
        .post(
          API_ENDPOINTS.CARRIERS.STATUS(id),
          { is_active },
          { timeout: CARRIER_IDENTITY_REQUEST_TIMEOUT_MS },
        )
        .then((res) => res.data),
    onSettled: invalidate,
  });

  return { create, update, rotateKey, setActive };
};
