// dizayn-v2: superadmin-branches-create-dialog
import type { FormEvent, ReactNode } from "react";
import { Building2, Lock, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import {
  Button,
  Dialog,
  Field,
  SegmentedControl,
  Select,
  TextInput,
  useFieldControl,
  type SegmentedOption,
  type SelectOption,
} from "../../../shared/ui/primitives";

/** Yaratish va tahrirlash formalarining umumiy maydonlari (tahrirda viloyat/tuman yo'q). */
export type BranchFormDialogValues = FieldValues & {
  name: string;
  parent_id: string;
  type: string;
  code: string;
  phone_number: string;
  address: string;
  region_id?: string;
  district_id?: string;
};

export type BranchTypeOption = { value: string; label: string; disabled?: boolean };

export type BranchFormLocation = {
  regionOptions: readonly SelectOption[];
  districtOptions: readonly SelectOption[];
  regionsLoading?: boolean;
  /** Viloyat almashsa — tuman tozalanadi (chaqiruvchi `setValue("district_id", "")`). */
  onRegionChange?: (regionId: string) => void;
  districtDisabled?: boolean;
};

export type BranchFormDialogProps<T extends BranchFormDialogValues> = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: LucideIcon;
  control: Control<T>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  submitLabel: string;
  typeOptions: readonly BranchTypeOption[];
  /** HQ tahriri: tur qulflangan (backend o'zgartirishni rad etadi). */
  typeLocked?: boolean;
  parentOptions: readonly SelectOption[];
  parentLoading?: boolean;
  parentDisabled?: boolean;
  parentPlaceholder: string;
  /** Faqat yaratishda: «Viloyat *» va «Tuman *». */
  location?: BranchFormLocation;
};

/** Segment `Field` yorlig'i, ko'rsatmasi va xatosiga ulanadi (radiogroup `aria-describedby` / `aria-invalid`). */
const TypeSegment = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}) => {
  const field = useFieldControl();
  return (
    <SegmentedControl
      ariaLabel={label}
      aria-describedby={field["aria-describedby"]}
      aria-invalid={field["aria-invalid"]}
      options={options}
      value={value}
      onValueChange={onChange}
      fullWidth
      // Telefonda 2 × 2 (maket `el-show-mobile` segmenti: har variant 40% eni, 44 px).
      className="max-md:flex-wrap max-md:[&>button]:basis-[calc(50%-1px)]"
    />
  );
};

const FULL = "col-span-full";

/**
 * FILIAL FORMASI OYNASI — «Yangi filial» (`BranchFormModal`) va «Filialni tahrirlash» (`BranchEditModal`)
 * uchun bitta v2 ko'rinish (maket `superadmin-branches-create-dialog`, 640 px; telefonda pastki varaqa).
 *
 * Maydonlar: «Filial nomi *» · «Filial turi *» (segment HQ · Qabul punkti · Viloyat · Aralash; HQ — qulf bilan
 * o'chiq, «HQ allaqachon mavjud») · «Yuqori filial *» (qidiruvli, «Qabul punktlari yuqori filial bo'la olmaydi») ·
 * «Qisqa nom *» + «Telefon raqami *» · «Viloyat *» + «Tuman *» (faqat yaratishda) · «Manzil *». Xato matnlari —
 * yup sxemasi va backend (`applyBranchBackendErrors`) dan, maydon ostida. Forma holati, sxema va so'rov — chaqiruvchi
 * oynada (o'zgarmagan); bu komponent faqat ko'rinish.
 */
