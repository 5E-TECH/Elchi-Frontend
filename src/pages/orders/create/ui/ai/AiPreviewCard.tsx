import { memo, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Home,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  SendHorizontal,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../../entities/logistics/api/logisticsApi";
import { toLocalPhone, type AiPreviewItem } from "../../../../../entities/ai-order";
import type { DeliveryType } from "../../../../../entities/order/types/order";
import { keepPhoneCaretAfterChange } from "../../../../../shared/lib/phone";
import SearchableSelect, { type SearchableSelectOption } from "../../../../../shared/ui/SearchableSelect";
import { formatPhone, formatPrice, stripPhone, stripPrice } from "../../model/orderCreateForm";
import {
  FormFieldError,
  getActionButtonClassName,
  getFieldClassName,
  orderInputClassName,
} from "../formFieldStyles";
import { toList, type AiDraft } from "./aiDraft";
import { evalPreview, isItemResolved, needsPriceConfirm, type AiDraftOrder, type AiIssue } from "./evalPreview";

export type AiProductOption = { id: string; name: string };
export type AiAreaItem = { id: string | number; name?: string | null; sato_code?: string | number | null };

const ISSUE_KEYS: Record<AiIssue, string> = {
  name_missing: "aiIssueNameMissing",
  phone_invalid: "aiIssuePhoneInvalid",
  region_missing: "aiIssueRegionMissing",
  district_missing: "aiIssueDistrictMissing",
  price_missing: "aiIssuePriceMissing",
  price_confirm: "aiIssuePriceConfirm",
  items_missing: "aiIssueItemsMissing",
  item_unresolved: "aiIssueItemUnresolved",
};

/** Mavjud naqsh (Step2Combined): `nom • sato_code` — operator viloyatni tekshira oladi. */
const areaLabel = (item: AiAreaItem) => `${item.name ?? "—"}${item.sato_code ? ` • ${item.sato_code}` : ""}`;

/** Maydon ostidagi kichik ogohlantirish (BeePost `FieldHint` uslubi). */
const FieldHint = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-1 text-[10px] font-semibold leading-4 text-amber-600 dark:text-amber-300">
    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </p>
);

const CardField = ({
  label,
  icon,
  htmlFor,
  children,
  wide,
}: {
  label: string;
  icon?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  wide?: boolean;
}) => (
  <div className={`flex min-w-0 flex-col gap-1.5${wide ? " sm:col-span-2" : ""}`}>
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
    >
      {icon}
      {label}
    </label>
    {children}
  </div>
);

type AiPreviewCardProps = {
  draft: AiDraft;
  index: number;
  products: AiProductOption[];
  productsLoading: boolean;
  regions: AiAreaItem[];
  regionsLoading: boolean;
  creating: boolean;
  onChange: (order: AiDraftOrder) => void;
  onRemove: () => void;
  onCreate: () => void;
};

