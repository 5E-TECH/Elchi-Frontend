// dizayn-v2: common-profile-password-dialog
import { useRef, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, Lock, LogOut, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  extractBackendFieldErrors,
  normalizeBackendFieldMessage,
} from "../../../features/user/lib/backendFieldErrors";
import { Button, Dialog, Field, IconButton, TextInput } from "../../../shared/ui/primitives";
import {
  checkPasswordPolicy,
  getPasswordPolicyServerMessage,
  passwordMinLength,
} from "../../../shared/lib/passwordPolicy";
import { getOldPasswordErrorKind } from "../../../shared/lib/oldPassword";

type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string | null | undefined;
  /**
   * `required` — NDmZMzCP «Yangi parol o'rnating» (`must_change_password`): sarlavha / izoh boshqa, «Bekor qilish»
   * o'rniga «Keyinroq». Saqlangach `onChanged` (token yangilash, bayroqni tozalash).
   */
  variant?: "change" | "required";
  /**
   * aidsxJ2H: majburiy rejim (parolni admin / tizim bergan — `pwd_forced`, yoki 403 `PASSWORD_CHANGE_REQUIRED`) —
   * oyna bloklovchi: «Keyinroq» / «Yopish» yo'q, Esc va fon yopmaydi; o'rniga «Chiqish» (`onSignOut`).
   */
  forced?: boolean;
  onSignOut?: () => void | Promise<void>;
  onChanged?: () => void | Promise<void>;
};

type Errors = { oldPassword?: string; password?: string; repeat?: string };

/**
 * «PAROLNI O'ZGARTIRISH» — maket `common-profile-password-dialog` (telefonda pastki varaqa — `Dialog` o'zi).
 *
 * `PATCH /auth/my-profile { old_password, password }` (aidsxJ2H: joriy parol MAJBURIY — yo'q / noto'g'ri bo'lsa
 * 400 `OLD_PASSWORD_REQUIRED` / `OLD_PASSWORD_INVALID`, 401 emas — chiqarilmaydi, xato «Joriy parol» ostida; yangisi
 * joriysi bilan bir xil — 400, «Yangi parol» ostida) → backend BOSHQA barcha qurilmalarni darhol chiqaradi, shu qurilma tizimda
 * qoladi (2026-10-23; avval hamma sessiya yopilib, shu yerdan ham chiqarilardi) → «Parol almashtirildi — boshqa
 * qurilmalardan chiqildi», oyna yopiladi; «Sessiyalar» ro'yxati qayta so'raladi (`updateMyProfile` →
 * `queryKeys.accountSessions`). Ikki marta yuborilmaydi (`submittingRef`).
 * Tekshiruv (NDmZMzCP siyosati, `shared/lib/passwordPolicy`): bo'sh emas, kamida 8 (xodim — 10) belgi, boshida /
 * oxirida bo'shliq yo'q, takrori mos (mos kelsa — yashil «Parollar mos keladi»). Oddiy / ketma-ket / telefonga teng
 * parolni server rad etadi — 400 matni maydon ostida.
 */
export const ChangePasswordDialog = ({
  open,
  onClose,
  name,
  phone,
  variant = "change",
  forced = false,
  onSignOut,
  onChanged,
}: ChangePasswordDialogProps) => {
  const { t } = useTranslation(["profile", "users", "common", "auth"]);
  const { updateMyProfile } = useUser();
  const role = useSelector((state: RootState) => state.role.role);
  const minLength = passwordMinLength(role);
  const required = variant === "required";
  const blocking = required && forced;
  const [oldPassword, setOldPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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
      setOldPassword("");
      setShowOld(false);
      setPassword("");
      setRepeat("");
      setShowPassword(false);
      setShowRepeat(false);
      setErrors({});
    }
  }

  const close = () => {
    if (busy || blocking) return;
    onClose();
  };

  const signOut = async () => {
    if (busy || signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut?.();
    } finally {
      setSigningOut(false);
    }
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!oldPassword) next.oldPassword = t("auth:currentPassword.required");
    // Faqat bo'shliqdan iborat parol — bo'sh hisoblanadi (eski `UpdateUserModal`: `password.trim()` bo'sh → yuborilmaydi).
    const issue = checkPasswordPolicy(password, role);
    if (issue === "required") next.password = t("profile:password.required");
    else if (issue) next.password = t(`auth:passwordPolicy.${issue}`, { min: minLength });
    else if (oldPassword && password === oldPassword) next.password = t("auth:currentPassword.sameAsOld");
    if (!repeat) next.repeat = t("profile:password.repeatRequired");
    else if (repeat !== password) next.repeat = t("profile:password.mismatch");
    return next;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const next = validate();
    setErrors(next);
    if (next.oldPassword || next.password || next.repeat) return;

    submittingRef.current = true;
    setBusy(true);
    try {
      await updateMyProfile.mutateAsync({ old_password: oldPassword, password });
      notify.success(
        required ? t("auth:mustChange.success") : t("profile:password.changedOthersSignedOut"),
        required ? { description: t("profile:password.changedOthersSignedOut") } : undefined,
      );
      await onChanged?.();
      onClose();
    } catch (error) {
      // aidsxJ2H: joriy parol yo'q / noto'g'ri — 400 (chiqarilmaydi), xato «Joriy parol» ostida, umumiy xabarsiz.
      const oldKind = getOldPasswordErrorKind(error);
      if (oldKind) {
        setErrors({ oldPassword: t(oldKind === "required" ? "auth:currentPassword.required" : "auth:currentPassword.invalid") });
        return;
      }
      const fieldMessage =
        normalizeBackendFieldMessage(extractBackendFieldErrors(error).password) ??
        getPasswordPolicyServerMessage(error);
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
      closable={!blocking}
      dismissible={!blocking}
      closeOnOverlay={!blocking}
      size="sm"
      icon={Lock}
      title={required ? t("auth:mustChange.title") : t("profile:password.title")}
      description={
        required ? (
          t(forced ? "auth:mustChange.forcedDescription" : "auth:mustChange.description")
        ) : (
          <>
            {name} · <span className="whitespace-nowrap">{formatPhone(phone)}</span>
          </>
        )
      }
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          {blocking ? (
            <Button
              variant="secondary"
              leftIcon={LogOut}
              onClick={() => void signOut()}
              loading={signingOut}
              disabled={busy}
            >
              {t("auth:mustChange.signOut")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={close} disabled={busy}>
              {required ? t("auth:mustChange.later") : t("profile:password.cancel")}
            </Button>
          )}
          <Button type="submit" loading={busy} loadingText={t("profile:password.saving")}>
            {t("profile:password.submit")}
          </Button>
        </>
      }
    >
      {/* aidsxJ2H: joriy parol (majburiy rejimda — SMS'dagi yoki administrator bergan vaqtinchalik parol). */}
      <Field
        label={t(forced ? "auth:currentPassword.temporaryLabel" : "auth:currentPassword.label")}
        required
        hint={forced ? t("auth:currentPassword.temporaryHint") : undefined}
        error={errors.oldPassword}
      >
        <TextInput
          type={showOld ? "text" : "password"}
          autoComplete="current-password"
          value={oldPassword}
          onValueChange={(value) => {
            setOldPassword(value);
            if (errors.oldPassword) setErrors((prev) => ({ ...prev, oldPassword: undefined }));
          }}
          placeholder={t("auth:currentPassword.placeholder")}
          suffix={visibilityToggle(showOld, () => setShowOld((value) => !value))}
        />
      </Field>
      <Field
        label={t("profile:password.new")}
        required
        hint={t("auth:passwordPolicy.hint", { min: minLength })}
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
