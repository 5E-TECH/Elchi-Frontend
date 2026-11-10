import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import tokenStorage from "./tokenStorage";
import { logoutAndRedirect, refreshAccessToken } from "./authService";
import { emitNetworkError, emitNetworkRestored, isNetworkFailure, isTransientAuthFailure } from "./networkError";
import { PASSWORD_CHANGE_REQUIRED_CODE, requirePasswordChange, responseErrorCode } from "./passwordChange";
import { notify } from "../shared/lib/notify";
import { API_ENDPOINTS } from "../shared/api/endpoints";
import { getLoginEpoch, isRefreshSuperseded } from "./loginEpoch";
import i18n from "../i18n";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /** So'rov qaysi kirish davrida yuborildi (`loginEpoch.ts`). */
  _loginEpoch?: number;
};

let refreshPromise: Promise<string> | null = null;

const getRefreshedAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

/**
 * Sessiya tugagani uchun chiqish — bir vaqtdagi so'rovlar (sahifa 5–10 ta so'rov yuboradi) uchun BITTA:
 * masalan sessiya boshqa qurilmadan yopilganda (profil «Sessiyalar» → «Chiqarish») hammasi 401 oladi, umumiy
 * refresh ham rad etiladi — `logout` (va `POST auth/logout`) har so'rov uchun qayta-qayta chaqirilmaydi.
 */
let sessionExpiredLogout: Promise<void> | null = null;

const logoutSessionExpired = (revoked = false) => {
  if (!sessionExpiredLogout) {
    sessionExpiredLogout = logoutAndRedirect(
      revoked ? { reason: "sessionExpired", revoked: true } : { reason: "sessionExpired" },
    ).finally(() => {
      sessionExpiredLogout = null;
    });
  }
  return sessionExpiredLogout;
};

/** Gateway sessiyasi boshqa qurilmadan yopilganda 401 javobida `message: "Session revoked"` beradi. */
const SESSION_REVOKED_MESSAGE = "session revoked";


/**
 * NDmZMzCP: gateway sessiyani tekshira olmadi (identity javob bermadi) — 503 `SESSION_CHECK_UNAVAILABLE`. Bu 401
 * EMAS: foydalanuvchi chiqarilmaydi, so'rov odatdagidek rad etiladi (React Query 5xx ni bir marta qayta so'raydi),
 * bitta ogohlantirish (bir xil `id` — takrorlanmaydi).
 */
export const SESSION_CHECK_UNAVAILABLE_CODE = "SESSION_CHECK_UNAVAILABLE";
export const SESSION_CHECK_TOAST_ID = "elchi-session-check-unavailable";

/**
 * So'rov hozirgi token bilan ketganmi. aidsxJ2H: parol almashgach bayroqsiz token olinadi — eski token bilan ketgan
 * so'rovning kech kelgan 403 javobi «Yangi parol o'rnating» oynasini qayta ochmasin.
 */
const sentWithCurrentToken = (sentAuthorization: unknown) => {
  const sent = String(sentAuthorization ?? "").replace(/^Bearer\s+/i, "");
  return !sent || sent === tokenStorage.getAccessToken();
};

/**
 * Xavfsizlik javoblari (403 `PASSWORD_CHANGE_REQUIRED`, 503 `SESSION_CHECK_UNAVAILABLE`) — axios interceptor va
 * `authFetch` (SSE, `fetch` bilan) uchun bitta: `sentAuthorization` — so'rov yuborilgan `Authorization` sarlavhasi.
 */
export const handleSecurityResponse = (status: number | undefined, body: unknown, sentAuthorization: unknown) => {
  if (status !== 403 && status !== 503) return;
  const code = responseErrorCode(body);
  if (status === 403 && code === PASSWORD_CHANGE_REQUIRED_CODE) {
    // Darvoza (`pwd_forced` yoki `PASSWORD_CHANGE_GATE`): chiqarilmaydi — «Yangi parol o'rnating» oynasi ochiladi.
    if (sentWithCurrentToken(sentAuthorization)) requirePasswordChange();
  } else if (status === 503 && code === SESSION_CHECK_UNAVAILABLE_CODE) {
    notify.warning(i18n.t("auth:sessionCheckUnavailable.title"), {
      id: SESSION_CHECK_TOAST_ID,
      description: i18n.t("auth:sessionCheckUnavailable.text"),
    });
  }
};

const hasRefreshTokenExpired = () => {
  const { refreshTokenExpiresAt } = tokenStorage.getSessionMetadata();
  return Boolean(refreshTokenExpiresAt && Date.now() >= refreshTokenExpiresAt);
};

/**
 * Token yangilanmadi. fix3 RBAC-11 / C10: 429 (so'rov cheklovi), 5xx yoki
 * tarmoq xatosida foydalanuvchi tizimdan CHIQARILMAYDI — faqat shu so'rov
 * rad etiladi, keyingi so'rov yana yangilashga urinadi (refresh o'zi 3 marta
 * qayta urinadi). Ilgari smena boshida ofisdagi bitta IP dan 10+ qurilma
 * yangilaganda 429 olganlar /login ga tashlanardi.
 */
const handleRefreshFailure = async (refreshError: unknown, revoked = false) => {
  // Yangilash javobi kelguncha foydalanuvchi qayta kirdi — eski sessiyaning so'rovi shunchaki rad etiladi: yangi
  // sessiyadan chiqarilmaydi, so'rov yangi token bilan qayta yuborilmaydi.
  if (isRefreshSuperseded(refreshError)) return Promise.reject(refreshError);
  if (!isTransientAuthFailure(refreshError)) {
    // Sessiya haqiqatan tugagan (yoki boshqa qurilmadan yopilgan — `revoked`) — login sahifasida «Sessiya tugadi»
    // ekrani (dizayn v2 `common-session-expired`), yopilgan bo'lsa sababi bilan.
    await logoutSessionExpired(revoked);
  } else if (isNetworkFailure(refreshError)) {
    // `authClient` tarmoq xatosini bildirmaydi (faqat «aloqa tiklandi» ni) — "Tarmoq xatosi" shu yerdan chiqadi.
    emitNetworkError(refreshError);
  }
  return Promise.reject(refreshError);
};