const AiPreviewCard = ({
  draft,
  index,
  products,
  productsLoading,
  regions,
  regionsLoading,
  creating,
  onChange,
  onRemove,
  onCreate,
}: AiPreviewCardProps) => {
  const { t } = useTranslation("orders");
  const { order, source } = draft;
  const { ready, issues } = evalPreview(order);
  const idPrefix = `ai-${draft.key}`;

  // react-query kaliti `[districts, regionId]` — bir xil viloyatli kartalar
  // keshni baham ko'radi, har karta uchun alohida so'rov ketmaydi.
  const { useGetDistricts } = useLogistics();
  const districtsQuery = useGetDistricts(order.region_id ?? undefined);
  const districts = toList<AiAreaItem>(districtsQuery.data);
  const districtsLoading = Boolean(order.region_id) && districtsQuery.isLoading;

  const update = (patch: Partial<AiDraftOrder>) => onChange({ ...order, ...patch });
  const updateItem = (itemIndex: number, patch: Partial<AiPreviewItem>) =>
    update({ items: order.items.map((item, i) => (i === itemIndex ? { ...item, ...patch } : item)) });

  const regionOptions: SearchableSelectOption[] = regions.map((region) => ({
    value: String(region.id),
    label: areaLabel(region),
  }));

  const candidateIds = new Set(order.district_candidates.map((candidate) => String(candidate.id)));
  const candidateOptions = order.district_candidates.map((candidate) => {
    const known = districts.find((district) => String(district.id) === String(candidate.id));
    return {
      value: String(candidate.id),
      label: known ? areaLabel(known) : `${candidate.label} • ${candidate.region_name}`,
    };
  });
  const restDistrictOptions = districts
    .filter((district) => !candidateIds.has(String(district.id)))
    .map((district) => ({ value: String(district.id), label: areaLabel(district) }));
  const districtOptions: SearchableSelectOption[] = candidateOptions.length
    ? [
        { value: "__ai_suggestions", label: t("aiSuggestions"), disabled: true },
        ...candidateOptions,
        ...(restDistrictOptions.length
          ? [{ value: "__all_districts", label: t("aiAllDistricts"), disabled: true }, ...restDistrictOptions]
          : []),
      ]
    : restDistrictOptions;
  if (order.district_id && !districtOptions.some((option) => option.value === order.district_id)) {
    districtOptions.unshift({ value: order.district_id, label: order.district_name ?? `#${order.district_id}` });
  }

  /**
   * ⚠️ Tuman FAQAT operator viloyatni qo'lda o'zgartirganda tozalanadi —
   * shu handler ichida, `useEffect` da EMAS. Qo'lda formadagi effekt AI
   * birga qo'ygan viloyat+tumanni jimgina o'chirib yuborardi.
   */
  const handleRegionChange = (value: string) => {
    if (value === (order.region_id ?? "")) return;
    const region = regions.find((item) => String(item.id) === value);
    update({
      region_id: value || null,
      region_name: region?.name ?? null,
      region_given: true,
      district_id: null,
      district_name: null,
    });
  };

  const handleDistrictChange = (value: string) => {
    const district = districts.find((item) => String(item.id) === value);
    const candidate = order.district_candidates.find((item) => String(item.id) === value);
    const patch: Partial<AiDraftOrder> = {
      district_id: value || null,
      district_name: district?.name ?? candidate?.label ?? null,
    };
    // Boshqa viloyatdagi taklif tanlansa viloyat ham unga moslanadi.
    if (!district && candidate) {
      const region = regions.find((item) => item.name === candidate.region_name);
      if (region) {
        patch.region_id = String(region.id);
        patch.region_name = region.name ?? null;
        patch.region_given = true;
      }
    }
    update(patch);
  };

  const productOptionsFor = (item: AiPreviewItem): SearchableSelectOption[] => {
    const suggested = new Set(item.candidates.map((candidate) => String(candidate.id)));
    const suggestions = item.candidates.map((candidate) => ({ value: String(candidate.id), label: candidate.name }));
    const rest = products
      .filter((product) => !suggested.has(product.id))
      .map((product) => ({ value: product.id, label: product.name }));
    const options: SearchableSelectOption[] = suggestions.length
      ? [
          { value: "__ai_suggestions", label: t("aiSuggestions"), disabled: true },
          ...suggestions,
          ...(rest.length ? [{ value: "__all_products", label: t("aiAllProducts"), disabled: true }, ...rest] : []),
        ]
      : rest;
    if (item.product_id && !options.some((option) => option.value === item.product_id)) {
      options.unshift({ value: item.product_id, label: item.resolved_name ?? `#${item.product_id}` });
    }
    return options;
  };

  const phoneUnreadable = !toLocalPhone(order.phone_number) && Boolean(source.phone_number?.trim());
  const accent = draft.createError
    ? "border-l-[var(--color-error)]"
    : ready
      ? "border-l-[var(--color-success)]"
      : "border-l-amber-400";

  return (
    <article
      data-testid="ai-preview-card"
      data-ready={ready}
      className={`flex flex-col gap-4 rounded-2xl border border-l-4 border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-primarydark/30 sm:p-5 ${accent}`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-main/10 px-2 py-1 text-xs font-bold text-main">#{index + 1}</span>
          {ready ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-[var(--color-success)]">
              <CheckCircle2 size={16} />
              {t("aiReady")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
              <AlertTriangle size={16} />
              {t("aiNotReady", { count: issues.length })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={!ready || creating}
            className={`${getActionButtonClassName({ variant: "primary", disabled: !ready || creating })} flex-1 sm:flex-none`}
          >
            <SendHorizontal size={15} />
            {t("aiCreateThis")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={creating}
            aria-label={t("aiDiscardOrder")}
            title={t("aiDiscardOrder")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 text-gray-400 transition-colors hover:border-error/40 hover:text-error dark:border-primarydark"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <FormFieldError message={draft.createError} />

      {!ready && (
        <ul className="flex flex-wrap gap-1.5" data-testid="ai-issues">
          {issues.map((issue) => (
            <li
              key={issue}
              className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
            >
              {t(ISSUE_KEYS[issue])}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <CardField label={t("customerName")} icon={<User size={12} />} htmlFor={`${idPrefix}-name`}>
          <input
            id={`${idPrefix}-name`}
            type="text"
            value={order.customer_name}
            onChange={(event) => update({ customer_name: event.target.value })}
            className={getFieldClassName(orderInputClassName, issues.includes("name_missing"))}
          />
        </CardField>

        <CardField label={t("phone")} icon={<Phone size={12} />} htmlFor={`${idPrefix}-phone`}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 font-mono text-xs text-gray-400">+998</span>
            <input
              id={`${idPrefix}-phone`}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="XX XXX XX XX"
              value={formatPhone(order.phone_number)}
              onChange={(event) => {
                const next = stripPhone(event.target.value);
                update({ phone_number: next });
                keepPhoneCaretAfterChange(event.target, formatPhone(next));
              }}
              className={getFieldClassName(
                `${orderInputClassName} pl-14 font-mono tracking-wider`,
                issues.includes("phone_invalid"),
              )}
            />
          </div>
          {phoneUnreadable && <FieldHint>{t("aiPhoneRead", { value: source.phone_number })}</FieldHint>}
        </CardField>

        <CardField label={t("additionalPhone")} icon={<Phone size={12} />} htmlFor={`${idPrefix}-extra`}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 font-mono text-xs text-gray-400">+998</span>
            <input
              id={`${idPrefix}-extra`}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="XX XXX XX XX"
              value={formatPhone(order.extra_number ?? "")}
              onChange={(event) => {
                const next = stripPhone(event.target.value);
                update({ extra_number: next });
                keepPhoneCaretAfterChange(event.target, formatPhone(next));
              }}
              className={`${orderInputClassName} pl-14 font-mono tracking-wider`}
            />
          </div>
        </CardField>

        <div className="flex min-w-0 flex-col gap-1.5">
          <SearchableSelect
            label={`${t("filterRegion")} *`}
            name={`${idPrefix}-region`}
            value={order.region_id ?? ""}
            onChange={handleRegionChange}
            options={regionOptions}
            placeholder={regionsLoading ? t("loading", { ns: "common" }) : t("selectRegion")}
            icon={MapPin}
            loading={regionsLoading}
            disabled={regionsLoading}
          />
          {order.region_id && !order.region_given && <FieldHint>{t("aiRegionGuessed")}</FieldHint>}
          {!order.region_id && <FieldHint>{t("aiIssueRegionMissing")}</FieldHint>}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <SearchableSelect
            label={`${t("district")} *`}
            name={`${idPrefix}-district`}
            value={order.district_id ?? ""}
            onChange={handleDistrictChange}
            options={districtOptions}
            placeholder={
              !order.region_id && !candidateOptions.length
                ? t("selectRegionFirst")
                : districtsLoading
                  ? t("loading", { ns: "common" })
                  : t("selectDistrict")
            }
            icon={Building2}
            loading={districtsLoading}
            disabled={(!order.region_id && !candidateOptions.length) || districtsLoading}
          />
          {!order.district_id && <FieldHint>{t("aiIssueDistrictMissing")}</FieldHint>}
        </div>

        <CardField label={t("address")} icon={<Home size={12} />} htmlFor={`${idPrefix}-address`}>
          <textarea
            id={`${idPrefix}-address`}
            rows={2}
            value={order.address ?? ""}
            onChange={(event) => update({ address: event.target.value })}
            className={`${orderInputClassName} resize-none`}
          />
        </CardField>
      </div>

      <section className="flex flex-col gap-2 border-t border-gray-200 pt-4 dark:border-primarydark">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <Package size={12} />
          {t("aiItems")}
        </p>
        {order.items.length === 0 && <FieldHint>{t("aiIssueItemsMissing")}</FieldHint>}
        {order.items.map((item, itemIndex) => {
          const resolved = isItemResolved(item);
          return (
            <div
              key={`${item.name}-${itemIndex}`}
              data-testid="ai-item-row"
              className={`flex flex-col gap-2 rounded-xl border p-2.5 ${
                resolved ? "border-gray-200 dark:border-primarydark/60" : "border-amber-300 dark:border-amber-500/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
                  {t("aiReadAs")}: <span className="font-semibold text-maindark dark:text-primary">{item.name || "—"}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="-"
                    onClick={() => updateItem(itemIndex, { quantity: Math.max(1, item.quantity - 1) })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:border-main/40 dark:border-primarydark"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-maindark dark:text-primary">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => updateItem(itemIndex, { quantity: item.quantity + 1 })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:border-main/40 dark:border-primarydark"
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("aiRemoveItem")}
                    onClick={() => update({ items: order.items.filter((_, i) => i !== itemIndex) })}
                    className="ml-1 text-gray-300 transition-colors hover:text-error"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <SearchableSelect
                label={t("aiCatalogProduct")}
                name={`${idPrefix}-item-${itemIndex}`}
                value={item.product_id ?? ""}
                onChange={(value) => {
                  const product = products.find((p) => p.id === value);
                  const candidate = item.candidates.find((c) => String(c.id) === value);
                  updateItem(itemIndex, {
                    product_id: value || null,
                    resolved_name: product?.name ?? candidate?.name ?? null,
                    allow_free_text: false,
                  });
                }}
                options={productOptionsFor(item)}
                placeholder={productsLoading ? t("loading", { ns: "common" }) : t("aiPickFromCatalog")}
                loading={productsLoading}
                disabled={productsLoading || item.allow_free_text === true}
                size="sm"
              />

              {!item.product_id && (
                <div className="flex flex-col gap-1.5 rounded-lg bg-amber-50 p-2 dark:bg-amber-500/10">
                  <FieldHint>{t("aiProductNotInCatalog")}</FieldHint>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-maindark dark:text-primary">
                    <input
                      type="checkbox"
                      checked={item.allow_free_text === true}
                      onChange={(event) => updateItem(itemIndex, { allow_free_text: event.target.checked })}
                      className="h-4 w-4 accent-[var(--color-main)]"
                    />
                    {t("aiSendAsFreeText")}
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-4 dark:border-primarydark sm:grid-cols-2 sm:gap-4">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("deliveryType")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "center" as DeliveryType, label: t("deliveryCenter"), icon: Building2 },
                { value: "address" as DeliveryType, label: t("deliveryHome"), icon: Home },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={order.where_deliver === value}
                onClick={() => update({ where_deliver: value })}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all ${
                  order.where_deliver === value
                    ? "border-main bg-main text-primary"
                    : "border-gray-200 text-gray-500 hover:border-main/40 dark:border-primarydark dark:text-gray-400"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <CardField label={t("totalPrice")} htmlFor={`${idPrefix}-price`}>
          <input
            id={`${idPrefix}-price`}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={order.total_price === null ? "" : formatPrice(String(order.total_price))}
            onChange={(event) => {
              const digits = stripPrice(event.target.value);
              // Narx o'zgarsa oldingi tasdiq kuchini yo'qotadi.
              update({ total_price: digits ? Number(digits) : null, price_confirmed: false });
            }}
            className={getFieldClassName(
              `${orderInputClassName} font-mono`,
              issues.includes("price_missing") || issues.includes("price_confirm"),
            )}
          />
          {issues.includes("price_missing") && <FieldHint>{t("aiIssuePriceMissing")}</FieldHint>}
          {needsPriceConfirm(order) && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-maindark dark:bg-amber-500/10 dark:text-primary">
              <input
                type="checkbox"
                checked={order.price_confirmed === true}
                onChange={(event) => update({ price_confirmed: event.target.checked })}
                className="h-4 w-4 accent-[var(--color-main)]"
              />
              {t("aiConfirmPrice")}
            </label>
          )}
        </CardField>

        <CardField label={t("operator")} icon={<User size={12} />} htmlFor={`${idPrefix}-operator`}>
          <input
            id={`${idPrefix}-operator`}
            type="text"
            value={order.operator ?? ""}
            onChange={(event) => update({ operator: event.target.value })}
            className={orderInputClassName}
          />
        </CardField>

        <CardField label={t("note")} htmlFor={`${idPrefix}-comment`} wide>
          <textarea
            id={`${idPrefix}-comment`}
            rows={2}
            value={order.comment ?? ""}
            onChange={(event) => update({ comment: event.target.value })}
            className={`${orderInputClassName} resize-none`}
          />
        </CardField>
      </div>
    </article>
  );
};

export default memo(AiPreviewCard);
