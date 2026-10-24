// dizayn-v2: superadmin-neworders-create-manual-source
import { memo, useId, useMemo, type ReactNode } from "react";
import { Building2, CirclePause, Info, Warehouse, type LucideIcon } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { OrderSourcePreview } from "../../../../entities/warehouse";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, Card, Skeleton } from "../../../../shared/ui/primitives";
import { toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";
import { useCanChooseOrderSource, useOrderSource } from "../model/useOrderSource";
import { CreateAlert } from "./CreateAlert";
import { useOrderCatalog } from "./useOrderCatalog";

const FIELD_NAME = "fulfillment";

/** `.el-choice-card` (CODE-MAP 2.2) + `.el-radio` (`accent-action`); tanlangan — `action` chegara va fon. */
const ChoiceCard = ({
  checked,
  disabled = false,
  title,
  badge,
  hint,
  hintId,
  icon: Icon,
  onSelect,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  badge?: ReactNode;
  hint: string;
  hintId: string;
  icon: LucideIcon;
  onSelect?: () => void;
}) => (
  <label
    className={cx(
      "flex min-h-16 min-w-0 items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
      "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
      "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus",
      disabled
        ? "cursor-not-allowed border-border bg-sunken"
        : checked
          ? "cursor-pointer border-action bg-action-soft"
          : "cursor-pointer border-border-strong bg-surface hover:border-text-subtle",
    )}
  >
    <input
      type="radio"
      name={FIELD_NAME}
      checked={checked}
      disabled={disabled}
      onChange={() => onSelect?.()}
      aria-describedby={hintId}
      className="mt-0.5 size-[18px] shrink-0 accent-action"
    />
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cx("font-semibold", disabled ? "text-text-muted" : "text-text")}>{title}</span>
        {badge}
      </span>
      <span id={hintId} className="text-[13px] text-text-muted">
        {hint}
      </span>
    </span>
    <Icon size={18} aria-hidden="true" className={cx("mt-0.5 shrink-0", checked && !disabled ? "text-action-fg" : "text-text-subtle")} />
  </label>
);

/** HQ'ga majburan o'tish sababi (backend `reason`) — kartadagi izoh. */
const HQ_REASON_KEY: Partial<Record<OrderSourcePreview["reason"], string>> = {
  NO_WAREHOUSE: "fulfillment.source.noWarehouse",
  NO_ITEMS: "fulfillment.source.noWarehouse",
  NO_REGION: "fulfillment.source.noRegion",
  PRODUCT_INVALID: "fulfillment.source.invalid",
  MARKET_NOT_ALLOWED: "fulfillment.source.notAllowed",
};

/**
 * «QAYERDAN YUBORILADI» — buyurtma manbasi (maket `superadmin-neworders-create-manual-source`; 6kHnNH9j, ega
 * qarori 4: tuman filialida FAOL ombor bo'lsa va HAMMA mahsulot yetarli bo'lsa — o'sha ombor, aks holda butun buyurtma
 * HQ'dan; yaratuvchi HQ'ni majburan tanlay oladi → `fulfillment: "hq"`).
 *
 * Sarlavha ostida «<tuman> · <filial> hududi». Holatlar (`useOrderSource`):
 *  - tuman yoki mahsulot tanlanmagan — izoh «… avtomatik aniqlanadi»;
 *  - ombor yetadi — ikki tanlov kartasi: «<ombor>» + «Avtomatik tanlandi» («Hamma mahsulot yetarli · HQ va pochtasiz,
 *    darhol kuryerga») va «Toshkent HQ» («Odatiy oqim …»); ostida band qilish izohi;
 *  - yetmaydi — kartalar o'rnida ogohlantirish «Omborda yetmaydi — butun buyurtma HQ'dan ketadi» (har mahsulot: kerak /
 *    bor; maketdagi «Chala qoldiq» holati);
 *  - tuman ombori to'xtatilgan — o'chiq karta «To'xtatilgan» + HQ tanlangan (maket «Tuman ombori to'xtatilgan»);
 *  - ombor yo'q / hudud aniqlanmadi / mahsulot tekshirilmadi — faqat HQ kartasi, izohida sabab (maket yo'q);
 *  - katalogda yo'q mahsulot — ogohlantirish (maketdagi izoh «Omborda yo'q mahsulot qo'shilsa …»);
 *  - so'rov yiqildi — «Manbani aniqlab bo'lmadi …» + «Qayta urinish» (yaratish to'xtamaydi: backend `auto`).
 */
