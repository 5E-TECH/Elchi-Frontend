import type { useTranslation } from "react-i18next";
import {
  CircleDot,
  Clock,
  Inbox,
  Mail,
  Plus,
  Send,
  Store,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { ORDER_STATUS_REGISTRY, resolveDisplayOrderStatus, type TrackingEvent } from "../../../entities/order";
import type { User } from "../../../entities/user/model/types";
import { actionLabelMap } from "./actionLabelMap";

/**
 * TARIX YOZUVINI O'QISH — xom `GET orders/:id/tracking` hodisasidan ko'rinish modeli (sof funksiya).
 *
 * Mantiq avvalgi `TrackingTimelineItem` dagidek (kim bajargani, tizim hodisasida haqiqiy aktyor,
 * marketga qaytarish, pochta/filial/market nomlari, bog'liq va qo'shimcha ma'lumotlar). Dizayn v2
 * (`*-orders-detail` maketlari) uni bitta jumlaga yig'adi: «Ro'yxatchi **Bobur Xolmatov** buyurtmani
 * HQ'da qabul qildi», ostida holat o'tishi va vaqt.
 */

export type TrackingContext = {
  branchName?: string | null;
  postName?: string | null;
  marketName?: string | null;
  branchNamesById?: Record<string, string>;
  marketNamesById?: Record<string, string>;
};

type T = ReturnType<typeof useTranslation>["t"];

export const humanize = (value?: string | null) => {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asCleanString = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(text);
  return text && !looksLikeUuid ? text : "";
};

const asDisplayString = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

export const normalizeKey = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

const readNameByKeys = (source: unknown, keys: readonly string[]) => {
  if (!isRecord(source)) return "";
  for (const key of keys) {
    const value = source[key];
    const directValue = asCleanString(value);
    if (directValue) return directValue;
    if (isRecord(value)) {
      const nestedValue = asCleanString(value.name ?? value.full_name ?? value.fullName ?? value.title);
      if (nestedValue) return nestedValue;
    }
  }
  return "";
};

const getEventSources = (event: TrackingEvent) => [event.metadata, event.new_value, event.old_value, event];

const COURIER_KEYS = ["courier_name", "courierName", "courier", "courier_user_name", "courierUserName"];
const BRANCH_KEYS = [
  "branch_name",
  "branchName",
  "destination_branch_name",
  "destinationBranchName",
  "source_branch_name",
  "sourceBranchName",
  "from_branch_name",
  "fromBranchName",
  "to_branch_name",
  "toBranchName",
];
const POST_KEYS = ["post_name", "postName", "post", "mail_name", "mailName"];
const MARKET_KEYS = ["market_name", "marketName", "market"];

const RELATED_GROUPS = [
  { type: "courier", keys: COURIER_KEYS },
  { type: "branch", keys: BRANCH_KEYS },
  { type: "post", keys: POST_KEYS },
  { type: "market", keys: MARKET_KEYS },
  { type: "user", keys: ["user_name", "userName", "full_name", "fullName", "name"] },
] as const;

const DETAIL_GROUPS = [
  { type: "courier", keys: COURIER_KEYS },
  { type: "branch", keys: BRANCH_KEYS },
  { type: "post", keys: POST_KEYS },
  { type: "market", keys: MARKET_KEYS },
  { type: "phone", keys: ["phone", "phone_number", "phoneNumber", "courier_phone", "courierPhone"] },
] as const;

const getRelatedEntity = (event: TrackingEvent) => {
  for (const source of getEventSources(event)) {
    for (const group of RELATED_GROUPS) {
      const name = readNameByKeys(source, group.keys);
      if (name) return { name, type: group.type };
    }
  }
  return null;
};

const getRelatedDetails = (event: TrackingEvent) => {
  const details: Array<{ type: string; value: string }> = [];
  const seen = new Set<string>();
  for (const source of getEventSources(event)) {
    for (const group of DETAIL_GROUPS) {
      const value = readNameByKeys(source, group.keys);
      const detailKey = `${group.type}:${value.toLowerCase()}`;
      if (value && !seen.has(detailKey)) {
        seen.add(detailKey);
        details.push({ type: group.type, value });
      }
    }
  }
  return details;
};

const ID_NAME_PREFIXES: Record<string, string[]> = {
  branch: ["branch_name", "branchName", "destination_branch_name", "destinationBranchName", "target_branch_name", "targetBranchName"],
  source_branch: ["source_branch_name", "sourceBranchName", "source_branch", "sourceBranch"],
  destination_branch: ["destination_branch_name", "destinationBranchName", "destination_branch", "destinationBranch"],
  target_branch: ["target_branch_name", "targetBranchName", "target_branch", "targetBranch"],
  holder_branch: ["holder_branch_name", "holderBranchName", "holder_branch", "holderBranch"],
  market: ["market_name", "marketName"],
  courier: ["courier_name", "courierName", "courier_user_name", "courierUserName"],
  post: ["post_name", "postName", "post_title", "postTitle", "mail_name", "mailName"],
  customer: ["customer_name", "customerName"],
  district: ["district_name", "districtName"],
  region: ["region_name", "regionName"],
  product: ["product_name", "productName"],
  user: ["user_name", "userName", "full_name", "fullName", "name"],
};

const getIdPrefix = (key: string) =>
  normalizeKey(key)
    .replace(/_?id$/, "")
    .replace(/_?uuid$/, "");

const getNameForIdKey = (event: TrackingEvent, key: string, value: unknown, context?: TrackingContext) => {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey.endsWith("_id") && !normalizedKey.endsWith("id")) return "";

  if (isRecord(value)) {
    const nestedName = asCleanString(value.name ?? value.full_name ?? value.fullName ?? value.title);
    if (nestedName) return nestedName;
  }

  const prefix = getIdPrefix(key);

  if (prefix.includes("branch")) {
    const id = asDisplayString(value);
    const contextBranchName = id ? context?.branchNamesById?.[id] : "";
    if (contextBranchName) return contextBranchName;
    if (prefix !== "source_branch" && context?.branchName) return context.branchName;
  }

  if (prefix.includes("market")) {
    const id = asDisplayString(value);
    const contextMarketName = id ? context?.marketNamesById?.[id] : "";
    if (contextMarketName) return contextMarketName;
    if (context?.marketName) return context.marketName;
  }

  const nameKeys = ID_NAME_PREFIXES[prefix] ?? [`${prefix}_name`, `${prefix}Name`];
  for (const source of getEventSources(event)) {
    const name = readNameByKeys(source, nameKeys);
    if (name) return name;
  }
  return "";
};

