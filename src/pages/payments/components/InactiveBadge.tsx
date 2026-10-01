import { memo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Pul oynalaridagi (Berilishi / Qabul qilinishi kerak) faol bo'lmagan market,
 * menejer yoki kuryer belgisi — qator puli qolgani uchun ko'rsatiladi.
 */
const InactiveBadge = ({ isSelected = false }: { isSelected?: boolean }) => {
  const { t } = useTranslation("common");

  return (
    <span
      className={`ml-2 inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide ${
        isSelected ? "bg-white/20 text-white" : "bg-rose-500/15 text-rose-500 dark:text-rose-300"
      }`}
    >
      {t("blocked")}
    </span>
  );
};

export default memo(InactiveBadge);
