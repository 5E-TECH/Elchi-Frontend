// dizayn-v2: (maket yo'q) superadmin-neworders-markets
import { memo, useEffect, useRef, useState } from "react";
import { Clock, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import {
  isCutoffPassed,
  useOrderIntake,
  useUpdateDayChangeTime,
  useUpdateOrderIntake,
  type OrderIntakeState,
} from "../../../entities/order-intake";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { CLOCK_TIME, toClockDraft } from "../../../shared/lib/clockTime";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, StatusBadge, TextInput } from "../../../shared/ui/primitives";

type DialogStep = "intake" | "dayChange";

/**
 * «Bugungi qabul vaqti» oynasi. Superadmin uchun ikkinchi qadam — «Kun almashish soati» (Trello #756): o'sha oyna
 * ichida (ichma-ich oyna emas), «Orqaga» — asosiy qadamga. Soat faqat buyurtma qabuli oynasiga ta'sir qiladi.
 */
const OrderIntakeDialog = ({
  open,
  intake,
  onClose,
}: {
  open: boolean;
  intake: OrderIntakeState;
  onClose: () => void;
}) => {
  const { t } = useTranslation("newOrders");
  const update = useUpdateOrderIntake();
  const updateDay = useUpdateDayChangeTime();
  const cutoffTime = intake.cutoffTime;
  const [step, setStep] = useState<DialogStep>("intake");
  const [draft, setDraft] = useState(cutoffTime ?? "");
  const [touched, setTouched] = useState(false);
  const [dayDraft, setDayDraft] = useState(intake.dayChangeTime);
  const [dayTouched, setDayTouched] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const dayFieldRef = useRef<HTMLInputElement>(null);
  const dayButtonRef = useRef<HTMLButtonElement>(null);
  // Oyna har ochilganda — saqlangan qiymatdan va asosiy qadamdan (render paytida, effektsiz).
  const [openedWith, setOpenedWith] = useState<{ open: boolean; cutoff: string | null }>({
    open,
    cutoff: cutoffTime,
  });
  if (openedWith.open !== open || openedWith.cutoff !== cutoffTime) {
    setOpenedWith({ open, cutoff: cutoffTime });
    if (open) {
      setDraft(cutoffTime ?? "");
      setTouched(false);
    }
    if (open && !openedWith.open) setStep("intake");
  }

  // Qadam almashganda fokus yangi qadamga: soat maydoni yoki qaytishda «O'zgartirish» (bosilgan tugma yo'qolmasin).
  const focusedStepRef = useRef<DialogStep>("intake");
  useEffect(() => {
    if (!open) {
      focusedStepRef.current = "intake";
      return;
    }
    if (step === focusedStepRef.current) return;
    focusedStepRef.current = step;
    (step === "dayChange" ? dayFieldRef.current : dayButtonRef.current)?.focus();
  }, [open, step]);

  const valid = CLOCK_TIME.test(draft);
  const dayValid = CLOCK_TIME.test(dayDraft);
  const busy = update.isPending || updateDay.isPending;
  // Saqlansa qabul darhol yopiladimi — joriy ISH KUNI oynasi bo'yicha (`isCutoffPassed`).
  const passed = valid && isCutoffPassed(draft, intake);

  const save = (value: string | null) => {
    if (busy) return;
    update.mutate(value, {
      onSuccess: () => {
        notify.success(
          value ? t("intake.dialog.saved", { time: value }) : t("intake.dialog.removed"),
        );
        onClose();
      },
      onError: () => notify.error(t("intake.dialog.error")),
    });
  };

  const openDayStep = () => {
    setDayDraft(intake.dayChangeTime);
    setDayTouched(false);
    setDayError(null);
    setStep("dayChange");
  };

  const saveDay = () => {
    setDayTouched(true);
    if (!dayValid || busy) return;
    setDayError(null);
    updateDay.mutate(dayDraft, {
      onSuccess: (state) => {
        notify.success(t("intake.dayChange.saved", { time: state.dayChangeTime }));
        setStep("intake");
      },
      onError: (error) => {
        const status = getErrorStatus(error);
        if (status === 400) setDayError(t("intake.dialog.invalid"));
        else notify.error(status === 403 ? t("intake.dayChange.forbidden") : t("intake.dayChange.error"));
      },
    });
  };

  const isDayStep = step === "dayChange";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      icon={Clock}
      title={isDayStep ? t("intake.dayChange.title") : t("intake.dialog.title")}
      description={isDayStep ? t("intake.dayChange.description") : t("intake.dialog.description")}
      onSubmit={(event) => {
        event.preventDefault();
        if (isDayStep) {
          saveDay();
          return;
        }
        setTouched(true);
        if (valid) save(draft);
      }}
      formProps={{ noValidate: true }}
      footer={
        isDayStep ? (
          <>
            <Button variant="secondary" onClick={() => setStep("intake")} disabled={busy}>
              {t("intake.dayChange.back")}
            </Button>
            <Button type="submit" loading={updateDay.isPending}>
              {t("intake.dayChange.save")}
            </Button>
          </>
        ) : (
          <>
            {cutoffTime ? (
              <Button
                variant="ghost"
                onClick={() => save(null)}
                disabled={busy}
                className="mr-auto max-md:mr-0"
              >
                {t("intake.dialog.remove")}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t("intake.dialog.cancel")}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {t("intake.dialog.save")}
            </Button>
          </>
        )
      }
    >
      {isDayStep ? (
        <>
          {cutoffTime ? (
            <p
              role="note"
              className="m-0 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] text-text"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 flex-none text-warning-fg" />
              <span className="min-w-0">{t("intake.dayChange.cutoffWarning")}</span>
            </p>
          ) : null}
          <Field
            label={t("intake.dayChange.field")}
            required
            hint={t("intake.dayChange.hint")}
            error={dayTouched && !dayValid ? t("intake.dialog.invalid") : (dayError ?? undefined)}
          >
            <TextInput
              ref={dayFieldRef}
              icon={Clock}
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              placeholder="00:00"
              value={dayDraft}
              onValueChange={(next) => {
                setDayDraft(toClockDraft(next));
                setDayError(null);
              }}
              onBlur={() => setDayTouched(true)}
            />
          </Field>
        </>
      ) : (
        <>
          {/* Kun almashish soati — ixcham qator (oyna faqat superadmin uchun ochiladi, `OrderIntakeControl`). */}
          <div
            data-testid="day-change-row"
            className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-sunken py-1 pl-3 pr-1"
          >
            <span className="min-w-0 text-[13px] text-text-muted">
              {t("intake.dayChange.row", { time: intake.dayChangeTime })}
            </span>
            <Button
              ref={dayButtonRef}
              variant="ghost"
              size="sm"
              onClick={openDayStep}
              disabled={busy}
              aria-label={t("intake.dayChange.changeLabel")}
              className="shrink-0"
            >
              {t("intake.dayChange.change")}
            </Button>
          </div>
          <Field
            label={t("intake.dialog.field")}
            required
            hint={passed ? t("intake.dialog.passed") : t("intake.dialog.hint")}
            error={touched && !valid ? t("intake.dialog.invalid") : undefined}
          >
            <TextInput
              icon={Clock}
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              placeholder="10:00"
              value={draft}
              onValueChange={(next) => setDraft(toClockDraft(next))}
              onBlur={() => setTouched(true)}
            />
          </Field>
        </>
      )}
    </Dialog>
  );
};

