// dizayn-v2: common-profile-password-dialog
import { useRef, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, Lock, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../../entities/user/api/userApi";
import { rememberLoginNotice } from "../../../auth/loginNotice";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { useLogout } from "../../../shared/lib/useLogout";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  extractBackendFieldErrors,
  normalizeBackendFieldMessage,
} from "../../../features/user/lib/backendFieldErrors";
import { Button, Dialog, Field, IconButton, TextInput } from "../../../shared/ui/primitives";

/** Backend `UpdateAdminRequestDto.password`: `@MinLength(4)` (api-gateway `identity.swagger.dto.ts`). */
export const PASSWORD_MIN_LENGTH = 4;

type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string | null | undefined;
};

type Errors = { password?: string; repeat?: string };

/**
 * «PAROLNI O'ZGARTIRISH» — maket `common-profile-password-dialog` (telefonda pastki varaqa — `Dialog` o'zi).
 *
 * Xulq eski `UpdateUserModal` (o'z profili, faqat parol) bilan bir xil: `PATCH /auth/my-profile { password }` →
 * «Parol o'zgardi — qayta kiring» → login sahifasida sabab (`rememberLoginNotice`) → `logout()` (backend shu hisob
 * sessiyasini yopadi, keyingi refresh baribir 401 bo'lardi). Ikki marta yuborilmaydi (`submittingRef`).
 * Tekshiruv: bo'sh emas, kamida 4 belgi, takrori mos (mos kelsa — yashil «Parollar mos keladi»).
 */
export const ChangePasswordDialog = ({ open, onClose, name, phone }: ChangePasswordDialogProps) => {
  const { t } = useTranslation(["profile", "auth", "users", "common"]);
  const { updateMyProfile } = useUser();
  const { logout } = useLogout();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  // Har ochilishda bo'sh forma (yopilgan oynada eski parol qolmasin) — render paytida, effektsiz.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setPassword("");
      setRepeat("");
      setShowPassword(false);
      setShowRepeat(false);
      setErrors({});
    }
  }

  const close = () => {
    if (busy) return;
    onClose();
  };

  const validate = (): Errors => {
    const next: Errors = {};
    // Faqat bo'shliqdan iborat parol — bo'sh hisoblanadi (eski `UpdateUserModal`: `password.trim()` bo'sh → yuborilmaydi).
    if (!password.trim()) next.password = t("profile:password.required");
    else if (password.length < PASSWORD_MIN_LENGTH) next.password = t("profile:password.tooShort");
    if (!repeat) next.repeat = t("profile:password.repeatRequired");
    else if (repeat !== password) next.repeat = t("profile:password.mismatch");
    return next;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const next = validate();
    setErrors(next);
    if (next.password || next.repeat) return;

    submittingRef.current = true;
    setBusy(true);
    try {
      await updateMyProfile.mutateAsync({ password });
      notify.success(t("auth:passwordChangedRelogin"));
      onClose();
      rememberLoginNotice("passwordChanged");
      void logout();
    } catch (error) {
      const fieldMessage = normalizeBackendFieldMessage(extractBackendFieldErrors(error).password);
      if (fieldMessage) setErrors({ password: fieldMessage });
      notify.error(t("common:error"), {
        description: getBackendErrorMessage(error) ?? t("users:editUserError"),
      });
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const matches = repeat.length > 0 && repeat === password && !errors.repeat;

  const visibilityToggle = (shown: boolean, toggle: () => void) => (
    <IconButton
      size="sm"
      icon={shown ? EyeOff : Eye}
      label={shown ? t("profile:password.hide") : t("profile:password.show")}
      aria-pressed={shown}
      onClick={toggle}
      className="-mr-2"
    />
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      size="sm"
      icon={Lock}
      title={t("profile:password.title")}
      description={
        <>
          {name} · <span className="whitespace-nowrap">{formatPhone(phone)}</span>
        </>
      }
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("profile:password.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("profile:password.saving")}>
            {t("profile:password.submit")}
          </Button>
        </>
      }
    >
      <Field
        label={t("profile:password.new")}
        required
        hint={t("profile:password.minHint")}
        error={errors.password}
      >
        <TextInput
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onValueChange={(value) => {
            setPassword(value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder={t("profile:password.newPlaceholder")}
          suffix={visibilityToggle(showPassword, () => setShowPassword((value) => !value))}
        />
      </Field>
      <Field
        label={t("profile:password.repeat")}
        required
        hintLive
        hint={
          matches ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success-fg">
              <Check size={16} aria-hidden="true" />
              {t("profile:password.match")}
            </span>
          ) : undefined
        }
        error={errors.repeat}
      >
        <TextInput
          type={showRepeat ? "text" : "password"}
          autoComplete="new-password"
          value={repeat}
          onValueChange={(value) => {
            setRepeat(value);
            if (errors.repeat) setErrors((prev) => ({ ...prev, repeat: undefined }));
          }}
          onBlur={() => {
            // Takror yozib bo'lingach mos kelmasa — darhol aytiladi (yuborishni kutmasdan).
            if (repeat && password && repeat !== password) {
              setErrors((prev) => ({ ...prev, repeat: t("profile:password.mismatch") }));
            }
          }}
          placeholder={t("profile:password.repeatPlaceholder")}
          suffix={visibilityToggle(showRepeat, () => setShowRepeat((value) => !value))}
        />
      </Field>
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg"
      >
        <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <p className="min-w-0 text-text">{t("profile:password.warning")}</p>
      </div>
    </Dialog>
  );
};
