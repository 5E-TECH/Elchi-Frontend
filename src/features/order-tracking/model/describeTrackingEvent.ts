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
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  ORDER_STATUS_REGISTRY,
  cleanBranchLabel,
  formatCancelHandoverMethod,
  readCancelHandoverInfo,
  resolveDisplayOrderStatus,
  type TrackingEvent,
} from "../../../entities/order";
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
  /**
   * HQ (bosh ofis) filialining nomi («Toshkent HQ»), agar ma'lum bo'lsa — bekor pochtasini HQ qabul qilgan
   * jumlada joy nomi sifatida (backend metadata'da HQ uchun faqat `received_by_hq: true` beradi).
   */
  hqName?: string | null;
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

/**
 * Jumlaning o'zida aytilgan bekor qaytarish maydonlari — alohida «qo'shimcha ma'lumot» bo'lib takrorlanmaydi
 * (`manual_override: true` / xom «Urgut filiali (UR, ID: 12)» yorlig'i ko'rinmasin). `source_branch` — backend
 * xatosi bilan noto'g'ri manba (BG5), ko'rsatilmaydi.
 */
const SENTENCE_METADATA_KEYS = new Set([
  "manual_override",
  "manual_reason",
  "received_by_hq",
  "destination_branch",
  "source_branch",
  // Bekor buyurtmani marketga topshirish usuli — jumlaning o'zida («QR orqali», «qo'lda tasdiq»), xom «Method: qr» emas.
  "method",
]);

/**
 * vbu7Wr3o: ichki identifikatorlar — «Received By: 101» kabi xom qator chiqmasin. `*_by` (kim qabul qildi / yaratdi)
 * — foydalanuvchi id'si; kim bajargani jumlada aktyor sifatida bor.
 */
const isInternalUserRefKey = (normalizedKey: string) => normalizedKey.endsWith("_by");

/** Saqlovchi / jo'natuvchi turi (`HQ` · `BRANCH` · `COURIER` · `MARKET`) qiymati — o'zbekcha nom (`tracking.holderValue.*`). */
const HOLDER_TYPE_VALUE_KEYS = new Set(["from_holder_type", "to_holder_type", "holder_type", "source_type"]);
/** Rol qiymati («manager») — `tracking.roleValue.*` («Menejer»). */
const ROLE_VALUE_KEYS = new Set(["source_user_role", "changed_by_role", "requester_role"]);

const formatMetadataValue = (t: T, normalizedKey: string, value: string) => {
  if (HOLDER_TYPE_VALUE_KEYS.has(normalizedKey)) {
    return t(`tracking.holderValue.${normalizeKey(value)}`, { defaultValue: "" }) || humanize(value.toLowerCase());
  }
  if (ROLE_VALUE_KEYS.has(normalizedKey)) return getRoleLabel(t, value);
  return value;
};

