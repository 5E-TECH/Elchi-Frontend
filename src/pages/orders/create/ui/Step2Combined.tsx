// dizayn-v2: superadmin-neworders-create-manual-step2, manager-new-orders-create-manual-step2, registrator-new-orders-create-step2, market-new-orders-create-manual
import { memo, useMemo, useState, type ReactNode } from "react";
import { Building2, Check, CircleX, MapPin, Minus, Plus, ShoppingBag, Tag, Trash2, type LucideIcon } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../../entities/product";
import type { DeliveryType } from "../../../../entities/order/types/order";
import type { RootState } from "../../../../app/config/store";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { getUzbekistanPhoneDigits } from "../../../../shared/lib/phone";
import { useCatalogSearch } from "./useCatalogSearch";
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Pressable,
  Select,
  Skeleton,
  TextInput,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { orderItemKey, toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";

type OrderItemValue = OrderCreateFormValues["details"]["items"][number];

type CatalogProduct = { id: string | number; name?: string; price?: number | string | null };

type AreaItem = { id: string | number; name?: string; sato_code?: string | null };

/**
 * Katalog to'liq olinadi (gateway chegarasi 500): `limit` siz server 10 tasini berardi va qidiruv faqat shu
 * 10 ta ichida ishlardi (D-20). Qidiruv — mijozda, olingan ro'yxat bo'yicha.
 */
const CATALOG_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

/** Mavjud naqsh: `nom • sato_code` — operator viloyat/tumanni kod bilan tekshira oladi. */
const toAreaOptions = (items: AreaItem[]): SelectOption[] =>
  items.map((item) => ({
    value: String(item.id),
    label: `${item.name ?? "—"}${item.sato_code ? ` • ${item.sato_code}` : ""}`,
  }));

/** `.el-stat-icon` (36 px): neytral ikonka qutisi. */
const StatIcon = ({ icon: Icon, className }: { icon: LucideIcon; className?: string }) => (
  <span
    aria-hidden="true"
    className={cx("inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-text-muted", className)}
  >
    <Icon size={18} />
  </span>
);

/** Son tanlagich: «−» · son · «+» (har biri 44 px), chegarali guruh. «−» 1 da o'chiq. */
const QuantityStepper = ({
  value,
  groupLabel,
  decreaseLabel,
  increaseLabel,
  onChange,
}: {
  value: number;
  groupLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (next: number) => void;
}) => (
  <div
    role="group"
    aria-label={groupLabel}
    className="inline-flex shrink-0 items-center rounded-xl border border-border-strong bg-surface"
  >
    <IconButton size="lg" icon={Minus} label={decreaseLabel} disabled={value <= 1} onClick={() => onChange(value - 1)} />
    <span className="min-w-7 text-center font-semibold tabular-nums text-text">{value}</span>
    <IconButton size="lg" icon={Plus} label={increaseLabel} onClick={() => onChange(value + 1)} />
  </div>
);

/** Yetkazish turi kartasi (`.el-choice-card` + radio): tanlanganda `action` chegara va `action-soft` fon. */
const DeliveryChoice = ({
  name,
  value,
  checked,
  title,
  hint,
  icon: Icon,
  invalid,
  onSelect,
}: {
  name: string;
  value: DeliveryType;
  checked: boolean;
  title: string;
  hint: string;
  icon: LucideIcon;
  invalid: boolean;
  onSelect: (value: DeliveryType) => void;
}) => (
  <label
    className={cx(
      // `relative` — `sr-only` radio karta ichida qoladi (fokusda sahifa boshqa joyga sakramaydi).
      "relative flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm",
      "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
      "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus",
      checked
        ? "border-action bg-action-soft"
        : cx("bg-input hover:border-text-subtle", invalid ? "border-danger" : "border-border-strong"),
    )}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={() => onSelect(value)}
      className="sr-only"
    />
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
        checked ? "border-action" : "border-border-strong",
      )}
    >
      {checked ? <span className="size-2.5 rounded-full bg-action" /> : null}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="font-semibold text-text">{title}</span>
      <span className="text-xs text-text-muted">{hint}</span>
    </span>
    <Icon size={18} aria-hidden="true" className={cx("shrink-0", checked ? "text-action-fg" : "text-text-muted")} />
  </label>
);

