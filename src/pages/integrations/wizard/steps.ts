import type { WebhookTestResult } from "../../../entities/partners";

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

export type CheckState = "ok" | "fail" | "warn" | "skip";

export interface StepCheck {
  labelKey: string;
  state: CheckState;
  detailKey: string;
  /** `detailKey` ichidagi `{{...}}` orniga qoyiladigan qiymatlar. */
  detailParams?: Record<string, string | number>;
}

/** Manzil shaklini BIZ tekshiramiz — so'rov yuborishdan oldin. */
export const checkUrlShape = (raw: string): StepCheck => {
  const url = raw.trim();
  if (!url) {
    return { labelKey: "stpUrl", state: "fail", detailKey: "stpUrlEmpty" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { labelKey: "stpUrl", state: "fail", detailKey: "stpUrlBadShape" };
  }
  if (parsed.protocol !== "https:") {
    /**
     * `http` — ogohlantirish, xato emas: ichki tarmoqda ishlashi mumkin.
     * Lekin imzo va ma'lumot ochiq ketadi, shuni aytish kerak.
     */
    return {
      labelKey: "stpUrl",
      state: "warn",
      detailKey: "stpUrlNotHttps",
      detailParams: { protocol: parsed.protocol },
    };
  }
  return {
    labelKey: "stpUrl",
    state: "ok",
    detailKey: "rawValue",
    detailParams: { value: parsed.origin },
  };
};

/** Hamkor webhook sinovi → to'rt qadam. */
export const partnerChecks = (url: string, res: WebhookTestResult | null): StepCheck[] => {
  const shape = checkUrlShape(url);
  if (!res) return [shape];

  const reached: StepCheck =
    res.http_status !== null
      ? {
          labelKey: "stpReach",
          state: "ok",
          detailKey: "stpReached",
          detailParams: { ms: res.duration_ms ?? 0 },
        }
      : {
          labelKey: "stpReach",
          state: "fail",
          // Tarmoq xatosi — manzil yoki server tomonda. Server matni
          // TARJIMA QILINMAYDI: u qanday kelsa shunday korsatiladi.
          ...(res.error
            ? { detailKey: "rawValue", detailParams: { value: res.error } }
            : { detailKey: "stpNoResponse" }),
        };

  const code: StepCheck =
    res.http_status === null
      ? { labelKey: "stpCode", state: "skip", detailKey: "stpCodeSkip" }
      : res.http_status >= 200 && res.http_status < 300
        ? {
            labelKey: "stpCode",
            state: "ok",
            detailKey: "rawValue",
            detailParams: { value: `HTTP ${res.http_status}` },
          }
        : {
            labelKey: "stpCode",
            state: "fail",
            detailKey: "stpCodeRejected",
            detailParams: { status: res.http_status },
          };

  const sign: StepCheck = res.secret_configured
    ? { labelKey: "stpSign", state: "ok", detailKey: "stpSignOk" }
    : {
        /**
         * Sekretsiz ham ishlaydi, shuning uchun `warn`. Lekin qabul qiluvchi
         * so'rov BIZDAN kelganini tasdiqlay olmaydi — bu xavfsizlik bo'shligi.
         */
        labelKey: "stpSign",
        state: "warn",
        detailKey: "stpSignMissing",
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

  const status = typeof res?.status === "number" ? res.status : null;

  const reached: StepCheck =
    status !== null
      ? {
          labelKey: "stpReach",
          state: "ok",
          ...(res?.response_time_ms
            ? { detailKey: "stpReached", detailParams: { ms: res.response_time_ms } }
            : { detailKey: "stpReachedNoMs" }),
        }
      : {
          labelKey: "stpReach",
          state: "fail",
          ...(error
            ? { detailKey: "rawValue", detailParams: { value: error } }
            : { detailKey: "stpNoResponse" }),
        };

  const code: StepCheck =
    status === null
      ? { labelKey: "stpCode", state: "skip", detailKey: "stpCodeSkip" }
      : status >= 200 && status < 300
        ? {
            labelKey: "stpCode",
            state: "ok",
            detailKey: "rawValue",
            detailParams: { value: `HTTP ${status}` },
          }
        : {
            labelKey: "stpCode",
            state: "fail",
            detailKey: "stpCodeNotAccepted",
            detailParams: { status },
          };

  return [shape, reached, code];
};
