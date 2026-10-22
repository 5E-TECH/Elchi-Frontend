import {
  cleanBranchLabel,
  normalizeOrderStatus,
  readCancelHandoverInfo,
  resolveCancelReturnPlace,
  resolveCancelReturnStage,
  type CancelHandoverInfo,
  type CancelReturnStage,
  type TrackingEvent,
} from "../../../entities/order";

/**
 * «QAYTARISH YO'LI» — bekor qilingan posilkaning zanjiri (taklif §3.3, maketlar
 * `superadmin-orders-detail-cancelled`, `manager-orders-detail-cancelled`, `market-orders-detail-cancelled`).
 *
 * Manba — `GET orders/:id/tracking` (holat hodisalari + custody hodisalari, backend bitta ro'yxatda beradi):
 *   1. «Bekor qilindi»  — `to_status: cancelled` (kuryer / menejer; sabab — `return_reason`);
 *   2. «Jo'natildi»      — `to_status: cancelled (sent)`; maqsad — shu vaqtdagi custody hodisasining
 *                          `new_value.holder_*` (backend filial yorlig'i), pochta № — keyingi qabulning
 *                          `metadata.canceled_post_id`;
 *   3. «Qabul qilindi»   — `action: cancelled_post_received`; joy — `metadata.destination_branch`
 *                          (HQ'da — `received_by_hq`); filial → HQ zanjirida 2–3 qadam ikki marta;
 *   4. «Marketga topshirildi» — `to_status: returned_to_market`; usul — `readCancelHandoverInfo`.
 * Yopilmagan zanjirda oxirida «kutilmoqda» qadami (bosqichdan: jo'natish / qabul / topshirish).
 *
 * Sof funksiya: taxmin yo'q — yo'q nom `null` qoladi va UI uni chizmaydi.
 */

export type ReturnPathStepKind = "cancelled" | "sent" | "received" | "handed";

export interface ReturnPathStep {
  id: string;
  kind: ReturnPathStepKind;
  /** Hodisa vaqti (backend ISO `+05:00`). */
  at: string;
  actor: string | null;
  /** Aktyor roli (`courier`, `registrator`, `manager` …) — `tracking.roleValue.*`. */
  role: string | null;
  /** «Bekor qilindi»: tuman; «Qabul qilindi» / «Marketga topshirildi»: joy; «Jo'natildi»: qayerdan. */
  place: string | null;
  /** «Jo'natildi»: qayerga. */
  to: string | null;
  postId: string | null;
  /** «Bekor qilindi»: sabab (kod yoki matn). */
  reason: string | null;
  /** «Marketga topshirildi»: market nomi va usul. */
  market: string | null;
  handover: CancelHandoverInfo | null;
}

export type ReturnPathPendingKind = "send" | "receive" | "handover";

export interface ReturnPathPending {
  kind: ReturnPathPendingKind;
  place: string | null;
  days: number | null;
  /** Filialdagi posilka: market olib ketishi YOKI HQ'ga jo'natilishi kutiladi. */
  atBranch: boolean;
}

export interface ReturnPath {
  stage: CancelReturnStage;
  steps: ReturnPathStep[];
  pending: ReturnPathPending | null;
  closed: boolean;
  /** Posilka hozir turgan joy (marketga «olib ketishingiz mumkin» matni uchun). */
  currentPlace: string | null;
  /** Buyurtma marketining nomi («Nur Elektronika olib ketishi kutilmoqda»). */
  market: string | null;
  /** Aniqlangan HQ nomi (`HQ_FALLBACK` emas) — tarix jumlalari ham shu nomni aytsin. */
  hqName: string | null;
}

/** HQ nomi noma'lum bo'lsa — «HQ» (uchala tilda bir xil). */
export const HQ_FALLBACK = "HQ";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const key = (value: unknown) =>
  text(value)
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[\s-]+/g, "_");

