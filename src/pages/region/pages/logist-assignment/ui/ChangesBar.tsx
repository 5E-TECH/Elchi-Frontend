// dizayn-v2: superadmin-regions-logist-assignment, admin-regions-logist-assignment
import { useTranslation } from "react-i18next";
import { cx } from "../../../../../shared/lib/cx";
import { Button } from "../../../../../shared/ui/primitives";
import type { AssignmentDiff } from "../model/assignment";

type ChangesBarProps = {
  diff: AssignmentDiff;
  saving: boolean;
  /** Nofaol logist — «Saqlash» o'chiq. */
  locked: boolean;
  onCancel: () => void;
  onSave: () => void;
};

/** «1 ta qo'shiladi · 1 ta o'tkaziladi · 1 ta olib tashlanadi» (telefonda qisqa: «1 qo'shiladi …»). */
const useDiffParts = (diff: AssignmentDiff, short: boolean) => {
  const { t } = useTranslation("region");
  const suffix = short ? "Short" : "";
  return [
    diff.added.length ? t(`v2.logist.changes.added${suffix}`, { count: diff.added.length }) : null,
    diff.transferred.length
      ? t(`v2.logist.changes.transferred${suffix}`, { count: diff.transferred.length })
      : null,
    diff.removed.length
      ? t(`v2.logist.changes.removed${suffix}`, { count: diff.removed.length })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
};

const Actions = ({
  diff,
  saving,
  locked,
  onCancel,
  onSave,
  stretch,
}: ChangesBarProps & { stretch?: boolean }) => {
  const { t } = useTranslation("region");
  const dirty = diff.total > 0;
  return (
    <div className={cx("flex gap-2", stretch && "[&>*]:flex-1")}>
      {dirty ? (
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          {t("v2.logist.changes.cancel")}
        </Button>
      ) : null}
      <Button
        onClick={onSave}
        disabled={!dirty || locked}
        loading={saving}
        loadingText={t("v2.logist.changes.saving")}
      >
        {t("v2.logist.changes.save")}
      </Button>
    </div>
  );
};

/**
 * Viloyatlar kartasining pastki qismi (desktop, planshet; maket `.el-card-foot`): «N ta o'zgarish» + tafsilot
 * va «Bekor qilish» · «Saqlash». O'zgarish yo'q — «O'zgarish yo'q», «Saqlash» o'chiq.
 */
export const ChangesFooter = (props: ChangesBarProps) => {
  const { t } = useTranslation("region");
  const parts = useDiffParts(props.diff, false);
  const dirty = props.diff.total > 0;
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3 max-md:hidden">
      <div role="status" className="flex min-w-0 flex-col gap-0.5">
        {dirty ? (
          <>
            <span className="font-semibold text-text">
              {t("v2.logist.changes.count", { count: props.diff.total })}
            </span>
            <span className="text-[13px] text-text-muted">{parts}</span>
          </>
        ) : (
          <span className="text-[13px] text-text-muted">{t("v2.logist.changes.none")}</span>
        )}
      </div>
      <Actions {...props} />
    </div>
  );
};

/**
 * Telefonda yopishqoq panel (maket `.el-sticky-bar`): faqat o'zgarish bo'lsa, pastki menyu ustida (`fixed`,
 * `--shell-bottomnav-h` — `courier-bulk`, `dispatch` naqshi) — «N ta o'zgarish» + qisqa tafsilot, ostida teng enli
 * «Bekor qilish» · «Saqlash».
 */
export const ChangesStickyBar = (props: ChangesBarProps) => {
  const { t } = useTranslation("region");
  const parts = useDiffParts(props.diff, true);
  if (props.diff.total === 0) return null;
  return (
    <>
      {/* Panel balandligidagi joy — oxirgi kartalar panel ostida qolmaydi. */}
      <div aria-hidden="true" className="h-[104px] shrink-0 md:hidden" />
      <div
        role="region"
        aria-label={t("v2.logist.changes.regionLabel")}
        className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 flex flex-col gap-2.5 border-t border-border bg-surface px-4 py-3 md:hidden"
      >
        <div role="status" className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="whitespace-nowrap font-semibold text-text">
            {t("v2.logist.changes.count", { count: props.diff.total })}
          </span>
          <span className="min-w-0 truncate text-xs text-text-muted">{parts}</span>
        </div>
        <Actions {...props} stretch />
      </div>
    </>
  );
};
