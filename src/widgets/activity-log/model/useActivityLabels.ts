import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ACTIVITY_SERVICES, type ActivityLog } from "../../../entities/activity-log";
import { ORDER_STATUS_NS, ORDER_STATUS_REGISTRY, resolveDisplayOrderStatus } from "../../../entities/order";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";

/**
 * Faoliyat jurnali yorliqlari (maket `superadmin-activity-logs-list`): xizmat («Buyurtmalar»), obyekt turi
 * («Buyurtma №10227»), rol («Kuryer»), maydon («Holat · status») va qiymatlar. Backend bermaydigan nomlar —
 * shu ro'yxatda; ro'yxatda yo'q tur yoki maydon o'zgarmasdan (xom kalit) ko'rsatiladi.
 */

/** Backend `entity_type` (`Order`, `Settlement` …) → `activityLogs:entities.*` kaliti. */
const ENTITY_KEYS = [
  "order",
  "settlement",
  "user",
  "market",
  "courier",
  "branch",
  "product",
  "batch",
  "post",
  "payment",
  "cashbox",
  "region",
  "district",
  "notification",
  "integration",
  "investor",
] as const;
type EntityKey = (typeof ENTITY_KEYS)[number];

const FIELD_KEYS = new Set([
  "status",
  "sold_at",
  "comment",
  "name",
  "phone_number",
  "role",
  "total_price",
  "price",
  "amount",
  "paid_amount",
  "quantity",
  "address",
  "reason",
  "courier_id",
  "market_id",
  "branch_id",
  "region_id",
  "district_id",
  "where_deliver",
]);

const META_KEYS = new Set([
  "source",
  "branch",
  "branch_name",
  "device",
  "ip",
  "reason",
  "comment",
  "amount",
  "count",
  "leg",
  "description",
]);

/** Pul maydonlari — `formatMoneyLocalized`. */
const MONEY_KEYS = new Set(["amount", "price", "total_price", "paid_amount", "to_be_paid", "allocated", "leftover", "balance"]);

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

const entityKeyOf = (type: string | null | undefined): EntityKey | null => {
  const key = String(type ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return (ENTITY_KEYS as readonly string[]).includes(key) ? (key as EntityKey) : null;
};

const isService = (value: string | null | undefined): value is (typeof ACTIVITY_SERVICES)[number] =>
  Boolean(value) && (ACTIVITY_SERVICES as readonly string[]).includes(String(value));

export const useActivityLabels = () => {
  const { t, i18n } = useTranslation(["activityLogs", "users", ORDER_STATUS_NS]);
  const language = i18n.language;

  return useMemo(() => {
    const service = (name: string | null | undefined) =>
      isService(name) ? t(`services.${name}`, { ns: "activityLogs" }) : name || "—";

    const entityType = (type: string | null | undefined) => {
      const key = entityKeyOf(type);
      return key ? t(`entities.${key}`, { ns: "activityLogs" }) : type || "—";
    };

    /** «№10227» — buyurtma (DESIGN_SYSTEM §7), qolgani «#5521». */
    const entityId = (log: Pick<ActivityLog, "entity_type" | "entity_id">) =>
      log.entity_id ? `${entityKeyOf(log.entity_type) === "order" ? "№" : "#"}${log.entity_id}` : "";

    const entityName = (log: Pick<ActivityLog, "entity">) => {
      const entity = log.entity ?? {};
      const name = [entity.name, entity.title, entity.customer_name, entity.full_name].find(
        (value) => typeof value === "string" && value.trim(),
      );
      return typeof name === "string" ? name.trim() : "";
    };

    /** «Kim»: ism → «#7 (topilmadi)» → «Tizim» (y8CxCtcK). Telefon ko'rsatilmaydi. */
    const actorName = (log: Pick<ActivityLog, "actor" | "user_name" | "user_id" | "actor_status">) => {
      const name = log.actor?.name || log.user_name;
      if (name) return name;
      const id = log.actor?.id || log.user_id;
      if (log.actor_status === "system" || !id) return t("actor.system", { ns: "activityLogs" });
      return t("actor.unresolved", { ns: "activityLogs", id });
    };

    const role = (value: string | null | undefined) => {
      if (!value) return "";
      const key = getUserRoleLabelKey(value);
      return key === "roleUnknown" ? value : t(key, { ns: "users" });
    };

    const field = (key: string) => (FIELD_KEYS.has(key) ? t(`fields.${key}`, { ns: "activityLogs" }) : null);
    const meta = (key: string) => (META_KEYS.has(key) ? t(`meta.${key}`, { ns: "activityLogs" }) : null);

    const value = (key: string, raw: unknown, type?: string | null): string => {
      if (raw === null || raw === undefined || raw === "") return "—";
      if (typeof raw === "boolean") return t(raw ? "detail.yes" : "detail.no", { ns: "activityLogs" });
      if (typeof raw === "number") {
        return MONEY_KEYS.has(key) ? formatMoneyLocalized(raw, { language }) : formatNumberLocalized(raw, { language, fractionDigits: 2 });
      }
      if (typeof raw === "string") {
        if (key === "status" && entityKeyOf(type) === "order") {
          const status = resolveDisplayOrderStatus(raw);
          if (status) return t(ORDER_STATUS_REGISTRY[status].labelKey, { ns: ORDER_STATUS_NS });
        }
        if (ISO_DATE_TIME.test(raw)) return formatDateTimeLocalized(raw, { language });
        if (MONEY_KEYS.has(key) && NUMERIC.test(raw)) return formatMoneyLocalized(Number(raw), { language });
        return raw;
      }
      return JSON.stringify(raw);
    };

    /**
     * Filtrdagi «Obyekt turi» (maket: «masalan, Buyurtma»): o'zbekcha nom yozilsa — backend turi (`Order`),
     * aks holda yozilgani o'zi.
     */
    const entityTypeParam = (input: string) => {
      const text = input.trim();
      const lower = text.toLocaleLowerCase();
      const key = ENTITY_KEYS.find((item) => t(`entities.${item}`, { ns: "activityLogs" }).toLocaleLowerCase() === lower);
      return key ? key.charAt(0).toUpperCase() + key.slice(1) : text;
    };

    return { service, entityType, entityId, entityName, actorName, role, field, meta, value, entityTypeParam, language };
  }, [language, t]);
};

export type ActivityLabels = ReturnType<typeof useActivityLabels>;
