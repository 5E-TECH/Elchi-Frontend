// dizayn-v2: superadmin-integrations-carrier-key-dialog, admin-integrations-carrier-key-dialog
import { useId, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Info, KeyRound } from "lucide-react";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import { InlineAlert } from "../ui";
import { carrierDocsUrl, carrierPublicBaseUrl } from "./carrierLinks";
import { useLeaveGuard } from "./carrierHooks";

/**
 * API KALIT — BIR MARTA ko'rsatiladi (maket `*-carrier-key-dialog`): yaratilgandan keyin va kalit yangilangandan
 * keyin. «Kalitni nusxaladim va xavfsiz saqladim» belgilanmaguncha oyna yopilmaydi (Esc, fon, × yo'q) va sahifani
 * yangilash / yopish brauzer tasdig'ini so'raydi, brauzer «Orqaga» bekor qilinadi (`useLeaveGuard`).
 *
 * Kalit faqat shu oynaning prop'ida yashaydi: chaqiruvchi uni o'z holatida ushlaydi va `onClose` da o'chiradi —
 * so'rov keshi, `localStorage`, URL'ga yozilmaydi. Yopilish harakati (200 ms) davomida sarlavha va matnlar oxirgi
 * kalitning ma'lumotidan (nom, tur — kalitning o'zi emas), maydon esa bo'sh: kalit yopilish bilan xotiradan ketadi.
 */
export type CarrierKeyReveal = {
  variant: "created" | "rotated";
  accountName: string;
  courierName?: string | null;
  apiKey: string;
};

/** Yopilish harakati uchun saqlanadigan qism — kalitsiz. */
type RevealMeta = Omit<CarrierKeyReveal, "apiKey"> & { keyLength: number };

const metaOf = (reveal: CarrierKeyReveal): RevealMeta => ({
  variant: reveal.variant,
  accountName: reveal.accountName,
  courierName: reveal.courierName,
  keyLength: reveal.apiKey.length,
});

