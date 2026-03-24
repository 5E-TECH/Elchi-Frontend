import { memo, useEffect, type ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Home, MapPin, Phone, User } from "lucide-react";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import {
  formatPhone,
  stripPhone,
  type OrderCreateFormValues,
} from "../model/orderCreateForm";
import {
  FormFieldError,
  getDisabledFieldClassName,
  getFieldClassName,
  getSelectFieldClassName,
  SelectFieldShell,
} from "./formFieldStyles";

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
      <span className="break-words">{label}</span>
      {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
    </label>
    {children}
    <FormFieldError message={error} />
  </div>
);

const Step2Customer = () => {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<OrderCreateFormValues>();

  const regionId = useWatch({ control, name: "customer.region_id" });

  const { getRegions, getDistricts } = useLogistics();
  const { data: regions, isLoading: regLoading } = getRegions();
  const { data: districts, isLoading: distLoading } = getDistricts(regionId);

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
            Mijoz ma'lumotlari
          </h3>
          <p className="text-xs text-gray-400">
            Yetkazib berish uchun ma'lumotlar kiriting
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Controller
          control={control}
          name="customer.phone"
          render={({ field }) => (
            <Field
              label="Telefon raqam"
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
                  placeholder="XX XXX XX XX"
                  value={formatPhone(field.value)}
                  onChange={(event) => field.onChange(stripPhone(event.target.value))}
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
              label="Qo'shimcha raqam"
              icon={<Phone size={12} />}
              error={errors.customer?.extra_phone?.message}
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                  +998
                </span>
                <input
                  type="tel"
                  placeholder="XX XXX XX XX"
                  value={formatPhone(field.value)}
                  onChange={(event) => field.onChange(stripPhone(event.target.value))}
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
              label="Ism"
              required
              icon={<User size={12} />}
              error={errors.customer?.name?.message}
            >
              <input
                {...field}
                type="text"
                placeholder="Ism kiriting"
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
              label="Viloyat"
              required
              icon={<MapPin size={12} />}
              error={errors.customer?.region_id?.message}
            >
              <SelectFieldShell
                hasError={!!errors.customer?.region_id?.message}
                disabled={regLoading}
              >
                <select
                  {...field}
                  disabled={regLoading}
                  className={getSelectFieldClassName(
                    getDisabledFieldClassName(`${inputClass} cursor-pointer`),
                    !!errors.customer?.region_id?.message,
                  )}
                >
                  <option value="">
                    {regLoading ? "Yuklanmoqda..." : "Viloyat tanlang"}
                  </option>
                  {regionList.map((region: any) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </SelectFieldShell>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="customer.district_id"
          render={({ field }) => (
            <Field
              label="Tuman"
              required
              icon={<MapPin size={12} />}
              error={errors.customer?.district_id?.message}
            >
              <SelectFieldShell
                hasError={!!errors.customer?.district_id?.message}
                disabled={!regionId || distLoading}
              >
                <select
                  {...field}
                  disabled={!regionId || distLoading}
                  className={getSelectFieldClassName(
                    getDisabledFieldClassName(`${inputClass} cursor-pointer`),
                    !!errors.customer?.district_id?.message,
                  )}
                >
                  <option value="">
                    {!regionId
                      ? "Avval viloyat tanlang"
                      : distLoading
                        ? "Yuklanmoqda..."
                        : "Tuman tanlang"}
                  </option>
                  {districtList.map((district: any) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </SelectFieldShell>
            </Field>
          )}
        />

        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="customer.address"
            render={({ field }) => (
              <Field
                label="Manzil"
                required
                icon={<Home size={12} />}
                error={errors.customer?.address?.message}
              >
                <textarea
                  {...field}
                  placeholder="To'liq manzil kiriting..."
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