const getAdditionalDetails = (event: TrackingEvent, context?: TrackingContext) => {
  const details: Array<{ key: string; label: string; value: string }> = [];
  const seen = new Set<string>();

  for (const source of [event.metadata, event.new_value, event.old_value]) {
    if (!isRecord(source)) continue;

    for (const [key, value] of Object.entries(source)) {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey === "status") continue;

      const isIdKey = normalizedKey.endsWith("_id") || normalizedKey.endsWith("id");
      const resolvedValue = getNameForIdKey(event, key, value, context);
      if (isIdKey && !resolvedValue) continue;

      const displayValue =
        resolvedValue ||
        (isRecord(value)
          ? asDisplayString(value.name ?? value.full_name ?? value.fullName ?? value.title ?? value.id)
          : asDisplayString(value));
      if (!displayValue) continue;

      const label = humanize(getIdPrefix(key) || key);
      const detailKey = `${label}:${displayValue}`;
      if (seen.has(detailKey)) continue;
      seen.add(detailKey);
      details.push({ key: normalizeKey(label), label, value: displayValue });
    }
  }

  return details.slice(0, 6);
};

const getCurrentUserName = (currentUser?: User | null) => currentUser?.name || currentUser?.username || "";

const isBranchWaitingHandlerRole = (role?: string | null) =>
  ["manager", "branch", "registrator"].includes(normalizeKey(role));

