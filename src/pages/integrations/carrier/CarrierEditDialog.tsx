// dizayn-v2: superadmin-integrations-carrier-edit-dialog, admin-integrations-carrier-edit-dialog
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Pencil } from "lucide-react";
import {
  useCarrierAccountActions,
  type CarrierAccount,
  type UpdateCarrierAccountDto,
} from "../../../entities/integrations/carriers";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import { initialsOf, type CourierInfo } from "./carrierModel";
import { courierSubline, useCourierName } from "./carrierFormat";
import { useOpenCount, useRetained } from "./carrierHooks";
import { IpAllowlistField } from "./IpAllowlistField";
import { checkIpAllowlist, ipAllowlistToText } from "./ipAllowlist";

/**
 * TAHRIRLASH (maket `*-carrier-edit-dialog`): faqat nom va IP ro'yxati (`PATCH admin/carriers/:id`). Kuryer
 * ko'rinadi, lekin o'zgarmaydi (`role="group"`, qulf) — boshqa kuryer kerak bo'lsa yangi akkaunt.
 * Faqat foydalanuvchi o'zgartirgan maydon yuboriladi (ochilgandagi nusxaga nisbatan); IP ro'yxati bo'shatilsa `[]` —
 * cheklov olib tashlanadi.
 *
 * Har ochilishda forma akkauntning joriy qiymatlaridan boshlanadi (`useOpenCount` → `key`; saqlangan akkaunt keshga
 * darhol yoziladi — `useCarrierAccountActions().update`). Ochiq turganda ro'yxat yangilansa (boshqa amalning
 * invalidatsiyasi) kiritilgani yo'qolmaydi; yopilganda o'sha nusxa oxirgi akkaunt bilan so'nadi (`useRetained`).
 */
export const CarrierEditDialog = ({
  account,
  couriers,
  onClose,
}: {
  account: CarrierAccount | null;
  /** Bog'langan kuryerlar (`useLinkedCouriers`) — yopilish paytida ham oxirgi akkauntning kuryeri. */
  couriers: ReadonlyMap<string, CourierInfo>;
  onClose: () => void;
}) => {
  const open = account !== null;
  const shown = useRetained(account);
  const openCount = useOpenCount(open);
  return (
    <EditForm
      key={openCount}
      open={open}
      account={shown}
      info={shown ? couriers.get(shown.courier_user_id) : undefined}
      onClose={onClose}
    />
  );
};

const sameRules = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((rule, i) => rule === b[i]);

const EditForm = ({
  open,
  account,
  info,
  onClose,
}: {
  open: boolean;
  account: CarrierAccount | null;
  info: CourierInfo | undefined;
  onClose: () => void;
}) => {
  const { t } = useTranslation("integrations");
  const { update } = useCarrierAccountActions();
  const courierName = useCourierName();
  /**
   * Forma ochilgan paytdagi qiymatlar — «nima o'zgardi» shu nusxa bilan solishtiriladi, jonli `account` bilan emas:
   * ochiq turganda ro'yxat yangilansa (oldingi saqlashning kechikkan yangilanishi yoki boshqa admin) foydalanuvchi
   * tegmagan maydon formadagi eski qiymat bilan yuborilib, o'sha o'zgarishni jimgina bekor qilmasin.
   */
  const [initial] = useState(() => ({
    name: account?.name ?? "",
    rules: account?.ip_allowlist ?? [],
  }));
  const [name, setName] = useState(initial.name);
  const [ipText, setIpText] = useState(() => ipAllowlistToText(initial.rules));
  const [touched, setTouched] = useState(false);
  const check = useMemo(() => checkIpAllowlist(ipText), [ipText]);

  const nameEmpty = !name.trim();
  const nameError =
    (touched || name !== initial.name) && nameEmpty ? t("carrier.create.nameEmpty") : undefined;
  const canSave = !nameEmpty && check.valid;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (!account || !canSave || update.isPending) return;
    const dto: UpdateCarrierAccountDto = {};
    if (name.trim() !== initial.name) dto.name = name.trim();
    if (!sameRules(check.rules, initial.rules)) dto.ip_allowlist = check.rules;
    if (!Object.keys(dto).length) {
      notify.info(t("setNoChange"));
      onClose();
      return;
    }
    try {
      await update.mutateAsync({ id: account.id, dto });
      notify.success(t("savedOk"));
      onClose();
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("saveFailed"));
    }
  };

  const courier = info?.state === "ready" ? info.courier : null;

  return (
    <Dialog
      open={open && Boolean(account)}
      onClose={onClose}
      busy={update.isPending}
      title={t("carrier.edit.title")}
      description={account ? t("carrier.edit.desc", { name: account.name }) : undefined}
      icon={Pencil}
      size="lg"
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            {t("carrier.cancel")}
          </Button>
          <Button type="submit" disabled={!canSave} loading={update.isPending}>
            {t("carrier.edit.save")}
          </Button>
        </>
      }
    >
      {account ? (
        <div className="flex flex-col gap-4">
          <Field
            label={t("carrier.create.name")}
            required
            hint={t("carrier.create.nameHint")}
            error={nameError}
          >
            <TextInput value={name} onValueChange={setName} maxLength={200} autoComplete="off" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span
              id={`carrier-edit-courier-${account.id}`}
              className="text-[13px] font-semibold text-text"
            >
              {t("carrier.edit.courier")}
            </span>
            <div
              role="group"
              aria-labelledby={`carrier-edit-courier-${account.id}`}
              className="flex min-w-0 items-center gap-3 rounded-[10px] border border-border bg-sunken px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-surface text-xs font-semibold text-text-muted"
              >
                {initialsOf(courierName(account, info))}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-text [overflow-wrap:anywhere]">
                  {courierName(account, info)}
                </span>
                {courier ? (
                  <span className="text-[13px] text-text-muted">{courierSubline(courier)}</span>
                ) : null}
              </span>
              <span className="inline-flex text-text-muted">
                <Lock size={16} aria-hidden="true" />
                <span className="sr-only">{t("carrier.edit.courierLockedSr")}</span>
              </span>
            </div>
            <span className="text-xs text-text-muted">{t("carrier.edit.courierHint")}</span>
          </div>
          <IpAllowlistField
            value={ipText}
            onValueChange={setIpText}
            check={check}
            hint={t("carrier.edit.ipHint")}
          />
        </div>
      ) : null}
    </Dialog>
  );
};
