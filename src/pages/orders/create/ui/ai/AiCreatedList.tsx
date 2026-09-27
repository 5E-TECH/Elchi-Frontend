import { memo } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatPhone, formatPrice } from "../../model/orderCreateForm";
import type { AiCreatedRow } from "./aiDraft";

/** AI orqali shu sessiyada muvaffaqiyatli yaratilgan buyurtmalar. */
const AiCreatedList = ({ rows }: { rows: AiCreatedRow[] }) => {
  const { t } = useTranslation("orders");

  if (rows.length === 0) return null;

  return (
    <section
      data-testid="ai-created-list"
      className="flex flex-col gap-2 rounded-2xl border border-[color:color-mix(in_srgb,var(--color-success)_30%,transparent)] bg-primary p-3 dark:bg-primarydark/30 sm:p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-success)]">
        <CheckCircle2 size={16} />
        {t("aiCreatedTitle", { count: rows.length })}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-0.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-maindark dark:bg-primarydark dark:text-primary sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0 truncate font-semibold">
              {row.customer_name} · <span className="font-mono">+998 {formatPhone(row.phone_number)}</span>
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {row.district_name ?? "—"} · {formatPrice(String(row.total_price))} {t("currency")}
              {row.order_id ? ` · #${row.order_id}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default memo(AiCreatedList);
