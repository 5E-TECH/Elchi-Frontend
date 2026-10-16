// dizayn-v2: superadmin-neworders-create-ai-preview, admin-neworders-create-ai, manager-new-orders-create-ai, registrator-new-orders-create-ai, market-new-orders-create-ai-preview
import { memo } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../../shared/lib/formatPhone";
import { Card } from "../../../../../shared/ui/primitives";
import type { AiCreatedRow } from "./aiDraft";

/**
 * «YARATILDI (N)» — AI orqali shu sessiyada muvaffaqiyatli yaratilgan buyurtmalar (maket `*-create-ai-preview`):
 * qator — «Ism · +998 90 214 55 08», ostida «Tuman · summa · №raqam».
 */
const AiCreatedList = ({ rows }: { rows: AiCreatedRow[] }) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;

  if (rows.length === 0) return null;

  return (
    <Card
      padding="none"
      data-testid="ai-created-list"
      title={
        <span className="flex items-center gap-2">
          <CircleCheck size={18} aria-hidden="true" className="shrink-0 text-success-fg" />
          {t("aiCreatedTitle", { count: rows.length })}
        </span>
      }
    >
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-sm last:border-b-0"
          >
            <span className="min-w-0 font-semibold text-text">
              {row.customer_name} · <span className="tabular-nums">{formatPhone(row.phone_number)}</span>
            </span>
            <span className="text-[13px] text-text-muted">
              {[
                row.district_name ?? "—",
                formatMoneyLocalized(row.total_price, { language }),
                row.order_id ? t("orderNumberShort", { id: row.order_id }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default memo(AiCreatedList);
