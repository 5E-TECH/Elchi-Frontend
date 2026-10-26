// dizayn-v2: superadmin-neworders-create-ai-preview, admin-neworders-create-ai, manager-new-orders-create-ai, registrator-new-orders-create-ai, market-new-orders-create-ai-preview
import { memo, useId, useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronDown, ChevronUp, MapPin, Minus, Package, Plus, Send, Trash2, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLogistics } from "../../../../../entities/logistics/api/logisticsApi";
import { toLocalPhone, type AiPreviewItem, type AiWarningField } from "../../../../../entities/ai-order";
import type { DeliveryType } from "../../../../../entities/order/types/order";
import { cx } from "../../../../../shared/lib/cx";
import { formatMoneyLocalized } from "../../../../../shared/lib/formatMoney";
import { getUzbekistanPhoneDigits, toUzbekistanPhoneValue } from "../../../../../shared/lib/phone";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  Field,
  IconButton,
  Pressable,
  SegmentedControl,
  Select,
  TextInput,
  type SelectOption,
} from "../../../../../shared/ui/primitives";
import { CreateAlert } from "../CreateAlert";
import { toDraft, toList, type AiDraft } from "./aiDraft";
import { activeAiWarnings, sourceAiWarnings } from "./aiWarnings";
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

/** Mavjud naqsh (qo'lda forma): `nom • sato_code` — operator viloyat/tumanni tekshira oladi. */
const areaLabel = (item: AiAreaItem) => `${item.name ?? "—"}${item.sato_code ? ` • ${item.sato_code}` : ""}`;

/** Ikki ustundan biriga mos maydonlar to'ri (maket: `minmax(min(220px,100%),1fr)`, oraliq 16). */
const FIELD_GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4";

/** Maydon ostidagi sariq ogohlantirish (maket: 13 px, `warning-fg`, qalin, `TriangleAlert`). */
const WarningHint = ({ children }: { children: ReactNode }) => (
  <span className="flex items-start gap-1.5 text-[13px] font-semibold text-warning-fg">
    <TriangleAlert size={16} aria-hidden="true" className="mt-px shrink-0" />
    <span className="min-w-0">{children}</span>
  </span>
);

/**
 * AI ogohlantirishi (J3hEDtFN `warnings[]`) — tegishli maydon ostida, `WarningHint` ko'rinishida. Matn faqat
 * sabab enum'idan (`aiWarning.<reason>`), server matni yo'q.
 */
const FieldWarning = ({ field, children }: { field: AiWarningField; children: ReactNode }) => (
  <span data-testid="ai-field-warning" data-field={field} className="flex">
    <WarningHint>{children}</WarningHint>
  </span>
);

/** Checkbox qatori (`.el-choice`, telefonda ham ≥ 44 px). */
const ChoiceRow = ({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
}) => (
  <label className={cx("flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-text", className)}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="size-[18px] shrink-0 accent-action"
    />
    {children}
  </label>
);

/**
 * Server sababi sarlavha bilan boshlansa («Buyurtma yaratilmadi: …») takrorlanmasin — matnda faqat sabab.
 */
const stripTitle = (message: string, title: string) => {
  if (!message.startsWith(title)) return message;
  return message.slice(title.length).replace(/^[\s:.—-]+/, "");
};

type AiPreviewCardProps = {
  draft: AiDraft;
  index: number;
  products: AiProductOption[];
  productsLoading: boolean;
  regions: AiAreaItem[];
  regionsLoading: boolean;
  /**
   * Viloyat/tuman ro'yxatlari bormi (sukut `true`). Market operatorida yo'q (`GET /region`, `region/:id` — 403, N11;
   * MO-3): «Viloyat» maydoni chiqmaydi (viloyatni backend tumandan oladi), «Tuman» — AI aniqlagani va takliflari.
   */
  areaLists?: boolean;
  /** Operator — so'rovchining o'zi (market operatori): maydon faqat o'qish uchun, «Siz — avtomatik yoziladi». */
  selfOperator?: { name: string | null };
  creating: boolean;
  onChange: (order: AiDraftOrder) => void;
  onRemove: () => void;
  onCreate: () => void;
};

