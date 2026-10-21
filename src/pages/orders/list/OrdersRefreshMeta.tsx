// dizayn-v2: superadmin-orders-list-refreshing, manager-orders-list-all-refreshing, courier-orders-pending-refreshing
import type { ReactNode } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Badge, Button, IconButton, Spinner } from "../../../shared/ui/primitives";

/**
 * «Buyurtmalar» sarlavhasining yangilanish qismlari (OR-1) — maketlar `*-orders-list`, `*-orders-list-refreshing`,
 * `courier-orders-pending{,-refreshing}`. Sahifa ularni `PageHeader grow` ga beradi:
 *
 *   <PageHeader grow title={…}
 *     meta={<OrdersRefreshTitleMeta refreshing={…} onRefresh={…} />}        // badge + telefondagi ikonka tugma
 *     description={<OrdersRefreshDescription total={…} lastUpdatedAt={…} />} // «Jami N» · «Oxirgi yangilanish» · «Avtomatik»
 *     actions={<><OrdersRefreshButton … /> …</>}                            // desktop/planshet ghost «Yangilash»
 *   />
 */

type RefreshControlProps = {
  /** Fon yangilanishi 400 ms dan uzoq — badge ko'rinadi, tugma band. */
  refreshing: boolean;
  onRefresh: () => void;
};

/** Sarlavha yonida: «Yangilanmoqda…» belgisi va telefonda (< 768) o'ng chetdagi chegarali ikonka tugma. */
export const OrdersRefreshTitleMeta = ({ refreshing, onRefresh }: RefreshControlProps) => {
  const { t } = useTranslation("orders");
  return (
    <>
      {/* Doim joyida turgan jonli hudud — matni almashadi (to'la holda qo'shilgan role=status ko'p ekran
          o'quvchilarida e'lon qilinmaydi); ko'rinadigan badge esa bezak. */}
      <span role="status" className="sr-only">
        {refreshing ? t("ordersList.refreshingBadge") : ""}
      </span>
      {refreshing ? (
        <Badge aria-hidden="true">
          <Spinner className="size-3! border-[1.5px]!" />
          {t("ordersList.refreshingBadge")}
        </Badge>
      ) : null}
      <IconButton
        variant="secondary"
        icon={RefreshCw}
        label={t("ordersList.refreshLabel")}
        loading={refreshing}
        loadingLabel={t("ordersList.refreshingLabel")}
        className="ml-auto md:hidden"
        data-orders-refresh=""
        onClick={onRefresh}
      />
    </>
  );
};

/** ≥ 768: amallar qatoridagi ghost «Yangilash» (telefonda yashirin — o'rnida ikonka tugma). */
export const OrdersRefreshButton = ({ refreshing, onRefresh }: RefreshControlProps) => {
  const { t } = useTranslation("orders");
  return (
    <Button
      variant="ghost"
      compact
      leftIcon={RefreshCw}
      loading={refreshing}
      // Nom yuklanishda ham o'zgarmaydi — ko'rinadigan «Yangilash» so'zi nomda qoladi (WCAG 2.5.3); bandlik —
      // `loading` → `aria-busy`.
      aria-label={t("ordersList.refreshLabel")}
      className="max-md:hidden"
      data-orders-refresh=""
      onClick={onRefresh}
    >
      {t("ordersList.refreshAction")}
    </Button>
  );
};

/**
 * Sarlavha izohi: «Jami N ta buyurtma» · «Oxirgi yangilanish: HH:mm» · «● Avtomatik yangilanadi».
 * `lastUpdatedAt = 0` (ma'lumot hali yo'q yoki birinchi yuklash yiqilgan) — faqat `total` (skelet yoki «—»).
 */
export const OrdersRefreshDescription = ({ total, lastUpdatedAt }: { total: ReactNode; lastUpdatedAt: number }) => {
  const { t } = useTranslation("orders");
  if (!lastUpdatedAt) return <>{total}</>;
  const time = formatTimeLocalized(lastUpdatedAt);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>{total}</span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Clock aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-text-subtle" />
        <span>
          <Trans
            t={t}
            i18nKey="ordersList.refreshLastUpdated"
            values={{ time }}
            components={{ time: <time dateTime={new Date(lastUpdatedAt).toISOString()} /> }}
          />
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={t("ordersList.refreshAutoHint")}>
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-success" />
        {t("ordersList.refreshAuto")}
      </span>
    </span>
  );
};