const isCourierReturnToWaitingEvent = (event: TrackingEvent) =>
  normalizeKey(event.old_value?.status ?? event.from_status) === "on_the_road" &&
  normalizeKey(event.new_value?.status ?? event.to_status) === "waiting";

const getCourierActorName = (event: TrackingEvent) => {
  for (const source of getEventSources(event)) {
    const courierName = readNameByKeys(source, COURIER_KEYS);
    if (courierName) return courierName;
  }
  return "";
};

const translateNote = (t: T, note?: string | null) => {
  if (!note) return "";
  const translated = t(`tracking.notes.${normalizeKey(note)}`, { defaultValue: "" });
  return translated || note;
};

const getTrackingName = (event: TrackingEvent, entity: "branch" | "post" | "market") => {
  const keys =
    entity === "branch"
      ? [
          "branch_name",
          "branchName",
          "destination_branch_name",
          "destinationBranchName",
          "target_branch_name",
          "targetBranchName",
          "to_branch_name",
          "toBranchName",
        ]
      : entity === "post"
        ? ["post_name", "postName", "post_title", "postTitle", "mail_name", "mailName"]
        : MARKET_KEYS;

  for (const source of getEventSources(event)) {
    const name = readNameByKeys(source, keys);
    if (name) return name;
  }
  return "";
};

// Backend `initiate-return`: holat o'zgarmaydi (`note`), izoh "Return initiated: <sabab>".
const RETURN_INITIATED_NOTE = /^\s*return initiated:\s*/i;

const getReturnInitiatedReason = (event: TrackingEvent) => {
  const note = String(event.note ?? event.description ?? "");
  return RETURN_INITIATED_NOTE.test(note) ? note.replace(RETURN_INITIATED_NOTE, "").trim() : null;
};

const isBulkCourierAssignEvent = (event: TrackingEvent) => {
  const note = normalizeKey(event.note ?? event.description);
  return normalizeKey(event.action) === "sent" && note.includes("courier") && note.includes("biriktirish");
};

const isCancelledPostCreatedEvent = (event: TrackingEvent) => {
  const action = normalizeKey(event.action);
  const note = normalizeKey(event.note ?? event.description);
  return action === "cancelled_sent" || note === "canceled_post_created" || note === "cancelled_post_created";
};

const isCancelledPostReceivedEvent = (event: TrackingEvent) => {
  const action = normalizeKey(event.action);
  const note = normalizeKey(event.note ?? event.description);
  return (
    action === "canceled_post_received" ||
    action === "cancelled_post_received" ||
    note.includes("canceled_order_received") ||
    note.includes("cancelled_order_received")
  );
};

const isSystemName = (value: unknown) => normalizeKey(String(value ?? "")) === "system";

const getActorName = (event: TrackingEvent, currentUser?: User | null) => {
  const actorName = asCleanString(event.actor?.name) || asCleanString(event.actor?.username);
  const currentUserName = getCurrentUserName(currentUser);
  const eventUserName = asCleanString(event.user_name);
  const changedByRole = normalizeKey(event.changed_by_role);
  const isSystemActor = isSystemName(actorName) || isSystemName(event.actor?.role) || changedByRole === "system";

  if (isSystemActor && isCourierReturnToWaitingEvent(event)) {
    if (isBranchWaitingHandlerRole(currentUser?.role) && currentUserName) return currentUserName;
    const courierName = getCourierActorName(event);
    if (courierName) return courierName;
    if (normalizeKey(currentUser?.role) === "courier" && currentUserName) return currentUserName;
  }

  if (actorName && !isSystemName(actorName)) return actorName;
  if (eventUserName && !isSystemName(eventUserName)) return eventUserName;

  const isCurrentUserAction = Boolean(currentUser?.id) && String(event.changed_by) === String(currentUser?.id);
  if (isCurrentUserAction && changedByRole !== "system" && currentUserName) return currentUserName;

  return humanize(event.changed_by_role || actorName || "system");
};

