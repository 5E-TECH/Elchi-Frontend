import type { IntegrationAuthType, UpdateIntegrationPayload } from "../../../entities/integrations";

/**
 * ESKI TASHQI MANBA AVTORIZATSIYASI — backend kontrakti (integration-service `AuthType`): faqat `login` | `api_key`.
 *   - `login` («Login va parol») — sinxronda `auth_url` ga login va parol yuborilib token olinadi;
 *   - `api_key` («Token») — saqlangan kalit `Authorization` sarlavhasida ketadi; bo'sh bo'lsa so'rov tokensiz.
 *
 * ⚠️ Ilgari forma `none` / `bearer` / `basic` yuborardi. Backend `login` dan boshqa har qiymatni `api_key` qiladi —
 * «Login va parol» (`basic`) jimgina `api_key` bo'lib, login/parol ishlatilmasdi. Token esa `credentials.token` ga
 * tushardi, backend kalitni faqat `api_key` dan o'qiydi — token hech qachon yuborilmasdi.
 */
export const LEGACY_AUTH_TYPES = [
  "login",
  "api_key",
] as const satisfies readonly IntegrationAuthType[];

export const LEGACY_AUTH_LABEL_KEY: Record<IntegrationAuthType, string> = {
  login: "legacySources.authBasic",
  api_key: "legacySources.authToken",
};

/** Saqlangan qiymat → forma qiymati. Eski forma qiymatlari ham o'qiladi: `basic` → `login`, `bearer` / `none` → `api_key`. */
export const toLegacyAuthType = (value?: string | null): IntegrationAuthType =>
  value === "login" || value === "basic" ? "login" : "api_key";

/**
 * Ro'yxatdagi yorliq (i18n kaliti). Eski qiymatlar ham: `bearer` — «Token», `basic` — «Login va parol», `none` yoki
 * bo'sh — «Avtorizatsiyasiz». Noma'lum qiymat — `null` (xom matn ko'rsatiladi).
 */
export const legacyAuthLabelKey = (value?: string | null): string | null => {
  if (value === "login" || value === "basic") return LEGACY_AUTH_LABEL_KEY.login;
  if (value === "api_key" || value === "bearer") return LEGACY_AUTH_LABEL_KEY.api_key;
  if (!value || value === "none") return "legacySources.authNone";
  return null;
};

export type LegacyAuthForm = {
  auth_type: IntegrationAuthType;
  auth_url: string;
  username: string;
  password: string;
  token: string;
};

/**
 * Yaratish (`POST /integrations`): `credentials` majburiy (`CreateIntegrationDto`); backend `api_key`, `username`,
 * `password`, `auth_url` ni shu yerdan o'qib ustunlarga yozadi (sirlar shifrlanadi). Faqat tanlangan turning maydonlari.
 */
export const buildLegacyAuthCreate = (form: LegacyAuthForm) => {
  const credentials: Record<string, string> = {};
  const authUrl = form.auth_url.trim();
  if (authUrl) credentials.auth_url = authUrl;
  if (form.auth_type === "login") {
    const username = form.username.trim();
    const password = form.password.trim();
    if (username) credentials.username = username;
    if (password) credentials.password = password;
  } else {
    const token = form.token.trim();
    if (token) credentials.api_key = token;
  }
  return { auth_type: form.auth_type, credentials };
};

/**
 * Tahrirlash (`PATCH /integrations/:id`): yassi maydonlar (`UpdateIntegrationDto`). `credentials` yuborilmaydi — backend
 * uni butunlay almashtirardi. Parol va token serverdan qaytmaydi (`***` maska) — faqat yangisi yozilsa yuboriladi, bo'sh
 * qolsa saqlangani o'zgarmaydi (ilgari maska `***` qaytib yuborilib, saqlangan parolni buzardi).
 */
export const buildLegacyAuthUpdate = (
  form: LegacyAuthForm,
): Pick<
  UpdateIntegrationPayload,
  "auth_type" | "auth_url" | "username" | "password" | "api_key"
> => {
  const out: Pick<
    UpdateIntegrationPayload,
    "auth_type" | "auth_url" | "username" | "password" | "api_key"
  > = {
    auth_type: form.auth_type,
  };
  const authUrl = form.auth_url.trim();
  if (authUrl) out.auth_url = authUrl;
  if (form.auth_type === "login") {
    const username = form.username.trim();
    const password = form.password.trim();
    if (username) out.username = username;
    if (password) out.password = password;
  } else {
    const token = form.token.trim();
    if (token) out.api_key = token;
  }
  return out;
};
