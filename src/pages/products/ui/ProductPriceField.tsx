// dizayn-v2: superadmin-products-create, admin-products-create, superadmin-products-edit-dialog, admin-products-edit-dialog
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Field, TextInput } from "../../../shared/ui/primitives";

export type ProductPriceFieldProps = {
  id: string;
  name: string;
  /** Raqamlar satri («145000») yoki bo'sh — narx yo'q. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
};

/**
 * «NARX» MAYDONI — maket `*-products-create` / `*-products-edit-dialog`: «Narx» (ixtiyoriy), mingliklar bilan,
 * o'ngda valyuta (`TextInput mode="money"`), izoh «Ixtiyoriy · buyurtma summasiga taklif sifatida chiqadi».
 * Bo'sh — narx yo'q (`null`); yarim kenglik (maket: `flex: 1 1 180px` qatori).
 */
export const ProductPriceField = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  inputRef,
  error,
  disabled,
  readOnly,
}: ProductPriceFieldProps) => {
  const { t } = useTranslation("products");
  return (
    <div className="flex min-w-0 flex-wrap items-start gap-4">
      <Field
        id={id}
        label={t("v2.form.price")}
        hint={t("v2.form.priceHint")}
        error={error}
        className="min-w-0 flex-[1_1_180px]"
      >
        <TextInput
          mode="money"
          name={name}
          ref={inputRef}
          value={value}
          onValueChange={onChange}
          onBlur={onBlur}
          placeholder="0"
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
        />
      </Field>
    </div>
  );
};
