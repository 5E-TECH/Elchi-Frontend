// dizayn-v2: superadmin-notifications-send-audience, superadmin-notifications-send-states
import { useId, useMemo, useState } from "react";
import { Check, Info, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { cx } from "../../../shared/lib/cx";
import {
  Field,
  IconButton,
  Pressable,
  Select,
  useConfirm,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { useAudienceSegments, useDeleteAudienceSegment } from "../api/hooks";
import type { AudiencePreview, SavedAudienceSegment } from "../api/campaignApi";
import {
  AUDIENCE_KINDS,
  AUDIENCE_STAFF_ROLES,
  draftFromSavedAudience,
  type AudienceDraft,
  type AudienceKind,
  type AudienceStaffRole,
  type AudienceTarget,
} from "../model/audience";
import { isCustomerSegmentEmpty, isOrderRangeInverted } from "../model/segment";
import type { AudiencePreviewErrorKind, AudiencePreviewState } from "../model/previewState";
import { AudienceSampleDialog } from "./AudienceSampleDialog";
import { AllCustomersChoice, AudienceSummary } from "./AudienceSummary";
import { CustomerSegmentFilters } from "./CustomerSegmentFilters";
import { SaveSegmentDialog } from "./SaveSegmentDialog";

export type AudienceBuilderErrors = {
  kinds?: string;
  staffRoles?: string;
  customer?: string;
};

export type AudienceBuilderProps = {
  value: AudienceDraft;
  onChange: (next: AudienceDraft) => void;
  /** Joriy nishon (`toAudienceTarget(value)`) — namuna va segmentni saqlash uchun. */
  target: AudienceTarget | null;
  previewState: AudiencePreviewState;
  preview: AudiencePreview | undefined;
  previewErrorKind?: AudiencePreviewErrorKind;
  onRetryPreview: () => void;
  /** Yuborishga urinishdan keyingi xatolar (tur, xodim roli, mijoz filtri). */
  errors?: AudienceBuilderErrors;
  disabled?: boolean;
  /** «Oxirgi buyurtma» taqvimidagi bugungi kun (test). */
  today?: string;
};

/** `.el-choice-card` (CODE-MAP 2.2). */
const CHOICE_CARD =
  "flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 " +
  "text-sm text-text has-[:checked]:border-action has-[:checked]:bg-action-soft " +
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70";
const CHECKBOX = "size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed";
/** `.el-chip` (`aria-pressed`) — telefonda 44 px. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg disabled:cursor-not-allowed disabled:opacity-60 max-md:h-11";
const LABEL = "min-w-0 text-[13px] font-semibold text-text";
const ERROR = "m-0 text-xs font-semibold text-danger-fg";

/**
 * AUDITORIYA KONSTRUKTORI — «Kimga» kartasidagi «Auditoriya» rejimi (maketlar `superadmin-notifications-send-audience`,
 * `-send-states`): «Saqlangan segment» (tanlash, o'chirish — tasdiq bilan), «Turi» (Mijoz · Market · Xodim), «Xodim
 * rollari» (chiplar; superadmin va investor yo'q — KM-S2), «Mijoz filtrlari» (faqat «Mijoz» bilan; aks holda izoh),
 * pastda jonli son (`AudienceSummary`), «Namunani ko'rish» va «Segmentni saqlash» oynalari.
 *
 * Maketdan farq: saqlangan segmentni o'chirish tugmasi ro'yxat bandi ichida emas, maydon yonida (tanlangan segment
 * uchun) — `role="option"` ichida ikkinchi tugma bo'lmaydi (klaviatura va ekran o'quvchi).
 */
export const AudienceBuilder = ({
  value,
  onChange,
  target,
  previewState,
  preview,
  previewErrorKind,
  onRetryPreview,
  errors,
  disabled = false,
  today,
}: AudienceBuilderProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (n: number) => formatNumberLocalized(n, { language });
  const confirm = useConfirm();
  const staffLabelId = useId();
  const staffHintId = useId();
  const segments = useAudienceSegments();
  const deleteSegment = useDeleteAudienceSegment();
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [marketLabel, setMarketLabel] = useState<string | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const has = (kind: AudienceKind) => value.kinds.includes(kind);
  /** Qo'lda o'zgarish — tanlangan saqlangan segment endi shartga mos emas. */
  const edit = (patch: Partial<AudienceDraft>) => {
    setSegmentId(null);
    onChange({ ...value, ...patch });
  };

  const toggleKind = (kind: AudienceKind, checked: boolean) =>
    edit({
      kinds: AUDIENCE_KINDS.filter((item) =>
        item === kind ? checked : value.kinds.includes(item),
      ),
    });
  const toggleRole = (role: AudienceStaffRole) =>
    edit({
      staffRoles: AUDIENCE_STAFF_ROLES.filter((item) =>
        item === role ? !value.staffRoles.includes(role) : value.staffRoles.includes(item),
      ),
    });

  const segmentOptions = useMemo<SelectOption[]>(
    () =>
      (segments.data ?? []).map((segment) => ({
        value: segment.id,
        label: segment.name,
        description:
          segment.lastTotal === null
            ? undefined
            : segment.lastCountedAt
              ? t("campaign.segments.meta", {
                  value: formatNumberLocalized(segment.lastTotal, { language }),
                  time: formatDateTimeLocalized(segment.lastCountedAt, { language }),
                })
              : t("campaign.segments.metaNoTime", {
                  value: formatNumberLocalized(segment.lastTotal, { language }),
                }),
      })),
    [segments.data, t, language],
  );
  const selectedSegment = segments.data?.find((segment) => segment.id === segmentId) ?? null;

  const applySegment = (segment: SavedAudienceSegment) => {
    setSegmentId(segment.id);
    setMarketLabel(null);
    onChange(draftFromSavedAudience(segment.audience));
  };

  const removeSegment = async (segment: SavedAudienceSegment) => {
    const done = await confirm({
      title: t("campaign.segments.deleteTitle"),
      description: t("campaign.segments.deleteText", { name: segment.name }),
      confirmLabel: t("campaign.segments.deleteConfirm"),
      cancelLabel: t("campaign.segments.deleteClose"),
      tone: "danger",
      icon: Trash2,
      onConfirm: async () => {
        try {
          await deleteSegment.mutateAsync(segment.id);
        } catch (error) {
          // Allaqachon o'chirilgan — natija baribir shu.
          if (getErrorStatus(error) !== 404) throw error;
        }
      },
      errorMessage: () => t("campaign.segments.deleteFailed"),
    });
    if (!done) return;
    setSegmentId(null);
    notify.success(t("campaign.segments.deleted"), { description: segment.name });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="audience-builder">
      <Field
        label={t("campaign.segments.label")}
        labelAs="span"
        hint={segments.isError ? t("campaign.segments.loadError") : undefined}
        hintLive
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select
              className="w-full"
              options={segmentOptions}
              value={segmentId}
              placeholder={t("campaign.segments.placeholder")}
              emptyText={t("campaign.segments.empty")}
              noOptionsText={t("campaign.segments.empty")}
              loading={segments.isLoading}
              disabled={disabled}
              onChange={(id) => {
                const segment = segments.data?.find((item) => item.id === id);
                if (segment) applySegment(segment);
              }}
            />
          </div>
          {selectedSegment ? (
            <IconButton
              icon={Trash2}
              label={t("campaign.segments.delete", { name: selectedSegment.name })}
              disabled={disabled}
              onClick={() => void removeSegment(selectedSegment)}
            />
          ) : null}
        </div>
      </Field>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className={cx(LABEL, "mb-2 p-0")}>
          {t("campaign.kindsLabel")}
          <span aria-hidden="true" className="text-danger-fg">
            {" *"}
          </span>
        </legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-2">
          {AUDIENCE_KINDS.map((kind) => (
            <label key={kind} className={CHOICE_CARD}>
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={has(kind)}
                disabled={disabled}
                onChange={(event) => toggleKind(kind, event.target.checked)}
              />
              <span className="min-w-0">{t(`campaign.kind.${kind}`)}</span>
            </label>
          ))}
        </div>
        {errors?.kinds ? (
          <p role="alert" className={ERROR}>
            {errors.kinds}
          </p>
        ) : null}

        {has("staff") ? (
          <div
            role="group"
            aria-labelledby={staffLabelId}
            aria-describedby={staffHintId}
            className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span id={staffLabelId} className={LABEL}>
                {t("campaign.staffRolesLabel")}
                <span aria-hidden="true" className="text-danger-fg">
                  {" *"}
                </span>
              </span>
              <span className="text-xs text-text-muted">
                {t("campaign.staffSelected", { value: num(value.staffRoles.length) })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_STAFF_ROLES.map((role) => {
                const on = value.staffRoles.includes(role);
                return (
                  <Pressable
                    key={role}
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => toggleRole(role)}
                    className={CHIP}
                  >
                    {on ? <Check aria-hidden="true" size={14} className="shrink-0" /> : null}
                    {t(`campaign.role.${role}`)}
                  </Pressable>
                );
              })}
            </div>
            <span id={staffHintId} className="text-xs text-text-muted">
              {t("campaign.staffExcluded")}
            </span>
            {errors?.staffRoles ? (
              <p role="alert" className={ERROR}>
                {errors.staffRoles}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      {has("customer") ? (
        <CustomerSegmentFilters
          value={value.customerSegment}
          onChange={(customerSegment) => edit({ customerSegment })}
          withMaxOrders
          orderRangeError={
            isOrderRangeInverted(value.customerSegment) ? t("campaign.errors.range") : undefined
          }
          onMarketLabel={setMarketLabel}
          disabled={disabled}
          today={today}
        />
      ) : value.kinds.length ? (
        <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-dashed border-border-strong px-3 py-2.5">
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-text-muted" />
          <span className="text-[13px] text-text-muted">{t("campaign.filtersHidden")}</span>
        </div>
      ) : null}

      {errors?.customer && previewState === "needsFilter" ? (
        <p role="alert" className={ERROR}>
          {errors.customer}
        </p>
      ) : null}

      {has("customer") && value.allCustomers && isCustomerSegmentEmpty(value.customerSegment) ? (
        <AllCustomersChoice
          checked
          disabled={disabled}
          onChange={(allCustomers) => edit({ allCustomers })}
        />
      ) : null}

      <AudienceSummary
        state={previewState}
        data={preview}
        errorKind={previewErrorKind}
        allCustomers={value.allCustomers}
        onAllCustomersChange={(allCustomers) => edit({ allCustomers })}
        onRetry={onRetryPreview}
        onSample={() => setSampleOpen(true)}
        onSave={() => setSaveOpen(true)}
        disabled={disabled}
      />

      <AudienceSampleDialog
        open={sampleOpen}
        target={target}
        onClose={() => setSampleOpen(false)}
      />
      <SaveSegmentDialog
        open={saveOpen}
        draft={value}
        target={target}
        total={previewState === "ready" || previewState === "big" ? (preview?.total ?? null) : null}
        marketLabel={marketLabel}
        onClose={() => setSaveOpen(false)}
        onSaved={(segment) => setSegmentId(segment.id)}
      />
    </div>
  );
};
