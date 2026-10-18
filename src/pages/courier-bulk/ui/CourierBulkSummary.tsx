// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main
import { useId } from "react";
import { CalendarClock, Camera, CircleX, Package, PackageCheck, ScanLine } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card, StatCard } from "../../../shared/ui/primitives";
import type { CourierBulkCounts, CourierBulkScanMode } from "../model/courierBulk";
import { ScanModeControl, ScanModeHint } from "./ScanModeControl";

type CourierBulkSummaryProps = {
  counts: CourierBulkCounts;
  /** Belgilanmagan (sukut bo'yicha sotiladigan) buyurtmalar soni. */
  unmarked: number;
  /** `manager` — «Kutilayotgan» izohi «Filial kuryerlarida, yakunlanmagan» (Q8, maket yo'q). */
  viewer: "courier" | "manager";
  scanMode: CourierBulkScanMode;
  onScanModeChange: (mode: CourierBulkScanMode) => void;
  onOpenCamera: () => void;
  busy: boolean;
  isPhone: boolean;
  /** < 1024: kartalardagi ikonkalar yashirin (maket `el-hide-tablet`). */
  isBelowLg: boolean;
};

/**
 * Kun yakuni ko'rsatkichlari va skanerlash rejimi (maket `courier-courier-bulk-main`).
 *  - ≥ 768: to'rtta `StatCard` («Kutilayotgan», «Sotiladi», «Bekor qilinadi», «Ertaga qoladi») + «Skanerlash rejimi»
 *    kartasi (rejim, «USB skaner tayyor», «Kamera»).
 *  - telefon: bitta karta — uch ustun (Sotildi / Bekor / Ertaga) va ostida rejim tanlovi.
 */
export const CourierBulkSummary = ({
  counts,
  unmarked,
  viewer,
  scanMode,
  onScanModeChange,
  onOpenCamera,
  busy,
  isPhone,
  isBelowLg,
}: CourierBulkSummaryProps) => {
  const { t, i18n } = useTranslation("courierBulk");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const modeTitleId = useId();

  if (isPhone) {
    const cells = [
      { key: "sold", tone: "success", label: t("stats.soldShort"), value: counts.sold },
      { key: "cancel", tone: "danger", label: t("stats.cancelShort"), value: counts.cancel },
      { key: "tomorrow", tone: "warning", label: t("stats.tomorrowShort"), value: counts.tomorrow },
    ] as const;
    return (
      <Card as="section" padding="none" aria-label={t("stats.phoneLabel")}>
        <div className="grid grid-cols-3">
          {cells.map((cell, index) => (
            <div
              key={cell.key}
              className={cx("flex min-w-0 flex-col items-start gap-1.5 px-3.5 py-3", index > 0 && "border-l border-border")}
            >
              <Badge tone={cell.tone} dot>
                {cell.label}
              </Badge>
              <span className="whitespace-nowrap text-[22px] leading-[30px] font-bold text-text">
                {num(cell.value)}
                <span className="ml-1 text-[13px] font-semibold text-text-muted">{t("stats.unit")}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <span id={modeTitleId} className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
            {t("scanMode.title")}
          </span>
          <ScanModeControl value={scanMode} onChange={onScanModeChange} compact labelledBy={modeTitleId} />
          <ScanModeHint value={scanMode} />
        </div>
      </Card>
    );
  }

  return (
    <>
      <div role="group" aria-label={t("stats.label")} className="grid grid-cols-4 gap-4">
        <StatCard
          label={t("stats.pending")}
          value={num(counts.total)}
          unit={t("stats.unit")}
          icon={isBelowLg ? undefined : Package}
          hint={t(viewer === "manager" ? "stats.pendingManager" : "stats.pendingCourier")}
        />
        <StatCard
          label={
            <Badge tone="success" dot>
              {t("stats.sold")}
            </Badge>
          }
          value={num(counts.sold)}
          unit={t("stats.unit")}
          icon={isBelowLg ? undefined : PackageCheck}
          hint={
            <Trans
              t={t}
              ns="courierBulk"
              i18nKey="stats.soldUnmarked"
              count={unmarked}
              components={{ strong: <strong className="font-semibold text-text" /> }}
            />
          }
        />
        <StatCard
          label={
            <Badge tone="danger" dot>
              {t("stats.cancel")}
            </Badge>
          }
          value={num(counts.cancel)}
          unit={t("stats.unit")}
          icon={isBelowLg ? undefined : CircleX}
          hint={t("stats.cancelHint")}
        />
        <StatCard
          label={
            <Badge tone="warning" dot>
              {t("stats.tomorrow")}
            </Badge>
          }
          value={num(counts.tomorrow)}
          unit={t("stats.unit")}
          icon={isBelowLg ? undefined : CalendarClock}
          hint={t("stats.tomorrowHint")}
        />
      </div>

      <Card as="section" padding="none" aria-labelledby={modeTitleId}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
          <div className="flex min-w-0 flex-[1000_1_280px] items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
            >
              <ScanLine size={18} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id={modeTitleId} className="text-sm font-semibold text-text">
                {t("scanMode.title")}
              </h2>
              <ScanModeHint value={scanMode} />
            </div>
          </div>
          <div className="flex min-w-0 flex-auto flex-wrap items-center gap-x-6 gap-y-3">
            <ScanModeControl value={scanMode} onChange={onScanModeChange} compact={false} labelledBy={modeTitleId} />
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <Badge tone="success" dot>
                {t("scanMode.usbReady")}
              </Badge>
              <Button variant="secondary" leftIcon={Camera} aria-haspopup="dialog" disabled={busy} onClick={onOpenCamera}>
                {t("scanMode.camera")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};