/**
 * «Qabul va yaratish» sarlavhasida BUGUNGI QABUL VAQTI (2026-11-08). Maket yo'q — eng yaqini
 * `superadmin-neworders-markets` sarlavhasi (ikkinchi darajali amal asosiy «Buyurtma yaratish» yonida).
 *   - faqat superadmin (ega 2026-11-09; backend `PATCH` ham `@Roles(SUPERADMIN)`, admin — 403):
 *     «Bugungi qabul: 10:00 gacha» tugmasi → oyna (vaqt, «Cheklovni olib tashlash», «Kun almashish soati» qatori va
 *     ikkinchi qadami — Trello #756);
 *   - qolgan rollar (admin ham): cheklov bo'lsa — holat belgisi («… gacha» / «yopildi»), cheklovsizda hech narsa.
 * Backend endpointi yo'q bo'lsa (`supported: false`) — umuman ko'rinmaydi (`entities/order-intake/model.ts`).
 */
const OrderIntakeControl = () => {
  const { t } = useTranslation("newOrders");
  const role = useSelector((state: RootState) => state.role.role);
  const canManage = role === "superadmin";
  const intake = useOrderIntake();
  const [open, setOpen] = useState(false);

  if (!intake.supported) return null;

  const label = intake.closed
    ? t("intake.closed")
    : intake.cutoffTime
      ? t("intake.until", { time: intake.cutoffTime })
      : t("intake.unlimited");

  if (!canManage) {
    if (!intake.cutoffTime) return null;
    return (
      <StatusBadge
        tone={intake.closed ? "danger" : "info"}
        icon={Clock}
        label={label}
        data-testid="order-intake-status"
      />
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        leftIcon={Clock}
        aria-label={`${label}. ${t("intake.change")}`}
        onClick={() => setOpen(true)}
        data-testid="order-intake-control"
      >
        {label}
      </Button>
      <OrderIntakeDialog open={open} intake={intake} onClose={() => setOpen(false)} />
    </>
  );
};

export default memo(OrderIntakeControl);