const timeOf = (event: TrackingEvent) => {
  const raw = asRecord(event);
  const ms = Number(raw.created_at_ms);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const parsed = Date.parse(event.created_at);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isCustodyEvent = (event: TrackingEvent) =>
  key(asRecord(event).event_type) === "custody" ||
  ["custody_change", "custody_changed"].includes(key(event.action));

const toStatusOf = (event: TrackingEvent) =>
  normalizeOrderStatus(event.new_value?.status ?? event.to_status);
const fromStatusOf = (event: TrackingEvent) =>
  normalizeOrderStatus(event.old_value?.status ?? event.from_status);

const isReceiveEvent = (event: TrackingEvent) => {
  const action = key(event.action);
  const note = key(event.note ?? event.description);
  return (
    action === "cancelled_post_received" ||
    action === "canceled_post_received" ||
    note.includes("canceled_order_received") ||
    note.includes("cancelled_order_received")
  );
};

const isSendEvent = (event: TrackingEvent) =>
  !isReceiveEvent(event) &&
  (toStatusOf(event) === "cancelled (sent)" || key(event.action) === "cancelled_sent");

const isCancelEvent = (event: TrackingEvent) => {
  if (isReceiveEvent(event) || toStatusOf(event) !== "cancelled") return false;
  const from = fromStatusOf(event);
  return from !== "cancelled" && from !== "cancelled (sent)";
};

/** Bekor oqimidagi holatlar — ulardan tashqariga o'tish eski bekor zanjirini uzadi. */
const CANCEL_FLOW_STATUSES = new Set<string>(["cancelled", "cancelled (sent)", "returned_to_market", "closed"]);

const isHandoverEvent = (event: TrackingEvent) =>
  readCancelHandoverInfo(event) !== null ||
  (fromStatusOf(event) === "cancelled (sent)" && toStatusOf(event) === "closed");

const isFlowBreak = (event: TrackingEvent) => {
  if (isReceiveEvent(event) || isHandoverEvent(event)) return false;
  const to = toStatusOf(event);
  return to !== null && !CANCEL_FLOW_STATUSES.has(to);
};

const actorOf = (event: TrackingEvent) => {
  const name = text(event.actor?.name) || text(event.actor?.username) || text(event.user_name);
  return name && name.toLowerCase() !== "system" ? name : null;
};

const roleOf = (event: TrackingEvent) => {
  const role = text(event.actor?.role) || text(event.changed_by_role);
  return role && role.toLowerCase() !== "system" ? role.toLowerCase() : null;
};

export interface BuildReturnPathOptions {
  /** HQ filialining nomi («Toshkent HQ»), agar ma'lum bo'lsa. */
  hqName?: string | null;
  now?: number;
}

/** Custody yozuvining (`old_value` / `new_value`) joy nomi. */
const holderPlace = (value: unknown, hq: string): string | null => {
  const record = asRecord(value);
  const type = text(record.holder_type).toUpperCase();
  if (type === "HQ") return hq;
  if (type === "BRANCH") return cleanBranchLabel(record.holder_branch);
  return null;
};

export const buildReturnPath = (
  rawEvents: readonly TrackingEvent[],
  order: unknown,
  options: BuildReturnPathOptions = {},
): ReturnPath | null => {
  const stage = resolveCancelReturnStage(order);
  if (!stage) return null;
  const record = asRecord(order);
  const marketName = text(asRecord(record.market).name) || null;
  const district = text(asRecord(record.district).name) || null;
  const reason = text(record.return_reason) || null;

  const events = [...rawEvents].sort((a, b) => timeOf(a) - timeOf(b));
  const custody = events.filter(isCustodyEvent);
  const status = events.filter((event) => !isCustodyEvent(event));

  /**
   * Zanjir oxirgi bekor qilishdan boshlanadi (qayta tiklanib, yana bekor qilingan bo'lishi mumkin). Bekor
   * qilishdan keyin bekor oqimidan tashqari holatga o'tilgan bo'lsa (tiklangan; `/returns` oqimi:
   * `waiting → returned_to_market`), o'sha eski bekor zanjiri olinmaydi — zanjir oxirgi shunday o'tishdan keyin.
   */
  let lastCancel = -1;
  let lastBreak = -1;
  status.forEach((event, index) => {
    if (isCancelEvent(event)) lastCancel = index;
    else if (isFlowBreak(event)) lastBreak = index;
  });
  const chain = status.slice(lastCancel > lastBreak ? lastCancel : lastBreak + 1);

  /** Jo'natish hodisasiga ENG yaqin custody hodisasi (±60 s). */
  const custodyNear = (event: TrackingEvent) => {
    const at = timeOf(event);
    let best: TrackingEvent | null = null;
    let bestGap = Infinity;
    for (const item of custody) {
      const gap = Math.abs(timeOf(item) - at);
      if (gap <= 60_000 && gap < bestGap) {
        best = item;
        bestGap = gap;
      }
    }
    return best;
  };

  /**
   * HQ nomi: berilgan bo'lsa — u; aks holda posilka HQ'dan o'tib, hozir ham o'sha joyga bog'liq bo'lsa
   * (HQ'dan topshirilgan / HQ'ga ketmoqda) — buyurtmaning `branch` i (bekor oqimida `branch_id` HQ filiali bo'ladi).
   */
  const lastReceive = [...chain].reverse().find(isReceiveEvent);
  const lastReceiveByHq =
    asRecord(lastReceive?.metadata).received_by_hq === true || key(lastReceive?.note).includes("market_handover");
  const lastSendToHq = (() => {
    const send = [...chain].reverse().find(isSendEvent);
    const near = send ? custodyNear(send) : null;
    return text(asRecord(near?.new_value).holder_type).toUpperCase() === "HQ";
  })();
  const branchName = text(asRecord(record.branch).name) || null;
  const hqFromOrder =
    (stage === "market" && lastReceiveByHq) || (stage === "in_transit" && lastSendToHq) ? branchName : null;
  const hq = options.hqName?.trim() || hqFromOrder || HQ_FALLBACK;

  const steps: ReturnPathStep[] = [];
  let lastPlace: string | null = null;
  const base = (event: TrackingEvent, kind: ReturnPathStepKind): ReturnPathStep => ({
    id: String(event.id),
    kind,
    at: event.created_at,
    actor: actorOf(event),
    role: roleOf(event),
    place: null,
    to: null,
    postId: null,
    reason: null,
    market: null,
    handover: null,
  });

  chain.forEach((event, index) => {
    if (isCancelEvent(event)) {
      steps.push({ ...base(event, "cancelled"), place: district, reason });
      return;
    }
    if (isSendEvent(event)) {
      const near = custodyNear(event);
      const to = near ? holderPlace(near.new_value, hq) : null;
      const from = near ? (holderPlace(near.old_value, hq) ?? lastPlace) : lastPlace;
      // Pochta №: keyingi qabul hodisasi (`metadata.canceled_post_id`) yoki — hali yo'lda — buyurtmaning o'zi.
      const receipt = chain.slice(index + 1).find(isReceiveEvent);
      const receiptMeta = asRecord(receipt?.metadata);
      const postId =
        text(receiptMeta.canceled_post_id) ||
        text(asRecord(receipt?.old_value).canceled_post_id) ||
        (!receipt ? text(record.canceled_post_id) : "") ||
        null;
      const role = roleOf(event);
      steps.push({ ...base(event, "sent"), place: role === "courier" ? null : from, to, postId });
      return;
    }
    if (isReceiveEvent(event)) {
      const metadata = asRecord(event.metadata);
      const byHq = metadata.received_by_hq === true || key(event.note).includes("market_handover");
      const previousTo = [...steps].reverse().find((step) => step.kind === "sent")?.to ?? null;
      const place = byHq ? hq : (cleanBranchLabel(metadata.destination_branch) ?? previousTo);
      lastPlace = place;
      steps.push({ ...base(event, "received"), place });
      return;
    }
    if (isHandoverEvent(event)) {
      const handover = readCancelHandoverInfo(event) ?? { method: "qr", reason: null };
      const place = lastPlace ?? (text(asRecord(record.branch).name) || null);
      steps.push({ ...base(event, "handed"), place, market: marketName, handover });
    }
  });

  const placeNow = resolveCancelReturnPlace(order, stage, { now: options.now });
  const closed = stage === "market";
  const pending: ReturnPathPending | null = (() => {
    switch (stage) {
      case "courier":
        return { kind: "send", place: null, days: placeNow?.days ?? null, atBranch: false };
      case "in_transit":
        return {
          kind: "receive",
          place:
            placeNow?.name ?? [...steps].reverse().find((step) => step.kind === "sent")?.to ?? null,
          days: null,
          atBranch: false,
        };
      case "branch":
        return {
          kind: "handover",
          place: placeNow?.name ?? lastPlace,
          days: placeNow?.days ?? null,
          atBranch: true,
        };
      case "hq":
        return {
          kind: "handover",
          place: placeNow?.name ?? lastPlace ?? hq,
          days: placeNow?.days ?? null,
          atBranch: false,
        };
      default:
        return null;
    }
  })();

  return {
    stage,
    steps,
    pending,
    closed,
    currentPlace: stage === "branch" || stage === "hq" ? (pending?.place ?? null) : null,
    market: marketName,
    hqName: hq === HQ_FALLBACK ? null : hq,
  };
};
