import type { MailItem, ReturnRequestActionPayload } from "../../../entities/mails";
import { getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * «Pochta → Qaytarish» — sof yordamchilar: guruhlash, so'rov tanasi, amal javobi va xato turi.
 *
 * Tasdiqlash / rad etish oqimi (u5HTJtqK) Ops'dagi «Qaytarish so'rovlari» nusxasidan ko'chdi (OS-3, `/returns`
 * pastidagi superadmin bo'limi o'chirildi): tasdiq oynasi, o'tkazib yuborilgan buyurtma raqamlari, 409 — «tanlov
 * eskirgan». Endpointlar o'sha: `POST post/return-requests/approve | reject` (`{ order_ids }`).
 */

/** Kuryersiz eski qator guruhining kaliti (kuryer id yo'q). */
export const NO_COURIER_KEY = "unknown";

export type ReturnGroup = {
  /** Kuryer id (`NO_COURIER_KEY` — kuryersiz eski qator) yoki `branch_transfer:<branch_id>`. */
  key: string;
  kind: "courier" | "branch";
  /** Kuryer ismi yoki «Filial: <nomi> — kelmagan». */
  name: string;
  phone: string;
  orders: MailItem[];
  totalAmount: number;
};

export const isBranchTransfer = (item: MailItem) => item.return_source === "branch_transfer";

/** Ro'yxatdagi so'rov kaliti (tanlov shu bilan). */
export const getRequestId = (item: MailItem) => item.request_id || item.order_id || item.id;

/** Backendga ketadigan buyurtma id si. */
export const getReturnOrderId = (item: MailItem) => item.order_id || item.request_id || item.id;

// Backend faqat { order_ids } qabul qiladi (ValidationPipe boshqa kalitni 400 bilan qaytaradi).
export const buildReturnPayload = (items: MailItem[]): ReturnRequestActionPayload => ({
  order_ids: Array.from(new Set(items.map(getReturnOrderId).filter(Boolean))),
});

/**
 * Kuryer bo'yicha guruhlar; filial o'tkazmasi so'rovlari — manzil filial bo'yicha alohida (`branch_transfer:<id>`):
 * bir nechta filialniki bitta «Kuryer» guruhiga qo'shilib ketmaydi. Tartib — ro'yxat tartibi.
 */
export const groupReturnRequests = (
  items: MailItem[],
  courierFallback: string,
  branchLabel: (branch: MailItem["return_branch"]) => string,
): ReturnGroup[] => {
  const groups = new Map<string, ReturnGroup>();

  items.forEach((item) => {
    const branch = isBranchTransfer(item);
    const key = branch
      ? `branch_transfer:${item.return_branch?.id ?? ""}`
      : item.courier?.id || item.courier_id || NO_COURIER_KEY;
    const group = groups.get(key) ?? {
      key,
      kind: branch ? ("branch" as const) : ("courier" as const),
      name: branch ? branchLabel(item.return_branch) : item.courier?.name || courierFallback,
      phone: branch ? "" : item.courier?.phone_number || "",
      orders: [],
      totalAmount: 0,
    };

    group.orders.push(item);
    group.totalAmount += item.post_total_price;
    groups.set(key, group);
  });

  return Array.from(groups.values());
};

/** Kuryersiz guruh (kuryer ham, filial ham emas). */
export const isCourierlessGroup = (group: ReturnGroup) => group.kind === "courier" && group.key === NO_COURIER_KEY;

/**
 * Tasdiq oynasidagi tartib (maket `superadmin-ops-logistics-approve-dialog`): kuryerlar ro'yxat tartibida, keyin
 * filial o'tkazmasi guruhlari, kuryersiz guruh — oxirida.
 */
export const orderSummaryGroups = (groups: ReturnGroup[]): ReturnGroup[] => [
  ...groups.filter((group) => group.kind === "courier" && !isCourierlessGroup(group)),
  ...groups.filter((group) => group.kind === "branch"),
  ...groups.filter(isCourierlessGroup),
];

export type ReturnRequestState = { key: "notReceived" | "withCourier" | "notArrived"; tone: "warning" | "neutral" };

/**
 * So'rov holati: ON_THE_ROAD — kuryer pochtani qabul qilganda bu posilkani qabul qilmagan (warning); filial
 * o'tkazmasida — posilka manzil filialga kelmagan (warning); WAITING — eski oqimdagi so'rov, posilka kuryer qo'lida
 * (neutral). Boshqa holat — `null` (xom backend qiymati ko'rsatilmaydi).
 */
export const returnRequestState = (item: MailItem): ReturnRequestState | null => {
  const normalized = String(item.status ?? "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (normalized === "on the road") {
    return { key: isBranchTransfer(item) ? "notArrived" : "notReceived", tone: "warning" };
  }
  if (normalized === "waiting") return { key: "withCourier", tone: "neutral" };
  return null;
};

export type ReturnAction = "approve" | "reject";

export type ReturnActionResult = {
  /** Backend haqiqatda bajargani: omborga qaytarilgan (approve) yoki rad etilgan (reject) so'rovlar soni. */
  done: number;
  /** Shu orada ko'rib chiqilgan yoki holati o'zgargani uchun o'tkazib yuborilgan buyurtma id lari. */
  skippedOrderIds: string[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

/**
 * Amal javobi: `{ data: { approved | rejected, order_ids, skipped_order_ids } }`. Son kelmasa — `order_ids` soni,
 * u ham bo'lmasa — yuborilganlar minus o'tkazib yuborilganlar (eski javob shakli).
 */
export const parseReturnActionResult = (
  payload: unknown,
  action: ReturnAction,
  requestedOrderIds: string[],
): ReturnActionResult => {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const skippedOrderIds = Array.isArray(data.skipped_order_ids)
    ? data.skipped_order_ids.map(toText).filter(Boolean)
    : [];
  const count = action === "approve" ? data.approved : data.rejected;
  const done =
    typeof count === "number" && Number.isFinite(count)
      ? count
      : Array.isArray(data.order_ids)
        ? data.order_ids.length
        : Math.max(requestedOrderIds.length - skippedOrderIds.length, 0);
  return { done, skippedOrderIds };
};

export type ReturnActionErrorKey = "forbidden" | "stale" | "server" | "generic";

/**
 * Xato → oynadagi matn kaliti (xom backend matni ko'rsatilmaydi — u faqat o'zbekcha):
 * 403 — boshqa filial kuryeri; 409 — tanlangan barcha so'rov shu orada ko'rib chiqilgan («tanlov eskirgan», backend
 * «… sahifani yangilang»); 404 — eski backendning o'sha holati; 5xx / vaqt chegarasi / oflayn — bir qismi yozilgan
 * bo'lishi mumkin (backend atomik emas).
 */
export const returnActionErrorKey = (error: unknown): ReturnActionErrorKey => {
  const status = getErrorStatus(error);
  if (status === 403) return "forbidden";
  if (status === 409 || status === 404) return "stale";
  const kind = getErrorKind(error);
  if (kind === "server" || kind === "timeout" || kind === "offline") return "server";
  return "generic";
};