const getAdditionalDetails = (event: TrackingEvent, t: T, context?: TrackingContext) => {
  const details: Array<{ key: string; label: string; value: string }> = [];
  const seen = new Set<string>();

  for (const source of [event.metadata, event.new_value, event.old_value]) {
    if (!isRecord(source)) continue;

    for (const [key, value] of Object.entries(source)) {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey === "status" || SENTENCE_METADATA_KEYS.has(normalizedKey)) continue;
      if (isInternalUserRefKey(normalizedKey)) continue;

      const isIdKey = normalizedKey.endsWith("_id") || normalizedKey.endsWith("id");
      const resolvedValue = getNameForIdKey(event, key, value, context);
      if (isIdKey && !resolvedValue) continue;

      const rawValue =
        resolvedValue ||
        (isRecord(value)
          ? asDisplayString(value.name ?? value.full_name ?? value.fullName ?? value.title ?? value.id)
          : asDisplayString(value));
      const displayValue = rawValue && !resolvedValue ? formatMetadataValue(t, normalizedKey, rawValue) : rawValue;
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

const isSystemEvent = (event: TrackingEvent) =>
  isSystemName(event.actor?.name ?? event.actor?.username) ||
  isSystemName(event.actor?.role) ||
  normalizeKey(event.changed_by_role) === "system";

/**
 * Aktyor ismi. Tizim hodisasi (`changed_by_role: "system"`) — «Tizim» (D-04): uni kim bajarganini API
 * aytmaydi, shuning uchun ism taxmin qilinmaydi (ilgari joriy foydalanuvchi yoki qo'shni hodisa aktyori
 * yozilardi — boshqa odamga). Yagona istisno — hodisaning o'zida kuryer nomi bo'lsa (kuryer qaytargan).
 */
const getActorName = (event: TrackingEvent, t: T, currentUser?: User | null) => {
  const actorName = asCleanString(event.actor?.name) || asCleanString(event.actor?.username);
  const currentUserName = getCurrentUserName(currentUser);
  const eventUserName = asCleanString(event.user_name);
  const isSystemActor = isSystemEvent(event);

  if (isSystemActor && isCourierReturnToWaitingEvent(event)) {
    const courierName = getCourierActorName(event);
    if (courierName) return courierName;
  }

  if (actorName && !isSystemName(actorName)) return actorName;
  if (eventUserName && !isSystemName(eventUserName)) return eventUserName;
  if (isSystemActor) return t("tracking.roleValue.system");

  const isCurrentUserAction = Boolean(currentUser?.id) && String(event.changed_by) === String(currentUser?.id);
  if (isCurrentUserAction && currentUserName) return currentUserName;

  // Ism yo'q — rol nomi («Menejer»), inglizcha «Manager» emas.
  return getRoleLabel(t, event.changed_by_role) || t("tracking.roleValue.system");
};

const getActorRole = (event: TrackingEvent, currentUser?: User | null) => {
  const actorRole = asCleanString(event.actor?.role);
  const isCurrentUserAction = Boolean(currentUser?.id) && String(event.changed_by) === String(currentUser?.id);
  const isSystemActor = isSystemName(actorRole) || isSystemName(event.changed_by_role);

  if (isSystemActor && isCourierReturnToWaitingEvent(event) && getCourierActorName(event)) return "courier";

  if (actorRole && !isSystemName(actorRole)) return actorRole;
  if (event.changed_by_role && !isSystemName(event.changed_by_role)) return event.changed_by_role;
  if (isCurrentUserAction && !isSystemActor && currentUser?.role) return currentUser.role;
  return actorRole || event.changed_by_role;
};

const getActorPhone = (event: TrackingEvent, currentUser?: User | null) => {
  const actorPhone = asCleanString(event.actor?.phone_number) || asCleanString(event.actor?.phoneNumber);
  if (actorPhone) return actorPhone;

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
      key: dispatchTemplateKey(branchName),
      params: { actor, post: postName || t("tracking.entity.postInSentence"), branch: branchName },
    };
  }
  return formattedNote;
};

type Template = { key: string; params: Record<string, string> };

/**
 * vbu7Wr3o: nomning o'zida «filial» so'zi bor («TEST Claude Surxondaryo filiali», «Филиал Самарканд») — jumlada
 * «… filiali filialiga» takrorlanmasin: shablon nomni o'zi qo'shimchasiz oladi (`dispatchToNamedBranch`).
 */
