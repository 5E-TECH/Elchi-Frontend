// dizayn-v2: courier-courier-bulk-scanner-camera-list
import { Check, CircleCheck, CircleX, Info, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Button, Dialog, EmptyState } from "../../../shared/ui/primitives";
import type { ScanEntry } from "../model/useScanAssign";
import { useScanEntryText } from "../model/useScanEntryText";

type ScanListSheetProps = {
  open: boolean;
  entries: ScanEntry[];
  acceptedCount: number;
  onClose: () => void;
  onDone: () => void;
  doneLoading: boolean;
};

const STATUS_ICON = {
  assigned: { icon: CircleCheck, className: "text-success-fg", toneText: "text-success-fg" },
  already: { icon: Info, className: "text-info-fg", toneText: "text-info-fg" },
  failed: { icon: CircleX, className: "text-danger-fg", toneText: "text-danger-fg" },
} as const;

/**
 * Shu sessiyada skanerlanganlar — kamera ichidagi pastki varaqa. Maket yo'q (hisoblagich va «Tayyor» kartada
 * so'ralgan, maketda yo'q) — eng yaqini `courier-courier-bulk-scanner-camera-list` («Skanerlanganlar»,
 * «Davom etish» + asosiy amal). Varaqa kamera yuzasi kabi tungi (`dark`).
 */
export const ScanListSheet = ({ open, entries, acceptedCount, onClose, onDone, doneLoading }: ScanListSheetProps) => {
  const { t } = useTranslation("tgScan");
  const { titleOf, placeOf, errorText, statusOf } = useScanEntryText();
  const failedCount = entries.filter((entry) => entry.status === "failed").length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      className="dark"
      title={t("list.title")}
      description={t("list.summary", { accepted: acceptedCount, failed: failedCount })}
      footerDivider="auto"
      footer={
        <>
          <Button variant="secondary" size="lg" leftIcon={ScanLine} onClick={onClose}>
            {t("list.continue")}
          </Button>
          <Button size="lg" leftIcon={Check} loading={doneLoading} loadingText={t("done.sending")} onClick={onDone}>
            {t("done.action")}
          </Button>
        </>
      }
    >
      {entries.length === 0 ? (
        <EmptyState icon={ScanLine} title={t("list.emptyTitle")} description={t("list.emptyText")} />
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const status = STATUS_ICON[entry.status];
            const Icon = status.icon;
            const title = entry.status === "failed" ? errorText(entry.error) : titleOf(entry.order);
            const place = entry.status === "failed" ? null : placeOf(entry.order);
            return (
              <li key={entry.key} className="flex min-w-0 items-center gap-3 py-3">
                <Icon aria-hidden="true" focusable="false" size={20} strokeWidth={2} className={cx("shrink-0", status.className)} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-5 font-semibold text-text">{title}</span>
                  <span className="truncate text-[13px] leading-[18px] text-text-muted">
                    <span className={status.toneText}>{statusOf(entry)}</span>
                    {place ? ` · ${place}` : null}
                  </span>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-text-muted">{formatDateTimeLocalized(entry.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
};
