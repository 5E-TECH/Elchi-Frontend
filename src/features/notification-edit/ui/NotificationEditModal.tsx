import { yupResolver } from "@hookform/resolvers/yup";
import { Button, Form, Input, Modal, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Notification } from "../../../entities/notification";
import { useMarkets } from "../../../entities/markets";
import { notificationEditSchema } from "../model/schema";
import { useUpdateNotification } from "../api/useUpdateNotification";
import type { UpdateNotificationDto } from "../model/types";

interface NotificationEditModalProps {
  open: boolean;
  initialData: Notification | null;
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

const NotificationEditModal = ({ open, initialData, onClose }: NotificationEditModalProps) => {
  const { t } = useTranslation("common");
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, open);
  const updateNotification = useUpdateNotification();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateNotificationDto>({
    resolver: yupResolver(notificationEditSchema),
    defaultValues: {
      market_id: "",
      group_id: "",
      group_type: "create",
    },
  });

  useEffect(() => {
    if (open && initialData) {
      reset({
        market_id: initialData.market_id,
        group_id: initialData.group_id,
        group_type: initialData.group_type,
      });
    }

    if (!open) {
      reset({
        market_id: "",
        group_id: "",
        group_type: "create",
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!initialData) return;
    await updateNotification.mutateAsync({ id: initialData.id, payload: values });
    message.success(t("notificationUpdated"));
    onClose();
  });

  return (
    <Modal
      destroyOnHidden
      open={open}
      title={t("editNotification")}
      width={560}
      footer={null}
      onCancel={onClose}
    >
      <Form layout="vertical" onFinish={onSubmit}>
        <Form.Item label={t("market")} validateStatus={errors.market_id ? "error" : ""} help={errors.market_id?.message}>
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
          <Controller control={control} name="group_id" render={({ field }) => <Input {...field} placeholder="-1001234567890" />} />
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

        <Button block type="primary" htmlType="submit" loading={updateNotification.isPending}>
          O'zgarishlarni saqlash
        </Button>
      </Form>
    </Modal>
  );
};

export default NotificationEditModal;