export const BranchFormDialog = <T extends BranchFormDialogValues>({
  open,
  onClose,
  title,
  description,
  icon = Building2,
  control,
  onSubmit,
  submitting,
  submitLabel,
  typeOptions,
  typeLocked = false,
  parentOptions,
  parentLoading = false,
  parentDisabled = false,
  parentPlaceholder,
  location,
}: BranchFormDialogProps<T>) => {
  const { t } = useTranslation(["branches", "common"]);
  const name = (key: keyof BranchFormDialogValues & string) => key as Path<T>;
  const segmentOptions: SegmentedOption[] = typeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    // HQ har doim o'chiq (yagona bosh ofis) — qulf belgisi bilan (maket).
    icon: option.value === "HQ" ? Lock : undefined,
    disabled: typeLocked || option.disabled,
  }));

  const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
  const errorOf = (message: unknown): ReactNode => (typeof message === "string" && message ? message : undefined);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={submitting}
      size="xl"
      title={title}
      description={description}
      icon={icon}
      onSubmit={onSubmit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Controller
          control={control}
          name={name("name")}
          render={({ field, fieldState }) => (
            <Field label={t("fields.name")} required error={errorOf(fieldState.error?.message)} className={FULL}>
              <TextInput
                ref={field.ref}
                name={field.name}
                value={text(field.value)}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("placeholders.name")}
                autoComplete="off"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={name("type")}
          render={({ field, fieldState }) => (
            <Field
              label={t("fields.type")}
              labelAs="span"
              required
              hint={typeLocked ? t("v2.form.hqTypeLocked") : t("validation.hqDisabled")}
              error={errorOf(fieldState.error?.message)}
              className={FULL}
            >
              <TypeSegment
                label={t("fields.type")}
                options={segmentOptions}
                value={text(field.value)}
                onChange={field.onChange}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={name("parent_id")}
          render={({ field, fieldState }) => (
            <Field
              label={t("fields.parent")}
              labelAs="span"
              required={!parentDisabled}
              hint={parentDisabled ? undefined : t("v2.form.parentHint")}
              error={errorOf(fieldState.error?.message)}
              disabled={parentDisabled}
              className={FULL}
            >
              <Select
                searchable
                options={parentOptions}
                value={text(field.value) || null}
                onChange={(value) => field.onChange(value ?? "")}
                loading={parentLoading}
                placeholder={parentPlaceholder}
                emptyText={t("v2.form.parentEmpty")}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={name("code")}
          render={({ field, fieldState }) => (
            <Field label={t("fields.code")} required error={errorOf(fieldState.error?.message)}>
              <TextInput
                ref={field.ref}
                name={field.name}
                value={text(field.value)}
                onValueChange={(value) => field.onChange(value.toUpperCase())}
                onBlur={field.onBlur}
                placeholder={t("placeholders.code")}
                autoComplete="off"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={name("phone_number")}
          render={({ field, fieldState }) => (
            <Field label={t("fields.phone")} required error={errorOf(fieldState.error?.message)}>
              <TextInput
                ref={field.ref}
                name={field.name}
                mode="phone"
                value={text(field.value)}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("placeholders.phone")}
              />
            </Field>
          )}
        />

        {location ? (
          <>
            <Controller
              control={control}
              name={name("region_id")}
              render={({ field, fieldState }) => (
                <Field label={t("fields.region")} labelAs="span" required error={errorOf(fieldState.error?.message)}>
                  <Select
                    searchable
                    options={location.regionOptions}
                    value={text(field.value) || null}
                    onChange={(value) => {
                      field.onChange(value ?? "");
                      location.onRegionChange?.(value ?? "");
                    }}
                    loading={location.regionsLoading}
                    placeholder={t("placeholders.region")}
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name={name("district_id")}
              render={({ field, fieldState }) => (
                <Field
                  label={t("fields.district")}
                  labelAs="span"
                  required
                  error={errorOf(fieldState.error?.message)}
                  disabled={location.districtDisabled}
                >
                  <Select
                    searchable
                    options={location.districtOptions}
                    value={text(field.value) || null}
                    onChange={(value) => field.onChange(value ?? "")}
                    placeholder={t("placeholders.district")}
                  />
                </Field>
              )}
            />
          </>
        ) : null}

        <Controller
          control={control}
          name={name("address")}
          render={({ field, fieldState }) => (
            <Field label={t("fields.address")} required error={errorOf(fieldState.error?.message)} className={FULL}>
              <TextInput
                multiline
                ref={field.ref}
                name={field.name}
                rows={3}
                value={text(field.value)}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("placeholders.address")}
              />
            </Field>
          )}
        />
      </div>
    </Dialog>
  );
};
