// dizayn-v2: superadmin-regions-map, admin-regions-map, manager-regions-scoped, courier-regions-scoped
import { memo, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Headset, Map as MapIcon } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../app/config/store";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import { Button, PageHeader } from "../../shared/ui/primitives";
import {
  customRangeLabel,
  parseRegionPeriod,
  regionDateParams,
  type RegionCustomRange,
  type RegionPeriod,
} from "./model/regionPeriod";
import RegionPeriodControls from "./ui/RegionPeriodControls";
import RegionsOverview from "./ui/RegionsOverview";
import ScopedRegionView from "./ui/ScopedRegionView";

const CHILD_ROUTES = [
  "/regions/districts",
  "/regions/sato-management",
  "/regions/logist-assignment",
];

/**
 * «HUDUDLAR» (`/regions`, guard `canViewRegionStats`: superadmin, admin, menejer, kuryer).
 *  - superadmin/admin — butun kompaniya xaritasi (`GET region/stats/all`), sarlavhada bola sahifalar
 *    («Tumanlar» — faqat superadmin);
 *  - menejer/kuryer — o'z viloyati tumanlar kesimida (`GET region/my/district-stats`).
 * Davr URL'da: `period=today|week|month|all|custom` + `startDate/endDate` (bola route'da yozilmaydi).
 */
const RegionPage = () => {
  const { t } = useTranslation("region");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { getParam, setMultipleParams } = useQueryParams();
  const role = useSelector((state: RootState) => state.role.role);

  const [initial] = useState(() =>
    parseRegionPeriod(getParam("period"), getParam("startDate"), getParam("endDate")),
  );
  const [period, setPeriod] = useState<RegionPeriod>(initial.period);
  const [customRange, setCustomRange] = useState<RegionCustomRange | null>(initial.range);

  const isSuperadmin = role === "superadmin";
  const isAdmin = role === "admin";
  const canViewStats = isAdmin || isSuperadmin;
  const canViewScopedStats = role === "manager" || role === "courier";
  const isChildRoute = CHILD_ROUTES.some((route) => pathname.includes(route));

  const dateParams = useMemo(() => regionDateParams(period, customRange), [period, customRange]);

  useEffect(() => {
    // Ichki sahifada (masalan, admin /regions/districts dan /regions ga yo'naltirilganda) eski
    // manzilga ?period yozib, redirectni qaytarmasin.
    if (isChildRoute || !(canViewStats || canViewScopedStats)) return;
    if (period === "custom" && customRange?.start && customRange?.end) {
      setMultipleParams({
        period: "custom",
        startDate: customRange.start,
        endDate: customRange.end,
      });
      return;
    }
    // Bitta yangilash: ketma-ket `setSearchParams` chaqiruvlari eski URL ustidan yozib, davrni yo'qotardi.
    setMultipleParams({ period, startDate: "", endDate: "" });
  }, [period, customRange, setMultipleParams, isChildRoute, canViewStats, canViewScopedStats]);

  if (isChildRoute) {
    return <Outlet />;
  }

  if (!canViewStats && !canViewScopedStats) {
    return <Navigate to="/403" replace />;
  }

  const periodLabel =
    period === "custom" && customRange ? customRangeLabel(customRange) : t(`v2.period.${period}`);
  const periodLower =
    period === "custom" && customRange
      ? customRangeLabel(customRange)
      : t(`v2.period.lower.${period}`);

  const controls = (
    <RegionPeriodControls
      period={period}
      customRange={customRange}
      onQuick={(next) => {
        setPeriod(next);
        setCustomRange(null);
      }}
      onRange={(range) => {
        setPeriod("custom");
        setCustomRange(range);
      }}
      onClear={() => {
        setCustomRange(null);
        setPeriod("all");
      }}
    />
  );

  if (canViewScopedStats) {
    return (
      <ScopedRegionView dateParams={dateParams} periodLabel={periodLabel} controls={controls} />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("v2.page.title")}
        description={t("v2.page.subtitle")}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={ArrowLeftRight}
              onClick={() => navigate("sato-management")}
            >
              {t("v2.page.actions.sato")}
            </Button>
            {isSuperadmin ? (
              <Button variant="secondary" leftIcon={MapIcon} onClick={() => navigate("districts")}>
                {t("v2.page.actions.districts")}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              leftIcon={Headset}
              onClick={() => navigate("logist-assignment")}
            >
              {t("v2.page.actions.logist")}
            </Button>
          </>
        }
      >
        {controls}
      </PageHeader>
      <RegionsOverview
        dateParams={dateParams}
        periodLabel={periodLabel}
        periodLower={periodLower}
      />
    </div>
  );
};

export default memo(RegionPage);
