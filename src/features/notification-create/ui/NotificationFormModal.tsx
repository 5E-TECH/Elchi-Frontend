import { yupResolver } from "@hookform/resolvers/yup";
import { Alert, Button, Divider, Form, Input, Modal, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../../entities/markets";
import { useConnectNotificationByToken } from "../../notification-connect/api/useConnectNotificationByToken";
import { notificationSchema } from "../model/schema";
import type { CreateNotificationDto } from "../model/types";
import { useCreateNotification } from "../api/useCreateNotification";

interface NotificationFormModalProps {
  open: boolean;
  onClose: () => void;
}

type MarketOption = {
  id?: string | number;
  name?: string;
  username?: string;
  phone_number?: string;
};

const getMarketItems = (value: unknown): MarketOption[] => {
  if (!value) return [];

  const response = value as Record<string, unknown>;
  const responseData = response?.data as unknown;
  const responseDataRecord =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : null;

  if (Array.isArray(value)) return value as MarketOption[];
  if (Array.isArray(responseData)) return responseData as MarketOption[];
  if (Array.isArray(response?.items)) return response.items as MarketOption[];
  if (Array.isArray(responseDataRecord?.items)) return responseDataRecord.items as MarketOption[];

  return [];
};

const NotificationFormModal = ({ open, onClose }: NotificationFormModalProps) => {
  const { t } = useTranslation("common");
  const [connectToken, setConnectToken] = useState("");
  const notificationBotUsername = import.meta.env.VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME
    ?.replace(/^@/, "")
    .trim();
  const addBotToGroupUrl = notificationBotUsername
    ? `https://t.me/${notificationBotUsername}?startgroup=notification`
    : "";
  const { getMarkets } = useMarkets();
  const marketsQuery = getMarkets({ status: "active", limit: 100 }, open);
  const createNotification = useCreateNotification();
  const connectNotification = useConnectNotificationByToken();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateNotificationDto>({
    resolver: yupResolver(notificationSchema),
    defaultValues: {
      market_id: "",
      group_id: "",
      group_type: "create",
    },
  });

  useEffect(() => {
    if (!open) {
      setConnectToken("");
      reset({
        market_id: "",
        group_id: "",
        group_type: "create",
      });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createNotification.mutateAsync(values);
      message.success(t("notificationCreated"));
      onClose();
      reset();
    } catch {
      message.error("Bildirishnomani yaratishda xatolik bo'ldi");
    }
  });

  const handleConnectByToken = async () => {
    const token = connectToken.trim();

    if (!token) {
      message.warning("Token kiriting");
      return;
    }

    try {
      await connectNotification.mutateAsync({ token });
      message.success("Telegram group ulandi");
      onClose();
      setConnectToken("");
    } catch {
      message.error("Token orqali ulashda xatolik bo'ldi");
    }
  };

  return (
    <Modal
      destroyOnHidden
      open={open}
      title={t("addNotification")}
      width={560}
      footer={null}
      onCancel={onClose}
    >
      <Form layout="vertical" onFinish={onSubmit}>
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="Telegram groupga bildirishnoma ulash"
          description={
            <div className="space-y-1">
              <p>Marketni tanlang, bot qo'shilgan Telegram group ID ni kiriting.</p>
              <p className="text-xs">
                Group ID odatda <span className="font-mono">-100</span> bilan boshlanadi.
              </p>
            </div>
          }
        />

        {addBotToGroupUrl ? (
          <Button
            className="mb-4"
            block
            href={addBotToGroupUrl}
            target="_blank"
            rel="noreferrer"
          >
            Botni Telegram groupga qo'shish
          </Button>
        ) : (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message="Bot username sozlanmagan"
            description="Botni groupga qo'shish tugmasi chiqishi uchun .env faylga VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME qo'shish kerak."
          />
        )}

        <Form.Item
          label={t("market")}
          validateStatus={errors.market_id ? "error" : ""}
          help={errors.market_id?.message}
        >
          <Controller
            control={control}
            name="market_id"
            render={({ field }) => (
              <Select
                {...field}
                showSearch
                loading={marketsQuery.isLoading}
                placeholder={t("selectMarket")}
                optionFilterProp="label"
                options={getMarketItems(marketsQuery.data).map((market) => ({
                  value: String(market.id ?? ""),
                  label: `${market.name ?? `#${market.id}`} ${
                    market.phone_number ? `• ${market.phone_number}` : market.username ? `• ${market.username}` : ""
                  }`,
                }))}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Telegram group ID"
          validateStatus={errors.group_id ? "error" : ""}
          help={errors.group_id?.message}
          extra="Masalan: -1001234567890. Bot shu groupga qo'shilgan bo'lishi kerak."
        >
          <Controller
            control={control}
            name="group_id"
            render={({ field }) => <Input {...field} placeholder="-1001234567890" />}
          />
        </Form.Item>

        <details className="mb-4 rounded-2xl border border-border-soft bg-main-soft p-3 text-sm dark:bg-background-soft">
          <summary className="cursor-pointer font-semibold text-maindark dark:text-primary">
            Group ID ni qanday olish mumkin?
          </summary>
          <div className="mt-3 space-y-2 text-text-muted dark:text-text-muted-dark">
            <p>1. Notification botni Telegram groupga qo'shing.</p>
            <p>2. Groupga oddiy xabar yozing: masalan, <span className="font-mono">test</span>.</p>
            <p>3. Backend yoki bot logidan <span className="font-mono">message.chat.id</span> qiymatini oling.</p>
            <p>
              Group ID odatda <span className="font-mono">-100</span> bilan boshlanadi,
              masalan <span className="font-mono">-1001234567890</span>.
            </p>
            <p className="font-semibold text-maindark dark:text-primary">
              Eng qulay yechim: botga /id komandasi qo'shilsa, group ichida /id yozilganda ID ni o'zi chiqaradi.
            </p>
          </div>
        </details>

        <Form.Item
          label="Qaysi xabar turi"
          validateStatus={errors.group_type ? "error" : ""}
          help={errors.group_type?.message}
          extra="Bitta market uchun create va cancel guruhlarini alohida ulash mumkin."
        >
          <Controller
            control={control}
            name="group_type"
            render={({ field }) => (
              <Select
                {...field}
                options={[
                  { value: "create", label: "Yangi buyurtmalar guruhi" },
                  { value: "cancel", label: "Bekor qilinganlar guruhi" },
                ]}
              />
            )}
          />
        </Form.Item>

        <Button block type="primary" htmlType="submit" loading={createNotification.isPending}>
          Bildirishnomani saqlash
        </Button>
      </Form>

      <Divider plain>Qo'shimcha</Divider>

      <details className="rounded-2xl border border-border-soft bg-main-soft p-3 dark:bg-background-soft">
        <summary className="cursor-pointer text-sm font-semibold text-maindark dark:text-primary">
          Token orqali ulash
        </summary>
        <div className="mt-3 space-y-3">
          <Alert
            type="warning"
            showIcon
            message="Faqat token bo'lsa ishlaydi"
            description="Bot yoki backend ulash tokenini bergan bo'lsa kiriting. Token bo'lmasa yuqoridagi qo'lda qo'shishdan foydalaning."
          />
          <Input
            value={connectToken}
            onChange={(event) => setConnectToken(event.target.value)}
            placeholder="Token"
            onPressEnter={() => void handleConnectByToken()}
          />
          <Button
            block
            loading={connectNotification.isPending}
            onClick={() => void handleConnectByToken()}
          >
            Token orqali ulash
          </Button>
        </div>
      </details>
    </Modal>
  );
};

export default NotificationFormModal;
