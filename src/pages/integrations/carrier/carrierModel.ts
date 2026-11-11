import axios from "axios";
import {
  CarrierUnreadableResponseError,
  type CarrierAccount,
} from "../../../entities/integrations/carriers";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import type { Tone } from "../../../shared/ui/primitives";

/**
 * TASHQI YETKAZUVCHI — sof mantiq (UI'siz, testlanadi): akkaunt holati, kuryer tanlovi qoidalari, server xatolari.
 *
 * Ma'lumot manbalari (hammasi haqiqiy endpoint):
 *  - akkaunt — `GET admin/carriers` (`is_active`, `courier_user_id`, `ip_allowlist`, sanalar);
 *  - bog'langan kuryer — `GET users/:id` (ism, telefon, `status`, `branch {id, name}`, tariflar; 404 — o'chirilgan);
 *  - HQ — `GET branches/hq` (kuryer filiali HQ'mi — naqdni kim qabul qiladi);
 *  - «Qabul qilinishi kerak» — `GET finance/cashbox/user/:id?cashbox_type=couriers&with_history=true` (`olinishi_kerak`:
 *    HQ kuryeri va filial savdosi kutilmayotgan bo'lsa musbat balans, aks holda 0 — «Kuryer kassasi» sahifasidagi bilan
 *    bir xil; `with_history` siz backend bu maydonni qo'shmaydi).
 */

/** `GET users/:id` dan kerakli qism. */
export type CarrierCourier = {
  id: string;
  name: string;
  phone: string;
  /** `active` · `inactive` · `blocked` (identity). */
  status: string;
  branch: { id: string; name: string } | null;
  tariffHome: number | null;
  tariffCenter: number | null;
};

/** Kuryer ma'lumoti holati: yuklanmoqda · bor · topilmadi (404 — o'chirilgan) · so'rov xatosi. */
export type CourierInfo =
  | { state: "loading" }
  | { state: "ready"; courier: CarrierCourier }
  | { state: "missing" }
  | { state: "error" };

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();
const numOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Identity foydalanuvchisi (`GET users/:id` / `GET users` qatori) → `CarrierCourier`. */
export const toCarrierCourier = (raw: unknown): CarrierCourier | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id);
  if (!id) return null;
  const branchRaw =
    row.branch && typeof row.branch === "object" ? (row.branch as Record<string, unknown>) : null;
  const branchId = text(branchRaw?.id ?? row.branch_id);
  return {
    id,
    name: text(row.name),
    phone: text(row.phone_number),
    status: text(row.status).toLowerCase(),
    branch: branchId ? { id: branchId, name: text(branchRaw?.name) } : null,
    tariffHome: numOrNull(row.tariff_home),
    tariffCenter: numOrNull(row.tariff_center),
  };
};

export const isCourierActive = (courier: CarrierCourier) => courier.status === "active";

/**
 * Akkaunt holati (ro'yxat, tafsilot, tasdiq oynalari) — maket nomlari:
 *  - `courierMissing` «Kuryer topilmadi» — kuryer o'chirilgan: kalit ishlamaydi, yoqish va rotatsiya rad etiladi;
 *  - `stopped` «To'xtatilgan» — `is_active: false`;
 *  - `courierInactive` «Kuryer nofaol» + «Kalit ishlamayapti» — akkaunt yoqiq, lekin guard 403
 *    (CARRIER_COURIER_INACTIVE; kesh tufayli ko'pi bilan 30 s kechikadi);
 *  - `active` «Faol».
 * Kuryer ma'lumoti hali kelmagan yoki xato bo'lsa — faqat akkauntning o'z holati.
 */
export type CarrierAccountState = "active" | "stopped" | "courierInactive" | "courierMissing";

export const accountState = (
  account: CarrierAccount,
  info: CourierInfo | undefined,
): CarrierAccountState => {
  if (info?.state === "missing") return "courierMissing";
  if (!account.is_active) return "stopped";
  if (info?.state === "ready" && !isCourierActive(info.courier)) return "courierInactive";
  return "active";
};

