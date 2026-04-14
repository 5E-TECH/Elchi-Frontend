import { memo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, MapPinned, Wallet } from "lucide-react";

interface MailSummaryStatsProps {
  totalRegions: number;
  totalOrders: number;
  totalPrice: string;
  isCourier: boolean;
  accent: "success" | "error";
}

interface StatChipProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tone?: "main" | "success" | "error";
}

const StatChip = ({ icon, value, label, tone = "main" }: StatChipProps) => {
  const toneClassName =
    tone === "error"
      ? "text-error"
      : tone === "success"
        ? "text-success"
        : "text-maindark dark:text-primary";

  const iconClassName =
    tone === "error"
      ? "bg-error/10 text-error"
      : tone === "success"
        ? "bg-success/10 text-success"
        : "bg-main/10 text-main";

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-primary/8 px-2 py-1 dark:bg-primary/6">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        {icon}
      </span>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={`truncate text-[1.3rem] font-bold leading-none ${toneClassName}`}>
          {value}
        </span>
        <span className="truncate text-xs font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          {label}
        </span>
      </div>
    </div>
  );
};

const MailSummaryStats = ({
  totalRegions,
  totalOrders,
  totalPrice,
  isCourier,
  accent,
}: MailSummaryStatsProps) => {
  const { t } = useTranslation("mails");

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-1">
      <StatChip
        icon={<MapPinned size={15} />}
        value={totalRegions}
        label={isCourier ? t("mailCountLabel") : t("regionCountLabel")}
      />
      <div className="hidden h-6 w-px bg-[color:var(--color-border-soft)] sm:block" />
      <StatChip
        icon={<BarChart3 size={15} />}
        value={totalOrders}
        label={t("orderCountLabel")}
      />
      <div className="hidden h-6 w-px bg-[color:var(--color-border-soft)] sm:block" />
      <StatChip
        icon={<Wallet size={15} />}
        value={totalPrice}
        label={t("amountLabel")}
        tone={accent}
      />
    </div>
  );
};

export default memo(MailSummaryStats);
