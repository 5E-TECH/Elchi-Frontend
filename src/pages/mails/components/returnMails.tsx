import { memo } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

const ReturnMails = () => {
  const { t } = useTranslation("mails");

  return (
    <div className="rounded-[1.75rem] border border-[color:var(--color-border-soft)] bg-primary px-6 py-14 text-center shadow-sm dark:bg-maindark">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          <RotateCcw size={42} strokeWidth={1.75} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-maindark dark:text-primary">
            {t("returnEmptyTitle")}
          </h3>
          <p className="text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            {t("returnEmptyDescription")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(ReturnMails);
