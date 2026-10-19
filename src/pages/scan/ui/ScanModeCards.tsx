// dizayn-v2: (maket yo'q) courier-courier-bulk-scanner-camera, courier-scan-active
import { useId, type ReactNode } from "react";
import { Check, CircleCheck, CircleX, History, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import type { ScanTargetListItem, ScanTargetTone } from "../../../shared/lib/scanner";
import { Button, Card, EmptyState, SegmentedControl } from "../../../shared/ui/primitives";
import type { UniversalScanMode } from "../model/scanModes";

/**
 * Universal skaner yon paneli (planshet / desktop) — 3-bosqich rejimlari. Maket yo'q — eng yaqini
 * `courier-courier-bulk-scanner-camera` (kamera ichidagi «Bekor / Ertaga» segmenti) va `courier-scan-active`
 * («Oxirgi skanerlar» qatorlari). Telefonda xuddi shu segment kamera ichida (`ScanTarget.modes`).
 */

export type ScanModeOption = { value: UniversalScanMode; label: string };

/** «Skaner rejimi»: segment, rejim izohi va rejimning amali (masalan «Marketni tanlang»). */
export const ScanModeCard = ({
  options,
  mode,
  onModeChange,
  text,
  action,
}: {
  options: readonly ScanModeOption[];
  mode: UniversalScanMode;
  onModeChange: (mode: UniversalScanMode) => void;
  text: string;
  action?: ReactNode;
}) => {
  const { t } = useTranslation("scan");
  const titleId = useId();
  return (
    <Card padding="lg" aria-labelledby={titleId} bodyClassName="flex flex-col gap-3">
      <h2 id={titleId} className="text-base font-bold text-text">
        {t("scanner.modes.label")}
      </h2>
      <SegmentedControl
        ariaLabel={t("scanner.modes.label")}
        options={options}
        value={mode}
        onValueChange={onModeChange}
        fullWidth
      />
      <p className="text-[13px] text-text-muted">{text}</p>
      {action}
    </Card>
  );
};

const ROW_TONE: Record<ScanTargetTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: "text-success-fg" },
  warning: { icon: TriangleAlert, className: "text-warning-fg" },
  danger: { icon: CircleX, className: "text-danger-fg" },
  neutral: { icon: Info, className: "text-text-muted" },
};

/** Kuryer «O'zimga olish»: hisoblagich, natija qatorlari (yangisi birinchi) va «Tugatish». */
export const ScanTakeCard = ({
  list,
  assigned,
  finishing,
  onFinish,
}: {
  list: readonly ScanTargetListItem[];
  assigned: number;
  finishing: boolean;
  onFinish: () => void;
}) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Card
      padding="none"
      title={t("scanner.take.listTitle")}
      actions={
        <span className="text-[13px] text-text-muted">
          <span className="text-base font-bold text-text">{formatNumberLocalized(assigned, { language })}</span>{" "}
          {t("scanner.take.meter")}
        </span>
      }
      className="overflow-hidden"
      footer={
        <Button fullWidth leftIcon={Check} loading={finishing} onClick={onFinish}>
          {t("scanner.take.finish")}
        </Button>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon={History} title={t("scanner.recentEmptyTitle")} description={t("scanner.take.emptyText")} />
      ) : (
        <ul className="max-h-[360px] divide-y divide-border overflow-y-auto border-t border-border">
          {list.map((item) => {
            const tone = ROW_TONE[item.tone ?? "neutral"];
            const Icon = tone.icon;
            return (
              <li key={item.key} className="flex min-h-14 min-w-0 items-center gap-3 px-5 py-2.5">
                <Icon aria-hidden="true" size={18} strokeWidth={2} className={cx("shrink-0", tone.className)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-text">{item.title}</span>
                  {item.subtitle ? (
                    <span className={cx("truncate text-[13px]", item.tone === "neutral" ? "text-text-muted" : tone.className)}>
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
