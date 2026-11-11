import { useSyncExternalStore } from "react";
import i18n from "../../i18n";
import { formatMoneyLocalized } from "../../shared/lib/formatMoney";
import { notify } from "../../shared/lib/notify";
import { formatExtraCostItems, readDeferredExtraCostReply, type ExtraCostRequest } from "./extraCostRequest";

export type ExtraCostAction = "sell" | "partly_sell" | "cancel";

const EXTRA_COST_ACTIONS: readonly ExtraCostAction[] = ["sell", "partly_sell", "cancel"];

export const isExtraCostAction = (value: unknown): value is ExtraCostAction =>
  typeof value === "string" && EXTRA_COST_ACTIONS.includes(value as ExtraCostAction);

export interface PendingExtraCostApproval {
  orderId: string;
  action: ExtraCostAction;
  amount: number;
  requestedAt: string;
  /** So'rov yuborilgandagi holat: holat o'zgarsa, market tasdiqlagan va amal bajarilgan. */
  orderStatus: string;
  /** So'rov id'si (server bergan bo'lsa). */
  id?: string;
  /** Avtomatik tasdiq muddati (AFZaUUi5; serverdan, o'chiq bo'lsa `null`). */
  autoApproveAt?: string | null;
}

/**
 * Serverdagi kutilayotgan so'rov — buyurtma obyektida (GykuOz8f): `GET orders/courier/orders`, `GET /orders` va
 * `GET /orders/:id` har buyurtmada `pending_extra_cost_approval` beradi — buyurtma `waiting` da va hal qilinmagan
 * so'rov bo'lsa obyekt, aks holda `null`.
 */
export type ServerPendingExtraCostApproval = {
  id: string;
  action: ExtraCostAction;
  amount: number;
  created_at: string;
  auto_approve_at: string | null;
};

/** `pending_extra_cost_approval` maydoni bo'lishi mumkin bo'lgan buyurtma (ro'yxat qatori yoki tafsilot). */
export type OrderWithPendingApproval = {
  id: string;
  status?: string | null;
  pending_extra_cost_approval?: unknown;
};

/**
 * Eski (`replay`) rejim: extraCost > 0 bo'lsa backend amalni BAJARMAYDI — market tasdig'ini so'raydi va
 * tanada `{ statusCode: 202, data: { approval_required: true } }` qaytaradi,
 * HTTP kodi esa 201. Shuning uchun muvaffaqiyatni HTTP kodga qarab bilib bo'lmaydi.
 * SPEC v2 (kechiktirilgan xarajat) javobi hech qachon 202 emas — `readDeferredExtraCostReply`.
 */
export const isExtraCostApprovalResponse = (response: unknown): boolean => {
  if (typeof response !== "object" || response === null) return false;
  const body = response as { statusCode?: unknown; data?: { approval_required?: unknown } | null };
  return body.statusCode === 202 || body.data?.approval_required === true;
};

/**
 * MANBA — SERVER (GykuOz8f). Avval kuryer/menejer kutilayotgan so'rovlarni backend'dan ololmasdi va ular shu
 * qurilmaning `localStorage` ida (3 kun) saqlanardi: boshqa qurilmada «Tasdiq kutilmoqda» ko'rinmasdi, rad etilgani esa
 * 3 kun osilib turardi. Endi belgi buyurtmaning `pending_extra_cost_approval` maydonidan olinadi (har qurilmada bir xil).
 *
 * Shu qurilmada faqat QISQA MUDDATLI ISHORA qoladi (xotirada, `localStorage` emas): 202 javobi kelgan zahoti — ro'yxat
 * hali qayta so'ralmagan paytda — «Market tasdig'i kutilmoqda» oynasi so'ralgan amal va vaqtni ko'rsatishi uchun.
 * Buyurtma obyektida server maydoni bo'lsa, SERVER QIYMATI YUTADI (`null` — kutilayotgan so'rov yo'q), ishora
 * e'tiborsiz qoladi; maydon umuman kelmasa (eski javob) — avvalgidek ishora (holat o'zgarmagan bo'lsa).
 */
const LEGACY_STORAGE_KEY = "extra_cost_pending_approvals";

