import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  COMMISSION_MAX,
  formatCommissionValue,
  type CommissionInputError,
  type CommissionType,
} from "../../../entities/market-operator";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";

/** Xato kodi → i18n matni (chegara — turga qarab, summa `formatMoneyLocalized` bilan). */
export const useCommissionErrorText = () => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (type: CommissionType, error: CommissionInputError | null | undefined): string | undefined => {
    if (!error) return undefined;
    if (error === "range") {
      return type === "percent"
        ? t("commissionForm.errors.percentRange")
        : t("commissionForm.errors.fixedRange", { max: formatMoneyLocalized(COMMISSION_MAX.fixed, { language }) });
    }
    return t(`commissionForm.errors.${error}`);
  };
};

/** Jadval/karta matni: «5%» + «Foiz · buyurtma narxidan» yoki «3 000 so'm» + «Qat'iy · har sotilgan buyurtma». */
export const useCommissionText = () => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(
    () => ({
      value: (type: CommissionType, value: number) => formatCommissionValue(type, value, language),
      hint: (type: CommissionType) => t(type === "percent" ? "commission.percentHint" : "commission.fixedHint"),
      /** Ixcham: «5% · foiz», «3 000 so'm · qat'iy» (telefon kartasi, «Hozirgi stavka»). */
      short: (type: CommissionType, value: number) =>
        t(type === "percent" ? "commission.percentShort" : "commission.fixedShort", {
          value: formatCommissionValue(type, value, language),
        }),
      maxFixed: formatMoneyLocalized(COMMISSION_MAX.fixed, { language }),
      money: (value: number) => formatMoneyLocalized(value, { language }),
    }),
    [language, t],
  );
};
