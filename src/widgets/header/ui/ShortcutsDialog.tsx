// dizayn-v2: shell
import { Fragment, memo, useId } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { useFocusTrap } from "../../../shared/lib/useFocusTrap";
import { IconButton } from "../../../shared/ui/primitives";
import { KBD } from "./styles";

/**
 * «TEZKOR TUGMALAR» OYNASI — `?` tugmasi yoki profil menyusidagi band (taxta `tizim-states-navigation` →
 * 01 «Tezkor tugmalar» kartasi). Oyna: `.el-overlay` + `.el-dialog` (CODE-MAP 2.8), telefonda pastdan chiquvchi
 * varaqa. `body` ga portal, fokus ichida, Esc/fon/«Yopish» yopadi, fokus chaqiruvchiga qaytadi.
 */

type Shortcut = { keys: string[]; joiner: "plus" | "then" | null; label: string };

type ShortcutsDialogProps = {
  open: boolean;
  onClose: () => void;
  /** «Qidiruv» (Ctrl K) — global qidiruvi bor rolda (`roleHasGlobalSearch`; investorda yo'q). */
  showSearch?: boolean;
  /** «Buyurtmalarga o'tish» (G → O) — buyurtmalar ochiladigan rolda (`canViewOrders`). */
  showOrders?: boolean;
  /** «Paketlarga o'tish» (G → B) faqat menejerda. */
  showBatches: boolean;
};

const ShortcutsDialog = ({ open, onClose, showSearch = true, showOrders = true, showBatches }: ShortcutsDialogProps) => {
  const { t } = useTranslation("ui");
  const titleId = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(open, { onEscape: onClose, inertAppRoot: true });

  if (!open || typeof document === "undefined") return null;

  const shortcuts: Shortcut[] = [
    ...(showSearch ? [{ keys: ["Ctrl", "K"], joiner: "plus" as const, label: t("header.shortcuts.search") }] : []),
    ...(showOrders ? [{ keys: ["G", "O"], joiner: "then" as const, label: t("header.shortcuts.orders") }] : []),
    ...(showBatches ? [{ keys: ["G", "B"], joiner: "then" as const, label: t("header.shortcuts.batches") }] : []),
    { keys: ["Esc"], joiner: null, label: t("header.shortcuts.escape") },
    { keys: ["Tab"], joiner: null, label: t("header.shortcuts.tab") },
    { keys: ["?"], joiner: null, label: t("header.shortcuts.list") },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-6 max-md:items-end max-md:p-0">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 size-full cursor-default bg-overlay"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "relative flex w-full max-w-[640px] flex-col gap-2 rounded-[20px] border border-border bg-raised p-6 shadow-xl outline-none",
          "max-md:max-h-[92dvh] max-md:overflow-y-auto max-md:rounded-b-none max-md:px-4 max-md:pb-6 max-md:pt-2",
        )}
      >
        <div aria-hidden="true" className="mx-auto mb-1 hidden h-1 w-10 shrink-0 rounded-full bg-border-strong max-md:block" />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 flex items-center gap-2 text-base font-bold text-text">
            {t("header.shortcuts.title")}
            <span aria-hidden="true" className={KBD}>
              ?
            </span>
          </h2>
          <IconButton label={t("header.shortcuts.close")} icon={X} onClick={onClose} />
        </div>
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-x-10">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.keys.join("+")}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5"
            >
              <dt className="text-[13px] text-text">{shortcut.label}</dt>
              <dd className="m-0 inline-flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, index) => (
                  <Fragment key={key}>
                    {index > 0 && shortcut.joiner === "plus" ? (
                      <span aria-hidden="true" className="text-xs text-text-muted">
                        +
                      </span>
                    ) : null}
                    {index > 0 && shortcut.joiner === "then" ? (
                      <>
                        <ArrowRight aria-hidden="true" size={16} className="text-text-subtle" />
                        <span className="sr-only">{t("header.shortcuts.then")}</span>
                      </>
                    ) : null}
                    <kbd className={cx(KBD, "font-sans")}>{key}</kbd>
                  </Fragment>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body,
  );
};

export default memo(ShortcutsDialog);
