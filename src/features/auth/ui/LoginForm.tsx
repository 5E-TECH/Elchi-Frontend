// Migrated to React Hook Form
import { memo, useState } from "react";
import logo from "../../../shared/assets/logo yozuvlik qora.png";
import { Eye, EyeClosed, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Controller, useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useTranslation } from "react-i18next";
import { createLoginSchema } from "../../../shared/lib/validation/loginSchema";
import {
  setLoading,
  setAppInitializing,
  setError,
} from "../../../entities/user/model/slice";
import type { RootState, AppDispatch } from "../../../app/config/store";
import { useLogin } from "../api/login";
import type { AxiosError } from "axios";
import {
  formatUzbekistanPhoneFull,
  keepPhoneCaretAfterChange,
} from "../../../shared/lib/phone";

interface LoginFormValues {
  phone_number: string;
  password: string;
}

interface ApiErrorResponse {
  message?: string;
}

const LoginForm = () => {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation("auth");
  const loading = useSelector((state: RootState) => state.user.loading);
  const error = useSelector((state: RootState) => state.user.error);

  const { signinUser } = useLogin();
  const isSubmitting = loading || signinUser.isPending;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(createLoginSchema(t)) as Resolver<LoginFormValues>,
    mode: "onTouched",
    defaultValues: {
      phone_number: formatUzbekistanPhoneFull(),
      password: "",
    },
  });

  const onSubmit: SubmitHandler<LoginFormValues> = (data) => {
    if (isSubmitting) return;

    dispatch(setLoading(true));
    dispatch(setAppInitializing(true));
    dispatch(setError(null));

    const payload = {
      phone_number: data.phone_number.replace(/\s/g, ""), // Remove spaces
      password: data.password,
    };

    signinUser.mutate(
      payload,
      {
        onSuccess: async () => {
          navigate("/");
        },
        onError: (error) => {
          const err = error as AxiosError<ApiErrorResponse>;
          let message = t("systemError");
          if (err.response) {
            const status = err.response.status;
            if (status === 400) message = t("invalidInput");
            if (status === 401) message = t("invalidCredentials");
            if (status === 404) message = t("userNotFound");
            if (status === 500) message = t("serverError");
          } else {
            message = err.message || t("networkError");
          }

          dispatch(setError(message));
          dispatch(setAppInitializing(false));
        },
      },
    );
  };

  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-[21rem] rounded-2xl bg-primary px-5 py-6 shadow-[0_20px_50px_rgba(0,0,0,0.12)] sm:max-w-md sm:px-10 sm:py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="mb-8 flex justify-center sm:mb-10">
            <img src={logo} alt="Elchi Logo" className="w-38 sm:w-50" />
          </div>

          <div>
            <div className="mb-3 sm:mb-4">
              <label className="mb-1 ml-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                {t("phoneLabel")}
              </label>
              <Controller
                control={control}
                name="phone_number"
                render={({ field }) => (
                  <input
                    ref={field.ref}
                    name="elchi-login-phone"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const nextValue = formatUzbekistanPhoneFull(event.target.value);
                      field.onChange(nextValue);
                      keepPhoneCaretAfterChange(event.target, nextValue, true);
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={t("phoneLabel")}
                    disabled={isSubmitting}
                    className={`login-field h-12 w-full rounded-xl border bg-gray-50 px-5 text-sm text-maindark transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-maindark sm:text-base ${errors.phone_number ? "border-red-500" : "border-gray-200"
                      } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    placeholder={t("phonePlaceholder")}
                  />
                )}
              />
              {errors.phone_number && (
                <p className="ml-1 mt-1 text-[11px] text-red-500 sm:text-xs">
                  {errors.phone_number.message as string}
                </p>
              )}
            </div>

            {/* Parol */}
            <div className="mb-5 sm:mb-8">
              <div className="mb-1 ml-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                  {t("passwordLabel")}
                </label>
              </div>
              <div className="relative">
                <input
                  {...register("password")}
                  type={show ? "text" : "password"}
                  disabled={isSubmitting}
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="current-password"
                  className={`login-field h-12 w-full rounded-xl border bg-gray-50 px-5 pr-12 text-sm text-maindark transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-maindark sm:text-base ${errors.password ? "border-red-500" : "border-gray-200"
                    } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShow(!show)}
                  aria-label={show ? t("hidePassword", { defaultValue: "Hide password" }) : t("showPassword", { defaultValue: "Show password" })}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-main focus:outline-none disabled:cursor-not-allowed"
                >
                  {show ? <Eye size={18} /> : <EyeClosed size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="ml-1 mt-1 text-[11px] text-red-500 sm:text-xs">
                  {errors.password.message as string}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-2 text-center text-xs text-red-500 sm:text-sm">
                {error}
              </div>
            )}

            {/* Kirish tugmasi */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`mb-1 mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold shadow-lg transition-all duration-200 sm:mb-2 sm:mt-4 sm:h-12 sm:text-lg ${isSubmitting
                ? "bg-maindark/70 text-primary cursor-not-allowed shadow-none translate-y-0"
                : "bg-maindark text-primary shadow-main/30 hover:shadow-main/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t("signingIn")}
                </>
              ) : (
                t("signInButton")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default memo(LoginForm);
