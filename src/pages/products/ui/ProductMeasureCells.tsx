// dizayn-v2: superadmin-products-list, admin-products-list, market-products-list, superadmin-products-create, admin-products-create
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { canManageDeliveryTariffs } from "../../../app/lib/access";
import { formatKgValue, useWeightRules } from "../../../entities/delivery-pricing";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Skeleton } from "../../../shared/ui/primitives";
import { getProductMeasureView, type ProductMeasureView } from "../model/productMeasure";
import type { Product } from "../model/productView";

/** «—» (ekran o'quvchiga «Kiritilmagan»). */
const Dash = ({ label }: { label: string }) => (
  <>
    <span aria-hidden="true" className="text-text-subtle">
      —
    </span>
    <span className="sr-only">{label}</span>
  </>
);

const useMeasureText = () => {
  const { t, i18n } = useTranslation("products");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return {
    t,
    kg: (value: number) => t("v2.measure.kg", { value: formatKgValue(value, language) }),
    basis: (view: ProductMeasureView) =>
      view.basis === "volume"
        ? t("v2.measure.basis.volume")
        : view.basis === "volumeOff"
          ? t("v2.measure.basis.volumeOff")
          : t("v2.measure.basis.weight"),
    number: (value: number) => formatNumberLocalized(value, { language }),
  };
};

/** «Kiritilmagan» — o'lchovsiz eski / hamkor mahsuloti (maket: `warning` nuqtali badge). */
const NotEntered = () => {
  const { t } = useTranslation("products");
  return (
    <Badge tone="warning" dot size="sm" className="self-start">
      {t("v2.measure.notEntered")}
    </Badge>
  );
};

/** «Og'irlik» ustuni: «0,2 kg» yoki «—». */
export const ProductWeight = ({ product }: { product: Product }) => {
  const { t, kg } = useMeasureText();
  const view = getProductMeasureView(product);
  return view.weightKg === null ? <Dash label={t("v2.measure.notEntered")} /> : <>{kg(view.weightKg)}</>;
};

/** «O'lcham, sm» ustuni: «15 × 10 × 6» yoki «—». */
export const ProductDimensions = ({ product }: { product: Product }) => {
  const { t, number } = useMeasureText();
  const { dimensions } = getProductMeasureView(product);
  return dimensions ? (
    <>{t("v2.measure.dims", { length: number(dimensions.length), width: number(dimensions.width), height: number(dimensions.height) })}</>
  ) : (
    <Dash label={t("v2.measure.notEntered")} />
  );
};

/**
 * Hisob vazni «Hajm bo'yicha hisoblash chegarasi» bilan (AQ9lkgVB) — forma va server bilan bir xil son: superadmin/admin
 * qoidalari sozlamadan (har doim), boshqa rolda chegara narx javobidan — faqat natija chegaraga bog'liq bo'lsa
 * (`thresholdPending`). So'rovlar kesh orqali bitta, qatorlar soniga bog'liq emas.
 */
const useBillableView = (product: Product) => {
  const canReadSettings = useSelector(canManageDeliveryTariffs);
  const base = getProductMeasureView(product);
  const weightRules = useWeightRules({
    canReadSettings,
    enabled: base.complete && (canReadSettings || base.thresholdPending),
  });
  const view = weightRules.rules ? getProductMeasureView(product, weightRules.rules) : base;
  return { view, loading: view.thresholdPending && weightRules.status === "loading" };
};

/**
 * Hisob vazni: `stack` — jadval ustuni («2,4 kg» qalin, ostida «hajm bo'yicha»); `inline` — nom ostida / telefon
 * kartasida («**0,2 kg** · og'irlik bo'yicha»). O'lchov to'liq emas — «Kiritilmagan». Chegara kerak, lekin hali
 * kelmagan — skelet; aniqlab bo'lmadi — «—» (taxminiy son ko'rsatilmaydi).
 */
export const ProductBillable = ({
  product,
  layout = "stack",
  emphasis = true,
}: {
  product: Product;
  layout?: "stack" | "inline";
  /** `inline` da og'irlik qalin (telefon kartasi); jadval katagi ostida — oddiy (maket `.el-cell-sub`). */
  emphasis?: boolean;
}) => {
  const { t, kg, basis } = useMeasureText();
  const { view, loading } = useBillableView(product);
  if (!view.complete) return <NotEntered />;
  if (view.thresholdPending || view.billableKg === null) {
    return loading ? (
      <span className="flex min-h-5 items-center">
        <Skeleton width={layout === "inline" ? 120 : 56} height={14} />
        <span className="sr-only">{t("v2.measure.billablePending")}</span>
      </span>
    ) : (
      <Dash label={t("v2.measure.billableUnknown")} />
    );
  }
  if (layout === "inline") {
    return (
      <span className="whitespace-nowrap">
        <span className={emphasis ? "font-semibold text-text" : undefined}>{kg(view.billableKg)}</span>
        {` · ${basis(view)}`}
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-0.5">
      <span className="whitespace-nowrap font-semibold text-text">{kg(view.billableKg)}</span>
      <span className="whitespace-nowrap text-[13px] text-text-muted">{basis(view)}</span>
    </span>
  );
};
