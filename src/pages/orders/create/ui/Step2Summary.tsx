// dizayn-v2: superadmin-neworders-create-manual-step2, manager-new-orders-create-manual-step2, registrator-new-orders-create-step2, market-new-orders-create-manual
import { memo, useId, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, CircleCheck, Plus } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { cx } from "../../../../shared/lib/cx";
import { Badge, Button, buttonClasses, Card, Field, TextInput } from "../../../../shared/ui/primitives";
import { stripPrice, toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";

type Step2SummaryProps = {
  /** Market roli: «Market» qatori yo'q, pastki tugma «Orqaga» (`/new-orders`). */
  isMarketRole: boolean;
  /** Majburiy maydonlar to'ldirilgan va mahsulot tanlangan — «Buyurtma yaratish» faol. */
  ready: boolean;
  /** So'rov ketmoqda: asosiy tugmada spinner, holat qatori «saqlanmoqda». */
  submitting: boolean;
  /** «Oldingi» — 1-qadamga (market saqlanadi). */
  onPrevious?: () => void;
  /** Market rolidagi «Orqaga» manzili. */
  backTo?: string;
};

/** `.el-divider`. */
const Divider = () => <hr className="m-0 h-px border-0 bg-border" />;

/**
 * BUYURTMA XULOSASI — yon ustundagi karta (maket `*-create-manual-step2`, `market-new-orders-create-manual`):
 * `dl` (Market · Mahsulotlar «3 ta · 4 dona» · Yetkazish · Tuman), «Umumiy summa *» (katta, so'm bilan),
 * «Operator», asosiy «Buyurtma yaratish» (`type="submit"`) + holat qatori, ostida «Oldingi» / «Orqaga».
 */
const Step2Summary = ({ isMarketRole, ready, submitting, onPrevious, backTo = "/new-orders" }: Step2SummaryProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const statusId = useId();
  const {
    control,
    formState: { errors },
  } = useFormContext<OrderCreateFormValues>();

  const market = useWatch({ control, name: "market" });
  const items = useWatch({ control, name: "details.items" });
  const whereDeliver = useWatch({ control, name: "details.where_deliver" });
  const regionId = useWatch({ control, name: "customer.region_id" }) ?? "";
  const districtId = useWatch({ control, name: "customer.district_id" }) ?? "";

  // Tuman nomi — `Step2Combined` dagi bilan bir xil so'rov (react-query keshidan).
  const { useGetDistricts } = useLogistics();
  const { data: districts } = useGetDistricts(regionId);
  const districtName = useMemo(
    () =>
      toApiList<{ id: string | number; name?: string }>(districts).find((item) => String(item.id) === districtId)?.name,
    [districtId, districts],
  );

  const units = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  const statusText = submitting ? t("createSubmitting") : ready ? t("orderReadyMessage") : t("fillRequiredFields");

  return (
    <Card title={t("createSummaryTitle")} bodyClassName="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-[minmax(120px,40%)_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        {!isMarketRole ? (
          <>
            <dt className="text-text-muted">{t("createSummaryMarket")}</dt>
            <dd className="m-0 min-w-0 truncate font-semibold text-text">{market?.name ?? "—"}</dd>
          </>
        ) : null}
        <dt className="text-text-muted">{t("createSummaryProducts")}</dt>
        <dd className="m-0 min-w-0 font-semibold text-text">
          {items.length > 0 ? t("createSummaryProductsValue", { count: items.length, units }) : "—"}
        </dd>
        <dt className="text-text-muted">{t("createSummaryDelivery")}</dt>
        <dd className="m-0 min-w-0">
          <Badge>{whereDeliver === "address" ? t("deliveryToHome") : t("deliveryToCenter")}</Badge>
        </dd>
        <dt className="text-text-muted">{t("createSummaryDistrict")}</dt>
        <dd className="m-0 min-w-0 truncate font-semibold text-text">{districtName ?? "—"}</dd>
      </dl>

      <Divider />

      <Controller
        control={control}
        name="details.total_price"
        render={({ field }) => (
          <Field
            id="details.total_price"
            label={t("totalPrice")}
            required
            hint={t("createTotalHint")}
            error={errors.details?.total_price?.message}
          >
            <TextInput
              mode="money"
              size="lg"
              name={field.name}
              placeholder="0"
              value={field.value}
              onValueChange={(next) => field.onChange(stripPrice(next))}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="details.operator"
        render={({ field }) => (
          <Field id="details.operator" label={t("operator")} error={errors.details?.operator?.message}>
            <TextInput
              name={field.name}
              placeholder={t("operatorPlaceholder")}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </Field>
        )}
      />

      <Divider />

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          fullWidth
          leftIcon={Plus}
          disabled={!ready && !submitting}
          loading={submitting}
          loadingText={t("submitting", { ns: "common" })}
          aria-describedby={statusId}
        >
          {t("create")}
        </Button>
        <p
          id={statusId}
          role="status"
          className={cx(
            "flex items-center justify-center gap-1.5 text-center text-[13px]",
            ready && !submitting ? "font-semibold text-success-fg" : "text-text-muted",
          )}
        >
          {ready && !submitting ? <CircleCheck size={16} aria-hidden="true" className="shrink-0" /> : null}
          {statusText}
        </p>
        {isMarketRole ? (
          <Link to={backTo} className={buttonClasses({ variant: "secondary", fullWidth: true })}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t("back", { ns: "common" })}
          </Link>
        ) : (
          <Button variant="secondary" fullWidth leftIcon={ChevronLeft} onClick={onPrevious}>
            {t("previous", { ns: "common" })}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default memo(Step2Summary);