/** Karta ostidagi xato matni (`Field error` ko'rinishida). */
const InlineError = ({ id, children }: { id?: string; children: ReactNode }) => (
  <p id={id} className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
    <CircleX size={16} aria-hidden="true" className="mt-px shrink-0" />
    <span className="min-w-0">{children}</span>
  </p>
);

/**
 * 2-QADAM — MIJOZ VA MAHSULOTLAR (maket `*-create-manual-step2`, `market-new-orders-create-manual`):
 *  - «Mijoz ma'lumotlari»: telefon · qo'shimcha raqam · mijoz ismi (desktopda 3 ustun); «Yetkazish manzili»:
 *    viloyat · tuman (qidiruvli), yetkazish turi (2 radio-karta), manzil · izoh;
 *  - «Buyurtma tafsilotlari *»: chapda katalogdan qo'shish (qidiruv + ro'yxat) va katalogda yo'q mahsulot
 *    (nomi + soni), o'ngda tanlangan mahsulotlar (son tanlagich, olib tashlash).
 * Summa, operator va «Buyurtma yaratish» — yon ustundagi `Step2Summary` da.
 */
const Step2Combined = () => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: unknown) => formatMoneyLocalized(value, { language });

  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<OrderCreateFormValues>();

  const market = useWatch({ control, name: "market" });
  const items = useWatch({ control, name: "details.items" });
  const whereDeliver = useWatch({ control, name: "details.where_deliver" });
  const selectedRegionId = useWatch({ control, name: "customer.region_id" }) ?? "";
  const role = useSelector((state: RootState) => state.role.role);
  const roleName = useSelector((state: RootState) => state.role.name);
  const isMarketRole = role === "market";
  const productSourceMarketId = market ? String(market.id) : "";

  const { useGetRegions, useGetDistricts } = useLogistics();
  const { data: regions, isLoading: regLoading } = useGetRegions();
  const { data: districts, isLoading: distLoading } = useGetDistricts(selectedRegionId);

  const { useGetByMarketId, useGetMyProducts } = useProducts();
  const marketProductsQuery = useGetByMarketId(productSourceMarketId, !isMarketRole, CATALOG_PARAMS);
  const myProductsQuery = useGetMyProducts(isMarketRole, CATALOG_PARAMS);
  const productsData = isMarketRole ? myProductsQuery.data : marketProductsQuery.data;
  const prodLoading = isMarketRole ? myProductsQuery.isLoading : marketProductsQuery.isLoading;

  const regionOptions = useMemo(() => toAreaOptions(toApiList<AreaItem>(regions)), [regions]);
  const districtOptions = useMemo(() => toAreaOptions(toApiList<AreaItem>(districts)), [districts]);
  const allProducts = useMemo(() => toApiList<CatalogProduct>(productsData), [productsData]);

  const [productSearch, setProductSearch] = useState("");
  // qNwXfqLL: qidiruv serverda (`?search=`), mijozdagi filtr emas.
  const { products: filteredProducts, isLoading: searchLoading } = useCatalogSearch({
    marketId: productSourceMarketId,
    isMarketRole,
    search: productSearch,
    catalog: allProducts,
  });

  const updateItems = (updater: (current: OrderItemValue[]) => OrderItemValue[]) => {
    setValue("details.items", updater(getValues("details.items")), { shouldDirty: true, shouldValidate: true });
  };

  // Katalogdagi mahsulot: bor bo'lsa soni +1 (avvalgidek), yo'q bo'lsa 1 ta bilan qo'shiladi.
  const addProduct = (product: CatalogProduct) => {
    const id = String(product.id);
    updateItems((current) =>
      current.some((item) => item.product_id === id)
        ? current.map((item) => (item.product_id === id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...current, { product_id: id, quantity: 1 }],
    );
  };

  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const addCustomProduct = () => {
    const name = customName.trim();
    if (!name) return;
    updateItems((current) => [...current, { product_id: null, product_name: name, quantity: Math.max(1, customQty) }]);
    setCustomName("");
    setCustomQty(1);
  };

  const setQuantity = (key: string, quantity: number) => {
    updateItems((current) =>
      current.map((item) => (orderItemKey(item) === key ? { ...item, quantity: Math.max(1, quantity) } : item)),
    );
  };

  const removeItem = (key: string) => updateItems((current) => current.filter((item) => orderItemKey(item) !== key));

  const getProduct = (id: string | null) =>
    id == null ? undefined : allProducts.find((product) => String(product.id) === id);

  const catalogOwner = isMarketRole ? roleName : market?.name;
  const itemsError = errors.details?.items?.message ?? errors.details?.items?.root?.message;
  const addressRequired = whereDeliver === "address";

  return (
    <>
      <Card padding="none" title={t("customerInfo")} description={t("customerInfoSubtitle")}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4 p-5">
          <Controller
            control={control}
            name="customer.phone"
            render={({ field }) => (
              <Field id="customer.phone" label={t("phone")} required error={errors.customer?.phone?.message}>
                <TextInput
                  mode="phone"
                  name={field.name}
                  placeholder="XX XXX XX XX"
                  value={field.value ? `+998${field.value}` : ""}
                  onValueChange={(next) => field.onChange(getUzbekistanPhoneDigits(next))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="customer.extra_phone"
            render={({ field }) => (
              <Field id="customer.extra_phone" label={t("additionalPhone")} error={errors.customer?.extra_phone?.message}>
                <TextInput
                  mode="phone"
                  name={field.name}
                  placeholder="XX XXX XX XX"
                  value={field.value ? `+998${field.value}` : ""}
                  onValueChange={(next) => field.onChange(getUzbekistanPhoneDigits(next))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="customer.name"
            render={({ field }) => (
              <Field id="customer.name" label={t("createCustomerName")} required error={errors.customer?.name?.message}>
                <TextInput
                  name={field.name}
                  placeholder={t("enterName")}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
        </div>

        <div className="border-t border-border px-5 pt-5 pb-4">
          <h3 className="text-sm font-semibold text-text">{t("createDeliveryAddressTitle")}</h3>
        </div>
        {/*
          Ikki ustun (telefonda bitta). `auto-fit` emas: to'liq qatorli «Yetkazish turi» (`col-span-full`) keng ekranda
          bo'sh uchinchi ustunni ushlab qolib, viloyat/tuman qatorini 2/3 ga qisib qo'yardi.
        */}
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 max-md:grid-cols-1">
          <Controller
            control={control}
            name="customer.region_id"
            render={({ field }) => (
              <Field
                id="customer.region_id"
                label={t("filterRegion")}
                required
                labelAs="span"
                error={errors.customer?.region_id?.message}
              >
                <Select
                  searchable
                  name={field.name}
                  options={regionOptions}
                  value={field.value || null}
                  onChange={(next) => {
                    const value = next ?? "";
                    // Tuman faqat viloyat ALMASHGANDA tozalanadi — 2-qadamga qaytib kelganda (qayta mount) saqlanadi.
                    if (value !== field.value) setValue("customer.district_id", "");
                    field.onChange(value);
                  }}
                  onBlur={field.onBlur}
                  placeholder={regLoading ? t("loading", { ns: "common" }) : t("selectRegion")}
                  loading={regLoading}
                  disabled={regLoading}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="customer.district_id"
            render={({ field }) => (
              <Field
                id="customer.district_id"
                label={t("district")}
                required
                labelAs="span"
                error={errors.customer?.district_id?.message}
              >
                <Select
                  searchable
                  name={field.name}
                  options={districtOptions}
                  value={field.value || null}
                  onChange={(next) => field.onChange(next ?? "")}
                  onBlur={field.onBlur}
                  placeholder={
                    !selectedRegionId
                      ? t("selectRegionFirst")
                      : distLoading
                        ? t("loading", { ns: "common" })
                        : t("selectDistrict")
                  }
                  loading={distLoading}
                  disabled={!selectedRegionId || distLoading}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="details.where_deliver"
            render={({ field }) => (
              <fieldset className="col-span-full m-0 min-w-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-[13px] font-semibold text-text">
                  {t("deliveryType")}
                  <span aria-hidden="true" className="text-danger-fg">
                    {" *"}
                  </span>
                </legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
                  <DeliveryChoice
                    name={field.name}
                    value="center"
                    checked={field.value === "center"}
                    title={t("deliveryToCenter")}
                    hint={t("createDeliveryCenterHint")}
                    icon={Building2}
                    invalid={Boolean(errors.details?.where_deliver)}
                    onSelect={field.onChange}
                  />
                  <DeliveryChoice
                    name={field.name}
                    value="address"
                    checked={field.value === "address"}
                    title={t("deliveryToHome")}
                    hint={t("createDeliveryHomeHint")}
                    icon={MapPin}
                    invalid={Boolean(errors.details?.where_deliver)}
                    onSelect={field.onChange}
                  />
                </div>
                {errors.details?.where_deliver?.message ? (
                  <div className="pt-1.5">
                    <InlineError>{errors.details.where_deliver.message}</InlineError>
                  </div>
                ) : null}
              </fieldset>
            )}
          />

          <Controller
            control={control}
            name="customer.address"
            render={({ field }) => (
              <Field
                id="customer.address"
                label={t("address")}
                required={addressRequired}
                error={errors.customer?.address?.message}
              >
                <TextInput
                  multiline
                  rows={3}
                  name={field.name}
                  placeholder={t("enterFullAddress")}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="details.comment"
            render={({ field }) => (
              <Field id="details.comment" label={t("note")} error={errors.details?.comment?.message}>
                <TextInput
                  multiline
                  rows={3}
                  name={field.name}
                  placeholder={t("notePlaceholder")}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
        </div>
      </Card>

      <Card
        title={
          <>
            {t("details")}
            <span aria-hidden="true" className="text-danger-fg">
              {" *"}
            </span>
          </>
        }
        description={t("selectedProductsSummary", { count: items.length })}
        bodyClassName="flex flex-col gap-4"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <Field id="create-product-search" label={t("addProduct")}>
              <TextInput mode="search" placeholder={t("searchProduct")} value={productSearch} onValueChange={setProductSearch} />
            </Field>

            <ul
              aria-label={t("createCatalogLabel", { market: catalogOwner ?? "—" })}
              aria-busy={prodLoading || searchLoading || undefined}
              className="m-0 flex max-h-[296px] list-none flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl bg-sunken p-1 text-sm"
            >
              {prodLoading || searchLoading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <li key={index} aria-hidden="true" className="flex min-h-13 items-center gap-3 px-3 py-2">
                    <Skeleton shape="block" tone="border" width={36} height={36} />
                    <span className="flex flex-1 flex-col gap-1.5">
                      <Skeleton tone="border" width="55%" />
                      <Skeleton tone="border" width="30%" />
                    </span>
                  </li>
                ))
              ) : allProducts.length === 0 ? (
                // Katalog umuman bo'sh — «Topilmadi» (qNwXfqLL), izohda katalog bo'shligi va qayerdan qo'shish (D-19).
                <li>
                  <EmptyState
                    icon={ShoppingBag}
                    title={t("notFound", { ns: "common" })}
                    description={t("createCatalogEmptyHint")}
                  />
                </li>
              ) : filteredProducts.length === 0 ? (
                <li>
                  <EmptyState icon={ShoppingBag} title={t("notFound", { ns: "common" })} />
                </li>
              ) : (
                filteredProducts.map((product) => {
                  const isAdded = items.some((item) => item.product_id === String(product.id));
                  return (
                    <li key={product.id}>
                      <Pressable
                        onClick={() => addProduct(product)}
                        className={cx(
                          "flex min-h-13 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left",
                          "transition-[background-color] duration-150 hover:bg-surface motion-reduce:transition-none",
                        )}
                      >
                        <StatIcon icon={ShoppingBag} className="bg-surface" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-semibold text-text">{product.name}</span>
                          {product.price != null ? (
                            <span className="text-[13px] text-text-muted">{money(product.price)}</span>
                          ) : null}
                        </span>
                        {isAdded ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-action-fg">
                            <Check size={16} aria-hidden="true" />
                            {t("createProductAdded")}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-text">
                            <Plus size={16} aria-hidden="true" />
                            {t("createProductAdd")}
                          </span>
                        )}
                      </Pressable>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Katalogda yo'q («maxsus») mahsulot — katalog bo'sh bo'lsa ham buyurtma yaratiladi. */}
            <Field id="create-custom-product" label={t("createCustomProductLabel")}>
              <TextInput
                placeholder={t("createCustomProductPlaceholder")}
                value={customName}
                onValueChange={setCustomName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomProduct();
                  }
                }}
              />
              <div className="flex min-w-0 items-center gap-3 pt-1.5">
                <span className="text-[13px] text-text-muted">{t("createCustomQuantityLabel")}</span>
                <QuantityStepper
                  value={customQty}
                  groupLabel={t("createCustomQuantityGroup")}
                  decreaseLabel={t("createCustomQuantityDecrease")}
                  increaseLabel={t("createCustomQuantityIncrease")}
                  onChange={(next) => setCustomQty(Math.max(1, next))}
                />
                <Button
                  variant="secondary"
                  leftIcon={Plus}
                  disabled={!customName.trim()}
                  onClick={addCustomProduct}
                  className="min-h-11 min-w-0 flex-1"
                >
                  {t("createProductAdd")}
                </Button>
              </div>
            </Field>
          </div>

          <div className="flex min-w-0 flex-col">
            <h3 className="pb-3 text-[13px] font-semibold text-text">{t("createSelectedProducts")}</h3>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-strong">
                <EmptyState icon={ShoppingBag} title={t("selectProductShort")} />
              </div>
            ) : (
              <ul aria-label={t("createSelectedProducts")} className="m-0 list-none p-0 text-sm">
                {items.map((item) => {
                  const key = orderItemKey(item);
                  const product = getProduct(item.product_id);
                  const isCustom = item.product_id == null;
                  const name = product?.name ?? item.product_name ?? `#${item.product_id ?? "?"}`;
                  return (
                    <li
                      key={key}
                      className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-border py-3 last:pb-0"
                    >
                      <StatIcon icon={isCustom ? Tag : ShoppingBag} className="bg-sunken" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-text">{name}</div>
                        <div className="text-[13px] text-text-muted">
                          {isCustom
                            ? t("orderDetail.catalogLess")
                            : product?.price != null
                              ? money(product.price)
                              : "—"}
                        </div>
                      </div>
                      <IconButton
                        size="lg"
                        icon={Trash2}
                        label={t("createRemoveItem", { name })}
                        onClick={() => removeItem(key)}
                      />
                      <div className="col-start-2 col-end-4">
                        <QuantityStepper
                          value={item.quantity}
                          groupLabel={t("itemQuantityGroup", { name })}
                          decreaseLabel={t("decreaseQuantity", { name })}
                          increaseLabel={t("increaseQuantity", { name })}
                          onChange={(next) => setQuantity(key, next)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        {itemsError ? <InlineError id="details.items-error">{itemsError}</InlineError> : null}
      </Card>
    </>
  );
};

export default memo(Step2Combined);
