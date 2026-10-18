// dizayn-v2: common-login, common-login-error
import { memo, useEffect, useId, useState } from "react";
import { CircleCheck, CircleX, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Controller, useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useTranslation } from "react-i18next";
import type { AxiosError } from "axios";
import { createLoginSchema } from "../../../shared/lib/validation/loginSchema";
import { UZBEKISTAN_PHONE_PREFIX } from "../../../shared/lib/phone";
import { setLoading, setAppInitializing, setError } from "../../../entities/user/model/slice";
import type { RootState, AppDispatch } from "../../../app/config/store";
import { Button, Field, IconButton, TextInput } from "../../../shared/ui/primitives";
import { useLogin } from "../api/login";
import { isNetworkFailure } from "../../../auth/networkError";
import { clearLoginNotice, peekLoginNotice } from "../../../auth/loginNotice";

/**
 * Kirish formasi — dizayn v2 (maketlar `common-login`, `common-login-error`). Ramka (navy panel / tasma) —
 * `features/auth/index.tsx`.
 *
 * Saqlangan xatti-harakat:
 *   - ikki marta yuborish himoyasi (`isSubmitting`; tugma `loading`, maydonlar shu payt faqat o'qish uchun),
 *     `setLoading` / `setAppInitializing` / `setError`;
 *   - so'rov `{ phone_number: "+998XXXXXXXXX", password }` (`POST /auth/login`), muvaffaqiyat → `/`;
 *   - xato matni: 400 / 401 / 404 / 500 / javobsiz (tarmoq) / boshqa — redux `user.error` da;
 *   - «Parol o'zgardi — qayta kiring» bir martalik xabari (`loginNotice`);
 *   - e2e tayanadigan nomlar: telefon `name="elchi-login-phone"`, parol `name="password"`.
 */

interface LoginFormValues {
  phone_number: string;
  password: string;
}

interface ApiErrorResponse {
  message?: string;
}

type LoginFormProps = {
  /** Forma ochilganda telefon maydoniga fokus («Sessiya tugadi» → «Qayta kirish» dan keyin). */
  autoFocus?: boolean;
};

const ALERT_BASE = "flex items-start gap-3 rounded-xl px-4 py-3 text-sm";

const LoginForm = ({ autoFocus = false }: LoginFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsHint, setCredentialsHint] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation("auth");
  const loading = useSelector((state: RootState) => state.user.loading);
  const error = useSelector((state: RootState) => state.user.error);
  const ids = useId();
  const errorId = `${ids}-error`;
  const phoneHintId = `${ids}-phone-prefix`;
  const passwordId = `${ids}-password`;

  const { signinUser } = useLogin();
  const isSubmitting = loading || signinUser.isPending;
  // fix3b RBAC-09: o'z parolini o'zgartirgan foydalanuvchi darhol chiqarildi —
  // sababi shu yerda bir marta ko'rsatiladi.
  const [loginNotice] = useState(peekLoginNotice);
  useEffect(() => {
    if (loginNotice) clearLoginNotice();
  }, [loginNotice]);

  const {
    control,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(createLoginSchema(t)) as Resolver<LoginFormValues>,
    mode: "onTouched",
    defaultValues: {
      phone_number: UZBEKISTAN_PHONE_PREFIX,
      password: "",
    },
  });

  useEffect(() => {
    if (autoFocus) setFocus("phone_number");
  }, [autoFocus, setFocus]);

  const onSubmit: SubmitHandler<LoginFormValues> = (data) => {
    if (isSubmitting) return;

    dispatch(setLoading(true));
    dispatch(setAppInitializing(true));
    dispatch(setError(null));
    setCredentialsHint(false);

    // `TextInput mode="phone"` qiymati allaqachon `+998XXXXXXXXX` (bo'sh joysiz) — qayta formatlanmaydi.
    const payload = {
      phone_number: data.phone_number,
      password: data.password,
    };

    signinUser.mutate(payload, {
      onSuccess: async () => {
        navigate("/");
      },
      onError: (error) => {
        const err = error as AxiosError<ApiErrorResponse>;
        let message = t("systemError");
        let credentials = false;
        if (err.response) {
          const status = err.response.status;
          if (status === 400) message = t("invalidInput");
          if (status === 401) message = t("invalidCredentials");
          if (status === 404) message = t("userNotFound");
          if (status === 500) message = t("serverError");
          credentials = status === 400 || status === 401 || status === 404;
        } else if (isNetworkFailure(error)) {
          // Javob kelmadi (internet yo'q / vaqt tugadi) — axios'ning inglizcha matni emas.
          message = t("networkError");
        } else {
          message = err.message || t("networkError");
        }

        setCredentialsHint(credentials);
        dispatch(setError(message));
        dispatch(setAppInitializing(false));
      },
    });
  };

  const passwordToggleLabel = showPassword ? t("hidePassword") : t("showPassword");

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-labelledby={`${ids}-title`}
      aria-describedby={error ? errorId : undefined}
      className="flex w-full max-w-[400px] flex-col gap-6"
    >
      <div className="mb-2 flex flex-col gap-1">
        <h1 id={`${ids}-title`} className="text-2xl font-bold tracking-[-.01em] text-text max-md:text-xl">
          {t("loginTitle")}
        </h1>
        <p className="text-sm text-text-muted">{t("loginSubtitle")}</p>
      </div>

      {error ? (
        <div id={errorId} role="alert" className={`${ALERT_BASE} -mt-2 bg-danger-soft text-danger-fg`}>
          <CircleX aria-hidden="true" focusable="false" size={20} className="mt-px shrink-0" />
          <div className="min-w-0 text-text">
            <p className="font-bold">{error}</p>
            {credentialsHint ? <p className="text-[13px]">{t("loginErrorHint")}</p> : null}
          </div>
        </div>
      ) : loginNotice === "passwordChanged" ? (
        <div role="status" className={`${ALERT_BASE} -mt-2 bg-success-soft text-success-fg`}>
          <CircleCheck aria-hidden="true" focusable="false" size={20} className="mt-px shrink-0" />
          <p className="min-w-0 font-bold text-text">{t("passwordChangedRelogin")}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <Field label={t("phoneLabel")} error={errors.phone_number?.message}>
          <Controller
            control={control}
            name="phone_number"
            render={({ field }) => (
              <TextInput
                ref={field.ref}
                mode="phone"
                size="lg"
                name="elchi-login-phone"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("phonePlaceholder")}
                aria-describedby={phoneHintId}
                autoCorrect="off"
                spellCheck={false}
                readOnly={isSubmitting}
              />
            )}
          />
          <span id={phoneHintId} className="sr-only">
            {t("phonePrefixHint")}
          </span>
        </Field>

        <Field id={passwordId} label={t("passwordLabel")} error={errors.password?.message}>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextInput
                ref={field.ref}
                size="lg"
                name={field.name}
                type={showPassword ? "text" : "password"}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
                readOnly={isSubmitting}
                suffix={
                  <IconButton
                    size="lg"
                    label={passwordToggleLabel}
                    icon={showPassword ? EyeOff : Eye}
                    aria-pressed={showPassword}
                    aria-controls={passwordId}
                    onClick={() => setShowPassword((value) => !value)}
                    className="-mr-2.5"
                  />
                }
              />
            )}
          />
        </Field>
      </div>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting} loadingText={t("signingIn")} className="mt-2">
        {t("loginButton")}
      </Button>
    </form>
  );
};

export default memo(LoginForm);
