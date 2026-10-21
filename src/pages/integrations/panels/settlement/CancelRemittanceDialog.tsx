// dizayn-v2: superadmin-integrations-settlement-cancel-dialog, admin-integrations-settlement-cancel-dialog
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CircleX, Clock, Info, RotateCcw, Wallet, type LucideIcon } from "lucide-react";
import {
  remittanceAdvanceContribution,
  useCancelRemittance,
  type CancelBlock,
  type Remittance,
} from "../../../../entities/integrations/settlement";
import { refreshCashboxQueries } from "../../../../entities/payments";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { InlineAlert } from "../../ui";

/**
 * «TO'LOVNI BEKOR QILISH» (maket `{superadmin,admin}-integrations-settlement-cancel-dialog`, DxdZFdIk).
 *
 * Bekor qilish — o'chirish emas: backend to'lovni `cancelled` qiladi, u yopgan qarzlarni qayta «Kutilmoqda» ga
 * qaytaradi va kassaga yozilgan bo'lsa Asosiy kassadan teskari chiqim yozadi (hammasi bitta tranzaksiyada). Oyna
 * oqibatlarni oldindan aytadi va «Sabab *» (≤ 500, jurnalga) so'raydi.
 *
 * Holatlar (maket «Boshqa holatlar»):
 *   - eski yozuv (`cashbox_posted = null`) — «Bu to'lov asosiy kassaga kirim qilinganmi?» majburiy tanlov →
 *     `reverse_cashbox` (aks holda backend 409). Tanlov ro'yxatda saqlanmaydi (backend kartasi BD2-10) — shuning uchun
 *     maketdagi «Tanlov saqlanadi …» jumlasi chizilmaydi, ro'yxatda «Kassa: eski yozuv» qoladi;
 *   - kassaga yozilmagan (`false`) — «kassa o'zgarmaydi»;
 *   - «Hozir bekor qilib bo'lmaydi» — avans keyingi to'lovda ishlatilgan: frontda oldindan (`cancelBlock`), 409 —
 *     zaxira. Bu holda «To'lovni bekor qilish» o'chiq;
 *   - kassa xatosi (502 / finance rad etdi) — «Kassadan chiqim yozib bo'lmadi», hech narsa o'zgarmadi, oyna ochiq;
 *   - muvaffaqiyat — oyna yopiladi, xabar «To'lov bekor qilindi · N ta qarz qayta ochildi · kassadan … qaytarildi»;
 *     backend idempotent (`idempotent: true` — allaqachon bekor qilingan) — ma'lumot xabari.
 * 409 / 502 matnlari backendda faqat o'zbekcha — hech biri ko'rsatilmaydi, faqat i18n matn.
 *
 * `ConfirmDialog` emas, `Dialog` (`alertdialog`): bloklangan holatda tasdiqlash tugmasi o'chiq bo'lishi kerak —
 * `ConfirmDialog` da bunday prop yo'q (shared primitivni bu PR o'zgartirmaydi). Ko'rinish — `ConfirmDialog` dagidek.
 */

const REASON_MAX = 500;
const CASHBOX_PATH = "/payments/main-cashbox";
/** Summa raqam o'rtasida bo'linmasin («1» / «150 000 so'm» emas) — maketda har summa `nowrap`. */
const STRONG = <strong className="whitespace-nowrap font-semibold" />;
const INLINE_LINK = "text-action-fg underline underline-offset-2 hover:text-action-hover";

type ServerError = "blocked" | "cashbox" | "failed";

