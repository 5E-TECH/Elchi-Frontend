// dizayn-v2: common-settings-notifications, superadmin-notifications-push-explain-dialog, courier-inbox-push-explain-dialog
import { memo, useId } from "react";
import { Bell, BellOff, BellRing, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Badge, Button, type Tone } from "../../../shared/ui/primitives";
import { usePushControl, type PushControl } from "../model/usePushControl";
import type { PushDeviceState } from "../model/usePushSubscription";
import { PushExplainDialog } from "./PushExplainDialog";

type PushPermissionButtonProps = {
  /**
   * `button` (sukut) — bitta tugma: «Bildirishnomalarni yoqish» / «Bildirishnomalarni o'chirish», rad etilgan
   * bo'lsa passiv izoh. `switch` — Sozlamalar → Bildirishnomalar qurilma bloki (maket
   * `common-settings-notifications`): «Shu qurilmaga bildirishnomalar» kaliti, «Brauzer ruxsati» badge'i va
   * bloklangan holatda «qanday yoqiladi» qadamlari.
   */
  variant?: "button" | "switch";
};

/**
 * "Bildirishnomalarni yoqish" (davC9QOX).
 *
 * Ikki qadam: avval BIZNING tushuntiruvchi oynamiz (`PushExplainDialog`), faqat "Yoqish" bosilgach
 * brauzer oynasi. Sahifa yuklanganda hech qanday ruxsat so'ralmaydi. Rad etilgan bo'lsa tugma o'rniga passiv
 * izoh — qayta bezovta qilinmaydi (brauzer 'denied' dan keyin dasturiy qayta so'rashga ruxsat bermaydi).
 */
const PushPermissionButton = ({ variant = "button" }: PushPermissionButtonProps) => {
  const control = usePushControl();
  return variant === "switch" ? (
    <PushDeviceSwitch control={control} />
  ) : (
    <PushButton control={control} />
  );
};

const PushButton = ({ control }: { control: PushControl }) => {
  const { t } = useTranslation("notifications");
  const { status, busy } = control;

  if (status === "loading" || status === "unsupported" || status === "unavailable") return null;

  if (status === "denied") {
    return (
      <p
        role="status"
        className="inline-flex max-w-full items-start gap-2 self-start text-[13px] text-text-muted"
      >
        <BellOff size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t("push.blocked")}</span>
      </p>
    );
  }

  if (status === "enabled") {
    return (
      <Button
        variant="secondary"
        leftIcon={BellRing}
        loading={busy}
        onClick={() => void control.turnOff()}
      >
        {t("push.turnOff")}
      </Button>
    );
  }

  return (
    <>
      <Button variant="secondary" leftIcon={Bell} onClick={control.openExplain}>
        {t("push.turnOn")}
      </Button>
      <PushExplainDialog
        open={control.explainOpen}
        busy={busy}
        onClose={control.closeExplain}
        onConfirm={() => void control.confirmEnable()}
      />
    </>
  );
};

const HINT_KEY: Record<PushDeviceState, string> = {
  loading: "push.deviceHintOff",
  unsupported: "push.deviceHintUnsupported",
  default: "push.deviceHintOff",
  "granted-off": "push.deviceHintOff",
  enabled: "push.deviceHintOn",
  denied: "push.deviceHintBlocked",
};

const PERMISSION_VIEW: Record<
  "granted" | "default" | "denied",
  { key: string; hint: string; tone: Tone }
> = {
  granted: { key: "push.permissionGranted", hint: "push.permissionGrantedHint", tone: "success" },
  default: { key: "push.permissionDefault", hint: "push.permissionDefaultHint", tone: "neutral" },
  denied: { key: "push.permissionDenied", hint: "push.permissionDeniedHint", tone: "warning" },
};

/** Qurilma bloki (Sozlamalar): kalit qatori + «Brauzer ruxsati» + bloklanganda yo'riqnoma. */
const PushDeviceSwitch = ({ control }: { control: PushControl }) => {
  const { t } = useTranslation("notifications");
  const hintId = useId();
  const { state, status, busy } = control;
  const checked = state === "enabled";
  const disabled = state === "loading" || state === "unsupported" || state === "denied" || busy;
  const permission =
    state === "denied"
      ? "denied"
      : state === "enabled" || state === "granted-off"
        ? "granted"
        : "default";
  const view = PERMISSION_VIEW[permission];
  const hint = status === "unavailable" ? "push.deviceHintUnavailable" : HINT_KEY[state];

  const toggle = () => {
    if (checked) void control.turnOff();
    else control.openExplain();
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={t("push.deviceToggle")}
        aria-describedby={hintId}
        aria-busy={busy || state === "loading" || undefined}
        disabled={disabled}
        onClick={toggle}
        className="group flex w-full items-center gap-4 rounded-xl bg-sunken p-4 text-left disabled:cursor-not-allowed max-md:gap-3 max-md:p-3"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
        >
          {state === "denied" || state === "unsupported" ? (
            <BellOff size={18} />
          ) : (
            <BellRing size={18} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-text">{t("push.deviceToggle")}</span>
          <span id={hintId} className="text-[13px] text-text-muted">
            {t(hint)}
          </span>
        </span>
        <SwitchTrack />
      </button>

      {state !== "unsupported" && state !== "loading" ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-text">{t("push.permissionTitle")}</span>
            <Badge tone={view.tone} dot>
              {t(view.key)}
            </Badge>
          </div>
          <span className="text-[13px] text-text-muted">{t(view.hint)}</span>
        </div>
      ) : null}

      {state === "denied" ? <PushBlockedHowTo /> : null}

      <PushExplainDialog
        open={control.explainOpen}
        busy={busy}
        onClose={control.closeExplain}
        onConfirm={() => void control.confirmEnable()}
      />
    </div>
  );
};

/** `.el-switch` ko'rinishi (CODE-MAP 2.2): 36 × 20, yoqiq — `action`; bosish maydoni — butun qator. */
const SwitchTrack = () => (
  <span
    aria-hidden="true"
    className={cx(
      "relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none",
      "group-aria-checked:bg-action group-disabled:opacity-45",
    )}
  >
    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
  </span>
);

/** «Brauzerda bloklangan bo'lsa, qanday yoqiladi» — 3 qadam (maket `common-settings-notifications`). */
export const PushBlockedHowTo = () => {
  const { t } = useTranslation("notifications");
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg"
    >
      <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold">{t("push.howToTitle")}</p>
        <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-[18px] text-[13px] text-text">
          <li>{t("push.howToStep1")}</li>
          <li>{t("push.howToStep2")}</li>
          <li>{t("push.howToStep3")}</li>
        </ol>
      </div>
    </div>
  );
};

export default memo(PushPermissionButton);
