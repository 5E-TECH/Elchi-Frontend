// dizayn-v2: superadmin-payments-history-detail-dialog-correctable, superadmin-payments-history-detail-dialog-locked
import { Clock, Lock, Pencil, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, buttonClasses } from "../../../shared/ui/primitives";
import type { CorrectionFooterState } from "../model/target";
import { usePaymentCorrectionTexts } from "../model/texts";

/**
 * TARIX TAFSILOTI PASTKI QISMI (superadmin, T6 N2) — `FinanceHistoryDetailPopup` `Dialog footer` ichida (aylanmaydi,
 * telefonda chetdan chetga chiziq ostida). Holat — `correctionFooterState`:
 *
 *  - `actions` (maket `superadmin-payments-history-detail-dialog-correctable`): muddat izohi («Qaytarish yoki
 *    tahrirlash mumkin: **{sana} gacha** · muddat {n} kun» / «… · muddat birinchi to'lovdan (#id)»), chapda
 *    «Qaytarish» (`danger-soft`), o'ngda «Summani tahrirlash» va «Yopish». Telefonda ustma-ust: «Summani tahrirlash»,
 *    so'ng «Qaytarish»; «Yopish» yo'q (X, tutqich, fon).
 *  - `lock` (maket `…-detail-dialog-locked`): neytral izoh (`role="note"`, `Lock`) — sarlavha (bo'lmasligi mumkin) va
 *    matn; `WINDOW_EXPIRED` da «Muddatni o'zgartirish» → sozlamalar. Faqat «Yopish» (telefonda to'liq en).
 *  - `none` — faqat «Yopish».
 */

export type PaymentCorrectionFooterProps = {
  state: CorrectionFooterState;
  closeLabel: string;
  onClose: () => void;
  onReverse: () => void;
  onCorrect: () => void;
  /** «Muddatni o'zgartirish» manzili (sahifa beradi — `/payments/shift-settings`). */
  changeWindowTo: string;
};

export const PaymentCorrectionFooter = ({
  state,
  closeLabel,
  onClose,
  onReverse,
  onCorrect,
  changeWindowTo,
}: PaymentCorrectionFooterProps) => {
  const texts = usePaymentCorrectionTexts();

  if (state.kind === "actions") {
    const hint = texts.deadlineHint(state);
    return (
      // Bitta o'ram: footer'ning «telefonda teng enli» qoidasi o'rniga o'z tartibi (izoh — butun qator).
      <div
        data-correction-footer="actions"
        className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 max-md:flex-col max-md:items-stretch"
      >
        <p className="m-0 flex min-w-0 items-start gap-2 text-[13px] text-text-muted md:basis-full">
          <Clock aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {hint.lead}{" "}
            {hint.until ? (
              <>
                <span className="font-semibold text-text">{hint.until}</span>
                {" · "}
              </>
            ) : null}
            {hint.window}
          </span>
        </p>
        <Button
          variant="danger-soft"
          leftIcon={RotateCcw}
          aria-haspopup="dialog"
          onClick={onReverse}
          className="md:mr-auto max-md:order-2"
        >
          {texts.actions.reverse}
        </Button>
        <Button variant="secondary" leftIcon={Pencil} aria-haspopup="dialog" onClick={onCorrect} className="max-md:order-1">
          {texts.actions.correct}
        </Button>
        <Button variant="secondary" onClick={onClose} className="max-md:hidden">
          {closeLabel}
        </Button>
      </div>
    );
  }

  const lock = state.kind === "lock" ? texts.lock(state.correctable) : null;
  if (!lock) {
    return (
      <Button variant="secondary" onClick={onClose}>
        {closeLabel}
      </Button>
    );
  }

  return (
    <div
      data-correction-footer="lock"
      className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-4 max-md:flex-col max-md:items-stretch"
    >
      <div
        role="note"
        className="flex w-full min-w-0 items-start gap-3 rounded-xl bg-sunken px-4 py-3 text-sm ring-1 ring-border ring-inset"
      >
        <Lock aria-hidden="true" size={20} className="shrink-0 text-text-muted" />
        <div className="flex min-w-0 flex-col text-text">
          {lock.title ? <p className="m-0 font-bold">{lock.title}</p> : null}
          <p className="m-0">{lock.body}</p>
          {lock.changeWindow ? (
            <div className="mt-1">
              <Link
                to={changeWindowTo}
                onClick={onClose}
                className={buttonClasses({ variant: "link", size: "sm", className: "-ml-1" })}
              >
                {lock.changeWindow}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
      <Button variant="secondary" onClick={onClose}>
        {closeLabel}
      </Button>
    </div>
  );
};
