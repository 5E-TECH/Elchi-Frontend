// dizayn-v2: superadmin-integrations-new-partner-dialog, admin-integrations-new-partner-dialog
import { useState, type FormEvent } from "react";
import { Handshake, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePartnerActions, type CreatePartnerDto } from "../../entities/partners";
import { notify } from "../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../shared/ui/primitives";
import { CopyValue, InlineAlert, SecretInput, TagsInput } from "./ui";

/**
 * YANGI HAMKOR — BeePost yaratish oqimi (maket `*-new-partner-dialog`, telefonda pastki varaqa).
 *
 * Nega alohida oyna (katalog/usta emas): hamkor yaratishdagi YAGONA muhim natija — API kalit. U faqat BIR
 * MARTA ko'rsatiladi (bazada sha256 hash). Shu bois oqim ikki qadamli: (1) forma; (2) kalitni ko'rsatish
 * + nusxa olish. Operator «Kalitni ko'chirib oldim» belgilamaguncha oyna yopilmaydi.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Yaratilgandan keyin ro'yxatni yangilash. */
  onCreated: () => void;
}

type Step = "form" | "reveal";

const isUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const NewPartnerModal = ({ open, onClose, onCreated }: Props) => {
  const { t } = useTranslation("integrations");
  const { createPartner } = usePartnerActions();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [ips, setIps] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [createdName, setCreatedName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secretShown, setSecretShown] = useState("");
  const [copied, setCopied] = useState(false);

  const urlSet = Boolean(webhookUrl.trim());
  const nameError = touched && !name.trim() ? t("npNameReq") : undefined;
  const urlError = touched && urlSet && !isUrl(webhookUrl.trim()) ? t("npWebhookUrlInvalid") : undefined;
  /* Backend: webhook_url bo'lsa secret SHART (aks holda 400). */
  const secretError = touched && urlSet && !webhookSecret.trim() ? t("npWebhookSecretReq") : undefined;

  const reset = () => {
    setStep("form");
    setName("");
    setWebhookUrl("");
    setWebhookSecret("");
    setIps([]);
    setTouched(false);
    setCreatedName("");
    setApiKey("");
    setSecretShown("");
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (!name.trim() || (urlSet && (!isUrl(webhookUrl.trim()) || !webhookSecret.trim()))) return;
    if (createPartner.isPending) return;
    const dto: CreatePartnerDto = {
      name: name.trim(),
      ...(webhookUrl.trim() ? { webhook_url: webhookUrl.trim() } : {}),
      ...(webhookSecret.trim() ? { webhook_secret: webhookSecret.trim() } : {}),
      ...(ips.length ? { ip_allowlist: ips } : {}),
    };
    try {
      const res = await createPartner.mutateAsync(dto);
      if (!res.api_key) {
        notify.error(t("npKeyMissing"));
        return;
      }
      setCreatedName(dto.name);
      setApiKey(res.api_key);
      setSecretShown(dto.webhook_secret ?? "");
      setStep("reveal");
      onCreated();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      notify.error(Array.isArray(msg) ? msg.join("; ") : (msg ?? t("npCreateError")));
    }
  };

  if (step === "reveal") {
    return (
      <Dialog
        open={open}
        /* Kalit ko'chirilmasdan yopilmasin: Esc, fon va × faqat belgidan keyin. */
        onClose={() => (copied ? close() : undefined)}
        closable={copied}
        dismissible={copied}
        closeOnOverlay={false}
        title={t("npKeyRevealTitle")}
        description={t("console.npCreated", { name: createdName })}
        icon={KeyRound}
        iconTone="warning"
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-text-muted max-md:hidden">{copied ? null : t("console.npCloseHint")}</span>
            <Button disabled={!copied} onClick={close}>
              {t("npDone")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <InlineAlert tone="warning" title={t("npKeyRevealWarn")}>
            {t("npKeyRevealWarnDesc")}
          </InlineAlert>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-text">{t("npKeyLabel")}</span>
            <CopyValue value={apiKey} label={t("console.copyShort")} onCopied={() => setCopied(true)} />
          </div>
          {secretShown ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-text">{t("npSecretLabel")}</span>
              <CopyValue value={secretShown} label={t("console.copyShort")} />
              <span className="text-xs text-text-muted">{t("npSecretHint")}</span>
            </div>
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              className="size-[18px] accent-action"
              checked={copied}
              onChange={(e) => setCopied(e.target.checked)}
            />
            {t("npKeyCopiedConfirm")}
          </label>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={createPartner.isPending}
      title={t("npTitle")}
      description={t("console.npSub")}
      icon={Handshake}
      size="lg"
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={createPartner.isPending}>
            {t("npCancel")}
          </Button>
          <Button type="submit" loading={createPartner.isPending}>
            {t("npCreate")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <InlineAlert tone="info" title={t("npIntroTitle")}>
          {t("npIntroDesc")}
        </InlineAlert>
        <Field label={t("npName")} required error={nameError}>
          <TextInput value={name} onValueChange={setName} placeholder="BeePost" maxLength={100} />
        </Field>
        <Field label={t("npWebhookUrl")} hint={t("npWebhookUrlHint")} error={urlError}>
          <TextInput
            type="url"
            inputMode="url"
            value={webhookUrl}
            onValueChange={setWebhookUrl}
            placeholder="https://beepost.uz/api/v1/elchi/webhook"
          />
        </Field>
        <Field
          label={t("npWebhookSecret")}
          required={urlSet}
          hint={urlSet ? `${t("console.npSecretRequiredNow")} ${t("npWebhookSecretHint")}` : t("npWebhookSecretHint")}
          error={secretError}
        >
          <SecretInput value={webhookSecret} onValueChange={setWebhookSecret} placeholder={t("npWebhookSecretPh")} />
        </Field>
        <Field label={t("npIpAllowlist")} hint={t("npIpAllowlistHint")}>
          <TagsInput
            value={ips}
            onChange={setIps}
            placeholder={t("npIpAllowlistPh")}
            listLabel={t("console.ipListLabel")}
            removeLabel={(ip) => t("console.npIpRemove", { ip })}
          />
        </Field>
      </div>
    </Dialog>
  );
};

export default NewPartnerModal;