const OrderSourceCard = () => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language });
  const { control, setValue } = useFormContext<OrderCreateFormValues>();
  const enabled = useCanChooseOrderSource();
  const { state, pending } = useOrderSource(control, enabled);
  const fulfillment = useWatch({ control, name: "fulfillment" });
  const items = useWatch({ control, name: "details.items" });
  const regionId = useWatch({ control, name: "customer.region_id" }) ?? "";
  const districtId = useWatch({ control, name: "customer.district_id" }) ?? "";
  const { findProduct } = useOrderCatalog(control);
  const warehouseHintId = useId();
  const hqHintId = useId();

  // Tuman nomi — `Step2Combined` dagi bilan bir xil so'rov (keshdan).
  const { useGetDistricts } = useLogistics();
  const { data: districts } = useGetDistricts(regionId);
  const districtName = useMemo(
    () =>
      toApiList<{ id: string | number; name?: string }>(districts).find((item) => String(item.id) === districtId)?.name,
    [districtId, districts],
  );

  if (state.kind === "off") return null;

  const units = (items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const choose = (value: OrderCreateFormValues["fulfillment"]) =>
    setValue("fulfillment", value, { shouldDirty: true });
  const preview = state.kind === "ready" ? state.preview : null;
  const branchName = preview?.warehouse?.branchName ?? null;
  const description = districtName
    ? branchName
      ? t("fulfillment.source.subtitle", { district: districtName, branch: branchName })
      : districtName
    : undefined;

  const hqCard = (checked: boolean, hint: string, onSelect?: () => void) => (
    <ChoiceCard
      checked={checked}
      title={t("fulfillment.source.hq")}
      hint={hint}
      hintId={hqHintId}
      icon={Building2}
      onSelect={onSelect}
    />
  );

  const note = (children: ReactNode) => (
    <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
      <Info size={16} aria-hidden="true" className="mt-px shrink-0 text-text-subtle" />
      <span className="min-w-0">{children}</span>
    </p>
  );

  const choices = (children: ReactNode) => (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-busy={pending || undefined}>
      <legend className="sr-only">{t("fulfillment.source.legend")}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">{children}</div>
    </fieldset>
  );

  let body: ReactNode;
  if (state.kind === "idle") {
    body = <p className="m-0 text-[13px] text-text-muted">{t("fulfillment.source.idle")}</p>;
  } else if (state.kind === "custom") {
    body = <CreateAlert tone="warning" title={t("fulfillment.source.custom")} />;
  } else if (state.kind === "loading") {
    body = (
      <div role="status" aria-label={t("fulfillment.source.loading")} className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
        <Skeleton shape="block" width="100%" height={64} />
        <Skeleton shape="block" width="100%" height={64} />
      </div>
    );
  } else if (state.kind === "error") {
    body = (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="m-0 text-[13px] text-text-muted">{t("fulfillment.source.failed")}</p>
        <Button variant="link" size="sm" onClick={state.retry}>
          {t("fulfillment.source.retry")}
        </Button>
      </div>
    );
  } else {
    const source = state.preview;
    const warehouse = source.warehouse;
    if (source.source === "WAREHOUSE" && warehouse) {
      const auto = fulfillment !== "hq";
      body = (
        <>
          {choices(
            <>
              <ChoiceCard
                checked={auto}
                title={warehouse.name}
                badge={auto ? <Badge tone="info">{t("fulfillment.source.auto")}</Badge> : undefined}
                hint={t("fulfillment.source.warehouseHint")}
                hintId={warehouseHintId}
                icon={Warehouse}
                onSelect={() => choose("auto")}
              />
              {hqCard(!auto, t("fulfillment.source.hqHint"), () => choose("hq"))}
            </>,
          )}
          {note(
            auto
              ? t("fulfillment.source.reserveNote", {
                  pcs: t("fulfillment.source.pcs", { count: units, value: number(units) }),
                })
              : t("fulfillment.source.hqNote"),
          )}
        </>
      );
    } else if (source.reason === "INSUFFICIENT_STOCK") {
      const lines = (source.shortages.length > 0 ? source.shortages : source.items.filter((line) => !line.enough)).map(
        (line) =>
          t("fulfillment.source.shortLine", {
            name: line.name ?? findProduct(line.productId)?.name ?? `#${line.productId}`,
            required: number(line.required),
            available: number(line.available),
          }),
      );
      body = (
        <CreateAlert tone="warning" title={t("fulfillment.source.shortTitle")}>
          {t("fulfillment.source.shortBody", { lines: lines.join("; "), hq: t("fulfillment.source.hq") })}
        </CreateAlert>
      );
    } else if (source.reason === "WAREHOUSE_PAUSED" && warehouse) {
      body = choices(
        <>
          <ChoiceCard
            checked={false}
            disabled
            title={warehouse.name}
            badge={
              <Badge tone="neutral" dot>
                {t("fulfillment.source.paused")}
              </Badge>
            }
            hint={t("fulfillment.source.pausedHint")}
            hintId={warehouseHintId}
            icon={CirclePause}
          />
          {hqCard(true, t("fulfillment.source.hqHint"))}
        </>,
      );
    } else {
      body = choices(hqCard(true, t(HQ_REASON_KEY[source.reason] ?? "fulfillment.source.noWarehouse")));
    }
  }

  return (
    <Card title={t("fulfillment.source.title")} description={description} bodyClassName="flex flex-col gap-4">
      {body}
    </Card>
  );
};

export default memo(OrderSourceCard);
