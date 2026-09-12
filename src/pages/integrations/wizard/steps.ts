import type { WebhookTestResult } from '../../../entities/partners';

/**
 * SINOV NATIJASINI QADAMLARGA AJRATISH.
 *
 * NEGA QADAMLAB. "Ulanmadi" degan bitta qizil xabar operatorga hech narsa
 * bermaydi: manzil xatomi, server o'chiqmi, imzo mosmi — bilinmaydi va odam
 * hammasini boshidan tekshirib chiqadi.
 *
 * ⚠️ FAQAT JAVOB HAQIQATAN AYTGAN NARSA. DNS va TCP ni alohida ko'rsatish
 * chiroyli bo'lardi, lekin javobda bunday ma'lumot YO'Q — uni to'qib
 * ko'rsatish yolg'on tashxis bo'lardi. Shuning uchun to'rt qadam: manzil
 * shakli (bizda tekshiriladi), HTTP javob keldimi, javob kodi yaxshimi,
 * imzo kaliti bormi.
 */

export type CheckState = 'ok' | 'fail' | 'warn' | 'skip';

export interface StepCheck {
  label: string;
  state: CheckState;
  detail: string;
}

/** Manzil shaklini BIZ tekshiramiz — so'rov yuborishdan oldin. */
export const checkUrlShape = (raw: string): StepCheck => {
  const url = raw.trim();
  if (!url) {
    return { label: 'Manzil', state: 'fail', detail: "manzil kiritilmagan" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      label: 'Manzil',
      state: 'fail',
      detail: "manzil shakli noto'g'ri (https://... bo'lishi kerak)",
    };
  }
  if (parsed.protocol !== 'https:') {
    /**
     * `http` — ogohlantirish, xato emas: ichki tarmoqda ishlashi mumkin.
     * Lekin imzo va ma'lumot ochiq ketadi, shuni aytish kerak.
     */
    return {
      label: 'Manzil',
      state: 'warn',
      detail: `${parsed.protocol} ishlatilgan — ma'lumot shifrlanmagan holda ketadi`,
    };
  }
  return { label: 'Manzil', state: 'ok', detail: parsed.origin };
};

/** Hamkor webhook sinovi → to'rt qadam. */
export const partnerChecks = (
  url: string,
  res: WebhookTestResult | null,
): StepCheck[] => {
  const shape = checkUrlShape(url);
  if (!res) return [shape];

  const reached: StepCheck =
    res.http_status !== null
      ? { label: 'Aloqa', state: 'ok', detail: `javob keldi (${res.duration_ms} ms)` }
      : {
          label: 'Aloqa',
          state: 'fail',
          // Tarmoq xatosi — manzil yoki server tomonda.
          detail: res.error || 'javob kelmadi',
        };

  const code: StepCheck =
    res.http_status === null
      ? { label: 'Javob kodi', state: 'skip', detail: 'aloqa bo‘lmadi' }
      : res.http_status >= 200 && res.http_status < 300
        ? { label: 'Javob kodi', state: 'ok', detail: `HTTP ${res.http_status}` }
        : {
            label: 'Javob kodi',
            state: 'fail',
            detail: `HTTP ${res.http_status} — qabul qiluvchi rad etdi`,
          };

  const sign: StepCheck = res.secret_configured
    ? {
        label: 'Imzo',
        state: 'ok',
        detail: 'sekret sozlangan — ular imzoni tekshira oladi',
      }
    : {
        /**
         * Sekretsiz ham ishlaydi, shuning uchun `warn`. Lekin qabul qiluvchi
         * so'rov BIZDAN kelganini tasdiqlay olmaydi — bu xavfsizlik bo'shligi.
         */
        label: 'Imzo',
        state: 'warn',
        detail: "sekret yo'q — ular so'rov bizdan kelganini tasdiqlay olmaydi",
      };

  return [shape, reached, code, sign];
};

/** Chiquvchi ulanish healthcheck → uch qadam. */
export const outboundChecks = (
  url: string,
  res: { ok?: boolean; status?: number; response_time_ms?: number } | null,
  error?: string | null,
): StepCheck[] => {
  const shape = checkUrlShape(url);
  if (!res && !error) return [shape];

  const status = typeof res?.status === 'number' ? res.status : null;

  const reached: StepCheck =
    status !== null
      ? {
          label: 'Aloqa',
          state: 'ok',
          detail: `javob keldi${
            res?.response_time_ms ? ` (${res.response_time_ms} ms)` : ''
          }`,
        }
      : { label: 'Aloqa', state: 'fail', detail: error || 'javob kelmadi' };

  const code: StepCheck =
    status === null
      ? { label: 'Javob kodi', state: 'skip', detail: 'aloqa bo‘lmadi' }
      : status >= 200 && status < 300
        ? { label: 'Javob kodi', state: 'ok', detail: `HTTP ${status}` }
        : {
            label: 'Javob kodi',
            state: 'fail',
            detail: `HTTP ${status} — so'rov qabul qilinmadi`,
          };

  return [shape, reached, code];
};