export const CarrierKeyDialog = ({
  reveal,
  onClose,
  returnFocus,
}: {
  reveal: CarrierKeyReveal | null;
  onClose: () => void;
  /**
   * Yopilgach fokus qayerga. Oyna yaratish / tasdiq oynasi yopilayotganda ochiladi — sukut («ochgan element») o'sha
   * oynaning tugmasi bo'lib qoladi va u DOM'dan olinadi (fokus `<body>` ga tushardi; `PayResultDialog` bilan bir xil).
   */
  returnFocus?: RefObject<HTMLElement | null>;
}) => {
  const { t } = useTranslation("integrations");
  const hintId = useId();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // Har yangi kalitda belgilar qaytadan (oldingi kalit uchun belgilangan «nusxaladim» yangisiga o'tmasin).
  const [shownKey, setShownKey] = useState<string | null>(reveal?.apiKey ?? null);
  const [meta, setMeta] = useState<RevealMeta | null>(reveal ? metaOf(reveal) : null);
  if (reveal && reveal.apiKey !== shownKey) {
    setShownKey(reveal.apiKey);
    setMeta(metaOf(reveal));
    setSaved(false);
    setCopied(false);
  } else if (!reveal && shownKey !== null) {
    setShownKey(null);
  }
  const open = reveal !== null;
  useLeaveGuard(open && !saved);

  const close = () => {
    if (!saved) return;
    onClose();
  };

  const copy = () => {
    if (!reveal) return;
    void copyToClipboard(reveal.apiKey).then((ok) => {
      if (ok) setCopied(true);
      else notify.error(t("console.copyFailed"));
    });
  };

  const shown = reveal ? metaOf(reveal) : meta;
  const created = shown?.variant === "created";

  return (
    <Dialog
      open={open}
      onClose={close}
      closable={false}
      dismissible={saved}
      closeOnOverlay={false}
      returnFocus={returnFocus ?? true}
      title={t(created ? "carrier.key.titleCreated" : "carrier.key.titleRotated")}
      description={
        shown
          ? created
            ? t("carrier.key.descCreated", {
                name: shown.accountName,
                courier: shown.courierName || "—",
              })
            : t("carrier.key.descRotated", { name: shown.accountName })
          : undefined
      }
      icon={KeyRound}
      iconTone="warning"
      iconShape="circle"
      size="lg"
      footer={
        <>
          {/*
            Telefonda o'z qatorida, ostida butun endagi «Yakunlash» (maket `ckm`, varaqa qoidasi); kattada chapda.
            `!` — oyna pastining telefondagi `[&>*]:flex-1` (`flex: 1` = asos 0) qoidasi CSS'da keyin keladi.
          */}
          <span className="self-center text-xs text-text-muted max-md:basis-full! md:mr-auto">
            {t(created ? "carrier.key.closeHintCreated" : "carrier.key.closeHintRotated")}
          </span>
          <Button disabled={!saved} onClick={close}>
            {t("carrier.key.done")}
          </Button>
        </>
      }
    >
      {shown ? (
        <div className="flex flex-col gap-4">
          {created ? (
            <InlineAlert tone="warning" role="alert" title={t("carrier.key.warnTitle")}>
              {t("carrier.key.warnText")}
            </InlineAlert>
          ) : (
            <InlineAlert tone="danger" title={t("carrier.key.rotatedTitle")}>
              {t("carrier.key.rotatedText")}
            </InlineAlert>
          )}
          <Field label={t("carrier.key.label")} readOnly>
            <TextInput
              multiline
              rows={2}
              readOnly
              value={reveal?.apiKey ?? ""}
              spellCheck={false}
              autoComplete="off"
              aria-describedby={hintId}
              className="resize-none break-all font-mono text-[13px] leading-[21px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={hintId} className="text-xs text-text-muted">
                {t("carrier.key.hint", { length: shown.keyLength })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={copied ? Check : Copy}
                onClick={copy}
                disabled={!reveal}
                aria-label={t(copied ? "carrier.key.copiedAria" : "carrier.key.copyAria")}
                className={copied ? "text-success-fg max-md:min-h-11" : "max-md:min-h-11"}
              >
                {t(copied ? "carrier.key.copied" : "carrier.key.copy")}
              </Button>
            </div>
            <span className="sr-only" role="status">
              {copied ? t("carrier.key.copiedStatus") : ""}
            </span>
          </Field>
          {created ? (
            <DeveloperSteps />
          ) : (
            <p className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
              <Info size={16} aria-hidden="true" className="mt-px flex-none" />
              <span>{t("carrier.key.rotatedNote")}</span>
            </p>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong px-3.5 py-3 text-sm text-text">
            <input
              type="checkbox"
              className="size-[18px] accent-action"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
            />
            {t("carrier.key.confirm")}
          </label>
        </div>
      ) : null}
    </Dialog>
  );
};

const Step = ({ n, children }: { n: number; children: ReactNode }) => (
  <li className="flex items-start gap-2.5 text-[13px] leading-[18px] text-text">
    <span className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-action-soft text-xs font-bold text-action-fg">
      {n}
    </span>
    <span className="min-w-0">{children}</span>
  </li>
);

const DeveloperSteps = () => {
  const { t } = useTranslation("integrations");
  const docs = carrierDocsUrl();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3.5">
      <h3 className="text-sm font-semibold text-text">{t("carrier.key.devTitle")}</h3>
      <ol className="flex flex-col gap-2.5">
        <Step n={1}>
          {t("carrier.key.stepBaseUrl")}{" "}
          <span className="font-semibold [overflow-wrap:anywhere]">{carrierPublicBaseUrl()}</span>
        </Step>
        <Step n={2}>
          {t("carrier.key.stepHeader")}{" "}
          <span className="font-semibold">
            X-Api-Key: &lt;{t("carrier.key.stepHeaderValue")}&gt;
          </span>
        </Step>
        <Step n={3}>
          {t("carrier.key.stepPing")} <span className="font-semibold">GET /carrier/ping</span>{" "}
          {t("carrier.key.stepPingTail")}
        </Step>
        <Step n={4}>
          {t("carrier.key.stepDocs")}{" "}
          <a
            href={docs}
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-action-fg underline-offset-2 hover:underline [overflow-wrap:anywhere]"
          >
            {docs.replace(/^https?:\/\//, "")}
          </a>{" "}
          {t("carrier.key.stepDocsTail")}
        </Step>
      </ol>
      <p className="text-xs text-text-muted">{t("carrier.key.devNote")}</p>
    </div>
  );
};
