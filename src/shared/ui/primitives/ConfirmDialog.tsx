import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowRight, CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActionErrorMessage } from "../../lib/actionError";
import { cx } from "../../lib/cx";
import { CURRENCY_LABEL, formatMoneyLocalized, resolveMoneyLanguage } from "../../lib/formatMoney";
import { Button, ButtonIcon, type ButtonVariant, type IconSlot } from "./Button";
import { Dialog, DialogPanel, type DialogLayout, type DialogSize } from "./Dialog";
import { TONE_FG, TONE_SOFT, type Tone } from "./tone";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TASDIQLASH OYNASI — dizayn v2 (taxta `tizim-feedback` 06 «Tasdiqlash oynalari», `tizim-motion` 03;
 *  maketlar `superadmin-users-delete-dialog`, `superadmin-products-delete-dialog`,
 *  `manager-orders-rollback-dialog`, `superadmin-notifications-sms-campaign-confirm-dialog` …)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Qaytarib bo'lmaydigan amal, pul harakati, hisobni o'chirish yoki nofaol qilish — faqat shu oyna
 *  orqali. Oyna amal NIMAGA ta'sir qilishini ko'rsatadi: ob'ekt (`details`), summa (`amount`),
 *  qayerdan → qayerga (`transfer`), qatorlar (`rows`: izoh, narx), oqibatlar ro'yxati (`consequences`).
 *
 *  «Tasdiqlash uchun nomni yozing» yoki belgilash katakchasi maketlarda yo'q (hech bir `*-delete-dialog`
 *  da) — shuning uchun primitivda ham yo'q; kerak bo'lsa `children` orqali.
 *
 *  Matn qoidalari (taxta): sarlavha — «… tasdiqlang» yoki aniq savol («Ishonchingiz komilmi?» emas);
 *  chapda «Bekor qilish», o'ngda ANIQ FE'L («O'chirish», «Tasdiqlash», «Nofaol qilish») — «OK» / «Ha»
 *  yolg'iz emas. Rang (`tone`): `danger` — o'chirish va bloklash; `success` — pul tasdig'i;
 *  `primary` (sukut) — oddiy rozilik.
 *
 *  Xatti-harakat: `role="alertdialog"`; ochilganda fokus XAVFSIZ tugmada («Bekor qilish»); Esc va fon
 *  bosilsa yopiladi; `onConfirm` va'da (Promise) qaytarsa — tugmalar qulflanadi, oyna yopilmaydi,
 *  tugmada yuklanish; xato bo'lsa oyna ochiq qoladi va xato matni oyna ichida (`role="alert"`).
 *
 *  Xato kod bo'yicha (ixtiyoriy, T6 maketlari `superadmin-payments-history-*-errors`): `errorView` xato
 *  qutisining mazmunini, ikonkasini (`WifiOff` — oflayn; berilsa 20 px) va qayta urinish befoydaligini
 *  (`blockConfirm` — tasdiqlash tugmasi o'chadi, `aria-describedby` xato qutisiga, fokus «Orqaga» ga) beradi;
 *  `compactOnError` — xato chiqqanda telefonda oqibatlar ro'yxati yashirinadi va xato qutisi ko'rinadigan
 *  joyga suriladi. Ikkalasi ham berilmasa — avvalgidek.
 */

export type ConfirmTone = "primary" | "success" | "danger";

export type ConfirmRow = {
  label: ReactNode;
  value: ReactNode;
  /**
   * Yorliq ustida, qiymat ostida — uzun matn uchun (pul o'tkazmasidagi «Izoh», taxta `tizim-feedback` 06).
   * Sukut — bir qatorda: yorliq chapda, qiymat o'ngda (`superadmin-notifications-sms-campaign-confirm-dialog`).
   */
  stacked?: boolean;
};

/** Pul o'tkazmasi tomoni: «Kuryer kassasi» + «Jasur Tursunov». */
export type ConfirmParty = {
  title: ReactNode;
  /** Ostidagi izoh (xodim, filial). */
  meta?: ReactNode;
  /** Ustidagi yorliq (sukut «Qayerdan» / «Qayerga»). */
  label?: ReactNode;
};

/** Qayerdan → qayerga (taxta `tizim-feedback` 06 «Pul o'tkazmasi — tekshirish»). */
export type ConfirmTransfer = { from: ConfirmParty; to: ConfirmParty };

export type ConfirmConsequence = {
  text: ReactNode;
  /**
   * Ikkinchi qator (`courier-courier-bulk-confirm-dialog`: «2 tasi belgilanmagan, sukut bo'yicha»).
   * Berilsa — ikonka ton qutisida (36), matn qalin; berilmasa ixcham qator (`tizim-motion` 03).
   */
  hint?: ReactNode;
  /** Ikonka rangi (sukut `neutral`). */
  tone?: Tone;
  /** Sukut — ton bo'yicha (`success` → `CircleCheck`, `danger` → `CircleX`, `warning` → `TriangleAlert`, …). */
  icon?: IconSlot;
};

export type ConfirmAmount = {
  /** Summa (so'm) — `formatMoneyLocalized` bilan, valyuta yonida kichik. */
  value: number | string;
  /** Ustidagi yorliq (sukut «Summa»). */
  label?: ReactNode;
  /** O'ngdagi belgi (masalan to'lov turi `Badge`). */
  badge?: ReactNode;
};

/**
 * Xato qutisining ko'rinishi (`ConfirmContent.errorView`) — xato kodi bo'yicha chaqiruvchi beradi.
 * Quti har doim `role="alert"`, qizil (`danger-soft`), oyna tanasining oxirida.
 */
export type ConfirmErrorView = {
  /** Mazmun: qalin sarlavha, matn va kerak bo'lsa amal (`Button variant="link" size="sm"`). */
  content: ReactNode;
  /** Ikonka (sukut `CircleX` 18); berilsa — 20 px (maket: oflaynda `WifiOff`). */
  icon?: IconSlot;
  /**
   * Quti toni: `danger` (sukut, qizil) yoki `neutral` (kulrang `.el-alert.el-tone-neutral` — xato emas, holat:
   * «To'lov allaqachon tuzatilgan. Ro'yxat yangilandi.», ega qarori 2026-11-03).
   */
  tone?: "danger" | "neutral";
  /**
   * Qayta urinish befoyda (masalan summa chegaradan oshdi): tasdiqlash tugmasi o'chadi va xato qutisiga
   * `aria-describedby` bilan bog'lanadi, fokus bekor tugmasiga («Orqaga») o'tadi. Oyna yopilib qayta ochilguncha.
   */
  blockConfirm?: boolean;
};

/**
 * `errorView` ga beriladigan boshqaruv: `dismiss` — SHU xato qutisini olib tashlaydi (holat o'zgardi, masalan
 * «Smenani ochish» dan keyin smena ochildi — eski «Smena ochilmagan» qolmasin) va fokusni xavfsiz tugmaga
 * («Orqaga») qaytaradi (qutidagi amal tugmasi DOM'dan ketadi). Keyingi xato chiqqan bo'lsa — tegmaydi.
 */
export type ConfirmErrorControls = { dismiss: () => void };

/** Tasdiqlash oynasining mazmuni — `ConfirmDialog` va `useConfirm()` uchun umumiy. */
export type ConfirmContent = {
  title: ReactNode;
  /** Sarlavha ostidagi izoh: nima bo'ladi («Mahsulot katalogdan butunlay o'chiriladi.»). */
  description?: ReactNode;
  /** Tasdiqlash tugmasi — ANIQ FE'L («O'chirish», «Tasdiqlash», «Nofaol qilish»). MAJBURIY. */
  confirmLabel: string;
  /** Bekor tugmasi (sukut «Bekor qilish»; asosiy amal o'zi bekor qilish bo'lsa — «Orqaga»). */
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Sarlavha ikonkasi (sukut — ton bo'yicha); `null` — ikonkasiz. */
  icon?: IconSlot | null;
  /** Ikonka toni (sukut: `danger` → `danger`, qolganlari `neutral`). */
  iconTone?: Tone;
  /** Tasdiqlash tugmasidagi ikonka (masalan `Trash2`, `UserX`; `success` da sukut `Check` yo'q — bering). */
  confirmIcon?: IconSlot;
  /** Yuklanish paytidagi tugma matni («O'chirilmoqda…»). */
  loadingLabel?: string;
  /** Asosiy matn — `details` dan oldin (maket `*-incoming-scan-partial-confirm-dialog`). */
  lead?: ReactNode;
  /** Ob'ekt kartasi (nom, izoh, summa) — `sunken` qutida. */
  details?: ReactNode;
  /** Katta summa (pul o'tkazmasi). */
  amount?: ConfirmAmount;
  /** Qayerdan → qayerga (pul o'tkazmasi): ikki ustun, o'rtada o'q. */
  transfer?: ConfirmTransfer;
  /** Xulosa qatorlari (`dl`): «Kassadagi summa», «Prognoz narx», «Izoh» (`stacked`) … */
  rows?: ReadonlyArray<ConfirmRow>;
  /** Oqibatlar ro'yxati («4 ta sotilgan deb belgilanadi», «1 ta bekor qilinadi»). */
  consequences?: ReadonlyArray<ConfirmConsequence>;
  /** Kulrang eslatma (`Info` ikonka bilan): «Hisobni vaqtincha to'xtatish kerak bo'lsa, nofaol qiling.» */
  note?: ReactNode;
  /** «Bu amalni qaytarib bo'lmaydi.» (qizil, ogohlantirish ikonkasi bilan); matn berilsa — o'sha. */
  irreversible?: boolean | ReactNode;
  /** Qo'shimcha erkin mazmun (masalan izoh maydoni) — boshqa bloklardan keyin. */
  children?: ReactNode;
  /** Kenglik (sukut `sm` — 440). */
  size?: DialogSize;
  /**
   * ARIA rol (sukut `alertdialog` — javob talab qiluvchi tasdiq). `dialog` — faqat eski o'ram
   * (`PopupConfirm`) uchun: v1 da shunday edi, sahifa testlari va e2e selektorlari unga tayanadi.
   */
  role?: "dialog" | "alertdialog";
  /** Sarlavhada «Yopish» tugmasi (sukut yo'q: Esc, fon va «Bekor qilish» yetadi). */
  closable?: boolean;
  /** Xato matni (sukut: backend matni yoki «Amalni bajarib bo'lmadi…»). */
  errorMessage?: (error: unknown) => ReactNode;
  /**
   * Xato kodi bo'yicha ko'rinish (mazmun, ikonka, `blockConfirm`). `null` / `undefined` qaytarsa —
   * `errorMessage` yoki sukut matni. `errorMessage` dan ustun. `controls.dismiss` — qutini keyinroq olib tashlash
   * (`ConfirmErrorControls`).
   */
  errorView?: (error: unknown, controls: ConfirmErrorControls) => ConfirmErrorView | null | undefined;
  /**
   * Xato chiqqanda ixcham (telefon, < 768): oqibatlar ro'yxati yashirinadi (`max-md:hidden`), xato qutisi
   * ko'rinadigan joyga suriladi (`scrollIntoView`, `block: "nearest"`) — xato ekran ostida qolmasin
   * (maket `superadmin-payments-history-reverse-errors`, telefon).
   */
  compactOnError?: boolean;
};

const DEFAULT_ICON: Record<ConfirmTone, IconSlot> = {
  danger: TriangleAlert,
  success: CircleCheck,
  primary: Info,
};

const BUTTON_VARIANT: Record<ConfirmTone, ButtonVariant> = {
  primary: "primary",
  success: "success",
  danger: "danger",
};

const CONSEQUENCE_ICON: Record<Tone, IconSlot> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

/** «OK» / «Ha» yolg'iz — fe'l emas (taxta: «o'ngda aniq fe'l»). */
const VAGUE_LABELS = new Set(["ok", "okay", "ha", "yes", "да", "ок"]);

const OVERLINE = "text-xs font-semibold uppercase tracking-[.05em] text-text-muted";

export type TransferSummaryProps = {
  /** Katta summa (yorliq sukut «Summa»; forma oynasida — «Qaytariladigan to'lov», «Joriy summa»). */
  amount?: ConfirmAmount;
  /** Qayerdan → qayerga: ikki ustun, o'rtada o'q. */
  transfer?: ConfirmTransfer;
  /** Xulosa qatorlari (`dl`). */
  rows?: ReadonlyArray<ConfirmRow>;
  className?: string;
};

/**
 * PUL O'TKAZMASI XULOSASI — tasdiqlash oynasidagi `sunken` blok (summa + belgi, qayerdan → qayerga, qatorlar).
 * Forma oynalari (T6 «To'lovni qaytarish», «Summani tahrirlash» — maket `superadmin-payments-history-*-dialog`)
 * xulosasi tasdiqdagi bilan aynan bir xil bo'lishi uchun alohida eksport. Hech biri berilmasa — hech narsa chizilmaydi.
 */
export const TransferSummary = ({ amount, transfer, rows, className }: TransferSummaryProps) => {
  const { t, i18n } = useTranslation("ui");
  const language = resolveMoneyLanguage(i18n.language);
  if (amount == null && transfer == null && !rows?.length) return null;

  const party = (side: ConfirmParty, fallbackLabel: string) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-text-muted">{side.label ?? fallbackLabel}</span>
      <span className="text-sm font-semibold [overflow-wrap:anywhere] text-text">{side.title}</span>
      {side.meta != null ? <span className="text-[13px] [overflow-wrap:anywhere] text-text-muted">{side.meta}</span> : null}
    </div>
  );

  return (
    <div className={cx("flex min-w-0 flex-col rounded-xl bg-sunken px-4 py-1", className)}>
      {amount ? (
        <div className="flex flex-wrap items-end justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={OVERLINE}>{amount.label ?? t("dialog.amount")}</span>
            <span className="whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text max-md:text-[22px] max-md:leading-[30px]">
              {formatMoneyLocalized(amount.value, { language, withCurrency: false })}
              <span className="sr-only"> </span>
              <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
                {CURRENCY_LABEL[language]}
              </span>
            </span>
          </div>
          {amount.badge ? <div className="shrink-0 pb-1.5">{amount.badge}</div> : null}
        </div>
      ) : null}
      {transfer ? (
        // Ustunlar tepadan tekislanadi: bir tomonda izoh qatori bo'lmasa ham («Asosiy kassa» — filial nomisiz)
        // «Qayerdan» / «Qayerga» va nomlar bir qatorda; teng ustunlarda maketdagi markazlash bilan bir xil. O'q — markazda.
        <div
          className={cx(
            "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 py-3",
            amount && "border-t border-border",
          )}
        >
          {party(transfer.from, t("dialog.from"))}
          <ArrowRight aria-hidden="true" size={18} className="shrink-0 self-center text-text-subtle" />
          {party(transfer.to, t("dialog.to"))}
        </div>
      ) : null}
      {rows?.length ? (
        <dl className={cx("m-0 flex flex-col", (amount || transfer) && "border-t border-border")}>
          {rows.map((row, index) =>
            row.stacked ? (
              <div key={index} className={cx("flex min-w-0 flex-col gap-0.5 py-3", index > 0 && "border-t border-border")}>
                <dt className="text-xs text-text-muted">{row.label}</dt>
                <dd className="m-0 text-[13px] [overflow-wrap:anywhere] text-text">{row.value}</dd>
              </div>
            ) : (
              <div
                key={index}
                className={cx(
                  "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm",
                  index > 0 && "border-t border-border",
                )}
              >
                <dt className="min-w-0 text-text-muted">{row.label}</dt>
                <dd className="m-0 ml-auto text-right font-semibold text-text">{row.value}</dd>
              </div>
            ),
          )}
        </dl>
      ) : null}
    </div>
  );
};

type ConfirmState = {
  pending: boolean;
  error: ConfirmErrorView | null;
  onCancel: () => void;
  onConfirm: () => void;
  /** Mazmun bloklaridan biri (izohsiz oynada `aria-describedby`). */
  detailsId: string;
  /** Xato qutisi (`blockConfirm` da tasdiqlash tugmasining `aria-describedby`). */
  errorId: string;
};

/** Xato → ko'rinish: `errorView` → `errorMessage` → backend matni → «Amalni bajarib bo'lmadi…». */
const resolveConfirmError = (
  caught: unknown,
  content: Pick<ConfirmContent, "errorView" | "errorMessage">,
  fallback: string,
  controls: ConfirmErrorControls,
): ConfirmErrorView => {
  const view = content.errorView?.(caught, controls);
  if (view) return view;
  return {
    content: content.errorMessage ? content.errorMessage(caught) : (getActionErrorMessage(caught, fallback) ?? fallback),
  };
};

/**
 * `cancelRef` va `alertRef` alohida argument: `state` ichida ref bo'lsa React Compiler butun obyektni ref deb
 * biladi (`react-hooks/refs`).
 */
const useConfirmParts = (
  content: ConfirmContent,
  state: ConfirmState,
  cancelRef?: RefObject<HTMLButtonElement | null>,
  alertRef?: RefObject<HTMLDivElement | null>,
) => {
  const { t } = useTranslation("ui");
  const tone = content.tone ?? "primary";

  if (import.meta.env.DEV && VAGUE_LABELS.has(content.confirmLabel.trim().toLowerCase())) {
    console.error(`ConfirmDialog: «${content.confirmLabel}» — aniq fe'l yozing («O'chirish», «Tasdiqlash»).`);
  }

  const irreversible =
    content.irreversible === true ? t("dialog.irreversible") : content.irreversible ? content.irreversible : null;
  const { error } = state;
  const blocked = Boolean(error?.blockConfirm) && !state.pending;

  const body = (
    <>
      {content.lead != null ? <p className="m-0 text-sm text-text">{content.lead}</p> : null}

      {content.details != null ? (
        <div id={state.detailsId} className="min-w-0 rounded-xl bg-sunken px-4 py-3 text-sm text-text">
          {content.details}
        </div>
      ) : null}

      <TransferSummary amount={content.amount} transfer={content.transfer} rows={content.rows} />

      {content.consequences?.length ? (
        <ul
          className={cx(
            "m-0 flex list-none flex-col rounded-xl bg-sunken p-0",
            content.compactOnError && error && "max-md:hidden",
          )}
        >
          {content.consequences.map((item, index) => {
            const itemTone = item.tone ?? "neutral";
            const icon = item.icon ?? CONSEQUENCE_ICON[itemTone];
            const divider = index > 0 && "border-t border-border";
            if (item.hint != null) {
              // Batafsil qator: ton qutisidagi ikonka (`.el-stat-icon`) + qalin matn + izoh.
              return (
                <li key={index} className={cx("flex items-center gap-3 px-4 py-3", divider)}>
                  <span
                    aria-hidden="true"
                    className={cx(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                      itemTone === "neutral" ? "bg-surface text-text-muted" : TONE_SOFT[itemTone],
                    )}
                  >
                    <ButtonIcon icon={icon} px={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-text">{item.text}</span>
                    <span className="text-[13px] text-text-muted">{item.hint}</span>
                  </span>
                </li>
              );
            }
            return (
              <li
                key={index}
                className={cx("flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-text", divider)}
              >
                <ButtonIcon icon={icon} px={18} className={TONE_FG[itemTone]} />
                <span className="min-w-0">{item.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {content.note != null ? (
        <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
          <ButtonIcon icon={Info} px={16} className="mt-0.5" />
          <span className="min-w-0">{content.note}</span>
        </p>
      ) : null}

      {content.children}

      {irreversible ? (
        <p className="m-0 flex items-start gap-2 text-[13px] font-semibold text-danger-fg">
          <ButtonIcon icon={TriangleAlert} px={16} className="mt-0.5" />
          <span className="min-w-0">{irreversible}</span>
        </p>
      ) : null}

      {error ? (
        <div
          ref={alertRef}
          id={state.errorId}
          role="alert"
          data-tone={error.tone ?? "danger"}
          className={cx(
            "flex items-start gap-3 rounded-xl px-4 py-3 text-sm",
            error.tone === "neutral" ? "bg-sunken text-text-muted ring-1 ring-border ring-inset" : "bg-danger-soft text-danger-fg",
          )}
        >
          {error.icon != null ? (
            <ButtonIcon icon={error.icon} px={20} />
          ) : (
            <ButtonIcon icon={CircleX} px={18} className="mt-px" />
          )}
          <div className="min-w-0 text-text">{error.content}</div>
        </div>
      ) : null}
    </>
  );

  const footer = (
    <>
      <Button ref={cancelRef} variant="secondary" disabled={state.pending} onClick={state.onCancel}>
        {content.cancelLabel ?? t("dialog.cancel")}
      </Button>
      <Button
        variant={BUTTON_VARIANT[tone]}
        leftIcon={content.confirmIcon}
        loading={state.pending}
        loadingText={content.loadingLabel}
        disabled={blocked}
        aria-describedby={blocked ? state.errorId : undefined}
        onClick={state.onConfirm}
      >
        {content.confirmLabel}
      </Button>
    </>
  );

  const icon = content.icon === null ? undefined : (content.icon ?? DEFAULT_ICON[tone]);
  const iconTone = content.iconTone ?? (tone === "danger" ? "danger" : "neutral");
  return { body, footer, icon, iconTone, blocked, size: content.size ?? "sm" };
};

export type ConfirmDialogProps = ConfirmContent & {
  open: boolean;
  /** «Bekor qilish», Esc, fon yoki «Yopish». So'rov ketayotganda chaqirilmaydi. */
  onCancel: () => void;
  /**
   * Tasdiqlandi. Va'da (Promise) qaytarsa — tugayguncha yuklanish va qulf; rad etilsa xato oynada
   * ko'rsatiladi va oyna ochiq qoladi. Oynani yopish — chaqiruvchida (`open=false`).
   */
  onConfirm: () => unknown;
  /** Tashqi yuklanish (mutatsiya `isPending`) — ichki holat bilan birga. */
  loading?: boolean;
  /** Tashqi xato matni. */
  error?: ReactNode;
  onExited?: () => void;
};

/**
 * Dizayn v2 tasdiqlash oynasi (boshqariladigan). Ko'p hollarda `useConfirm()` qulayroq:
 *
 *   <ConfirmDialog
 *     open={Boolean(target)}
 *     tone="danger"
 *     title={t("users.deleteTitle")}
 *     description={t("users.deleteMessage", { name: target.name })}
 *     icon={Trash2}
 *     confirmIcon={Trash2}
 *     confirmLabel={t("common.delete")}
 *     details={<UserSummary user={target} />}
 *     irreversible
 *     onCancel={() => setTarget(null)}
 *     onConfirm={async () => { await deleteUser.mutateAsync(target.id); setTarget(null); }}
 *   />
 */
export const ConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
  loading = false,
  error: externalError,
  onExited,
  closable = false,
  errorMessage,
  errorView,
  ...content
}: ConfirmDialogProps) => {
  const { t } = useTranslation("ui");
  const detailsId = useId();
  const errorId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [caughtError, setError] = useState<ConfirmErrorView | null>(null);
  // `errorView` ning `dismiss` i olib tashlagan quti (faqat o'sha — keyingi xato ko'rinadi).
  const [dismissed, setDismissed] = useState<ConfirmErrorView | null>(null);
  const wasDismissed = caughtError !== null && caughtError === dismissed;
  const error = wasDismissed ? null : caughtError;
  // Qayta ochilganda eski xato ko'rinmasin (holat render paytida tozalanadi — effektsiz).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setDismissed(null);
      setPending(false);
    }
  }

  const busy = loading || pending;
  const toView = (caught: unknown) => {
    const controls: ConfirmErrorControls = { dismiss: () => setDismissed(view) };
    const view = resolveConfirmError(caught, { errorView, errorMessage }, t("dialog.error"), controls);
    return view;
  };

  const handleConfirm = () => {
    if (busy || error?.blockConfirm) return;
    setError(null);
    let result: unknown;
    try {
      result = onConfirm();
    } catch (caught) {
      setError(toView(caught));
      return;
    }
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      setPending(true);
      (result as PromiseLike<unknown>).then(
        () => setPending(false),
        (caught: unknown) => {
          setPending(false);
          setError(toView(caught));
        },
      );
    }
  };

  // Tashqi xato (`error` prop) ichkisidan ustun — avvalgidek (`externalError ?? error`, bo'sh qiymat — qutisiz).
  const shownError: ConfirmErrorView | null =
    externalError == null ? error : externalError ? { content: externalError } : null;

  const parts = useConfirmParts(
    { ...content, closable, errorMessage, errorView },
    {
      pending: busy,
      error: shownError,
      onCancel: () => {
        if (!busy) onCancel();
      },
      onConfirm: handleConfirm,
      detailsId,
      errorId,
    },
    cancelRef,
    alertRef,
  );

  // Qayta urinish befoyda (`blockConfirm`): o'chgan tugmadan fokus yo'qolmasin — «Orqaga» ga.
  const { blocked } = parts;
  useEffect(() => {
    if (blocked) cancelRef.current?.focus();
  }, [blocked]);

  // `dismiss`: qutidagi amal tugmasi (fokus o'sha yerda yoki uning ustidagi oynadan qaytadi) DOM'dan ketdi — «Orqaga» ga.
  // Effekt boshqa oynalar fokus qamog'i tozalangandan keyin ishlaydi (React avval barcha tozalashlarni bajaradi).
  useEffect(() => {
    if (wasDismissed) cancelRef.current?.focus();
  }, [wasDismissed]);

  // `compactOnError`: xato qutisi ko'rinadigan joyga (telefonda oqibatlar yashiringach ham pastda qolishi mumkin).
  const compactOnError = Boolean(content.compactOnError);
  const hasError = shownError != null;
  useEffect(() => {
    if (!compactOnError || !hasError) return;
    alertRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [compactOnError, hasError, error, externalError]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      onExited={onExited}
      role={content.role ?? "alertdialog"}
      title={content.title}
      description={content.description}
      aria-describedby={content.description == null && content.details != null ? detailsId : undefined}
      icon={parts.icon}
      iconTone={parts.iconTone}
      iconShape="circle"
      size={parts.size}
      closable={closable}
      busy={busy}
      initialFocus={cancelRef}
      footer={parts.footer}
    >
      {parts.body}
    </Dialog>
  );
};

export type ConfirmDialogPanelProps = ConfirmContent & {
  layout?: DialogLayout;
  /** Namuna holati: tugmada yuklanish. */
  loading?: boolean;
  /**
   * Namuna holati: xato. `errorView` berilsa — u shu qiymatdan ko'rinish quradi (masalan xato kodi), aks holda
   * matn sifatida chiziladi.
   */
  error?: ReactNode;
  className?: string;
};

/**
 * Tasdiqlash oynasi paneli joyida (portal va fonsiz) — namuna sahifasi (`/ops/ui-kit?section=dialog`) uchun.
 * Ilovada `ConfirmDialog` yoki `useConfirm()` ishlating.
 */
export const ConfirmDialogPanel = ({
  layout = "dialog",
  loading = false,
  error = null,
  className,
  closable = false,
  ...content
}: ConfirmDialogPanelProps) => {
  const detailsId = useId();
  const errorId = useId();
  const shownError: ConfirmErrorView | null = error
    ? (content.errorView?.(error, { dismiss: () => {} }) ?? { content: error })
    : null;
  const parts = useConfirmParts(content, {
    pending: loading,
    error: shownError,
    onCancel: () => {},
    onConfirm: () => {},
    detailsId,
    errorId,
  });
  return (
    <DialogPanel
      role="group"
      layout={layout}
      title={content.title}
      description={content.description}
      icon={parts.icon}
      iconTone={parts.iconTone}
      iconShape="circle"
      size={parts.size}
      onCloseClick={closable ? () => {} : undefined}
      footer={parts.footer}
      className={className}
    >
      {parts.body}
    </DialogPanel>
  );
};
