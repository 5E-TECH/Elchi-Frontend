import { ArrowRight, CheckCircle2, Clock3, FileText, UserRound, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TrackingEvent } from "../../../entities/order";
import type { User } from "../../../entities/user/model/types";
import { formatTrackingDate } from "../lib/formatTrackingDate";
import { actionLabelMap } from "../model/actionLabelMap";

type TrackingTimelineItemProps = {
  event: TrackingEvent;
  index: number;
  total: number;
  currentUser?: User | null;
  context?: {
    branchName?: string | null;
    postName?: string | null;
  };
};

const humanize = (value?: string | null) => {
  if (!value) {
    return "—";
  }

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
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  const text = String(value).trim();
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(text);

  return text && !looksLikeUuid ? text : "";
};

const asDisplayString = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || "";
  }

  return "";
};

const readNameByKeys = (source: unknown, keys: string[]) => {
  if (!isRecord(source)) {
    return "";
  }

  for (const key of keys) {
    const value = source[key];
    const directValue = asCleanString(value);

    if (directValue) {
      return directValue;
    }

    if (isRecord(value)) {
      const nestedValue = asCleanString(value.name ?? value.full_name ?? value.fullName ?? value.title);

      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return "";
};

const getEventSources = (event: TrackingEvent) => [
  event.metadata,
  event.new_value,
  event.old_value,
  event,
];

const getRelatedEntity = (event: TrackingEvent) => {
  const sources = getEventSources(event);
  const groups = [
    {
      type: "courier",
      keys: ["courier_name", "courierName", "courier", "courier_user_name", "courierUserName"],
    },
    {
      type: "branch",
      keys: [
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
      ],
    },
    {
      type: "post",
      keys: ["post_name", "postName", "post", "mail_name", "mailName"],
    },
    {
      type: "market",
      keys: ["market_name", "marketName", "market"],
    },
    {
      type: "user",
      keys: ["user_name", "userName", "full_name", "fullName", "name"],
    },
  ];

  for (const source of sources) {
    for (const group of groups) {
      const name = readNameByKeys(source, group.keys);

      if (name) {
        return { name, type: group.type };
      }
    }
  }

  return null;
};

const detailGroups = [
  {
    type: "courier",
    keys: ["courier_name", "courierName", "courier", "courier_user_name", "courierUserName"],
  },
  {
    type: "branch",
    keys: [
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
    ],
  },
  {
    type: "post",
    keys: ["post_name", "postName", "post", "mail_name", "mailName"],
  },
  {
    type: "market",
    keys: ["market_name", "marketName", "market"],
  },
  {
    type: "phone",
    keys: ["phone", "phone_number", "phoneNumber", "courier_phone", "courierPhone"],
  },
] as const;

const getRelatedDetails = (event: TrackingEvent) => {
  const sources = getEventSources(event);
  const details: Array<{ type: string; value: string }> = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const group of detailGroups) {
      const value = readNameByKeys(source, [...group.keys]);
      const detailKey = `${group.type}:${value.toLowerCase()}`;

      if (value && !seen.has(detailKey)) {
        seen.add(detailKey);
        details.push({ type: group.type, value });
      }
    }
  }

  return details;
};

const getAdditionalDetails = (event: TrackingEvent) => {
  const ignoredKeys = new Set(["status"]);
  const details: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  for (const source of [event.metadata, event.new_value, event.old_value]) {
    if (!isRecord(source)) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      if (ignoredKeys.has(normalizeKey(key))) {
        continue;
      }

      const resolvedValue = getNameForIdKey(event, key, value);
      const displayValue = resolvedValue || (isRecord(value)
        ? asDisplayString(value.name ?? value.full_name ?? value.fullName ?? value.title ?? value.id)
        : asDisplayString(value));

      if (!displayValue) {
        continue;
      }

      const label = getAdditionalLabel(key);
      const detailKey = `${label}:${displayValue}`;

      if (seen.has(detailKey)) {
        continue;
      }

      seen.add(detailKey);
      details.push({
        label,
        value: displayValue,
      });
    }
  }

  return details.slice(0, 6);
};

