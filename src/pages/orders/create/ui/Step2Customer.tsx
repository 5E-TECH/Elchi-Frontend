import { memo, useEffect, type ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Building2, Home, MapPin, Phone, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import SearchableSelect from "../../../../shared/ui/SearchableSelect";
import {
  formatPhone,
  stripPhone,
  type OrderCreateFormValues,
} from "../model/orderCreateForm";
import {
  FormFieldError,
  getFieldClassName,
} from "./formFieldStyles";
import { keepPhoneCaretAfterChange } from "../../../../shared/lib/phone";

const inputClass = `
  w-full min-h-12 px-3 py-2.5 rounded-xl text-sm
  bg-primary dark:bg-primarydark
  border border-gray-200 dark:border-primarydark/80
  text-maindark dark:text-primary
  placeholder:text-gray-400
  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
  transition-all duration-200
`;

interface FieldProps {
  label: string;
  required?: boolean;
  icon: ReactNode;
  children: ReactNode;
  error?: string;
}

const Field = ({ label, required, icon, children, error }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-4">
      <span className="shrink-0">{icon}</span>
      <span className="wrap-break-word">{label}</span>
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    <FormFieldError message={error} />
  </div>
);

const getAreaOptionLabel = (item: any) => {
  const satoCode = item?.sato_code ? ` • ${item.sato_code}` : "";

  return `${item?.name ?? "—"}${satoCode}`;
};

const Step2Customer = () => {
  const { t } = useTranslation("orders");
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<OrderCreateFormValues>();

  const regionId = useWatch({ control, name: "customer.region_id" });

  const { useGetRegions, useGetDistricts } = useLogistics();
  const { data: regions, isLoading: regLoading } = useGetRegions();
  const { data: districts, isLoading: distLoading } = useGetDistricts(regionId);

  useEffect(() => {
    setValue("customer.district_id", "");
  }, [regionId, setValue]);

  const toArray = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (
      typeof value === "object" &&
      value !== null &&
      "data" in value &&
      Array.isArray((value as { data?: unknown[] }).data)
    ) {
      return (value as { data: unknown[] }).data;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "items" in value &&
      Array.isArray((value as { items?: unknown[] }).items)
    ) {
      return (value as { items: unknown[] }).items;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "results" in value &&
      Array.isArray((value as { results?: unknown[] }).results)
    ) {
      return (value as { results: unknown[] }).results;
    }
    return [];
  };

  const regionList = toArray(regions);
  const districtList = toArray(districts);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
          <User size={18} className="text-main" />
        </div>
        <div>
          <h3 className="font-semibold text-maindark dark:text-primary text-base">
            {t("customerInfo")}
          </h3>
          <p className="text-xs text-gray-400">
            {t("customerInfoSubtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Controller
          control={control}
          name="customer.phone"
          render={({ field }) => (
            <Field
              label={t("customerPhone")}
              required
              icon={<Phone size={12} />}
              error={errors.customer?.phone?.message}
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                  +998
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="XX XXX XX XX"
                  value={formatPhone(field.value)}
                  onChange={(event) => {
                    const nextValue = stripPhone(event.target.value);
                    const nextDisplayValue = formatPhone(nextValue);
                    field.onChange(nextValue);
                    keepPhoneCaretAfterChange(event.target, nextDisplayValue);
                  }}
                  className={getFieldClassName(
                    `${inputClass} pl-14`,
                    !!errors.customer?.phone?.message,
                  )}
                />
              </div>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="customer.extra_phone"
          render={({ field }) => (
            <Field
              label={t("additionalPhone")}
              icon={<Phone size={12} />}
              error={errors.customer?.extra_phone?.message}
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                  +998
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="XX XXX XX XX"
                  value={formatPhone(field.value)}
                  onChange={(event) => {
                    const nextValue = stripPhone(event.target.value);
                    const nextDisplayValue = formatPhone(nextValue);
                    field.onChange(nextValue);
                    keepPhoneCaretAfterChange(event.target, nextDisplayValue);
                  }}
                  className={getFieldClassName(
                    `${inputClass} pl-14`,
                    !!errors.customer?.extra_phone?.message,
                  )}
                />
              </div>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="customer.name"
          render={({ field }) => (
            <Field
              label={t("customerName")}
              required
              icon={<User size={12} />}
              error={errors.customer?.name?.message}
            >
              <input
                {...field}
                type="text"
                placeholder={t("enterName")}
                className={getFieldClassName(inputClass, !!errors.customer?.name?.message)}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="customer.region_id"
          render={({ field }) => (
            <Field
              label={t("filterRegion")}
              required
              icon={<MapPin size={12} />}
              error={errors.customer?.region_id?.message}
            >
              <SearchableSelect
                label={t("filterRegion")}
                name={field.name}
                value={field.value ?? ""}
                onChange={field.onChange}
                options={regionList.map((region: any) => ({
                  value: String(region.id),
                  label: getAreaOptionLabel(region),
                }))}
                placeholder={regLoading ? t("createSubmitting") : t("selectRegion")}
                icon={MapPin}
                loading={regLoading}
                disabled={regLoading}
                hideLabel
                surface="search"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="customer.district_id"
          render={({ field }) => (
            <Field
              label={t("district")}
              required
              icon={<MapPin size={12} />}
              error={errors.customer?.district_id?.message}
            >
              <SearchableSelect
                label={t("district")}
                name={field.name}
                value={field.value ?? ""}
                onChange={field.onChange}
                options={districtList.map((district: any) => ({
                  value: String(district.id),
                  label: getAreaOptionLabel(district),
                }))}
                placeholder={
                  !regionId
                    ? t("selectRegionFirst")
                    : distLoading
                      ? t("createSubmitting")
                      : t("selectDistrict")
                }
                icon={Building2}
                loading={distLoading}
                disabled={!regionId || distLoading}
                hideLabel
                surface="search"
              />
            </Field>
          )}
        />

        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="customer.address"
            render={({ field }) => (
              <Field
                label={t("address")}
                icon={<Home size={12} />}
                error={errors.customer?.address?.message}
              >
                <textarea
                  {...field}
                  placeholder={t("enterFullAddress")}
                  rows={2}
                  className={getFieldClassName(
                    `${inputClass} resize-none`,
                    !!errors.customer?.address?.message,
                  )}
                />
              </Field>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(Step2Customer);
