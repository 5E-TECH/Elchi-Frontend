// dizayn-v2: superadmin-notifications-create-dialog
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
  type TelegramGroupFormValues,
} from "../../../entities/notification";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { useCreateNotification } from "../api/useCreateNotification";

interface NotificationFormModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * «Bildirishnoma qo'shish» — marketning Telegram guruhini ulash (`POST /notifications`
 * `{ market_id, group_id, group_type }`). Ko'rinish — `TelegramGroupFormDialog` (maket
 * `superadmin-notifications-create-dialog`).
 *
 * fix3b CODE-02: «Token orqali ulash» bo'limi yo'q. U `POST /notifications/connect-by-token` ga `{ token }`
 * yuborardi, backend esa `{ text, group_id }` talab qiladi — har doim 400. Guruh ikki yo'l bilan ulanadi:
 * market guruhga botni qo'shib maxfiy tokenni yuboradi (token market sahifasida) yoki admin shu oyna orqali
 * (market + guruh ID) ulaydi.
 */
const NotificationFormModal = ({ open, onClose }: NotificationFormModalProps) => {
  const { t } = useTranslation("notificationGroups");
  const schema = useMemo(() => createTelegramGroupSchema(t), [t]);
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, open);
  const markets = useMemo(() => toTelegramMarketOptions(marketsQuery.data), [marketsQuery.data]);
  const createNotification = useCreateNotification();
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
    if (!open) reset(EMPTY_TELEGRAM_GROUP);
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createNotification.mutateAsync({ ...values, group_id: values.group_id.trim() });
      notify.success(t("form.created"));
      onClose();
      reset(EMPTY_TELEGRAM_GROUP);
    } catch (error) {
      notify.error(t("form.createFailed"), {
        description: getBackendErrorMessage(error) ?? undefined,
      });
    }
  });

  return (
    <TelegramGroupFormDialog
      open={open}
      onClose={onClose}
      title={t("form.createTitle")}
      showConnectHint
      control={control}
      errors={errors}
      onSubmit={onSubmit}
      submitting={createNotification.isPending}
      markets={markets}
      marketsLoading={marketsQuery.isLoading}
    />
  );
};

export default NotificationFormModal;