const getActorRole = (event: TrackingEvent, currentUser?: User | null) => {
  const actorRole = asCleanString(event.actor?.role);
  const isCurrentUserAction = Boolean(currentUser?.id) && String(event.changed_by) === String(currentUser?.id);
  const isSystemActor = isSystemName(actorRole) || isSystemName(event.changed_by_role);

  if (isSystemActor && isCourierReturnToWaitingEvent(event)) {
    if (isBranchWaitingHandlerRole(currentUser?.role)) return currentUser?.role;
    if (getCourierActorName(event) || normalizeKey(currentUser?.role) === "courier") return "courier";
  }

  if (actorRole && !isSystemName(actorRole)) return actorRole;
  if (event.changed_by_role && !isSystemName(event.changed_by_role)) return event.changed_by_role;
  if (isCurrentUserAction && currentUser?.role) return currentUser.role;
  return actorRole || event.changed_by_role;
};

const getActorPhone = (event: TrackingEvent, currentUser?: User | null) => {
  const actorPhone = asCleanString(event.actor?.phone_number) || asCleanString(event.actor?.phoneNumber);
  if (actorPhone) return actorPhone;

  const systemReturn =
    isCourierReturnToWaitingEvent(event) && isSystemName(event.actor?.role ?? event.changed_by_role);
  if (systemReturn && isBranchWaitingHandlerRole(currentUser?.role)) return asCleanString(currentUser?.phone_number);
  if (systemReturn && normalizeKey(currentUser?.role) === "courier") return asCleanString(currentUser?.phone_number);

  if (
    Boolean(currentUser?.id) &&
    String(event.changed_by) === String(currentUser?.id) &&
    !isSystemName(event.actor?.name) &&
    !isSystemName(event.actor?.role)
  ) {
    return asCleanString(currentUser?.phone_number);
  }
  return "";
};

const getRoleLabel = (t: T, role?: string | null) => {
  if (!role) return "";
  const normalizedRole = normalizeKey(role);
  return t(`tracking.roleValue.${normalizedRole}`, { defaultValue: "" }) || humanize(role);
};

/** Matnli izohdagi `branch #12`, `market 7ga`, `post #3` — nomlar bilan. */
const formatNoteWithNames = (note: string, event: TrackingEvent, t: T, actor: string, context?: TrackingContext) => {
  let formattedNote = note;
  const branchName = getTrackingName(event, "branch") || context?.branchName || "";
  const postName = getTrackingName(event, "post") || context?.postName || "";
  const marketName = getTrackingName(event, "market") || context?.marketName || "";

  formattedNote = formattedNote.replace(
    /\bbranch\s*#?(\d+)\b/gi,
    (match, branchId: string) => context?.branchNamesById?.[branchId] || branchName || match.replace(`#${branchId}`, branchId),
  );
  formattedNote = formattedNote.replace(/\bmarket\s*#?(\d+)(ga|da|dan)?\b/gi, (match, marketId: string, suffix = "") => {
    const resolvedMarket = context?.marketNamesById?.[marketId] || marketName;
    return resolvedMarket ? `${resolvedMarket}${suffix}` : match;
  });
  formattedNote = formattedNote.replace(/\bpost\s*#?\d+\b/gi, postName || t("tracking.entity.post"));

  if (branchName && /dispatch qilindi|dispatch|jo'natildi|jonatildi/i.test(formattedNote)) {
    return {
      key: "tracking.dynamic.dispatchToBranch",
      params: { actor, post: postName || t("tracking.entity.post"), branch: branchName },
    };
  }
  return formattedNote;
};

type Template = { key: string; params: Record<string, string> };

/**
 * Jumla shabloni (`tracking.dynamic.*`) yoki — mos shablon bo'lmasa — `null` (izoh alohida).
 * Shablonlar `{{actor}}` bilan; sahifa aktyorni qalin va rol nomi bilan chizadi.
 */
