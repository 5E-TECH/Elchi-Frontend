// dizayn-v2: superadmin-regions-sato-codes, superadmin-regions-sato-codes-apply-dialog
import { useRef, useState } from "react";
import { Check, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog } from "../../../../shared/ui/primitives";
import {
  countSatoCodesWritten,
  parseSatoAppliedCount,
  satoApplySummary,
  type SatoDistrict,
  type SatoTabRows,
} from "../../model/satoModel";
import { DialogNote } from "../DistrictMergeDialog";

/** Tugmadagi son (`.el-tab-count`, maket: oq fon, ko'k matn). */
const COUNT =
  "ms-0.5 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-surface px-1.5 text-xs font-semibold text-action-fg tabular-nums";

type Props = {
  /** Superadmin tablari (`null` — yuklanmoqda yoki xato: tugma o'chiq). */
  rows: SatoTabRows | null;
  /**
   * Preview va `/district` ni birga qayta yuklaydi va yangi `/district` ni qaytaradi (`null` — yuklab bo'lmadi).
   * Natija xabari shu ro'yxatdagi haqiqiy holat bo'yicha (504, aloqa uzilishi, qisman yozilish).
   */
  reload: () => Promise<SatoDistrict[] | null>;
};

/**
 * «SATO KODLARINI YOZISH N» (superadmin, sarlavha amali): N = «Topildi» tabi. Tasdiq oynasi — Yoziladi /
 * O'zgarmaydi / Yozilmaydi, birinchi 3 tuman; bosilgach «Yozilmoqda…» (oyna yopilmaydi) →
 * `POST district/sato-match/apply` → ro'yxat qayta yuklanadi → xabar. Server yozishni bo'laklab qiladi (tranzaksiya
 * yo'q) — xato yoki javobsiz (504) bo'lsa ham ro'yxat qayta olinib, haqiqiy holat aytiladi (server matni emas).
 */
export const SatoApplyAction = ({ rows, reload }: Props) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language });
  const countTa = (value: number) => t("v2.common.countTa", { count: number(value) });
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const summary = rows ? satoApplySummary(rows) : null;
  // Oyna ochilgandagi ro'yxat (yozish paytida qayta yuklansa ham xulosa o'zgarmaydi).
  const [snapshot, setSnapshot] = useState(summary);
  const shown = open || writing ? snapshot : summary;
  const write = summary?.write ?? 0;

  const close = () => {
    if (!writing) setOpen(false);
  };

  const submit = async () => {
    if (!snapshot || writing) return;
    const { ids } = snapshot;
    const total = ids.length;
    setWriting(true);
    let applied: number | null = null;
    let failed = false;
    try {
      const response = await api.post(API_ENDPOINTS.DISTRICTS.SATO_MATCH_APPLY);
      applied = parseSatoAppliedCount(response.data);
    } catch {
      failed = true;
    }
    const fresh = await reload().catch(() => null);
    setWriting(false);
    setOpen(false);

    if (!failed) {
      const count = applied ?? (fresh ? countSatoCodesWritten(ids, fresh) : total);
      if (count > 0) notify.success(t("v2.sato.apply.done", { count, value: number(count) }), { description: t("v2.sato.apply.doneText") });
      else notify.info(t("v2.sato.apply.none"), { description: t("v2.sato.apply.noneText") });
      return;
    }
    if (!fresh) {
      notify.warning(t("v2.sato.apply.unknown"), { description: t("v2.sato.apply.unknownText") });
      return;
    }
    const written = countSatoCodesWritten(ids, fresh);
    if (total > 0 && written === total)
      notify.success(t("v2.sato.apply.done", { count: written, value: number(written) }), {
        description: t("v2.sato.apply.doneText"),
      });
    else if (written > 0)
      notify.warning(t("v2.sato.apply.partial"), {
        description: t("v2.sato.apply.partialText", { written: number(written), total: number(total) }),
      });
    else notify.error(t("v2.sato.apply.failed"), { description: t("v2.sato.apply.failedText") });
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="primary"
        compact
        leftIcon={Zap}
        aria-haspopup="dialog"
        disabled={!summary || write === 0}
        onClick={() => {
          setSnapshot(summary);
          setOpen(true);
        }}
      >
        {t("v2.sato.apply.button")}
        {summary ? <span className={COUNT}>{number(write)}</span> : null}
      </Button>

      {shown ? (
        <Dialog
          open={open}
          onClose={close}
          role="alertdialog"
          size="md"
          busy={writing}
          title={t("v2.sato.apply.title")}
          description={t("v2.sato.apply.text", { count: shown.write, value: number(shown.write) })}
          icon={Zap}
          iconShape="circle"
          returnFocus={triggerRef}
          footer={
            <>
              <Button variant="secondary" disabled={writing} onClick={close}>
                {t("v2.sato.apply.cancel")}
              </Button>
              <Button
                variant="primary"
                leftIcon={Check}
                loading={writing}
                loadingText={t("v2.sato.apply.writing")}
                onClick={() => void submit()}
              >
                {t("v2.sato.apply.submit", { count: shown.write, value: number(shown.write) })}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 rounded-xl bg-sunken p-4">
            <dl aria-label={t("v2.sato.apply.summaryAria")} className="m-0 grid grid-cols-3 gap-3">
              {(
                [
                  ["write", shown.write],
                  ["unchanged", shown.unchanged],
                  ["skipped", shown.skipped],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-text-muted">{t(`v2.sato.apply.${key}`)}</dt>
                  <dd className="m-0 text-base font-bold whitespace-nowrap text-text tabular-nums">{countTa(value)}</dd>
                </div>
              ))}
            </dl>
            <ul aria-label={t("v2.sato.apply.listAria")} className="m-0 flex list-none flex-col p-0">
              {shown.preview.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 border-t border-border py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-semibold text-text [overflow-wrap:anywhere]">{row.name}</span>
                    <span className="text-xs text-text-muted">{row.regionName}</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap text-text tabular-nums tracking-[.04em]">
                    {row.foundCode ?? row.satoCode}
                  </span>
                </li>
              ))}
              {shown.rest > 0 ? (
                <li className="border-t border-border pt-2 text-xs text-text-muted">
                  {t("v2.sato.apply.more", { count: shown.rest, value: number(shown.rest) })}
                </li>
              ) : null}
            </ul>
          </div>
          <DialogNote>
            {t("v2.sato.apply.note", { notFound: number(shown.notFound), duplicates: number(shown.duplicates) })}
          </DialogNote>
        </Dialog>
      ) : null}
    </>
  );
};
