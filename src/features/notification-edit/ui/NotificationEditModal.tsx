// dizayn-v2: superadmin-notifications-create-dialog
import { useMemo, useRef, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Pencil, Store } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  GroupTypeChoice,
  useNotificationMarkets,
  type Notification,
} from "../../../entities/notification";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import { useUpdateNotification } from "../api/useUpdateNotification";
import { notificationEditSchema } from "../model/schema";
import type { UpdateNotificationDto } from "../model/types";

interface NotificationEditModalProps {
  open: boolean;
  initialData: Notification | null;
  onClose: () => void;
}

type EditDialogProps = NotificationEditModalProps & { initialData: Notification };

/**
 * Guruh ulanishini tahrirlash (`PATCH /notifications/:id`: market, guruh ID, xabar turi). Maket — jadvaldagi
 * «Tahrirlash» `superadmin-notifications-create-dialog` ga olib boradi; maydonlar shu oyna uslubida
 * (`Field` + `Select` / `TextInput`, xabar turi — radio kartalar).
 */
const EditDialog = ({ open, initialData, onClose }: EditDialogProps) => {
  const { t } = useTranslation("notifications");
  const { options, getName, isLoading: marketsLoading } = useNotificationMarkets(open);
  const updateNotification = useUpdateNotification();
  /** Ochilganda fokus guruh ID maydonida — odatda shu tahrirlanadi (market qidiruvi belgilanib qolmasin). */
  const groupIdRef = useRef<HTMLInputElement | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateNotificationDto>({
    resolver: yupResolver(notificationEditSchema),
    defaultValues: {
      market_id: initialData.market_id,
      group_id: initialData.group_id,
      group_type: initialData.group_type,
    },
  });

  // Joriy market faol marketlar ro'yxatida bo'lmasa ham tanlovda ko'rinsin.
  const marketOptions = useMemo<SelectOption[]>(() => {
    if (!initialData.market_id || options.some((option) => option.value === initialData.market_id)) return options;
    const label = initialData.market_name ?? getName(initialData.market_id) ?? `#${initialData.market_id}`;
    return [{ value: initialData.market_id, label }, ...options];
  }, [getName, initialData.market_id, initialData.market_name, options]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateNotification.mutateAsync({
        id: initialData.id,
        payload: { ...values, group_id: values.group_id.trim() },
      });
      notify.success(t("telegramGroups.editDialog.success"));
      onClose();
    } catch (error) {
      notify.error(t("telegramGroups.editDialog.error"), { description: getApiErrorMessage(error) || undefined });
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={Pencil}
      title={t("telegramGroups.editDialog.title")}
      busy={updateNotification.isPending}
      initialFocus={groupIdRef}
      onSubmit={(event) => void onSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="flex-[1_1_120px]">
            {t("telegramGroups.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={updateNotification.isPending}
            loadingText={t("telegramGroups.editDialog.saving")}
            className="flex-[999_1_200px]"
          >
            {t("telegramGroups.editDialog.submit")}
          </Button>
        </>
      }
    >
      <Controller
        control={control}
        name="market_id"
        render={({ field }) => (
          <Field
            label={t("telegramGroups.create.market")}
            labelAs="span"
            required
            error={errors.market_id?.message ? t(errors.market_id.message) : undefined}
          >
            <Select
              ref={field.ref}
              searchable
              icon={Store}
              options={marketOptions}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              onBlur={field.onBlur}
              placeholder={t("telegramGroups.create.marketPlaceholder")}
              listLabel={t("telegramGroups.create.marketList")}
              loading={marketsLoading}
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="group_id"
        render={({ field }) => (
          <Field
            label={t("telegramGroups.editDialog.groupId")}
            required
            hint={t("telegramGroups.editDialog.groupIdHint")}
            error={errors.group_id?.message ? t(errors.group_id.message) : undefined}
          >
            <TextInput
              ref={(element) => {
                field.ref(element);
                groupIdRef.current = element;
              }}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={t("telegramGroups.editDialog.groupIdPlaceholder")}
              autoComplete="off"
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="group_type"
        render={({ field }) => (
          <Field label={t("telegramGroups.create.type")} labelAs="span" required hint={t("telegramGroups.create.typeHint")}>
            <GroupTypeChoice name="notification-edit-type" value={field.value} onChange={field.onChange} />
          </Field>
        )}
      />
    </Dialog>
  );
};

/** Har ochilishda forma tanlangan qatordan qayta to'ladi; yopilish harakati paytida oxirgi qator ko'rinadi. */
const NotificationEditModal = ({ open, initialData, onClose }: NotificationEditModalProps) => {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  const [shown, setShown] = useState<Notification | null>(initialData);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((value) => value + 1);
  }
  if (initialData && initialData !== shown) setShown(initialData);

  if (!shown) return null;
  return <EditDialog key={session} open={open && Boolean(initialData)} initialData={shown} onClose={onClose} />;
};

export default NotificationEditModal;
