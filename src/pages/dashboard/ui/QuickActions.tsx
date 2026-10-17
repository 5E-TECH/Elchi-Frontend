// dizayn-v2: market-dashboard-home
import { ChevronRight, Inbox, Plus, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card } from "../../../shared/ui/primitives";

const ActionLink = ({ to, icon: Icon, title, hint }: { to: string; icon: LucideIcon; title: string; hint: string }) => (
  <Link
    to={to}
    className="flex min-h-16 min-w-0 flex-1 basis-[280px] items-center gap-3 rounded-xl bg-sunken px-4 py-3 text-left no-underline transition-colors duration-150 hover:bg-row-hover motion-reduce:transition-none"
  >
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted">
      <Icon size={18} aria-hidden="true" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm font-semibold text-text">{title}</span>
      <span className="text-[13px] text-text-muted">{hint}</span>
    </span>
    <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
  </Link>
);

/**
 * «TEZKOR HARAKATLAR» (market): «Buyurtmalarni ko'rish» → `/new-orders`, «Buyurtma yaratish» →
 * `/new-orders/create` (faqat `add_order` ruxsati bo'lsa).
 */
const QuickActions = ({ canAddOrder }: { canAddOrder: boolean }) => {
  const { t } = useTranslation("dashboard");
  return (
    <Card title={t("market.quick_actions")} bodyClassName="flex flex-wrap gap-3">
      <ActionLink to="/new-orders" icon={Inbox} title={t("market.view_orders")} hint={t("v2Market.quick.viewHint")} />
      {canAddOrder ? (
        <ActionLink to="/new-orders/create" icon={Plus} title={t("v2Market.createOrder")} hint={t("v2Market.quick.createHint")} />
      ) : null}
    </Card>
  );
};

export default memo(QuickActions);