const getSentenceTemplate = (
  event: TrackingEvent,
  t: T,
  actor: string,
  context?: TrackingContext,
): Template | null => {
  const oldStatus = normalizeKey(event.old_value?.status ?? event.from_status);
  const newStatus = normalizeKey(event.new_value?.status ?? event.to_status);
  const transition = `${oldStatus}->${newStatus}`;
  const branch = getTrackingName(event, "branch") || context?.branchName || t("tracking.entity.branch");
  const post = getTrackingName(event, "post") || context?.postName || t("tracking.entity.post");
  const market = getTrackingName(event, "market") || context?.marketName || t("tracking.entity.market");
  const dynamic = (name: string, params: Record<string, string> = {}): Template => ({
    key: `tracking.dynamic.${name}`,
    params: { actor, ...params },
  });

  if (isBulkCourierAssignEvent(event)) return dynamic("assignedToCourier");
  const returnReason = getReturnInitiatedReason(event);
  if (returnReason !== null) return dynamic("returnInitiated", { reason: returnReason || "—" });
  if (newStatus === "returned_to_market") return dynamic("returnedToMarketByActor", { market });
  if (isCancelledPostCreatedEvent(event)) return dynamic("cancelledPostCreated");
  if (isCancelledPostReceivedEvent(event)) {
    const role = normalizeKey(event.actor?.role ?? event.changed_by_role);
    const note = normalizeKey(event.note ?? event.description);
    const isHqReceiver = ["admin", "superadmin", "registrator"].includes(role) || note.includes("market_handover");
    return dynamic(isHqReceiver ? "cancelledPostReceivedAtHq" : "cancelledPostReceivedAtBranch");
  }
  if (normalizeKey(event.action) === "created" || (!oldStatus && (newStatus === "new" || newStatus === "created"))) {
    return dynamic("createdByActor");
  }
  if (transition === "new->received") return dynamic("acceptedAtHq");
  if (transition === "received->on_the_road") return dynamic("dispatchToBranch", { post, branch });
  if (transition === "waiting->on_the_road") return dynamic("sentToCourier");
  if (transition === "on_the_road->waiting") return dynamic("returnedToWaiting");
  if (newStatus === "cancelled") return dynamic("cancelledByActor");
  if (newStatus === "sold") return dynamic("soldByActor");
  if (oldStatus === "cancelled_sent" && newStatus === "closed") return dynamic("cancelledOrderHandedToMarket", { market });
  return null;
};

/** Yozuv ikonkasi (`.el-stat-icon` doirasi) — maketlardagidek hodisa turiga qarab. */
const getEventIcon = (event: TrackingEvent, templateKey: string | null): LucideIcon => {
  switch (templateKey) {
    case "tracking.dynamic.returnInitiated":
      return Undo2;
    case "tracking.dynamic.returnedToMarketByActor":
    case "tracking.dynamic.cancelledOrderHandedToMarket":
      return Store;
    case "tracking.dynamic.assignedToCourier":
    case "tracking.dynamic.sentToCourier":
      return Truck;
    case "tracking.dynamic.cancelledPostCreated":
      return Send;
    case "tracking.dynamic.cancelledPostReceivedAtHq":
    case "tracking.dynamic.cancelledPostReceivedAtBranch":
    case "tracking.dynamic.acceptedAtHq":
      return Inbox;
    case "tracking.dynamic.dispatchToBranch":
      return Mail;
    case "tracking.dynamic.returnedToWaiting":
      return Clock;
    case "tracking.dynamic.createdByActor":
      return Plus;
    default: {
      const key = resolveDisplayOrderStatus(event.new_value?.status ?? event.to_status);
      return key ? ORDER_STATUS_REGISTRY[key].icon : CircleDot;
    }
  }
};

/** Aktyor o'rnini belgilovchi (jumlani «oldin · aktyor · keyin» ga ajratish uchun). */
const ACTOR_MARK = "\u0001";

export type TrackingDetail = { label: string; value: string; kind?: "phone" };

