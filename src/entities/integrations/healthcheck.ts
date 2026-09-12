import { useMutation } from '@tanstack/react-query';
import { api } from '../../shared/api/api';
import { API_ENDPOINTS } from '../../shared/api';

/**
 * CHIQUVCHI ULANISHNI SINASH (`POST integrations/:id/healthcheck`).
 *
 * NEGA ALOHIDA HOOK. `integrationsCoverage.ts` ichida ham bor, lekin u
 * bitta katta `useIntegrationsCoverage()` to'plami — chaqirilsa o'n-o'n
 * beshta so'rov va mutatsiya birga tirgiziladi. Ustaga bittasi kerak.
 *
 * ⚠️ BACKEND XATONI HTTP XATO QILIB QAYTARMAYDI. Yiqilganda ham
 * `errorRes(...)` bilan `{statusCode: 502, message, data:{ok:false}}`
 * ko'rinishida oddiy javob keladi — ya'ni axios `catch`ga TUSHMAYDI.
 * Shu sababli natijani `ok`/`status` bo'yicha o'qish kerak, faqat
 * `try/catch`ga tayanmaslik.
 */
export interface HealthcheckResult {
  ok: boolean;
  status: number | null;
  response_time_ms: number | null;
  url: string | null;
  /** Backend `message` maydonida sababni beradi (502 holatida). */
  message: string | null;
}

const readResult = (raw: unknown): HealthcheckResult => {
  const outer = raw as {
    statusCode?: number;
    message?: string;
    data?: Record<string, unknown>;
  };
  // Qatlam soni marshrutga qarab farq qilishi mumkin.
  const inner = (outer?.data?.data ?? outer?.data ?? {}) as Record<
    string,
    unknown
  >;
  const status = typeof inner.status === 'number' ? inner.status : null;
  return {
    ok: inner.ok === true,
    status,
    response_time_ms:
      typeof inner.response_time_ms === 'number' ? inner.response_time_ms : null,
    url: typeof inner.url === 'string' ? inner.url : null,
    /**
     * Muvaffaqiyatli javobda ham `message` bo'ladi ("healthcheck completed") —
     * uni xato deb ko'rsatmaslik uchun faqat yiqilganda olamiz.
     */
    message:
      inner.ok === true
        ? null
        : typeof outer?.message === 'string'
          ? outer.message
          : null,
  };
};

export const useIntegrationHealthcheck = () =>
  useMutation({
    mutationFn: (id: string) =>
      api
        .post(API_ENDPOINTS.INTEGRATIONS.HEALTHCHECK(id), {})
        .then((res) => readResult(res.data)),
  });
