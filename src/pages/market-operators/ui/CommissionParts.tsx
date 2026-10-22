// dizayn-v2: market-operators-create-dialog, market-operators-commission-dialog, market-operators-commission-fixed-dialog
import { useTranslation } from "react-i18next";
import type { CommissionType } from "../../../entities/market-operator";
import { CURRENCY_LABEL, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { SegmentedControl, TextInput, type TextInputFieldProps } from "../../../shared/ui/primitives";

/** «Foiz | Qat'iy summa» (`.el-seg`, maket `role="group"` → `SegmentedControl` radiogroup). */
export const CommissionTypeSwitch = ({
  value,
  onChange,
  ariaLabel,
  className,
  disabled,
}: {
  value: CommissionType;
  onChange: (value: CommissionType) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) => {
  const { t } = useTranslation("marketOperators");
  return (
    <SegmentedControl<CommissionType>
      ariaLabel={ariaLabel}
      value={value}
      onValueChange={onChange}
      fullWidth
      className={className}
      options={[
        { value: "percent", label: t("commissionForm.percent"), disabled },
        { value: "fixed", label: t("commissionForm.fixed"), disabled },
      ]}
    />
  );
};

/**
 * Qiymat maydoni (`.el-input` + o'ngda «%» yoki valyuta): kasr bilan (`inputMode="decimal"`), mingliklar bo'sh joy bilan
 * yozilsa ham o'qiladi (`parseCommissionInput`). `Field` ichida — yorliq va xato o'sha yerdan.
 */
export const CommissionValueInput = ({
  type,
  ...rest
}: { type: CommissionType } & Omit<TextInputFieldProps, "mode" | "suffix" | "inputMode" | "multiline">) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  return (
    <TextInput
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      placeholder={t(type === "percent" ? "commissionForm.percentPlaceholder" : "commissionForm.fixedPlaceholder")}
      suffix={<span className="whitespace-nowrap text-text-muted">{type === "percent" ? "%" : CURRENCY_LABEL[language]}</span>}
    />
  );
};
