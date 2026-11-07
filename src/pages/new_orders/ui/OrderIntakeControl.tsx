// dizayn-v2: (maket yo'q) superadmin-neworders-markets
import { memo, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useOrderIntake, useUpdateOrderIntake } from "../../../entities/order-intake";
import { CLOCK_TIME, tashkentClockNow, toClockDraft } from "../../../shared/lib/clockTime";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, StatusBadge, TextInput } from "../../../shared/ui/primitives";

const OrderIntakeDialog = ({
  open,
  cutoffTime,
  onClose,
}: {
  open: boolean;
  cutoffTime: string | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation("newOrders");
  const update = useUpdateOrderIntake();
  const [draft, setDraft] = useState(cutoffTime ?? "");
  const [touched, setTouched] = useState(false);
  // Oyna har ochilganda — saqlangan qiymatdan (render paytida, effektsiz).
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
  }

  const valid = CLOCK_TIME.test(draft);
  const busy = update.isPending;
  // Bugun (Toshkent) shu soat o'tgan bo'lsa — saqlansa qabul darhol yopiladi (izohda aytiladi).
  const passed = valid && draft <= tashkentClockNow();

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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      icon={Clock}
      title={t("intake.dialog.title")}
      description={t("intake.dialog.description")}
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (valid) save(draft);
      }}
      formProps={{ noValidate: true }}
      footer={
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
          <Button type="submit" loading={busy}>
            {t("intake.dialog.save")}
          </Button>
        </>
      }
    >
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
    </Dialog>
  );
};

/**
 * «Qabul va yaratish» sarlavhasida BUGUNGI QABUL VAQTI (2026-11-08). Maket yo'q — eng yaqini
 * `superadmin-neworders-markets` sarlavhasi (ikkinchi darajali amal asosiy «Buyurtma yaratish» yonida).
 *   - superadmin / admin: «Bugungi qabul: 10:00 gacha» tugmasi → oyna (vaqt, «Cheklovni olib tashlash»);
 *   - qolgan rollar: cheklov bo'lsa — holat belgisi («… gacha» / «yopildi»), cheklovsizda hech narsa.
 * Backend endpointi yo'q bo'lsa (`supported: false`) — umuman ko'rinmaydi (`entities/order-intake/model.ts`).
 */
const OrderIntakeControl = () => {
  const { t } = useTranslation("newOrders");
  const role = useSelector((state: RootState) => state.role.role);
  const canManage = role === "superadmin" || role === "admin";
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
      <OrderIntakeDialog
        open={open}
        cutoffTime={intake.cutoffTime}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default memo(OrderIntakeControl);
