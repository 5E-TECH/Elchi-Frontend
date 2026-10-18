import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ACTIVITY_SERVICES, humanizeAction, type ActivityLog } from "../../../entities/activity-log";
import { ORDER_STATUS_NS, ORDER_STATUS_REGISTRY, resolveDisplayOrderStatus } from "../../../entities/order";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";

/**
 * Faoliyat jurnali yorliqlari (maket `superadmin-activity-logs-list`): xizmat («Buyurtmalar»), obyekt turi
 * («Buyurtma №10227»), rol («Kuryer»), amal, «Amal» filtri guruhi, maydon («Holat · status») va qiymatlar.
 * Tarjimada yo'q tur, maydon yoki kalit o'zgarmasdan (xom kalit) ko'rsatiladi.
 */

/**
 * Backend `entity_type` lari (audit yozuvlari, Elchi-Backend `origin/main`) — `activityLogs:entityTypes.*`.
 * Tartib muhim: «Obyekt turi» filtrida bir xil nom (Foydalanuvchi — `User` / `Auth`) birinchisiga o'giriladi.
 */
const ENTITY_TYPES = [
  "Order",
  "User",
  "Auth",
  "Post",
  "Cashbox",
  "CashboxCard",
  "CashboxHistory",
  "Shift",
  "District",
  "Region",
  "Branch",
  "BranchUser",
  "BranchConfig",
  "BranchTransferBatch",
  "TransferBatch",
  "Partner",
  "ExternalIntegration",
  "Settlement",
  "Product",
  "Market",
  "Courier",
  "Payment",
  "Investor",
  "Investment",
  "Notification",
  "NotificationCampaign",
  "SmsCampaign",
  "FinancialBalanceHistory",
  "UserSalary",
  "OperatorEarning",
  "OperatorPayment",
] as const;

const squash = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
const ENTITY_BY_SQUASHED = new Map<string, string>(ENTITY_TYPES.map((type) => [squash(type), type]));

/** `order`, `ORDER`, `branch_user` → `Order`, `BranchUser` (ro'yxatda yo'q — `null`). */
const entityTypeOf = (type: string | null | undefined) => ENTITY_BY_SQUASHED.get(squash(String(type ?? ""))) ?? null;

/** Pul maydonlari — `formatMoneyLocalized`. */
const MONEY_KEYS = new Set(["amount", "price", "total_price", "paid_amount", "to_be_paid", "allocated", "leftover", "balance"]);

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

const isService = (value: string | null | undefined): value is (typeof ACTIVITY_SERVICES)[number] =>
  Boolean(value) && (ACTIVITY_SERVICES as readonly string[]).includes(String(value));

export const useActivityLabels = () => {
  const { t, i18n } = useTranslation(["activityLogs", "users", ORDER_STATUS_NS]);
  const language = i18n.resolvedLanguage ?? i18n.language;

  return useMemo(() => {
    const ns = { ns: "activityLogs" } as const;
    /** Tarjima bo'lmasa — `null` (xom kalit chaqiruvchida). */
    const optional = (key: string) => {
      const text = t(key, { ...ns, defaultValue: "" });
      return text ? text : null;
    };

    const service = (name: string | null | undefined) => (isService(name) ? t(`services.${name}`, ns) : name || "—");

    const entityType = (type: string | null | undefined) => {
      const known = entityTypeOf(type);
      return (known && optional(`entityTypes.${known}`)) || type || "—";
    };

    /** «№10227» — buyurtma (DESIGN_SYSTEM §7), qolgani «#5521». */
    const entityId = (log: Pick<ActivityLog, "entity_type" | "entity_id">) =>
      log.entity_id ? `${entityTypeOf(log.entity_type) === "Order" ? "№" : "#"}${log.entity_id}` : "";

    /** «Buyurtma №10227» — ochish tugmasi nomi. */
    const entityTitle = (log: Pick<ActivityLog, "entity_type" | "entity_id">) =>
      [entityType(log.entity_type), entityId(log)].filter(Boolean).join(" ");

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
      if (log.actor_status === "system" || !id) return t("actor.system", ns);
      return t("actor.unresolved", { ...ns, id });
    };

    const role = (value: string | null | undefined) => {
      if (!value) return "";
      const key = getUserRoleLabelKey(value);
      return key === "roleUnknown" ? value : t(key, { ns: "users" });
    };

    /**
     * Amal yorlig'i. O'zbekchada — `undefined` (badge o'zi: `action_meta` → reyestr → humanize). Boshqa
     * tillarda backend reyestri (faqat o'zbekcha) ishlatilmaydi: asosiy fe'l — tarjima (`actions.*`), qolgani —
     * humanize.
     */
    const action = (verb: string): string | undefined => {
      if (!verb || language.startsWith("uz")) return undefined;
      return (!verb.includes(".") && optional(`actions.${verb}`)) || humanizeAction(verb) || verb;
    };

    /** «Amal» filtri guruhi: backend `category_label` faqat o'zbekcha — `categories.<kalit>` tarjimasi. */
    const category = (key: string | null | undefined, fallback: string | null | undefined) =>
      (key ? optional(`categories.${key}`) : null) || fallback || key || undefined;

    const field = (key: string) => optional(`fields.${key}`);
    const meta = (key: string) => optional(`meta.${key}`);

    const value = (key: string, raw: unknown, type?: string | null): string => {
      if (raw === null || raw === undefined || raw === "") return "—";
      if (typeof raw === "boolean") return t(raw ? "detail.yes" : "detail.no", ns);
      if (typeof raw === "number") {
        return MONEY_KEYS.has(key) ? formatMoneyLocalized(raw, { language }) : formatNumberLocalized(raw, { language, fractionDigits: 2 });
      }
      if (typeof raw === "string") {
        if (key === "status" && entityTypeOf(type) === "Order") {
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
     * Filtrdagi «Obyekt turi» (maket: «masalan, Buyurtma»): tarjima qilingan nom yozilsa — backend turi (`Order`),
     * backend turi kichik harfda yozilsa ham (`order`) — o'sha; aks holda yozilgani o'zi.
     */
    const entityTypeParam = (input: string) => {
      const text = input.trim();
      const lower = text.toLocaleLowerCase();
      const byLabel = ENTITY_TYPES.find((type) => (optional(`entityTypes.${type}`) ?? "").toLocaleLowerCase() === lower);
      return byLabel ?? entityTypeOf(text) ?? text;
    };

    return {
      service,
      entityType,
      entityId,
      entityTitle,
      entityName,
      actorName,
      role,
      action,
      category,
      field,
      meta,
      value,
      entityTypeParam,
      language,
    };
  }, [language, t]);
};

export type ActivityLabels = ReturnType<typeof useActivityLabels>;