export const STATE_TONE: Record<CarrierAccountState, Tone> = {
  active: "success",
  stopped: "neutral",
  courierInactive: "warning",
  courierMissing: "danger",
};

/** i18n kalitlari (`integrations` → `carrier.state.*`). */
export const STATE_LABEL: Record<CarrierAccountState, string> = {
  active: "carrier.state.active",
  stopped: "carrier.state.stopped",
  courierInactive: "carrier.state.courierInactive",
  courierMissing: "carrier.state.courierMissing",
};

/** Kalit hozir ishlamaydi (akkaunt yoqiq bo'lsa ham) — qatorda «Kalit ishlamayapti». */
export const keyBlocked = (state: CarrierAccountState) =>
  state === "courierInactive" || state === "courierMissing";

/**
 * KURYER TANLOVI — frontend biladigan qoidalar (maket «Bog'lash mumkin · N» / «Bog'lab bo'lmaydi · N»):
 *  - shu kuryer allaqachon akkauntga bog'langan (`GET admin/carriers` → `courier_user_id`) — yoqiq akkaunt yoki
 *    to'xtatilgan (kuryer bo'shamaydi: o'chirish backendda yo'q);
 *  - kuryer `status !== active` — «Nofaol».
 * Qolgani (kuryer tanlangach bloklangan, roli o'zgargan, poyga) — server javobi bilan (409 / 400 / 404).
 */
export type CourierEligibility =
  | { ok: true }
  | { ok: false; reason: "bound"; account: CarrierAccount }
  | { ok: false; reason: "inactive" };

export const courierEligibility = (
  courier: CarrierCourier,
  accounts: readonly CarrierAccount[],
): CourierEligibility => {
  const bound = accounts.find((account) => account.courier_user_id === courier.id);
  if (bound) return { ok: false, reason: "bound", account: bound };
  if (!isCourierActive(courier)) return { ok: false, reason: "inactive" };
  return { ok: true };
};

/** Ism bosh harflari (avatar): «FastPost kuryeri» → «FK». */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/**
 * SERVER XATOLARI — backend kod bermaydi (faqat matn), shu bois status + backend matnidagi «kurier» so'zi
 * (`carrier-account.service.ts`: «Kurier topilmadi», «Kurier faol emas», «Bu foydalanuvchi kurier emas»):
 *  - `busy` — 409 (kuryer boshqa akkauntga bog'langan);
 *  - `courier` — kuryer tekshiruvdan o'tmadi (404 / 400 + «kurier»);
 *  - `unavailable` — 503 (identity javob bermadi, hech narsa yozilmadi);
 *  - `unknown` — natija noma'lum: javob kelmadi (tarmoq, vaqt, 502 / 504) yoki 2xx javobda kalit yo'q
 *    (`CarrierUnreadableResponseError`) — yaratilgan / yangilangan bo'lishi MUMKIN. `serverErrorUnknown` (yaratish
 *    va kalitni yangilash) — 500 ham noma'lum: backend yozib bo'lgach yiqilishi mumkin (rotatsiyada hash `patch`
 *    dan keyin `findOrFail`), oddiy xato xabari o'rniga «ro'yxatni yangilang / qayta yangilang» yo'li;
 *  - `other` — qolgani (backend matni bilan xabar).
 */
export type CarrierErrorKind = "busy" | "courier" | "unavailable" | "unknown" | "other";

export const classifyCarrierError = (
  error: unknown,
  options?: { serverErrorUnknown?: boolean },
): CarrierErrorKind => {
  if (error instanceof CarrierUnreadableResponseError) return "unknown";
  if (!axios.isAxiosError(error)) return "other";
  const status = error.response?.status;
  if (!status) return "unknown";
  if (status === 502 || status === 504) return "unknown";
  if (status === 500 && options?.serverErrorUnknown) return "unknown";
  if (status === 409) return "busy";
  if (status === 503) return "unavailable";
  const message = (getBackendErrorMessage(error) ?? "").toLowerCase();
  if ((status === 404 || status === 400) && /kurier|kuryer/.test(message)) return "courier";
  return "other";
};
