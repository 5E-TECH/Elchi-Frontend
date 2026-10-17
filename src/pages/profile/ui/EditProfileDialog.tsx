// dizayn-v2: (maket yo'q) common-profile-password-dialog
import { useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UpdateUserRequest, User } from "../../../entities/user/types/user";
import { useUser } from "../../../entities/user/api/userApi";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { getUzbekistanPhoneDigits, UZBEKISTAN_PHONE_PREFIX } from "../../../shared/lib/phone";
import {
  extractBackendFieldErrors,
  normalizeBackendFieldMessage,
} from "../../../features/user/lib/backendFieldErrors";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";

type EditProfileDialogProps = {
  open: boolean;
  onClose: () => void;
  user: User;
};

type Errors = { name?: string; phone?: string };

/** Backend maydon nomi → forma maydoni (eski `UpdateUserModal` `SERVER_FIELD_NAME_MAP` dan, faqat shu ikkisi). */
const SERVER_FIELD: Record<string, keyof Errors> = {
  name: "name",
  full_name: "name",
  phone: "phone",
  phone_number: "phone",
};

/** Mahalliy 9 raqam (`+998` siz) — `TextInput mode="phone"` qiymati `+998…` ko'rinishida. */
const localDigits = (value: string | null | undefined) => getUzbekistanPhoneDigits(value ?? "");

/**
 * «PROFILNI TAHRIRLASH» — maket yo'q, eng yaqini `common-profile-password-dialog` (spec D7: alohida oyna,
 * Ism + Telefon; parol — o'z oynasida). Payload eski `UpdateUserModal` (o'z profili) qoidasida: faqat
 * o'zgargan maydonlar — `name` (bo'shliqsiz), `phone_number` (`+998…`). O'zgarish yo'q — oyna yopiladi,
 * so'rov ketmaydi. Backend maydon xatolari maydon ostida (`applyBackendFieldErrors` naqshi).
 */
export const EditProfileDialog = ({ open, onClose, user }: EditProfileDialogProps) => {
  const { t } = useTranslation(["profile", "users", "common"]);
  const { updateMyProfile } = useUser();
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(`${UZBEKISTAN_PHONE_PREFIX}${localDigits(user.phone_number)}`);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  // Har ochilishda forma joriy profildan boshlanadi — render paytida, effektsiz.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(user.name ?? "");
      setPhone(`${UZBEKISTAN_PHONE_PREFIX}${localDigits(user.phone_number)}`);
      setErrors({});
    }
  }

  const close = () => {
    if (busy) return;
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const next: Errors = {};
    if (!name.trim()) next.name = t("users:nameRequired");
    // Backend `UpdateAdminRequestDto.name`: `@MinLength(2)` — inglizcha server xatosini kutmasdan.
    else if (name.trim().length < 2) next.name = t("profile:editDialog.nameTooShort");
    const digits = localDigits(phone);
    if (digits.length !== 9) next.phone = t("users:phoneValidation");
    setErrors(next);
    if (next.name || next.phone) return;

    const payload: UpdateUserRequest = {};
    if (name.trim() !== user.name) payload.name = name.trim();
    const phoneNumber = `${UZBEKISTAN_PHONE_PREFIX}${digits}`;
    if (phoneNumber !== user.phone_number) payload.phone_number = phoneNumber;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    try {
      await updateMyProfile.mutateAsync(payload);
      notify.success(t("common:success"), {
        description: t("users:userUpdatedSuccess", { name: user.name }),
      });
      onClose();
    } catch (error) {
      const fieldErrors: Errors = {};
      Object.entries(extractBackendFieldErrors(error)).forEach(([field, message]) => {
        const key = SERVER_FIELD[field];
        const text = normalizeBackendFieldMessage(message);
        if (key && text) fieldErrors[key] = text;
      });
      setErrors(fieldErrors);
      notify.error(t("common:error"), {
        description: getBackendErrorMessage(error) ?? t("users:editUserError"),
      });
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      size="sm"
      icon={Pencil}
      title={t("profile:editDialog.title")}
      description={
        <>
          {user.name} · <span className="whitespace-nowrap">{formatPhone(user.phone_number)}</span>
        </>
      }
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("profile:editDialog.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("profile:editDialog.saving")}>
            {t("profile:editDialog.submit")}
          </Button>
        </>
      }
    >
      <Field label={t("profile:editDialog.name")} required error={errors.name}>
        <TextInput
          value={name}
          autoComplete="name"
          onValueChange={(value) => {
            setName(value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder={t("profile:editDialog.namePlaceholder")}
        />
      </Field>
      <Field label={t("profile:editDialog.phone")} required error={errors.phone}>
        <TextInput
          mode="phone"
          value={phone}
          onValueChange={(value) => {
            setPhone(value);
            if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
          }}
        />
      </Field>
    </Dialog>
  );
};
