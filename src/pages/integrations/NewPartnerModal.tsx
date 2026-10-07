import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Typography,
  message,
} from "antd";
import { KeyRound, Webhook } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePartnerActions, type CreatePartnerDto } from "../../entities/partners";

/**
 * YANGI HAMKOR — BeePost yaratish oqimi (PCS "MarketplaceCreateModal" shakli).
 *
 * Nega alohida modal (katalog/usta emas): hamkor yaratishdagi YAGONA muhim
 * natija — API kalit. U faqat BIR MARTA ko'rsatiladi (bazada sha256 hash).
 * Shu bois oqim ikki qadamli: (1) forma; (2) kalitni ko'rsatish + nusxa olish.
 * Operator kalitni ko'chirmasdan modalni yopa olmaydi.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Yaratilgandan keyin ro'yxatni yangilash. */
  onCreated: () => void;
}

type Step = "form" | "reveal";

interface FormValues {
  name: string;
  webhook_url?: string;
  webhook_secret?: string;
  ip_allowlist?: string[];
}

const NewPartnerModal = ({ open, onClose, onCreated }: Props) => {
  const { t } = useTranslation("integrations");
  const [form] = Form.useForm<FormValues>();
  const { createPartner } = usePartnerActions();

  const [step, setStep] = useState<Step>("form");
  const [apiKey, setApiKey] = useState("");
  const [secretShown, setSecretShown] = useState("");
  const [copied, setCopied] = useState(false);

  const reset = () => {
    form.resetFields();
    setStep("form");
    setApiKey("");
    setSecretShown("");
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    const dto: CreatePartnerDto = {
      name: values.name.trim(),
      ...(values.webhook_url?.trim() ? { webhook_url: values.webhook_url.trim() } : {}),
      ...(values.webhook_secret?.trim() ? { webhook_secret: values.webhook_secret.trim() } : {}),
      ...(values.ip_allowlist?.length ? { ip_allowlist: values.ip_allowlist } : {}),
    };
    try {
      const res = await createPartner.mutateAsync(dto);
      if (!res.api_key) {
        message.error(t("npKeyMissing"));
        return;
      }
      setApiKey(res.api_key);
      setSecretShown(dto.webhook_secret ?? "");
      setStep("reveal");
      onCreated();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join("; ") : (msg ?? t("npCreateError")));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={step === "form" ? close : undefined}
      /* Reveal bosqichida X yo'q — kalit ko'chirilmasdan yopilmasin. */
      closable={step === "form"}
      maskClosable={step === "form"}
      title={step === "form" ? t("npTitle") : t("npKeyRevealTitle")}
      footer={null}
      destroyOnClose
      width={560}
    >
      {step === "form" ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark="optional"
          className="mt-2"
        >
          <Alert
            type="info"
            showIcon
            className="mb-4"
            message={t("npIntroTitle")}
            description={t("npIntroDesc")}
          />

          <Form.Item
            name="name"
            label={t("npName")}
            rules={[{ required: true, message: t("npNameReq") }]}
          >
            <Input placeholder="BeePost" maxLength={100} autoFocus />
          </Form.Item>

          <Form.Item
            name="webhook_url"
            label={
              <span className="flex items-center gap-1.5">
                <Webhook className="h-3.5 w-3.5" />
                {t("npWebhookUrl")}
              </span>
            }
            tooltip={t("npWebhookUrlHint")}
            rules={[{ type: "url", message: t("npWebhookUrlInvalid") }]}
          >
            <Input placeholder="https://beepost.uz/api/v1/elchi/webhook" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.webhook_url !== cur.webhook_url}
          >
            {({ getFieldValue }) => {
              const urlSet = Boolean(getFieldValue("webhook_url")?.trim());
              return (
                <Form.Item
                  name="webhook_secret"
                  label={
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" />
                      {t("npWebhookSecret")}
                    </span>
                  }
                  tooltip={t("npWebhookSecretHint")}
                  /* Backend: webhook_url bo'lsa secret SHART (aks holda 400). */
                  rules={[
                    {
                      required: urlSet,
                      message: t("npWebhookSecretReq"),
                    },
                  ]}
                >
                  <Input.Password
                    placeholder={t("npWebhookSecretPh")}
                    autoComplete="new-password"
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="ip_allowlist"
            label={t("npIpAllowlist")}
            tooltip={t("npIpAllowlistHint")}
          >
            <Select
              mode="tags"
              tokenSeparators={[",", " "]}
              placeholder={t("npIpAllowlistPh")}
              open={false}
              suffixIcon={null}
            />
          </Form.Item>

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={close}>{t("npCancel")}</Button>
            <Button type="primary" htmlType="submit" loading={createPartner.isPending}>
              {t("npCreate")}
            </Button>
          </div>
        </Form>
      ) : (
        <div className="mt-2 space-y-4">
          <Alert
            type="warning"
            showIcon
            message={t("npKeyRevealWarn")}
            description={t("npKeyRevealWarnDesc")}
          />

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <KeyRound className="h-4 w-4" />
              {t("npKeyLabel")}
            </p>
            <Typography.Paragraph
              copyable={{ text: apiKey, onCopy: () => setCopied(true) }}
              className="!mb-0 break-all rounded-lg bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800"
            >
              {apiKey}
            </Typography.Paragraph>
          </div>

          {secretShown && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Webhook className="h-4 w-4" />
                {t("npSecretLabel")}
              </p>
              <Typography.Paragraph
                copyable={{ text: secretShown }}
                className="!mb-0 break-all rounded-lg bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800"
              >
                {secretShown}
              </Typography.Paragraph>
              <p className="mt-1 text-xs text-gray-400">{t("npSecretHint")}</p>
            </div>
          )}

          <Checkbox checked={copied} onChange={(e) => setCopied(e.target.checked)}>
            {t("npKeyCopiedConfirm")}
          </Checkbox>

          <div className="flex justify-end">
            <Button type="primary" disabled={!copied} onClick={close}>
              {t("npDone")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default NewPartnerModal;
