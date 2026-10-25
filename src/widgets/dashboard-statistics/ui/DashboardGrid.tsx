// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, courier-dashboard-home, market-dashboard-home, manager-branch-dashboard-main
import type { ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";
import { Card, SkeletonChart } from "../../../shared/ui/primitives";
import { withSectionBoundaries } from "../../../shared/ui/sectionBoundaries";

/**
 * KPI QATORI (`.el-kpi-row`): 4 ustun (3 ta bo'lsa — 3), < 1024 — 2, telefonda 2 (oraliq 12).
 * «Taklif» KPI chizilmaydi — qolganlari qatorni to'ldiradi. Har KPI — o'z xato chegarasida (QKCeGZ3N).
 */
export const KpiRow = ({ count, label, children }: { count: number; label: string; children: ReactNode }) => (
  <section
    aria-label={label}
    className={cx(
      "grid gap-4 max-lg:grid-cols-2 max-md:gap-3",
      count >= 4 ? "grid-cols-4" : count === 3 ? "grid-cols-3" : "grid-cols-2",
      // 3 ta KPI: 2 ustunli to'rda oxirgisi butun qatorni egallaydi (bo'sh joy qolmaydi).
      count === 3 && "max-lg:[&>*:last-child]:col-span-2",
    )}
  >
    {withSectionBoundaries(children)}
  </section>
);

/**
 * KARTALAR TO'RI: desktopda 3 ustun (sozlamada yashirilgan karta o'rni yopiladi — `auto-fit`),
 * planshetda 2 (toq sonli bo'lsa oxirgisi butun qator), telefonda 1. Har karta — o'z xato chegarasida (QKCeGZ3N):
 * bittasi yiqilsa faqat uning o'rnida «Bo'lim xatosi».
 */
export const CardRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cx(
      "grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4",
      "max-lg:grid-cols-2 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2",
      "max-md:grid-cols-1 max-md:gap-3 max-md:[&>*:last-child:nth-child(odd)]:col-span-1",
      className,
    )}
  >
    {withSectionBoundaries(children)}
  </div>
);

/** Yuklanayotgan grafik kartasi: sarlavha joyida, tanada `SkeletonChart`. */
export const LoadingChartCard = ({
  title,
  description,
  "data-testid": testId,
}: {
  title: string;
  description?: string;
  "data-testid"?: string;
}) => (
  <Card divided={false} title={title} description={description} aria-busy="true" data-testid={testId}>
    <SkeletonChart />
  </Card>
);
