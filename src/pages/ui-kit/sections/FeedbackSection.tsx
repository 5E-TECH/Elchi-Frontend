import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { notify, type NotifyTone } from "../../../shared/lib/notify";
import { Button } from "../../../shared/ui/primitives/Button";
import { Toast } from "../../../shared/ui/primitives/Toaster";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Qalqib chiquvchi xabarlar» bo'limi (`?section=feedback`) — 3-bosqich: `notify()` + `Toaster`.
 *
 * Namunalar taxtadan: `tizim-feedback` 01 «Qalqib chiquvchi xabarlar» (6 ta xabar, aniq matnlari bilan) va
 * 02 «Joylashuv va to'planish». «Turlari» — xabar kartasi joyida (ikkala mavzuda); «Sinab ko'rish» —
 * haqiqiy `notify()`: xabar ilovaning burchagida chiqadi (kompyuterda pastki o'ng, telefonda tepada).
 */

const DemoBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
      {note ? <p className="text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/** Bitta namuna: nomi + izoh (maketdagi `el-h3` + `el-xs el-muted`), ostida kulrang maydonda xabar. */
const Sample = ({ label, meta, children }: { label: string; meta: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2.5">
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm font-semibold text-text">{label}</span>
      <span className="text-xs text-text-muted">{meta}</span>
    </div>
    <div className="flex min-h-[148px] flex-1 items-center justify-center rounded-[14px] bg-sunken px-4 py-7 max-md:px-3">
      <div className="w-full max-w-[380px]">{children}</div>
    </div>
  </div>
);

const GRID = "grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-x-4 gap-y-6";

export const FeedbackSection = () => {
  const { t } = useTranslation("ui");
  const amount = formatMoneyLocalized(1_250_000);
  const noop = () => {};

  const samples: ReadonlyArray<{
    key: string;
    tone: NotifyTone;
    title: string;
    text: string;
    action?: string;
  }> = [
    { key: "success", tone: "success", title: t("feedbackKit.demo.paid.title"), text: t("feedbackKit.demo.paid.text", { amount }) },
    { key: "info", tone: "info", title: t("feedbackKit.demo.dayClosed.title"), text: t("feedbackKit.demo.dayClosed.text") },
    { key: "warning", tone: "warning", title: t("feedbackKit.demo.duplicate.title"), text: t("feedbackKit.demo.duplicate.text") },
    { key: "error", tone: "error", title: t("feedbackKit.demo.forbidden.title"), text: t("feedbackKit.demo.forbidden.text") },
    {
      key: "undo",
      tone: "success",
      title: t("feedbackKit.demo.removed.title"),
      text: t("feedbackKit.demo.removed.text"),
      action: t("feedbackKit.demo.removed.action"),
    },
    {
      key: "retry",
      tone: "error",
      title: t("feedbackKit.demo.report.title"),
      text: t("feedbackKit.demo.report.text"),
      action: t("feedbackKit.demo.report.action"),
    },
  ];

  // «Sinab ko'rish» — haqiqiy xabarlar (Toaster: pastki o'ng / telefonda tepada).
  const triggers: ReadonlyArray<{ key: string; label: string; run: () => void }> = [
    {
      key: "success",
      label: t("feedbackKit.buttons.success"),
      run: () => notify.success(samples[0].title, { description: samples[0].text }),
    },
    {
      key: "info",
      label: t("feedbackKit.buttons.info"),
      run: () => notify.info(samples[1].title, { description: samples[1].text }),
    },
    {
      key: "warning",
      label: t("feedbackKit.buttons.warning"),
      run: () => notify.warning(samples[2].title, { description: samples[2].text }),
    },
    {
      key: "error",
      label: t("feedbackKit.buttons.error"),
      run: () => notify.error(samples[3].title, { description: samples[3].text }),
    },
    {
      key: "undo",
      label: t("feedbackKit.buttons.undo"),
      run: () =>
        notify.success(samples[4].title, {
          description: samples[4].text,
          action: { label: samples[4].action ?? "", onClick: noop },
        }),
    },
    {
      key: "retry",
      label: t("feedbackKit.buttons.retry"),
      run: () =>
        notify.error(samples[5].title, {
          description: samples[5].text,
          action: { label: samples[5].action ?? "", onClick: noop },
        }),
    },
    {
      key: "burst",
      label: t("feedbackKit.buttons.burst"),
      run: () => {
        notify.success(t("feedbackKit.demo.excel.title"), { description: t("feedbackKit.demo.excel.text") });
        notify.warning(samples[2].title, { description: samples[2].text });
        notify.error(samples[5].title, { description: samples[5].text });
        notify.success(t("feedbackKit.demo.accepted.title"), { description: t("feedbackKit.demo.accepted.text") });
      },
    },
    {
      key: "repeat",
      label: t("feedbackKit.buttons.repeat"),
      run: () => notify.error(samples[5].title, { description: samples[5].text }),
    },
  ];

  return (
    <KitSection id="feedback" title={t("kit.sections.feedback.title")} description={t("kit.sections.feedback.description")}>
      <DemoBlock title={t("feedbackKit.groups.live")} note={t("feedbackKit.groups.liveNote")}>
        <div className="flex min-w-0 flex-wrap gap-2" data-feedback-triggers="">
          {triggers.map((trigger) => (
            <Button key={trigger.key} variant="secondary" size="sm" onClick={trigger.run}>
              {trigger.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => notify.dismiss()}>
            {t("feedbackKit.buttons.dismissAll")}
          </Button>
        </div>
      </DemoBlock>

      <ThemePair layout="stack">
        <DemoBlock title={t("feedbackKit.groups.tones")} note={t("feedbackKit.groups.tonesNote")}>
          <div className={GRID}>
            {samples.map((sample) => (
              <Sample
                key={sample.key}
                label={t(`feedbackKit.kinds.${sample.key}.label`)}
                meta={t(`feedbackKit.kinds.${sample.key}.meta`)}
              >
                <Toast
                  tone={sample.tone}
                  title={sample.title}
                  description={sample.text}
                  action={sample.action ? { label: sample.action, onClick: noop } : undefined}
                  onClose={noop}
                />
              </Sample>
            ))}
          </div>
        </DemoBlock>
      </ThemePair>
    </KitSection>
  );
};