/**
 * AI PREVIEW KARTASI (maket `*-create-ai-preview`): sarlavhada tartib raqami, mijoz ismi va holat
 * («Tayyor» / «To'ldirilmagan: N ta»), «Bu kartani yaratish» + «Bu buyurtmani tashlab yuborish».
 * Tanada: server xatosi, kamchiliklar, mijoz va manzil maydonlari, mahsulotlar (AI o'qigani + katalogdan
 * tanlash), yetkazish turi, summa, operator, izoh. Karta boshqariladi — holat ota komponentda.
 */
const AiPreviewCard = ({
  draft,
  index,
  products,
  productsLoading,
  regions,
  regionsLoading,
  areaLists = true,
  selfOperator,
  creating,
  onChange,
  onRemove,
  onCreate,
}: AiPreviewCardProps) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { order, source } = draft;
  const { ready, issues } = evalPreview(order, { regionRequired: areaLists });
  const idPrefix = `ai-${draft.key}`;
  const titleId = useId();
  const bodyId = useId();

  /**
   * TELEFONDA tayyor karta sukut bo'yicha YIG'ILGAN (bitta qator: tuman · summa) — 30 ta ochiq karta
   * telefonda foydalanib bo'lmaydigan uzunlik beradi. ⚠️ `ready` bo'lmagan yoki yaratishda yiqilgan karta
   * MAJBURAN ochiq va yig'ish tugmasi yo'q: operator uni ko'rishi shart. ≥ 768 da tana har doim ochiq (CSS).
   */
  const mustStayOpen = !ready || Boolean(draft.createError);
  const [expanded, setExpanded] = useState(mustStayOpen);
  // Karta "tayyor emas"ga o'tsa ochiladi va tahrir paytida o'zi yopilmaydi.
  if (mustStayOpen && !expanded) setExpanded(true);

  const summaryPrice =
    order.total_price === null ? "—" : formatMoneyLocalized(order.total_price, { language });

  // react-query kaliti `[districts, regionId]` — bir xil viloyatli kartalar keshni baham ko'radi.
  const { useGetDistricts } = useLogistics();
  const districtsQuery = useGetDistricts(order.region_id ?? undefined, areaLists);
  const districts = toList<AiAreaItem>(districtsQuery.data);
  const districtsLoading = areaLists && Boolean(order.region_id) && districtsQuery.isLoading;

  // AI chiqishining tahrirgacha ko'rinishi: operator maydonni o'zgartirsa, uning ogohlantirishi yo'qoladi.
  const initialOrder = useMemo(() => toDraft(source, draft.key).order, [source, draft.key]);
  const warnings = activeAiWarnings(sourceAiWarnings(source), order, initialOrder);
  const warningFor = (field: AiWarningField): ReactNode => {
    const reason = warnings[field];
    return reason ? (
      <FieldWarning key={field} field={field}>
        {t(`aiWarning.${reason}`)}
      </FieldWarning>
    ) : null;
  };
  /** Bir nechta izoh bitta `hint` da (ustma-ust); hammasi bo'sh bo'lsa — `undefined`. */
  const hints = (...items: ReactNode[]): ReactNode => {
    const shown = items.filter(Boolean);
    return shown.length > 0 ? <>{shown}</> : undefined;
  };
  // Kartada o'z maydoni yo'q ogohlantirishlar (almashtirish; ro'yxatsiz rolda viloyat) — maydonlar ustida.
  const cardWarnings = (["is_replacement", ...(areaLists ? [] : ["region_name"])] as AiWarningField[]).filter(
    (field) => warnings[field],
  );

  const update = (patch: Partial<AiDraftOrder>) => onChange({ ...order, ...patch });
  const updateItem = (itemIndex: number, patch: Partial<AiPreviewItem>) =>
    update({ items: order.items.map((item, i) => (i === itemIndex ? { ...item, ...patch } : item)) });

  const regionOptions: SelectOption[] = regions.map((region) => ({ value: String(region.id), label: areaLabel(region) }));

  /**
   * Tuman ro'yxati: AI takliflari ENG TEPADA alohida guruhda, qolganlari «Barcha tumanlar» guruhida.
   * Taklif boshqa viloyatda bo'lsa (tumanlar ro'yxatida yo'q) — `nom • viloyat`.
   */
  const candidateIds = new Set(order.district_candidates.map((candidate) => String(candidate.id)));
  const candidateOptions: SelectOption[] = order.district_candidates.map((candidate) => {
    const known = districts.find((district) => String(district.id) === String(candidate.id));
    return {
      value: String(candidate.id),
      label: known ? areaLabel(known) : `${candidate.label} • ${candidate.region_name}`,
      group: t("aiSuggestions"),
    };
  });
  const hasCandidates = candidateOptions.length > 0;
  // Ro'yxatsiz (market operatori) va taklifsiz: tumanni kartada tanlab bo'lmaydi — faqat matnni tuzatib qayta tahlil.
  const districtFromTextOnly = !areaLists && !hasCandidates && !order.district_id;
  const districtOptions: SelectOption[] = [
    ...candidateOptions,
    ...districts
      .filter((district) => !candidateIds.has(String(district.id)))
      .map((district) => ({
        value: String(district.id),
        label: areaLabel(district),
        group: hasCandidates ? t("aiAllDistricts") : undefined,
      })),
  ];
  if (order.district_id && !districtOptions.some((option) => option.value === order.district_id)) {
    districtOptions.unshift({ value: order.district_id, label: order.district_name ?? `#${order.district_id}` });
  }

  /**
   * ⚠️ Tuman FAQAT operator viloyatni qo'lda o'zgartirganda tozalanadi — shu handler ichida, `useEffect` da
   * EMAS. Effekt AI birga qo'ygan viloyat+tumanni jimgina o'chirib yuborardi.
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

  /** Katalog ro'yxati: AI takliflari tepada («AI takliflari»), qolgani «Barcha mahsulotlar». */
  const productOptionsFor = (item: AiPreviewItem): SelectOption[] => {
    const suggested = new Set(item.candidates.map((candidate) => String(candidate.id)));
    const hasSuggestions = item.candidates.length > 0;
    const options: SelectOption[] = [
      ...item.candidates.map((candidate) => ({
        value: String(candidate.id),
        label: candidate.name,
        group: t("aiSuggestions"),
      })),
      ...products
        .filter((product) => !suggested.has(product.id))
        .map((product) => ({
          value: product.id,
          label: product.name,
          group: hasSuggestions ? t("aiAllProducts") : undefined,
        })),
    ];
    if (item.product_id && !options.some((option) => option.value === item.product_id)) {
      options.unshift({ value: item.product_id, label: item.resolved_name ?? `#${item.product_id}` });
    }
    return options;
  };

  const phoneUnreadable = !toLocalPhone(order.phone_number) && Boolean(source.phone_number?.trim());
  const failedTitle = t("aiCreateFailedTitle");
  const failedText = draft.createError ? stripTitle(draft.createError, failedTitle) : "";
  // `duplicate_recent` (j3WEDIpt): buyurtma allaqachon bor — karta «Mavjud (#N)», qayta yaratilmaydi.
  const existingOrderId = draft.existingOrderId;
  const priceInvalid = issues.includes("price_missing") || issues.includes("price_confirm");
  const customerName = order.customer_name?.trim();

  return (
    <Card
      as="article"
      padding="none"
      aria-labelledby={titleId}
      data-testid="ai-preview-card"
      data-ready={ready}
      data-existing={existingOrderId ? "" : undefined}
      // `scroll-mb-48` — klaviatura ochilganda / `scrollIntoView` da maydon pastdagi yopishgan
      // «Yaratishni tasdiqlash» paneli ostida qolib ketmaydi.
      className="scroll-mt-4 scroll-mb-48 [&_input]:scroll-mb-48 [&_textarea]:scroll-mb-48"
    >
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-[999_1_auto] flex-wrap items-center gap-2.5">
          <Badge>#{index + 1}</Badge>
          <h2 id={titleId} className="min-w-0 text-base font-bold text-text [overflow-wrap:anywhere]">
            {customerName || "—"}
          </h2>
          {existingOrderId ? (
            <Badge tone="warning" dot>
              {t("aiExisting", { id: existingOrderId })}
            </Badge>
          ) : ready ? (
            <Badge tone="success" dot>
              {t("aiReady")}
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              {t("aiNotReady", { count: issues.length })}
            </Badge>
          )}
        </div>
        <div className="flex flex-[1_1_auto] items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Send}
            onClick={onCreate}
            disabled={!ready || creating || Boolean(existingOrderId)}
            className="max-md:flex-[1_0_auto]"
          >
            {t("aiCreateThis")}
          </Button>
          <IconButton
            variant="secondary"
            size="sm"
            icon={X}
            label={t("aiDiscardOrder")}
            onClick={onRemove}
            disabled={creating}
          />
        </div>
      </header>

      {!mustStayOpen ? (
        <Pressable
          data-testid="ai-card-toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((value) => !value)}
          className={cx(
            "hidden min-h-[52px] w-full items-center gap-2 px-5 py-3 text-left max-md:flex",
            expanded && "border-b border-border",
          )}
        >
          <span className="sr-only">{expanded ? t("aiCardCollapse") : t("aiCardExpand")} </span>
          {/* Uzun tuman nomi qisqaradi — summa har doim to'liq ko'rinadi. */}
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px]">
            <span className="min-w-0 truncate text-text-muted">{order.district_name || "—"}</span>
            <span aria-hidden="true" className="shrink-0 text-text-muted">
              ·
            </span>
            <span className="shrink-0 whitespace-nowrap font-semibold text-text">{summaryPrice}</span>
          </span>
          {expanded ? (
            <ChevronUp size={16} aria-hidden="true" className="shrink-0 text-action-fg" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
          )}
        </Pressable>
      ) : null}

      <div
        id={bodyId}
        data-testid="ai-card-body"
        className={cx("flex flex-col gap-5 p-5", !expanded && "max-md:hidden")}
      >
        {draft.createError && existingOrderId ? (
          <CreateAlert
            tone="warning"
            title={t("aiExistingTitle")}
            action={
              <Link to={`/orders/edit/${existingOrderId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {t("aiOpenExisting", { id: existingOrderId })}
              </Link>
            }
          >
            {failedText}
          </CreateAlert>
        ) : draft.createError ? (
          <CreateAlert tone="danger" title={failedTitle}>
            {failedText}
          </CreateAlert>
        ) : null}

        {!ready ? (
          <ul aria-label={t("aiIssuesLabel")} data-testid="ai-issues" className="flex flex-wrap gap-2">
            {issues.map((issue) => (
              <li key={issue} className="min-w-0">
                <Badge tone="warning" className="max-w-full">
                  <span className="truncate">
                    {t(issue === "district_missing" && districtFromTextOnly ? "operatorCreate.districtChip" : ISSUE_KEYS[issue])}
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {cardWarnings.length > 0 ? (
          <ul aria-label={t("aiWarning.listLabel")} className="flex flex-col gap-1.5">
            {cardWarnings.map((field) => (
              <li key={field}>
                <FieldWarning field={field}>
                  {t("aiWarning.withField", {
                    field: t(field === "is_replacement" ? "aiWarning.fieldReplacement" : "aiWarning.fieldRegion"),
                    reason: t(`aiWarning.${warnings[field]}`),
                  })}
                </FieldWarning>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={FIELD_GRID}>
          <Field
            label={t("createCustomerName")}
            required
            id={`${idPrefix}-name`}
            invalid={issues.includes("name_missing")}
            hint={hints(warningFor("customer_name"))}
          >
            <TextInput
              value={order.customer_name}
              onValueChange={(value) => update({ customer_name: value })}
              placeholder={t("enterName")}
            />
          </Field>

          <Field
            label={t("phone")}
            required
            id={`${idPrefix}-phone`}
            invalid={issues.includes("phone_invalid")}
            hint={hints(
              phoneUnreadable ? <WarningHint key="read">{t("aiPhoneRead", { value: source.phone_number })}</WarningHint> : null,
              warningFor("phone_number"),
            )}
          >
            <TextInput
              mode="phone"
              value={toUzbekistanPhoneValue(order.phone_number)}
              onValueChange={(value) => update({ phone_number: getUzbekistanPhoneDigits(value) })}
            />
          </Field>

          <Field label={t("additionalPhone")} id={`${idPrefix}-extra`} hint={hints(warningFor("extra_number"))}>
            <TextInput
              mode="phone"
              value={toUzbekistanPhoneValue(order.extra_number ?? "")}
              onValueChange={(value) => update({ extra_number: getUzbekistanPhoneDigits(value) })}
            />
          </Field>

          {areaLists ? (
            <Field
              label={t("filterRegion")}
              labelAs="span"
              required
              id={`${idPrefix}-region`}
              hint={hints(
                order.region_id && !order.region_given ? <WarningHint key="guessed">{t("aiRegionGuessed")}</WarningHint> : null,
                warningFor("region_name"),
              )}
            >
              <Select
                searchable
                options={regionOptions}
                value={order.region_id || null}
                onChange={(value) => handleRegionChange(value ?? "")}
                placeholder={t("selectRegion")}
                loading={regionsLoading}
              />
            </Field>
          ) : null}

          <Field
            label={t("district")}
            labelAs="span"
            required
            id={`${idPrefix}-district`}
            hint={hints(
              // Ro'yxatsiz (market operatori): tuman AI matndan topmagan va taklif yo'q — matnni tuzatib qayta tahlil.
              districtFromTextOnly ? <WarningHint key="text">{t("operatorCreate.districtFromText")}</WarningHint> : null,
              warningFor("district_name"),
            )}
          >
            <Select
              searchable
              options={districtOptions}
              value={order.district_id || null}
              onChange={(value) => handleDistrictChange(value ?? "")}
              placeholder={!areaLists || order.region_id || hasCandidates ? t("selectDistrict") : t("selectRegionFirst")}
              loading={districtsLoading}
              disabled={areaLists ? !order.region_id && !hasCandidates : !hasCandidates && !order.district_id}
            />
          </Field>

          <Field label={t("address")} id={`${idPrefix}-address`} hint={hints(warningFor("address"))}>
            <TextInput
              value={order.address ?? ""}
              onValueChange={(value) => update({ address: value })}
              placeholder={t("enterFullAddress")}
            />
          </Field>
        </div>

        <section aria-labelledby={`${idPrefix}-items-title`} className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 id={`${idPrefix}-items-title`} className="flex items-center gap-2 text-sm font-semibold text-text">
            <Package size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
            {t("aiItems")}
          </h3>
          {order.items.length === 0 ? <WarningHint>{t("aiIssueItemsMissing")}</WarningHint> : null}
          {warningFor("items")}
          {order.items.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {order.items.map((item, itemIndex) => {
                const name = item.name || "—";
                return (
                  <li
                    key={`${item.name}-${itemIndex}`}
                    data-testid="ai-item-row"
                    data-resolved={isItemResolved(item)}
                    className="flex flex-col gap-3 rounded-xl bg-sunken p-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="min-w-0 flex-[1_1_200px] text-[13px] text-text-muted [overflow-wrap:anywhere]">
                        {t("aiReadAs")}: <span className="font-semibold text-text">{name}</span>
                      </p>
                      <div className="flex items-center gap-1">
                        <div
                          role="group"
                          aria-label={t("itemQuantityGroup", { name })}
                          className="inline-flex items-center rounded-[10px] border border-border-strong bg-surface"
                        >
                          <IconButton
                            size="sm"
                            icon={Minus}
                            label={t("decreaseQuantity", { name })}
                            disabled={item.quantity <= 1}
                            onClick={() => updateItem(itemIndex, { quantity: Math.max(1, item.quantity - 1) })}
                          />
                          <span className="min-w-7 text-center text-sm font-semibold text-text tabular-nums">
                            {item.quantity}
                          </span>
                          <IconButton
                            size="sm"
                            icon={Plus}
                            label={t("increaseQuantity", { name })}
                            onClick={() => updateItem(itemIndex, { quantity: item.quantity + 1 })}
                          />
                        </div>
                        <IconButton
                          size="sm"
                          icon={Trash2}
                          label={t("aiRemoveItem", { name })}
                          onClick={() => update({ items: order.items.filter((_, i) => i !== itemIndex) })}
                        />
                      </div>
                    </div>

                    <Field label={t("aiCatalogProduct")} labelAs="span" id={`${idPrefix}-item-${itemIndex}`}>
                      <Select
                        searchable
                        options={productOptionsFor(item)}
                        value={item.product_id || null}
                        onChange={(value) => {
                          const product = products.find((p) => p.id === value);
                          const candidate = item.candidates.find((c) => String(c.id) === value);
                          updateItem(itemIndex, {
                            product_id: value || null,
                            resolved_name: product?.name ?? candidate?.name ?? null,
                            allow_free_text: false,
                          });
                        }}
                        placeholder={t("aiPickFromCatalog")}
                        loading={productsLoading}
                        disabled={item.allow_free_text === true}
                      />
                    </Field>

                    {!item.product_id ? (
                      <div className="flex flex-col gap-1 rounded-xl bg-warning-soft px-3 py-2.5">
                        <WarningHint>{t("aiProductNotInCatalog")}</WarningHint>
                        <ChoiceRow
                          checked={item.allow_free_text === true}
                          onChange={(checked) => updateItem(itemIndex, { allow_free_text: checked })}
                        >
                          {t("aiSendAsFreeText")}
                        </ChoiceRow>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <div className={cx(FIELD_GRID, "border-t border-border pt-5")}>
          <div className="col-span-full flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-text">{t("deliveryType")}</span>
            <SegmentedControl<DeliveryType>
              ariaLabel={t("deliveryType")}
              fullWidth
              value={order.where_deliver === "address" ? "address" : "center"}
              onValueChange={(value) => update({ where_deliver: value })}
              options={[
                { value: "center", label: t("deliveryToCenter"), icon: Building2 },
                { value: "address", label: t("deliveryToHome"), icon: MapPin },
              ]}
            />
            {warningFor("where_deliver")}
          </div>

          <Field
            label={t("totalPrice")}
            required
            id={`${idPrefix}-price`}
            invalid={priceInvalid}
            hint={hints(
              issues.includes("price_missing") ? <WarningHint key="missing">{t("aiIssuePriceMissing")}</WarningHint> : null,
              warningFor("total_price"),
            )}
          >
            <TextInput
              mode="money"
              placeholder="0"
              value={order.total_price === null ? "" : String(order.total_price)}
              // Narx o'zgarsa oldingi tasdiq kuchini yo'qotadi.
              onValueChange={(digits) => update({ total_price: digits ? Number(digits) : null, price_confirmed: false })}
            />
            {needsPriceConfirm(order) ? (
              <ChoiceRow
                checked={order.price_confirmed === true}
                onChange={(checked) => update({ price_confirmed: checked })}
                className="rounded-[10px] bg-warning-soft px-2.5 py-2"
              >
                {t("aiConfirmPrice")}
              </ChoiceRow>
            ) : null}
          </Field>

          {selfOperator ? (
            // Market operatori: operator — o'zi (maket `market_operator-new-orders-create-manual`); tahrirlanmaydi.
            <Field label={t("operator")} id={`${idPrefix}-operator`} hint={t("operatorCreate.operatorAuto")}>
              <TextInput value={selfOperator.name?.trim() || t("operatorCreate.operatorYou")} readOnly />
            </Field>
          ) : (
            <Field label={t("operator")} id={`${idPrefix}-operator`} hint={hints(warningFor("operator"))}>
              <TextInput
                value={order.operator ?? ""}
                onValueChange={(value) => update({ operator: value })}
                placeholder={t("operatorPlaceholder")}
              />
            </Field>
          )}

          <Field label={t("note")} id={`${idPrefix}-comment`} hint={hints(warningFor("comment"))}>
            <TextInput
              value={order.comment ?? ""}
              onValueChange={(value) => update({ comment: value })}
              placeholder={t("notePlaceholder")}
            />
          </Field>
        </div>
      </div>
    </Card>
  );
};

export default memo(AiPreviewCard);
