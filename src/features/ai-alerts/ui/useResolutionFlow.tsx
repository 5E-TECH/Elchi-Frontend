import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleX, Info } from "lucide-react";
import {
  AI_ADVISOR_ERROR_CODES,
  AI_ADVISOR_NOTE_MAX,
  AI_ADVISOR_NOTE_MIN,
  alertShortLabel,
  readAdvisorError,
  type AdvisorTranslate,
  type AiAdvisorAlertDetail,
} from "../../../entities/ai-advisor";
import { formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { useConfirm, type ConfirmErrorView } from "../../../shared/ui/primitives";
import { useDismissAlert, useResolveAlert } from "../model/useAlertMutations";

/**
 * «Hal qilindi» / «Ahamiyatsiz» (D9; maketlar `superadmin-ai-assistant-alert-dialog`, `-alert-resolve-confirm`,
 * toastlar — `-alerts`):
 *   «Hal qilindi»  izoh trim'dan keyin 3–500 — avval mijozda («Izoh kamida 3 belgi bo'lsin», fokus maydonga), so'ng
 *                  `useConfirm` («Ogohlantirish hal qilindimi?» + qisqa nom va summa, izoh, oqibatlar, «Orqaga» /
 *                  «Hal qilindi deb belgilash») → PATCH (yuklanish va xato — tasdiq oynasining o'zida: 400
 *                  `NOTE_INVALID`, 409 `ALERT_CLOSED`) → toast «Ogohlantirish hal qilindi», oyna yopiladi;
 *   «Ahamiyatsiz»  tasdiqsiz, izoh ixtiyoriy (≤ 500) → PATCH → toast «Ahamiyatsiz deb belgilandi», oyna yopiladi;
 *                  400 `NOTE_INVALID` — maydon ostida (`noteError`), boshqa xato — oynada (`dismissError`).
 */
export const useResolutionFlow = ({ alert, onDone }: { alert: AiAdvisorAlertDetail | undefined; onDone: () => void }) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  const confirm = useConfirm();
  const resolveMutation = useResolveAlert();
  const dismissMutation = useDismissAlert();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNoteState] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);
  // Boshqa ogohlantirish ochilsa — izoh va xatolar tozalanadi (oyna yopilib qayta ochilganda ham shu ID bo'lsa saqlanadi).
  const [noteFor, setNoteFor] = useState(alert?.id ?? null);
  if (alert && alert.id !== noteFor) {
    setNoteFor(alert.id);
    setNoteState("");
    setNoteError(null);
    setDismissError(null);
  }

  // So'rov paytida maydon o'chiq — fokus u yana yoqilgan chizishdan keyin beriladi.
  const focusNoteRef = useRef(false);
  useEffect(() => {
    if (!focusNoteRef.current || dismissMutation.isPending) return;
    focusNoteRef.current = false;
    noteRef.current?.focus();
  });

  const setNote = (value: string) => {
    setNoteState(value);
    if (noteError) setNoteError(null);
  };

  const noteErrorView = (reason: string | null): string =>
    reason === "too_long" ? t("alerts.note.tooLong") : t("alerts.note.tooShort");

  const closedView = (): ConfirmErrorView => ({
    tone: "neutral",
    icon: Info,
    blockConfirm: true,
    content: (
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{t("alerts.resolve.closedTitle")}</span>
        <span className="text-[13px] text-text-muted">{t("alerts.resolve.closedText")}</span>
      </span>
    ),
  });

  const resolve = async () => {
    if (!alert) return;
    const trimmed = note.trim();
    if (trimmed.length < AI_ADVISOR_NOTE_MIN || trimmed.length > AI_ADVISOR_NOTE_MAX) {
      setNoteError(noteErrorView(trimmed.length > AI_ADVISOR_NOTE_MAX ? "too_long" : "too_short"));
      noteRef.current?.focus();
      return;
    }
    const label = alertShortLabel(alert, tt);
    const amount = alert.headline_amount;
    const ok = await confirm({
      title: t("alerts.resolve.title"),
      description: (
        <>
          {label}
          {amount !== null ? (
            <>
              {" "}
              <span className={amount < 0 ? "whitespace-nowrap text-danger-fg" : "whitespace-nowrap"}>
                {formatSignedMoneyLocalized(amount, { language })}
              </span>
            </>
          ) : null}
        </>
      ),
      icon: CircleCheck,
      iconTone: "neutral",
      // Maket: «Izoh» yorlig'i + `sunken` qutida matn, oqibatlar — qutisiz ro'yxat (primitivning `rows` /
      // `consequences` ko'rinishi boshqa — shuning uchun `children`).
      children: (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text">{t("alerts.resolve.noteLabel")}</span>
            <p className="m-0 rounded-xl bg-sunken px-4 py-3 text-[13px] whitespace-pre-line [overflow-wrap:anywhere] text-text">
              {trimmed}
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {[t("alerts.resolve.status"), t("alerts.resolve.reopen")].map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <Info aria-hidden="true" size={16} strokeWidth={2} className="mt-px shrink-0 text-text-muted" />
                <span className="min-w-0 text-[13px] text-text">{text}</span>
              </li>
            ))}
          </ul>
        </>
      ),
      confirmLabel: t("alerts.resolve.confirm"),
      confirmIcon: CircleCheck,
      cancelLabel: t("alerts.resolve.cancel"),
      loadingLabel: t("alerts.resolve.loading"),
      onConfirm: () => resolveMutation.mutateAsync({ id: alert.id, note: trimmed }),
      errorView: (error) => {
        const { code, fields, status } = readAdvisorError(error);
        if (code === AI_ADVISOR_ERROR_CODES.NOTE_INVALID) {
          return { icon: CircleX, blockConfirm: true, content: noteErrorView(fields.reason) };
        }
        if (status === 409) return closedView();
        return null;
      },
    });
    if (!ok) return;
    notify.success(t("alerts.resolve.toastTitle"), { description: t("alerts.resolve.toastText", { label }) });
    onDone();
  };

  const dismiss = () => {
    if (!alert || dismissMutation.isPending) return;
    setDismissError(null);
    // «Hal qilindi» urinishidan qolgan izoh xatosi «Ahamiyatsiz» ga tegishli emas (izoh bu yerda ixtiyoriy).
    setNoteError(null);
    const label = alertShortLabel(alert, tt);
    dismissMutation.mutate(
      { id: alert.id, note },
      {
        onSuccess: () => {
          notify.info(t("alerts.dismiss.toastTitle"), { description: t("alerts.dismiss.toastText", { label }) });
          onDone();
        },
        onError: (error) => {
          const { code, fields, status } = readAdvisorError(error);
          // Izoh qoidasi (masalan `too_long`) — umumiy xato emas, maydon ostida (resolve'dagidek).
          if (code === AI_ADVISOR_ERROR_CODES.NOTE_INVALID) {
            setNoteError(noteErrorView(fields.reason));
            focusNoteRef.current = true;
            return;
          }
          setDismissError(status === 409 ? t("alerts.dialog.closedAlready") : t("alerts.dialog.dismissFailed"));
        },
      },
    );
  };

  return {
    note,
    setNote,
    noteError,
    noteRef,
    resolve,
    dismiss,
    dismissError,
    dismissing: dismissMutation.isPending,
    busy: dismissMutation.isPending || resolveMutation.isPending,
  };
};
