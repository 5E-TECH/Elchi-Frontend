import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, CalendarClock, Check, Download, Timer, Trash2, UserX } from "lucide-react";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  ConfirmDialogPanel,
  Dialog,
  DialogPanel,
  Field,
  Skeleton,
  TextInput,
  useConfirm,
} from "../../../shared/ui/primitives";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Oynalar va tasdiqlash» bo'limi (`?section=dialog`) — 3-bosqich: `Dialog`, `ConfirmDialog`, `useConfirm()`.
 *
 * Namunalar maketlardan: oyna — `manager-payments-close-shift-dialog`; tasdiqlash oynalari — taxta
 * `tizim-feedback` 06 (o'chirish, pul o'tkazmasi, nofaol qilish) va qoidalari; telefon varaqasi —
 * `tizim-motion` 03 («Kunni yakunlash») va `superadmin-users-delete-dialog` (telefon).
 * Maketdagidek oynalar joyida chizilgan (portal va fonsiz — `DialogPanel` / `ConfirmDialogPanel`);
 * pastdagi «Jonli namuna» — haqiqiy modal oyna (ilovaning joriy mavzusida).
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

/** Oyna orqasidagi sahifa (skelet) — maketdagi taxta kartalari kabi. */
const PageBehind = () => (
  <div aria-hidden="true" className="absolute inset-0 flex flex-col gap-3 p-5">
    <Skeleton width="40%" height={14} animated={false} />
    <Skeleton width="65%" animated={false} />
    <div className="mt-2 grid grid-cols-2 gap-3">
      <Skeleton shape="block" height={64} animated={false} />
      <Skeleton shape="block" height={64} animated={false} />
    </div>
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton key={index} width={index % 2 ? "85%" : "70%"} animated={false} />
    ))}
  </div>
);

/** Kompyuter: fon qoplamasi + markazdagi oyna (maketdagi `.el-overlay` joyida chizilgan). */
const DesktopStage = ({ children }: { children: ReactNode }) => (
  <div className="relative flex min-h-[420px] min-w-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg p-6 max-md:p-3">
    <PageBehind />
    <div aria-hidden="true" className="absolute inset-0 bg-overlay" />
    <div className="relative flex w-full min-w-0 justify-center">{children}</div>
  </div>
);

/** Telefon (390): pastki varaqa ekran pastida. */
const PhoneStage = ({ children }: { children: ReactNode }) => (
  <div className="relative mx-auto h-[620px] w-full max-w-[390px] overflow-hidden rounded-xl border border-border bg-bg">
    <PageBehind />
    <div aria-hidden="true" className="absolute inset-0 bg-overlay" />
    <div className="absolute inset-x-0 bottom-0 flex max-h-full flex-col">{children}</div>
  </div>
);

const SUMMARY = "m-0 flex flex-col rounded-xl bg-sunken px-4 py-1 text-sm";
const SUMMARY_ROW = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2";

