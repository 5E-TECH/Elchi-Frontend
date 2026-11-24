// dizayn-v2: (maket yo'q) superadmin-integrations-marketplace-console
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, PackageCheck } from "lucide-react";
import { useGetIntegrationById, type Integration } from "../../../entities/integrations";
import { importedOrdersOf } from "../../../entities/integrations/siteSource";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { buttonClasses } from "../../../shared/ui/primitives";
import { ChartBlock } from "../ui";
import type { Connection } from "../useConnections";

/**
 * «OLINGAN BUYURTMALAR» — sayt ulanishining asosiy natijasi (ega 2026-11-25).
 *
 * Ilgari sayt uchun ham hamkor ko'rsatkichlari (webhook, posilka, muvaffaqiyat foizi) chiqardi: 49 ta buyurtma olingan
 * sayt «0 ta hodisa — ulanish hali ishlatilmagan bo'lishi mumkin» derdi. Son buyurtmalarning o'zidan
 * (`imported_orders`); noma'lum bo'lsa «—», 0 emas.
 */
const SiteImports = ({ connection }: { connection: Connection }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const raw = connection.raw as Integration;
  // Ro'yxat javobida market nomi qatorda yo'q — tafsilotdan olinadi.
  const detail = useGetIntegrationById(connection.id, { silentError: true });
  const integration = detail.data?.data ?? null;
  const imports = importedOrdersOf(integration ?? raw) ?? importedOrdersOf(raw);
  const count = (value: number) => t("console.countTa", { count: formatNumberLocalized(value, { language }) });
  const marketName = (integration?.market?.name ?? "").trim();

  const rows = [
    { key: "total", label: t("conn.importTotal"), value: imports ? count(imports.total) : "—" },
    { key: "today", label: t("conn.importToday"), value: imports ? count(imports.today) : "—" },
    {
      key: "last",
      label: t("conn.importLast"),
      value: !imports ? "—" : imports.last_at ? formatDateTimeLocalized(imports.last_at, { language }) : t("conn.importNever"),
    },
    { key: "market", label: t("conn.importMarket"), value: marketName || "—" },
  ];

  return (
    <ChartBlock
      id={`ovw-imports-${connection.uid}`}
      data-testid="ovw-imports"
      title={t("conn.importTitle")}
      subtitle={t("conn.importSub")}
      controls={<PackageCheck size={18} aria-hidden="true" className="text-text-subtle" />}
    >
      <dl className="m-0 flex flex-col">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className={`flex items-center justify-between gap-3 py-2.5 ${index ? "border-t border-border" : ""}`}
          >
            <dt className="text-[13px] text-text-muted">{row.label}</dt>
            <dd className="m-0 text-right text-sm font-semibold text-text [overflow-wrap:anywhere]">{row.value}</dd>
          </div>
        ))}
      </dl>
      {raw.market_id ? (
        <Link
          to={`/orders?orderMarketId=${encodeURIComponent(String(raw.market_id))}`}
          className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-auto self-start max-md:min-h-11" })}
        >
          {t("conn.importOpenOrders")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </ChartBlock>
  );
};

export default SiteImports;