const Consequence = ({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) => (
  <li className="flex items-start gap-2.5 text-[13px] leading-[18px] text-text">
    <Icon size={16} aria-hidden="true" className="mt-px flex-none text-text-muted" />
    <span className="min-w-0">{children}</span>
  </li>
);

const CancelRemittanceDialog = ({
  open,
  remittance,
  integrationId,
  connectionName,
  block,
  returnFocus,
  onCancelled,
  onClose,
}: {
  open: boolean;
  /** Mazmun yopilish animatsiyasida ham qoladi — ko'rinish `open` bilan. */
  remittance: Remittance | null;
  integrationId: string;
  connectionName: string;
  /** Oldindan aniqlangan «Hozir bekor qilib bo'lmaydi» (avans ishlatilgan); `null` — to'siq ma'lum emas. */
  block: CancelBlock | null;
  returnFocus?: RefObject<HTMLElement | null>;
  /** To'lov bekor qilindi (oyna yopilishidan oldin) — «Bekor qilish» tugmasi ro'yxatdan yo'qoladi, fokus boshqa joyga. */
  onCancelled?: () => void;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const client = useQueryClient();
  const cancel = useCancelRemittance();
  const backRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState("");
  const [legacy, setLegacy] = useState<"yes" | "no" | null>(null);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  /** Bir tikda ikki marta yuborishdan himoya (`cancel.isPending` keyingi renderdagina yangilanadi). */
  const inFlight = useRef(false);

  // 409 dan keyin forma o'rniga ogohlantirish chiqadi va fokusdagi tugma o'chadi — fokus <body> ga tushmasin.
  useEffect(() => {
    if (open && serverError === "blocked") backRef.current?.focus();
  }, [open, serverError]);

  // Qayta ochilganda eski qiymat va xato ko'rinmasin (render paytida — effektsiz).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setLegacy(null);
      setTouched(false);
      setServerError(null);
    }
  }

  if (!remittance) return null;
  const r = remittance;
  const isLegacy = r.cashboxPosted === null;
  const willReverse = r.cashboxPosted === true || (isLegacy && legacy === "yes");
  const blocked = Boolean(block) || serverError === "blocked";
  const contribution = remittanceAdvanceContribution(r);
  const trimmed = reason.trim();
  const reasonError = !touched
    ? undefined
    : !trimmed
      ? t("remittances.dialog.reasonRequired")
      : trimmed.length > REASON_MAX
        ? t("remittances.dialog.reasonTooLong")
        : undefined;
  const legacyError = touched && isLegacy && legacy === null ? t("remittances.dialog.legacyRequired") : undefined;

  const close = () => {
    if (cancel.isPending) return;
    onClose();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (blocked || cancel.isPending || inFlight.current) return;
    setTouched(true);
    if (!trimmed || trimmed.length > REASON_MAX || (isLegacy && legacy === null)) return;
    setServerError(null);
    inFlight.current = true;
    try {
      const result = await cancel.mutateAsync({
        integrationId,
        remittanceId: r.id,
        reason: trimmed,
        reverseCashbox: isLegacy ? legacy === "yes" : undefined,
      });
      void refreshCashboxQueries(client);
      onCancelled?.();
      onClose();
      if (result.idempotent) {
        notify.info(t("remittances.dialog.already"), { description: t("remittances.dialog.alreadyDesc") });
        return;
      }
      const parts = [
        result.reopenedCount > 0 ? t("remittances.dialog.doneReopened", { count: result.reopenedCount }) : null,
        result.cashboxReversed
          ? t("remittances.dialog.doneReversed", { amount: money(result.amount || r.amount) })
          : t("remittances.dialog.doneUnchanged"),
      ].filter(Boolean);
      const description = parts.join(" · ");
      // «kassa o'zgarmadi» qism birinchi kelganda ham gap bosh harfdan boshlansin.
      notify.success(t("remittances.dialog.done"), {
        description: description.charAt(0).toLocaleUpperCase(language) + description.slice(1),
      });
    } catch (error) {
      // Xom backend matni (409 / 502 — faqat o'zbekcha) ko'rsatilmaydi — holat kodi bo'yicha i18n matn.
      const status = getErrorStatus(error);
      // Natija noma'lum (tarmoq uzildi / 5xx): bekor qilish o'tgan bo'lishi mumkin — kassa keshi ham yangilansin.
      if (status === undefined || status >= 500) void refreshCashboxQueries(client);
      if (status === 409) {
        setServerError("blocked");
      } else if (status === 404) {
        onClose();
        notify.error(t("remittances.dialog.notFound"), { description: t("remittances.dialog.notFoundDesc") });
      } else if (willReverse && status !== undefined && (status === 502 || (status >= 400 && status < 500 && status !== 401 && status !== 403))) {
        setServerError("cashbox");
      } else {
        setServerError("failed");
      }
    } finally {
      inFlight.current = false;
    }
  };

  const blockedDesc = block
    ? block.consumers.length
      ? t("remittances.dialog.blockedDesc", {
          amount: money(block.used),
          ids: block.consumers.map((id) => t("remittances.number", { id })).join(", "),
        })
      : t("remittances.dialog.blockedDescNoIds", { amount: money(block.used) })
    : t("remittances.dialog.blockedDescServer");

  const keepCashbox =
    r.cashboxPosted === true
      ? t("remittances.cashReversed")
      : r.cashboxPosted === false
        ? t("remittances.cashUnchanged")
        : t("remittances.cashLegacy");

  return (
    <Dialog
      open={open}
      onClose={close}
      role="alertdialog"
      busy={cancel.isPending}
      title={t("remittances.dialog.title")}
      description={t("remittances.dialog.subtitle", {
        id: r.id,
        // Summa bo'linmasin (maket `cc-desc` dagi `nowrap`).
        amount: money(r.amount).replace(/ /g, "\u00a0"),
        date: r.createdAt ? formatDateTimeLocalized(r.createdAt, { language }) : "—",
      })}
      icon={CircleX}
      iconTone="danger"
      iconShape="circle"
      size="md"
      initialFocus={backRef}
      returnFocus={returnFocus ?? true}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button ref={backRef} variant="secondary" onClick={close} disabled={cancel.isPending}>
            {t("remittances.dialog.back")}
          </Button>
          <Button type="submit" variant="danger" loading={cancel.isPending} disabled={blocked}>
            {t("remittances.dialog.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {blocked ? (
          <InlineAlert tone="danger" title={t("remittances.dialog.blockedTitle")}>
            {blockedDesc}
          </InlineAlert>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col gap-2.5 rounded-xl bg-sunken px-3.5 py-3" data-testid="cancel-consequences">
              {r.settledCount > 0 ? (
                <Consequence icon={Clock}>
                  <Trans
                    t={t}
                    i18nKey={r.settledAmount !== null ? "remittances.dialog.reopen" : "remittances.dialog.reopenNoAmount"}
                    count={r.settledCount}
                    values={{ name: connectionName, amount: money(r.settledAmount ?? 0) }}
                    components={{ strong: STRONG }}
                  />
                </Consequence>
              ) : null}
              {r.cashboxPosted === true ? (
                <Consequence icon={Wallet}>
                  <Trans t={t} i18nKey="remittances.dialog.reverse" values={{ amount: money(r.amount) }} components={{ strong: STRONG }} />
                </Consequence>
              ) : r.cashboxPosted === false ? (
                <Consequence icon={Wallet}>
                  <Trans t={t} i18nKey="remittances.dialog.notPosted" components={{ strong: STRONG }} />
                </Consequence>
              ) : null}
              {contribution > 0 ? (
                <Consequence icon={RotateCcw}>
                  <Trans t={t} i18nKey="remittances.dialog.advance" values={{ amount: money(contribution) }} components={{ strong: STRONG }} />
                </Consequence>
              ) : null}
              <Consequence icon={Info}>{t("remittances.dialog.keep", { cashbox: keepCashbox })}</Consequence>
            </ul>

            {isLegacy ? (
              <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-sm font-semibold text-text">
                  {t("remittances.dialog.legacyLegend")} <span className="text-danger-fg" aria-hidden="true">*</span>
                </legend>
                {(
                  [
                    ["yes", t("remittances.dialog.legacyYes", { amount: money(r.amount) }), t("remittances.dialog.legacyYesHint")],
                    ["no", t("remittances.dialog.legacyNo"), t("remittances.dialog.legacyNoHint")],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 has-[:checked]:border-action has-[:checked]:bg-action-soft"
                  >
                    <input
                      type="radio"
                      name="cancel-reverse-cashbox"
                      value={value}
                      checked={legacy === value}
                      onChange={() => setLegacy(value)}
                      className="mt-0.5 size-[18px] flex-none accent-action"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] font-semibold text-text">{label}</span>
                      <span className="text-xs text-text-muted">{hint}</span>
                    </span>
                  </label>
                ))}
                <span className="text-xs text-text-muted">
                  <Trans
                    t={t}
                    i18nKey="remittances.dialog.legacyHint"
                    components={{ cashbox: <Link to={CASHBOX_PATH} className={INLINE_LINK} /> }}
                  />
                </span>
                {legacyError ? (
                  <span role="alert" className="text-xs font-medium text-danger-fg">
                    {legacyError}
                  </span>
                ) : null}
              </fieldset>
            ) : null}

            <Field label={t("remittances.dialog.reason")} required error={reasonError} hint={t("remittances.dialog.reasonHint")}>
              <TextInput
                multiline
                rows={2}
                value={reason}
                onValueChange={(value) => {
                  setReason(value);
                  if (serverError === "failed" || serverError === "cashbox") setServerError(null);
                }}
              />
            </Field>

            {serverError === "cashbox" ? (
              <InlineAlert tone="danger" title={t("remittances.dialog.cashboxErrorTitle")}>
                {/* Finance rad etishi (kassada pul yetmaydi, smena yopiq) qayta bosish bilan tuzalmaydi — Asosiy kassaga yo'l. */}
                <Trans
                  t={t}
                  i18nKey="remittances.dialog.cashboxErrorDesc"
                  components={{ cashbox: <Link to={CASHBOX_PATH} className={INLINE_LINK} /> }}
                />
              </InlineAlert>
            ) : serverError === "failed" ? (
              <InlineAlert tone="danger" title={t("remittances.dialog.failedTitle")}>
                {t("remittances.dialog.failedDesc")}
              </InlineAlert>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
};

export default CancelRemittanceDialog;