/** «Smenani yopish» oynasining tanasi (maket `manager-payments-close-shift-dialog`). */
const CloseShiftBody = () => {
  const { t } = useTranslation("ui");
  const [comment, setComment] = useState("");
  const rows: Array<[string, string]> = [
    [t("dialogs.demo.shiftCurrent"), t("dialogs.demo.shiftCurrentValue")],
    [t("dialogs.demo.shiftOpenedBy"), t("dialogs.demo.shiftOpenedByValue")],
    [t("dialogs.demo.shiftCash"), formatMoneyLocalized(3785000)],
  ];
  return (
    <>
      <dl className={SUMMARY}>
        {rows.map(([label, value], index) => (
          <div key={label} className={index > 0 ? `${SUMMARY_ROW} border-t border-border` : SUMMARY_ROW}>
            <dt className="text-text-muted">{label}</dt>
            <dd className="m-0 whitespace-nowrap font-semibold text-text">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="note" className="flex items-start gap-3 rounded-xl bg-info-soft px-4 py-3 text-info-fg">
        <Download aria-hidden="true" size={18} className="mt-px shrink-0" />
        <p className="m-0 min-w-0 text-[13px] text-text">{t("dialogs.demo.shiftExcel")}</p>
      </div>
      <Field label={t("dialogs.demo.shiftComment")} optional>
        <TextInput
          multiline
          rows={3}
          value={comment}
          onValueChange={setComment}
          placeholder={t("dialogs.demo.shiftCommentPlaceholder")}
        />
      </Field>
    </>
  );
};

const CloseShiftFooter = ({ onCancel, submit }: { onCancel?: () => void; submit?: boolean }) => {
  const { t } = useTranslation("ui");
  return (
    <>
      <Button variant="secondary" onClick={onCancel}>
        {t("dialog.cancel")}
      </Button>
      <Button type={submit ? "submit" : "button"} leftIcon={Timer}>
        {t("dialogs.demo.shiftAction")}
      </Button>
    </>
  );
};

/** Ob'ekt kartasi: nom + izoh, o'ngda summa (taxta `tizim-feedback` 06 «O'chirish»). */
const ProductCard = () => {
  const { t } = useTranslation("ui");
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold text-text">{t("dialogs.demo.deleteProduct")}</span>
        <span className="text-[13px] text-text-muted">{t("dialogs.demo.deleteMarket")}</span>
      </div>
      <span className="whitespace-nowrap font-semibold text-text">{formatMoneyLocalized(185000)}</span>
    </div>
  );
};

/** Foydalanuvchi kartasi: avatar + ism + rol (taxta «Nofaol qilish», `superadmin-users-delete-dialog`). */
const PersonCard = ({ initials, name, meta }: { initials: string; name: string; meta: string }) => (
  <div className="flex items-center gap-3">
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
    >
      {initials}
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="font-semibold text-text">{name}</span>
      <span className="text-[13px] text-text-muted">{meta}</span>
    </span>
  </div>
);

/** Pastda — haqiqiy modal oynalar (Tab, Esc, fon, fokus qaytishi; `useConfirm` yuklanishi va xatosi). */
const LiveDemo = () => {
  const { t } = useTranslation("ui");
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const askDelete = async (fail: boolean) => {
    const ok = await confirm({
      tone: "danger",
      title: t("dialogs.demo.deleteTitle"),
      description: t("dialogs.demo.deleteDescription"),
      icon: Trash2,
      confirmIcon: Trash2,
      confirmLabel: t("dialogs.demo.deleteAction"),
      loadingLabel: t("dialogs.demo.deleting"),
      details: <ProductCard />,
      irreversible: true,
      onConfirm: () =>
        new Promise<void>((resolve, reject) => {
          window.setTimeout(() => (fail ? reject(new Error("demo")) : resolve()), 1200);
        }),
      errorMessage: () => t("dialogs.demo.failingError"),
    });
    setResult(ok ? t("dialogs.demo.resultConfirmed") : t("dialogs.demo.resultCancelled"));
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 max-md:p-4">
      <div className="flex flex-wrap items-center gap-2 max-md:[&>button]:flex-1">
        <Button variant="secondary" leftIcon={Timer} onClick={() => setDialogOpen(true)}>
          {t("dialogs.demo.openDialog")}
        </Button>
        <Button variant="secondary" leftIcon={Trash2} onClick={() => void askDelete(false)}>
          {t("dialogs.demo.openConfirm")}
        </Button>
        <Button variant="secondary" onClick={() => void askDelete(true)}>
          {t("dialogs.demo.openFailing")}
        </Button>
      </div>
      <p role="status" className="m-0 min-h-5 text-[13px] text-text-muted">
        {result}
      </p>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("dialogs.demo.shiftTitle")}
        description={t("dialogs.demo.shiftDescription")}
        icon={Timer}
        onSubmit={(event) => {
          event.preventDefault();
          setDialogOpen(false);
        }}
        footer={<CloseShiftFooter submit onCancel={() => setDialogOpen(false)} />}
      >
        <CloseShiftBody />
      </Dialog>
    </div>
  );
};

export const DialogSection = () => {
  const { t } = useTranslation("ui");
  const rules: Array<[string, string]> = [
    [t("dialogs.rules.title"), t("dialogs.rules.titleText")],
    [t("dialogs.rules.buttons"), t("dialogs.rules.buttonsText")],
    [t("dialogs.rules.colour"), t("dialogs.rules.colourText")],
    [t("dialogs.rules.closing"), t("dialogs.rules.closingText")],
  ];

  return (
    <KitSection id="dialog" title={t("kit.sections.dialog.title")} description={t("kit.sections.dialog.description")}>
      <ThemePair layout="stack">
        {() => (
          <div className="flex min-w-0 flex-col gap-8">
            <DemoBlock title={t("dialogs.groups.dialog")} note={t("dialogs.groups.dialogMeta")}>
              <DesktopStage>
                <DialogPanel
                  role="group"
                  layout="dialog"
                  title={t("dialogs.demo.shiftTitle")}
                  description={t("dialogs.demo.shiftDescription")}
                  icon={Timer}
                  onCloseClick={() => {}}
                  footer={<CloseShiftFooter />}
                >
                  <CloseShiftBody />
                </DialogPanel>
              </DesktopStage>
            </DemoBlock>

            <DemoBlock title={t("dialogs.groups.sheet")} note={t("dialogs.groups.sheetMeta")}>
              <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
                <PhoneStage>
                  <ConfirmDialogPanel
                    layout="sheet"
                    icon={null}
                    title={t("dialogs.demo.dayTitle")}
                    description={t("dialogs.demo.dayDescription")}
                    confirmLabel={t("dialogs.demo.dayAction")}
                    consequences={[
                      { text: t("dialogs.demo.daySold"), tone: "success" },
                      { text: t("dialogs.demo.dayCancelled"), tone: "danger" },
                      { text: t("dialogs.demo.dayTomorrow"), tone: "warning", icon: CalendarClock },
                    ]}
                  />
                </PhoneStage>
                <PhoneStage>
                  <ConfirmDialogPanel
                    layout="sheet"
                    tone="danger"
                    icon={UserX}
                    title={t("dialogs.demo.offTitle")}
                    description={t("dialogs.demo.offDescription")}
                    confirmLabel={t("dialogs.demo.offAction")}
                    confirmIcon={UserX}
                    details={<PersonCard initials="FS" name={t("dialogs.demo.offName")} meta={t("dialogs.demo.offMeta")} />}
                  />
                </PhoneStage>
              </div>
            </DemoBlock>

            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] gap-x-4 gap-y-8">
              <DemoBlock title={t("dialogs.groups.danger")} note={t("dialogs.groups.dangerMeta")}>
                <DesktopStage>
                  <ConfirmDialogPanel
                    tone="danger"
                    icon={Trash2}
                    title={t("dialogs.demo.deleteTitle")}
                    description={t("dialogs.demo.deleteDescription")}
                    details={<ProductCard />}
                    irreversible
                    confirmLabel={t("dialogs.demo.deleteAction")}
                    confirmIcon={Trash2}
                  />
                </DesktopStage>
              </DemoBlock>
              <DemoBlock title={t("dialogs.groups.money")} note={t("dialogs.groups.moneyMeta")}>
                <DesktopStage>
                  <ConfirmDialogPanel
                    tone="success"
                    icon={ArrowLeftRight}
                    size="md"
                    title={t("dialogs.demo.payTitle")}
                    description={t("dialogs.demo.payDescription")}
                    amount={{ value: 1250000, badge: <Badge>{t("dialogs.demo.payCash")}</Badge> }}
                    transfer={{
                      from: { title: t("dialogs.demo.payFromTitle"), meta: t("dialogs.demo.payFromMeta") },
                      to: { title: t("dialogs.demo.payToTitle"), meta: t("dialogs.demo.payToMeta") },
                    }}
                    rows={[{ label: t("dialogs.demo.payNote"), value: t("dialogs.demo.payNoteValue"), stacked: true }]}
                    confirmLabel={t("dialogs.demo.payAction")}
                    confirmIcon={Check}
                  />
                </DesktopStage>
              </DemoBlock>
              <DemoBlock title={t("dialogs.groups.deactivate")} note={t("dialogs.groups.deactivateMeta")}>
                <DesktopStage>
                  <ConfirmDialogPanel
                    tone="danger"
                    icon={UserX}
                    title={t("dialogs.demo.offTitle")}
                    description={t("dialogs.demo.offDescription")}
                    details={<PersonCard initials="FS" name={t("dialogs.demo.offName")} meta={t("dialogs.demo.offMeta")} />}
                    confirmLabel={t("dialogs.demo.offAction")}
                    confirmIcon={UserX}
                  />
                </DesktopStage>
              </DemoBlock>
              <DemoBlock title={t("dialogs.groups.loading")} note={t("dialogs.groups.loadingMeta")}>
                <DesktopStage>
                  <ConfirmDialogPanel
                    tone="danger"
                    icon={Trash2}
                    title={t("dialogs.demo.deleteTitle")}
                    description={t("dialogs.demo.deleteDescription")}
                    details={<ProductCard />}
                    loading
                    loadingLabel={t("dialogs.demo.deleting")}
                    confirmLabel={t("dialogs.demo.deleteAction")}
                    confirmIcon={Trash2}
                  />
                </DesktopStage>
              </DemoBlock>
              <DemoBlock title={t("dialogs.groups.error")} note={t("dialogs.groups.errorMeta")}>
                <DesktopStage>
                  <ConfirmDialogPanel
                    tone="danger"
                    icon={Trash2}
                    title={t("dialogs.demo.deleteTitle")}
                    description={t("dialogs.demo.deleteDescription")}
                    details={<ProductCard />}
                    error={t("dialogs.demo.failingError")}
                    confirmLabel={t("dialogs.demo.deleteAction")}
                    confirmIcon={Trash2}
                  />
                </DesktopStage>
              </DemoBlock>
            </div>

            <dl className="m-0 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-x-6 gap-y-4 rounded-[14px] border border-border bg-surface p-5 max-md:p-4">
              {rules.map(([term, text]) => (
                <div key={term} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{term}</dt>
                  <dd className="m-0 text-[13px] text-text">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </ThemePair>

      <DemoBlock title={t("dialogs.groups.live")} note={t("dialogs.groups.liveMeta")}>
        <LiveDemo />
      </DemoBlock>
    </KitSection>
  );
};
