import { useSyncExternalStore } from "react";

export type ExtraCostAction = "sell" | "partly_sell" | "cancel";

export interface PendingExtraCostApproval {
  orderId: string;
  action: ExtraCostAction;
  amount: number;
  requestedAt: string;
  /** So'rov yuborilgandagi holat: holat o'zgarsa, market tasdiqlagan va amal bajarilgan. */
  orderStatus: string;
}

/**
 * extraCost > 0 bo'lsa backend amalni BAJARMAYDI — market tasdig'ini so'raydi va
 * tanada `{ statusCode: 202, data: { approval_required: true } }` qaytaradi,
 * HTTP kodi esa 201. Shuning uchun muvaffaqiyatni HTTP kodga qarab bilib bo'lmaydi.
 */
export const isExtraCostApprovalResponse = (response: unknown): boolean => {
  if (typeof response !== "object" || response === null) return false;
  const body = response as { statusCode?: unknown; data?: { approval_required?: unknown } | null };
  return body.statusCode === 202 || body.data?.approval_required === true;
};

// Kuryer/menejer tasdiqlar ro'yxatini backend'dan ololmaydi (GET extra-cost-approvals
// faqat MARKET/ADMIN), shuning uchun yuborilgan so'rovlar shu qurilmada eslab qolinadi.
const STORAGE_KEY = "extra_cost_pending_approvals";
// Rad etilgan so'rov haqida kuryerga xabar kelmaydi — yozuv abadiy qolib ketmasin.
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

type ApprovalMap = Record<string, PendingExtraCostApproval>;

const readStorage = (): ApprovalMap => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed as ApprovalMap).filter(
        ([, entry]) => entry && now - new Date(entry.requestedAt).getTime() < TTL_MS,
      ),
    );
  } catch {
    return {};
  }
};

let snapshot: ApprovalMap = readStorage();
const listeners = new Set<() => void>();

const persist = (next: ApprovalMap) => {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Saqlab bo'lmasa ham joriy sessiyadagi holat to'g'ri qoladi.
  }
  listeners.forEach((listener) => listener());
};

export const recordPendingExtraCostApproval = (entry: PendingExtraCostApproval) => {
  persist({ ...snapshot, [entry.orderId]: entry });
};

export const clearPendingExtraCostApproval = (orderId: string) => {
  if (!(orderId in snapshot)) return;
  const next = { ...snapshot };
  delete next[orderId];
  persist(next);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = readStorage();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const getSnapshot = () => snapshot;

export const usePendingExtraCostApprovals = (): ApprovalMap =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Faqat buyurtma hali so'rov yuborilgandagi holatda bo'lsa yozuv amalda. */
export const getActivePendingApproval = (
  approvals: ApprovalMap,
  order: { id: string; status?: string | null } | null | undefined,
): PendingExtraCostApproval | undefined => {
  if (!order) return undefined;
  const entry = approvals[order.id];
  return entry && entry.orderStatus === order.status ? entry : undefined;
};

export const EXTRA_COST_APPROVAL_POLL_MS = 30_000;

/**
 * react-query `refetchInterval` uchun: ko'rinayotgan buyurtmalardan birortasi
 * market tasdig'ini kutayotgan bo'lsa ro'yxat davriy yangilanadi — tasdiqlangach
 * buyurtma o'zi yopilib ketadi. Kutilayotgan yozuv bo'lmasa so'rov yuborilmaydi.
 */
export const pollWhileApprovalPending = (
  orders: Array<{ id: string; status?: string | null }>,
): number | false =>
  orders.some((order) => getActivePendingApproval(snapshot, order))
    ? EXTRA_COST_APPROVAL_POLL_MS
    : false;

/**
 * Sotish/bekor qilish javobini ajratadi: tasdiq so'ralgan bo'lsa buyurtma
 * eslab qolinadi va modal ochiq qoladi, aks holda amal bajarilgan.
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
    return;
  }

  const approval = (response as { data?: { approval?: { amount?: unknown; createdAt?: unknown } } }).data?.approval;
  recordPendingExtraCostApproval({
    orderId: order.id,
    action,
    amount: Number(approval?.amount ?? extraCost) || extraCost,
    requestedAt: typeof approval?.createdAt === "string" ? approval.createdAt : new Date().toISOString(),
    orderStatus: String(order.status ?? ""),
  });
  onApprovalRequested();
};