// Eski versiya qoldirgan `localStorage` yozuvlari endi o'qilmaydi — bir marta tozalanadi.
try {
  if (typeof window !== "undefined") window.localStorage.removeItem(LEGACY_STORAGE_KEY);
} catch {
  // Saqlash joyi yopiq (maxfiy rejim) — tozalanadigan narsa ham yo'q.
}

type ApprovalMap = Record<string, PendingExtraCostApproval>;

let snapshot: ApprovalMap = {};
const listeners = new Set<() => void>();

const publish = (next: ApprovalMap) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const recordPendingExtraCostApproval = (entry: PendingExtraCostApproval) => {
  publish({ ...snapshot, [entry.orderId]: entry });
};

export const clearPendingExtraCostApproval = (orderId: string) => {
  if (!(orderId in snapshot)) return;
  const next = { ...snapshot };
  delete next[orderId];
  publish(next);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

/** Shu qurilmadagi ishoralar (202 javoblari) — o'zgarsa komponent qayta chiziladi. */
export const usePendingExtraCostApprovals = (): ApprovalMap =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Joriy ishoralar (React'dan tashqarida, testlar uchun ham). */
export const getPendingExtraCostApprovalHints = (): ApprovalMap => snapshot;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const idText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;

/** Server qiymatini o'qiydi: `undefined` — maydon yo'q (eski javob), `null` — kutilayotgan so'rov yo'q. */
export const readServerPendingApproval = (value: unknown): ServerPendingExtraCostApproval | null | undefined => {
  if (value === undefined) return undefined;
  const record = asRecord(value);
  if (!record) return null;
  const amount = Number(record.amount);
  const createdAt = idText(record.created_at ?? record.createdAt);
  const autoApproveAt = idText(record.auto_approve_at);
  return {
    id: idText(record.id) ?? "",
    action: isExtraCostAction(record.action) ? record.action : ("" as ExtraCostAction),
    amount: Number.isFinite(amount) ? amount : 0,
    created_at: createdAt ?? "",
    auto_approve_at: autoApproveAt,
  };
};

const fromServer = (
  order: OrderWithPendingApproval,
  server: ServerPendingExtraCostApproval,
): PendingExtraCostApproval => ({
  orderId: order.id,
  action: server.action,
  amount: server.amount,
  requestedAt: server.created_at,
  orderStatus: String(order.status ?? ""),
  ...(server.id ? { id: server.id } : {}),
  autoApproveAt: server.auto_approve_at,
});

/**
 * Buyurtmaning kutilayotgan so'rovi. Server maydoni bo'lsa — faqat u (`null` — yo'q); maydon kelmagan eski javobda —
 * shu qurilmadagi ishora, buyurtma hali so'rov yuborilgandagi holatda bo'lsa.
 */
export const getActivePendingApproval = (
  approvals: ApprovalMap,
  order: OrderWithPendingApproval | null | undefined,
): PendingExtraCostApproval | undefined => {
  if (!order) return undefined;
  const server = readServerPendingApproval(order.pending_extra_cost_approval);
  if (server !== undefined) return server ? fromServer(order, server) : undefined;
  const entry = approvals[order.id];
  return entry && entry.orderStatus === order.status ? entry : undefined;
};

/**
 * «Market tasdig'i kutilmoqda» oynasi uchun (202 javobidan keyin, oyna ochiq turganda): avval shu qurilmadagi ishora —
 * u aynan hozirgi so'rov (oynadagi buyurtma obyekti so'rovdan OLDINGI holatda), keyin server qiymati.
 */
export const getRequestedApproval = (
  approvals: ApprovalMap,
  order: OrderWithPendingApproval | null | undefined,
): PendingExtraCostApproval | undefined =>
  order ? (approvals[order.id] ?? getActivePendingApproval(approvals, order)) : undefined;

export const EXTRA_COST_APPROVAL_POLL_MS = 30_000;

/**
 * react-query `refetchInterval` uchun: ko'rinayotgan buyurtmalardan birortasi
 * market tasdig'ini kutayotgan bo'lsa ro'yxat davriy yangilanadi — tasdiqlangach
 * buyurtma o'zi yopilib ketadi. Kutilayotgan so'rov bo'lmasa so'rov yuborilmaydi.
 *
 * `onlyHinted` — faqat SHU QURILMA yuborgan so'rov (ishora bor) hisoblanadi: oyna ochiq turganda (avtomatik
 * yangilanish to'xtagan, oyna aynan o'sha natijani kutadi) va so'rov yozmaydigan rollar ro'yxatida (admin, market —
 * serverdagi har kutilayotgan buyurtma uchun 30 s ga tushmasin).
 */
export const pollWhileApprovalPending = (
  orders: OrderWithPendingApproval[],
  options: { onlyHinted?: boolean } = {},
): number | false =>
  orders.some(
    (order) => (!options.onlyHinted || order.id in snapshot) && getActivePendingApproval(snapshot, order),
  )
    ? EXTRA_COST_APPROVAL_POLL_MS
    : false;

/**
 * SPEC v2: amal bajarildi, qo'shimcha xarajat esa alohida so'rov bo'lib market tasdig'ini kutmoqda — muvaffaqiyat
 * xabaridan keyin qo'shimcha ma'lumot: «20 000 so'm qo'shimcha xarajat market tasdig'ini kutmoqda» + tovarlar va
 * naqdni to'liq topshirish eslatmasi.
 */
const notifyDeferredExtraCost = (request: ExtraCostRequest, action: ExtraCostAction, extraCost: number) => {
  const language = i18n.resolvedLanguage ?? i18n.language;
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options ?? {});
  const items = formatExtraCostItems(request.items, { t, language, action: request.action ?? action });
  notify.info(
    t("orders:extraCostDeferredToast", {
      amount: formatMoneyLocalized(request.amount > 0 ? request.amount : extraCost, { language }),
    }),
    {
      description: items
        ? t("orders:extraCostDeferredToastItems", { items })
        : t("orders:extraCostDeferredToastDescription"),
    },
  );
};

/**
 * Sotish/bekor qilish javobini ajratadi: tasdiq so'ralgan bo'lsa (eski `replay` rejimi — 202 / `approval_required`)
 * buyurtma eslab qolinadi va modal ochiq qoladi, aks holda amal bajarilgan. Javobda kechiktirilgan xarajat
 * (`data.extra_cost_request`, `mode: "deferred"`) bo'lsa — amal BAJARILGAN: oyna yopiladi, ustiga «xarajat market
 * tasdig'ini kutmoqda» xabari (SPEC v2).
 */
export const resolveOrderActionResponse = (
  response: unknown,
  params: {
    order: { id: string; status?: string | null };
    action: ExtraCostAction;
    extraCost: number;
    onCompleted: () => void;
    onApprovalRequested: () => void;
  },
) => {
  const { order, action, extraCost, onCompleted, onApprovalRequested } = params;
  if (!isExtraCostApprovalResponse(response)) {
    clearPendingExtraCostApproval(order.id);
    onCompleted();
    const deferred = readDeferredExtraCostReply(response);
    if (deferred) notifyDeferredExtraCost(deferred, action, extraCost);
    return;
  }

  const approval = (
    response as {
      data?: {
        approval?: { id?: unknown; action?: unknown; amount?: unknown; createdAt?: unknown; auto_approve_at?: unknown };
      };
    }
  ).data?.approval;
  const approvalAction = approval?.action;
  const approvalId = idText(approval?.id);
  const autoApproveAt = idText(approval?.auto_approve_at);
  recordPendingExtraCostApproval({
    orderId: order.id,
    // fix3b M3: market AYNAN shu tasdiq amalini bajaradi — javobdagi amal
    // yoziladi (eski backend eski tasdiqni qaytarardi: masalan bekor qilish
    // so'ralganda kutilayotgan SOTISH). Javobda amal bo'lmasa — so'ralgani.
    action: isExtraCostAction(approvalAction) ? approvalAction : action,
    amount: Number(approval?.amount ?? extraCost) || extraCost,
    requestedAt: typeof approval?.createdAt === "string" ? approval.createdAt : new Date().toISOString(),
    orderStatus: String(order.status ?? ""),
    ...(approvalId ? { id: approvalId } : {}),
    ...(autoApproveAt ? { autoApproveAt } : {}),
  });
  onApprovalRequested();
};