const BRANCH_WORD = /(^|[\s(«"])(filial|filiali|филиал[а-яё]*)($|[\s)»".,])/iu;
export const branchNameHasBranchWord = (name: string) => BRANCH_WORD.test(name.trim());

const dispatchTemplateKey = (branch: string) =>
  branchNameHasBranchWord(branch) ? "tracking.dynamic.dispatchToNamedBranch" : "tracking.dynamic.dispatchToBranch";

/**
 * vbu7Wr3o: filial menejeri / kuryer pochtani qabul qildi (`on the road → waiting`, `action: "post_received"`,
 * metadata `{ post_id, branch_name }` yoki `{ post_id, courier_name }`). Eski yozuvlar (`action: "waiting"`,
 * `changed_by: "system"`) — o'zgarmaydi.
 */
export const isPostReceivedEvent = (event: TrackingEvent) => normalizeKey(event.action) === "post_received";

/** 6kHnNH9j: `action: warehouse_returned` — ombor buyurtmasi bekor bo'lib, mahsulot omborga qaytdi. */
export const isWarehouseReturnedEvent = (event: TrackingEvent) => normalizeKey(event.action) === "warehouse_returned";

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
  // Gap o'rtasida: nomi noma'lum pochta — kichik harf bilan («… pochtani HQ'dan Urgut filialiga jo'natdi», D-05).
  const post = getTrackingName(event, "post") || context?.postName || t("tracking.entity.postInSentence");
  const market = getTrackingName(event, "market") || context?.marketName || t("tracking.entity.market");
  const dynamic = (name: string, params: Record<string, string> = {}): Template => ({
    key: `tracking.dynamic.${name}`,
    params: { actor, ...params },
  });

  if (isBulkCourierAssignEvent(event)) return dynamic("assignedToCourier");
  // 6kHnNH9j: ombor buyurtmasining omborga qaytishi (`→ returned_to_market`, lekin marketga topshirish emas).
  if (isWarehouseReturnedEvent(event)) return dynamic("warehouseReturnedByActor");
  const returnReason = getReturnInitiatedReason(event);
  if (returnReason !== null) return dynamic("returnInitiated", { reason: returnReason || "—" });
  // Usul hodisadan («QR orqali», «qo'lda tasdiq — sabab», «QR'siz») — endi «QR tasdiq bilan» qotirib yozilmaydi.
  const handover = readCancelHandoverInfo(event);
  if (handover) {
    return dynamic("returnedToMarketByActor", { market, method: formatCancelHandoverMethod(t, handover) ?? "" });
  }
  if (isCancelledPostCreatedEvent(event)) return dynamic("cancelledPostCreated");
  if (isCancelledPostReceivedEvent(event)) {
    const role = normalizeKey(event.actor?.role ?? event.changed_by_role);
    const note = normalizeKey(event.note ?? event.description);
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    // Aniq bayroq ustun: filial registratori o'z filialida qabul qilsa `received_by_hq: false` — joy filial.
    const isHqReceiver =
      typeof metadata.received_by_hq === "boolean"
        ? metadata.received_by_hq
        : ["admin", "superadmin", "registrator"].includes(role) ||
          note.includes("market_handover") ||
          note.includes("received_by_hq");
    // Joy nomi (`metadata.destination_branch`, «Urgut filiali (UR, ID: 12)» → «Urgut filiali»); HQ'da — HQ nomi.
    const place = isHqReceiver
      ? (context?.hqName ?? null)
      : cleanBranchLabel(metadata.destination_branch ?? metadata.destination_branch_name);
    if (place) return dynamic("cancelledPostReceivedAtPlace", { place });
    return dynamic(isHqReceiver ? "cancelledPostReceivedAtHq" : "cancelledPostReceivedAtBranch");
  }
  if (normalizeKey(event.action) === "created" || (!oldStatus && (newStatus === "new" || newStatus === "created"))) {
    return dynamic("createdByActor");
  }
  if (transition === "new->received") return dynamic("acceptedAtHq");
  // vbu7Wr3o: qabul yozuvi `on_the_road->waiting` umumiy jumlasidan («… kutilmoqda holatiga qaytardi») OLDIN.
  if (isPostReceivedEvent(event)) {
    // Faqat yozuvdagi filial nomi (yozuv paytidagi) — buyurtmaning JORIY filiali (`context.branchName`) emas.
    const receivedAt = getTrackingName(event, "branch");
    return receivedAt ? dynamic("postReceivedAtBranch", { branch: receivedAt }) : dynamic("postReceived");
  }
  if (transition === "received->on_the_road") {
    return { key: dispatchTemplateKey(branch), params: { actor, post, branch } };
  }
  if (transition === "waiting->on_the_road") return dynamic("sentToCourier");
  if (transition === "on_the_road->waiting") return dynamic("returnedToWaiting");
  if (newStatus === "cancelled") return dynamic("cancelledByActor");
  if (newStatus === "sold") return dynamic("soldByActor");
  if (oldStatus === "cancelled_sent" && newStatus === "closed") {
    return dynamic("cancelledOrderHandedToMarket", {
      market,
      method: formatCancelHandoverMethod(t, { method: "qr", reason: null }) ?? "",
    });
  }
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
    case "tracking.dynamic.warehouseReturnedByActor":
      return Warehouse;
    case "tracking.dynamic.assignedToCourier":
    case "tracking.dynamic.sentToCourier":
      return Truck;
    case "tracking.dynamic.cancelledPostCreated":
      return Send;
    case "tracking.dynamic.cancelledPostReceivedAtHq":
    case "tracking.dynamic.cancelledPostReceivedAtBranch":
    case "tracking.dynamic.cancelledPostReceivedAtPlace":
    case "tracking.dynamic.acceptedAtHq":
    case "tracking.dynamic.postReceived":
    case "tracking.dynamic.postReceivedAtBranch":
      return Inbox;
    case "tracking.dynamic.dispatchToBranch":
    case "tracking.dynamic.dispatchToNamedBranch":
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
  /** 6kHnNH9j: omborga qaytish — yangi holat belgisi «Omborga qaytdi» («Marketga topshirildi» emas). */
  warehouseReturn: boolean;
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

  const actor = getActorName(event, t, currentUser);
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
  for (const detail of getAdditionalDetails(event, t, context)) {
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
    warehouseReturn: isWarehouseReturnedEvent(event),
  };
};