const ID_NAME_PREFIXES: Record<string, string[]> = {
  branch: ["branch_name", "branchName", "destination_branch_name", "destinationBranchName", "target_branch_name", "targetBranchName"],
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

const getNameForIdKey = (event: TrackingEvent, key: string, value: unknown) => {
  const normalizedKey = normalizeKey(key);

  if (!normalizedKey.endsWith("_id") && !normalizedKey.endsWith("id")) {
    return "";
  }

  if (isRecord(value)) {
    const nestedName = asCleanString(value.name ?? value.full_name ?? value.fullName ?? value.title);

    if (nestedName) {
      return nestedName;
    }
  }

  const prefix = getIdPrefix(key);
  const nameKeys = ID_NAME_PREFIXES[prefix] ?? [`${prefix}_name`, `${prefix}Name`];

  for (const source of getEventSources(event)) {
    const name = readNameByKeys(source, nameKeys);

    if (name) {
      return name;
    }
  }

  return "";
};

const getAdditionalLabel = (key: string) => {
  const prefix = getIdPrefix(key);

  return humanize(prefix || key);
};

const getCurrentUserName = (currentUser?: User | null) =>
  currentUser?.name || currentUser?.username || "";

const getRoleLabel = (t: ReturnType<typeof useTranslation>["t"], role?: string | null) => {
  const normalizedRole = normalizeKey(role);
  const translated = t(`tracking.roleValue.${normalizedRole}`, { defaultValue: "" });

  return translated || humanize(role);
};

const normalizeKey = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

const getStatusTone = (status?: string | null) => {
  const normalizedStatus = normalizeKey(status);

  if (normalizedStatus.includes("closed") || normalizedStatus.includes("paid") || normalizedStatus.includes("sold")) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (normalizedStatus.includes("cancel")) {
    return "border-red-400/25 bg-red-500/10 text-red-700 dark:text-red-200";
  }

  if (normalizedStatus.includes("road") || normalizedStatus.includes("received")) {
    return "border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-200";
  }

  return "border-main/25 bg-main/10 text-main dark:text-primary";
};

const getEventTone = (event: TrackingEvent) => {
  const status = normalizeKey(event.new_value?.status || event.to_status || event.action);

  if (status.includes("cancel")) {
    return {
      icon: XCircle,
      node: "bg-red-500 text-white shadow-red-500/30",
      card: "border-red-400/30 bg-red-500/[0.04]",
      badge: "border-red-400/25 bg-red-500/10 text-red-200",
    };
  }

  if (status.includes("closed") || status.includes("paid") || status.includes("sold")) {
    return {
      icon: CheckCircle2,
      node: "bg-emerald-500 text-white shadow-emerald-500/30",
      card: "border-emerald-400/25 bg-emerald-500/[0.04]",
      badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    };
  }

  return {
    icon: ArrowRight,
    node: "bg-main text-white shadow-main/30",
    card: "border-main/25 bg-main/[0.04]",
    badge: "border-main/25 bg-main/10 text-main dark:text-primary",
  };
};

const translateStatus = (t: ReturnType<typeof useTranslation>["t"], status?: string | null) => {
  if (!status) return "—";

  const key = normalizeKey(status);
  const translated = t(`tracking.status.${key}`, { defaultValue: "" });
  return translated || humanize(status);
};

const translateNote = (t: ReturnType<typeof useTranslation>["t"], note?: string | null) => {
  if (!note) return "";

  const normalizedNote = normalizeKey(note);
  const translated = t(`tracking.notes.${normalizedNote}`, { defaultValue: "" });
  return translated || note;
};

const getTrackingName = (event: TrackingEvent, entity: "branch" | "post") => {
  const branchKeys = [
    "branch_name",
    "branchName",
    "destination_branch_name",
    "destinationBranchName",
    "target_branch_name",
    "targetBranchName",
    "to_branch_name",
    "toBranchName",
  ];
  const postKeys = ["post_name", "postName", "post_title", "postTitle", "mail_name", "mailName"];
  const keys = entity === "branch" ? branchKeys : postKeys;

  for (const source of getEventSources(event)) {
    const name = readNameByKeys(source, keys);

    if (name) {
      return name;
    }
  }

  return "";
};

const formatNoteWithNames = (
  note: string,
  event: TrackingEvent,
  t: ReturnType<typeof useTranslation>["t"],
  context?: TrackingTimelineItemProps["context"],
) => {
  let formattedNote = note;
  const branchName = getTrackingName(event, "branch") || context?.branchName || "";
  const postName = getTrackingName(event, "post") || context?.postName || "";

  formattedNote = formattedNote.replace(/\bbranch\s*#?(\d+)\b/gi, (match, branchId: string) =>
    branchName || match.replace(`#${branchId}`, branchId),
  );

  if (postName) {
    formattedNote = formattedNote.replace(
      /\bpost\s*#?\d+\b/gi,
      postName,
    );
  } else {
    formattedNote = formattedNote.replace(/\bpost\s*#?\d+\b/gi, "Pochta");
  }

  if (branchName && /dispatch qilindi|dispatch|jo'natildi|jonatildi/i.test(formattedNote)) {
    return t("tracking.dynamic.dispatchToBranch", {
      post: postName || t("tracking.entity.post"),
      branch: branchName,
    });
  }

  return formattedNote;
};

const getActorName = (event: TrackingEvent, currentUser?: User | null) => {
  const actorName = asCleanString(event.actor?.name) || asCleanString(event.actor?.username);
  const currentUserName = getCurrentUserName(currentUser);

  if (actorName && normalizeKey(actorName) !== "system") {
    return actorName;
  }

  const isCurrentUserAction = Boolean(currentUser?.id) && String(event.changed_by) === String(currentUser?.id);

  if ((isCurrentUserAction || normalizeKey(actorName) === "system" || normalizeKey(event.changed_by_role) === "system") && currentUserName) {
    return currentUserName;
  }

  return event.user_name || humanize(event.changed_by_role);
};

const getActorRole = (event: TrackingEvent, currentUser?: User | null) => {
  const actorRole = asCleanString(event.actor?.role);
  const isCurrentUserAction = Boolean(currentUser?.id) && String(event.changed_by) === String(currentUser?.id);

  if (actorRole && normalizeKey(actorRole) !== "system") {
    return actorRole;
  }

  if ((isCurrentUserAction || normalizeKey(actorRole) === "system" || normalizeKey(event.changed_by_role) === "system") && currentUser?.role) {
    return currentUser.role;
  }

  return event.changed_by_role;
};

const getActorPhone = (event: TrackingEvent, currentUser?: User | null) => {
  const actorPhone = asCleanString(event.actor?.phone_number) || asCleanString(event.actor?.phoneNumber);

  if (actorPhone) {
    return actorPhone;
  }

  if (normalizeKey(event.actor?.name) === "system" || normalizeKey(event.actor?.role) === "system") {
    return asCleanString(currentUser?.phone_number);
  }

  return "";
};

export const TrackingTimelineItem = ({ event, index, total, currentUser, context }: TrackingTimelineItemProps) => {
  const { t } = useTranslation("orders");
  const actionLabelKey = event.action ? actionLabelMap[event.action] : undefined;
  const oldStatus = event.old_value?.status;
  const newStatus = event.new_value?.status;
  const actionName = actionLabelKey ? t(actionLabelKey) : humanize(event.action);
  const note = formatNoteWithNames(translateNote(t, event.note || event.description), event, t, context);
  const relatedEntity = getRelatedEntity(event);
  const actor = getActorName(event, currentUser);
  const actorPhone = getActorPhone(event, currentUser);
  const role = getRoleLabel(t, getActorRole(event, currentUser));
  const relatedDetails = getRelatedDetails(event).filter(
    (detail) => !(normalizeKey(detail.value) === normalizeKey(actor) && detail.type === relatedEntity?.type),
  );
  const additionalDetails = getAdditionalDetails(event);
  const hasTransition = Boolean(oldStatus || newStatus);
  const tone = getEventTone(event);
  const NodeIcon = tone.icon;

  return (
    <article className="relative flex w-[300px] shrink-0 flex-col pt-12 sm:w-[350px]">
      <div className="absolute left-0 right-0 top-5 h-px bg-main/20 dark:bg-white/12" />
      <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          #{index + 1}/{total}
        </span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg ${tone.node}`}>
          <NodeIcon size={17} />
        </span>
      </div>

      <div className={`min-h-[330px] rounded-2xl border p-3.5 shadow-sm transition-colors hover:border-main/45 dark:bg-maindark/45 ${tone.card}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black ${tone.badge}`}>
            {actionName}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            <Clock3 size={12} />
            {formatTrackingDate(event.created_at)}
          </span>
        </div>

        <div className="rounded-xl border border-main/10 bg-main/10 p-3 dark:border-white/8 dark:bg-white/[0.04]">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-main dark:text-primary">
            <UserRound size={12} />
            {t("tracking.executor")}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-maindark dark:text-primary">{actor}</p>
              {actorPhone ? (
                <p className="mt-1 truncate text-[11px] font-bold text-main dark:text-primary">{actorPhone}</p>
              ) : null}
            </div>
            <span className="shrink-0 rounded-md bg-main px-2 py-1 text-[10px] font-black uppercase text-white dark:bg-primary dark:text-maindark">
              {role}
            </span>
          </div>
        </div>

        {hasTransition ? (
          <div className="mt-3">
            <p className="mb-2 text-xs font-bold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("tracking.statusTitle")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex min-h-8 max-w-full items-center rounded-xl border px-3 text-xs font-black ${getStatusTone(oldStatus)}`}>
                <span className="mr-1.5 text-[10px] font-bold opacity-70">{t("tracking.from")}</span>
                <span className="truncate">{translateStatus(t, oldStatus)}</span>
              </span>
              <span className="text-main dark:text-primary">→</span>
              <span className={`inline-flex min-h-8 max-w-full items-center rounded-xl border px-3 text-xs font-black ${getStatusTone(newStatus)}`}>
                <span className="mr-1.5 text-[10px] font-bold opacity-70">{t("tracking.to")}</span>
                <span className="truncate">{translateStatus(t, newStatus)}</span>
              </span>
            </div>
          </div>
        ) : null}

        {relatedDetails.length > 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              {t("tracking.relatedDetails")}
            </p>
            <div className="space-y-1.5">
              {relatedDetails.map((detail) => (
                <div
                  key={`${detail.type}-${detail.value}`}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="shrink-0 font-bold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                    {t(`tracking.entity.${detail.type}`, { defaultValue: humanize(detail.type) })}
                  </span>
                  <span className="text-right font-black text-emerald-700 dark:text-emerald-200">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {additionalDetails.length > 0 ? (
          <div className="mt-3 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
              {t("tracking.additional")}
            </p>
            <div className="space-y-1.5">
              {additionalDetails.map((detail) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-[11px]"
                >
                  <span className="truncate font-bold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                    {t(`tracking.field.${normalizeKey(detail.label)}`, { defaultValue: detail.label })}
                  </span>
                  <span className="truncate font-black text-blue-800 dark:text-blue-100" title={detail.value}>
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {note ? (
          <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-900 dark:text-sky-100">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
              <FileText size={12} />
              {t("tracking.note")}
            </p>
            <div className="flex gap-2">
              <FileText size={15} className="mt-0.5 shrink-0 text-main" />
              <span>{note}</span>
            </div>
          </div>
        ) : null}

        {!hasTransition && !note ? (
          <div className="mt-3 rounded-xl bg-main/10 px-3 py-2 text-sm font-bold text-main dark:text-primary">
            {t("tracking.role")}: {humanize(event.changed_by_role)}
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default TrackingTimelineItem;