export interface TrackingEventView {
  /** Amal nomi («Qaytarish so'raldi», «Holat o'zgartirildi») — holat o'zgarmagan yozuvda belgi. */
  actionName: string;
  actor: string;
  /** Aktyor roli («Ro'yxatchi», «Menejer») — jumla boshida. */
  roleLabel: string;
  /** Shablon jumla aktyor atrofida bo'lingan: `before` + rol + **aktyor** + `after`. */
  sentence: { before: string; after: string };
  /** Shablonga tushmagan matnli izoh (`Izoh: …` bloki). */
  note: string;
  details: TrackingDetail[];
  oldStatus: string | null;
  newStatus: string | null;
  icon: LucideIcon;
}

export const describeTrackingEvent = (
  event: TrackingEvent,
  t: T,
  currentUser?: User | null,
  context?: TrackingContext,
): TrackingEventView => {
  const actionKey = normalizeKey(event.action);
  const actionLabelKey = event.action ? (actionLabelMap[event.action] ?? actionLabelMap[actionKey]) : undefined;
  const actionName =
    getReturnInitiatedReason(event) !== null
      ? t("tracking.action.returnRequested")
      : isBulkCourierAssignEvent(event)
        ? t("tracking.action.courierAssigned")
        : isCancelledPostCreatedEvent(event)
          ? t("tracking.action.cancelledPostCreated")
          : isCancelledPostReceivedEvent(event)
            ? t("tracking.action.cancelledPostReceived")
            : actionLabelKey
              ? t(actionLabelKey)
              : humanize(event.action);

  const actor = getActorName(event, currentUser);
  const roleLabel = getRoleLabel(t, getActorRole(event, currentUser));

  let template = getSentenceTemplate(event, t, actor, context);
  let note = "";
  if (!template) {
    const formatted = formatNoteWithNames(translateNote(t, event.note || event.description), event, t, actor, context);
    if (typeof formatted === "string") note = formatted;
    else template = formatted;
  }

  const sentence = (() => {
    if (!template) return { before: "", after: "" };
    const text = t(template.key, { ...template.params, actor: ACTOR_MARK });
    const index = text.indexOf(ACTOR_MARK);
    if (index < 0) return { before: "", after: ` — ${text}` };
    return { before: text.slice(0, index), after: text.slice(index + ACTOR_MARK.length) };
  })();
  const sentenceText = `${sentence.before} ${actor} ${sentence.after} ${note}`.toLowerCase();

  // Bog'liq va qo'shimcha ma'lumotlar: jumlada allaqachon bor nom takrorlanmaydi.
  const seen = new Set<string>([normalizeKey(actor)]);
  const details: TrackingDetail[] = [];
  const pushDetail = (detail: TrackingDetail) => {
    const key = normalizeKey(detail.value);
    if (!key || seen.has(key) || sentenceText.includes(detail.value.toLowerCase())) return;
    seen.add(key);
    details.push(detail);
  };

  const actorPhone = getActorPhone(event, currentUser);
  if (actorPhone) pushDetail({ label: t("tracking.entity.phone"), value: actorPhone, kind: "phone" });
  const relatedEntity = getRelatedEntity(event);
  for (const detail of getRelatedDetails(event)) {
    if (normalizeKey(detail.value) === normalizeKey(actor) && detail.type === relatedEntity?.type) continue;
    pushDetail({
      label: t(`tracking.entity.${detail.type}`, { defaultValue: humanize(detail.type) }),
      value: detail.value,
      kind: detail.type === "phone" ? "phone" : undefined,
    });
  }
  for (const detail of getAdditionalDetails(event, context)) {
    pushDetail({ label: t(`tracking.field.${detail.key}`, { defaultValue: detail.label }), value: detail.value });
  }

  return {
    actionName,
    actor,
    roleLabel,
    sentence,
    note,
    details,
    oldStatus: event.old_value?.status ?? event.from_status ?? null,
    newStatus: event.new_value?.status ?? event.to_status ?? null,
    icon: getEventIcon(event, template?.key ?? null),
  };
};
