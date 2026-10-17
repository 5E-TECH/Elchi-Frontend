// dizayn-v2: (maket yo'q) superadmin-notifications-create-dialog
import { useEffect, useMemo } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../../entities/markets";
import {
  createTelegramGroupSchema,
  EMPTY_TELEGRAM_GROUP,
  TelegramGroupFormDialog,
  toTelegramMarketOptions,
  type Notification,
  type TelegramGroupFormValues,
} from "../../../entities/notification";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { useUpdateNotification } from "../api/useUpdateNotification";

interface NotificationEditModalProps {
  open: boolean;
  initialData: Notification | null;
  onClose: () => void;
}

/**
 * «Bildirishnomani tahrirlash» — maket yo'q, eng yaqini qo'shish oynasi (ega qarori D6).
 * `PATCH /notifications/:id` `{ market_id, group_id, group_type }` (avvalgidek).
 */
const NotificationEditModal = ({ open, initialData, onClose }: NotificationEditModalProps) => {
  const { t } = useTranslation("notificationGroups");
  const schema = useMemo(() => createTelegramGroupSchema(t), [t]);
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, open);
  const updateNotification = useUpdateNotification();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TelegramGroupFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<TelegramGroupFormValues>,
    defaultValues: EMPTY_TELEGRAM_GROUP,
  });

  useEffect(() => {
    if (open && initialData) {
      reset({
        market_id: initialData.market_id,
        group_id: initialData.group_id,
        group_type: initialData.group_type,
      });
    }
    if (!open) reset(EMPTY_TELEGRAM_GROUP);
  }, [initialData, open, reset]);

  // Faol marketlar ro'yxatida bo'lmasa ham joriy market tanlangan ko'rinsin (nofaol market guruhi).
  const markets = useMemo(() => {
    const list = toTelegramMarketOptions(marketsQuery.data);
    if (initialData?.market_id && !list.some((market) => market.id === initialData.market_id)) {
      list.unshift({ id: initialData.market_id, name: initialData.market_name });
    }
    return list;
  }, [initialData, marketsQuery.data]);

  const onSubmit = handleSubmit(async (values) => {
    if (!initialData) return;
    try {
      await updateNotification.mutateAsync({
        id: initialData.id,
        payload: { ...values, group_id: values.group_id.trim() },
      });
      notify.success(t("form.updated"));
      onClose();
    } catch (error) {
      notify.error(t("form.updateFailed"), {
        description: getBackendErrorMessage(error) ?? undefined,
      });
    }
  });

  return (
    <TelegramGroupFormDialog
      open={open}
      onClose={onClose}
      title={t("form.editTitle")}
      control={control}
      errors={errors}
      onSubmit={onSubmit}
      submitting={updateNotification.isPending}
      markets={markets}
      marketsLoading={marketsQuery.isLoading}
    />
  );
};

export default NotificationEditModal;