/**
 * So'rov oldidan amaldagi access token (`authFetch` bilan umumiy): refresh token muddati o'tgan bo'lsa — sessiya
 * tugadi (chiqish, xato); access token muddati o'tgan bo'lsa — bitta umumiy yangilash (`getRefreshedAccessToken`),
 * yiqilsa — `handleRefreshFailure` (vaqtinchalik xatoda chiqarilmaydi).
 */
export const prepareAccessToken = async (): Promise<string | null> => {
  if (hasRefreshTokenExpired()) {
    await logoutSessionExpired();
    throw new Error("Refresh token expired");
  }

  const accessToken = tokenStorage.getAccessToken();
  const { accessTokenExpiresAt } = tokenStorage.getSessionMetadata();

  if (accessToken && accessTokenExpiresAt && Date.now() >= accessTokenExpiresAt) {
    try {
      return await getRefreshedAccessToken();
    } catch (refreshError) {
      return handleRefreshFailure(refreshError);
    }
  }

  return accessToken;
};

/**
 * 401 dan keyin bitta umumiy yangilash (`authFetch` bilan umumiy) — yangi access token. Yiqilsa —
 * `handleRefreshFailure` (`revoked` — sessiya boshqa qurilmadan yopilgan, «Sessiya tugadi» ekrani sababi bilan).
 */
export const refreshAfterUnauthorized = async ({ revoked = false }: { revoked?: boolean } = {}): Promise<string> => {
  try {
    if (hasRefreshTokenExpired()) {
      throw new Error("Refresh token expired");
    }
    return await getRefreshedAccessToken();
  } catch (refreshError) {
    return handleRefreshFailure(refreshError, revoked);
  }
};

/** 401 javobi tanasidagi «Session revoked» (gateway sessiyani boshqa qurilmadan yopilganda). */
export const isSessionRevokedBody = (body: unknown) => {
  const message = (body as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message.trim().toLowerCase() === SESSION_REVOKED_MESSAGE;
};

const shouldAttemptRefresh = (error: AxiosError) => {
  const status = error.response?.status;
  const requestConfig = error.config as RetryableRequestConfig | undefined;
  const requestUrl = requestConfig?.url ?? "";

  if (status !== 401 || !requestConfig || requestConfig._retry) {
    return false;
  }

  // Eski sessiyada yuborilgan so'rovning 401 i qayta kirishdan keyin keldi (sekin internet) — yangi foydalanuvchi
  // cookie'si bilan yangilab, eski so'rovni (masalan boshqa xodimning amalini) yangi token bilan qayta yubormaymiz.
  if (requestConfig._loginEpoch !== undefined && requestConfig._loginEpoch !== getLoginEpoch()) {
    return false;
  }

  if (!tokenStorage.getAccessToken()) {
    return false;
  }

  // Endpoint'lar nisbiy ("auth/refresh", boshida "/" siz) — ilgari "/auth/refresh" bilan solishtirilib hech qachon mos
  // kelmasdi: yiqilgan token yangilash xatosi yangi token bilan qayta yangilanib, javobi so'rov keshiga yozilardi.
  return !requestUrl.includes(API_ENDPOINTS.AUTH.LOGIN) && !requestUrl.includes(API_ENDPOINTS.AUTH.REFRESH);
};

// ⚠️ Foydalanuvchi o'zi bekor qilgan so'rov (AbortController) ham `response`
// siz keladi — u tarmoq xatosi EMAS, "tarmoq xatosi" toast'i chiqmasin.
export const setupAuthInterceptors = (api: AxiosInstance) => {
  api.interceptors.request.use(async (config) => {
    (config as RetryableRequestConfig)._loginEpoch = getLoginEpoch();
    const accessToken = await prepareAccessToken();

    if (accessToken) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
    }

    return config;
  });

  api.interceptors.response.use(
    (response) => {
      // G6F68ti6 (1-band): uzilishdan keyingi birinchi javob — «Aloqa tiklandi» (`online` hodisasi «Wi-Fi bor,
      // internet yo'q» holatida kelmaydi, shuning uchun signal haqiqiy javobdan).
      emitNetworkRestored();
      return response;
    },
    async (error: AxiosError) => {
      // Javob kelgan xato (4xx/5xx) ham aloqa borligini bildiradi.
      if (error.response) emitNetworkRestored();
      // Fon so'rovi (`silentNetworkError`, masalan har daqiqadagi o'qilmaganlar soni) — holat belgilanadi, lekin
      // foydalanuvchi yopgan tarmoq xabari qayta ochilmaydi (9-band).
      emitNetworkError(error, { silent: error.config?.silentNetworkError === true });
      handleSecurityResponse(error.response?.status, error.response?.data, error.config?.headers?.Authorization);

      if (!shouldAttemptRefresh(error)) {
        return Promise.reject(error);
      }

      const originalRequest = error.config as RetryableRequestConfig;
      originalRequest._retry = true;

      const nextAccessToken = await refreshAfterUnauthorized({ revoked: isSessionRevokedBody(error.response?.data) });
      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${nextAccessToken}`;

      return api(originalRequest);
    },
  );
};

export default setupAuthInterceptors;
