import axios, { AxiosError, CanceledError, type AxiosAdapter, type GenericAbortSignal, type InternalAxiosRequestConfig } from "axios";
import { isBrowserOffline } from "../lib/chunkError";
import { isRequestTimeout, NETWORK_RETRIED_FLAG } from "../lib/errorKind";

/**
 * O'QISH SO'ROVLARI — SEKIN INTERNET (2026-11-07). EDGE / Slow 3G da liniya 15–20 s+ «qotib» qoladi; 20 s chegara
 * (qJjLP109) ma'lumotni yuklamay taslim bo'lardi.
 *
 *   - GET / HEAD, vaqtini o'zi bermagan (`API_TIMEOUT_MS`) — 60 s (`READ_TIMEOUT_MS`);
 *   - vaqt tugasa — jim, `READ_TIMEOUT_RETRY_DELAYS_MS` bo'yicha qayta (sukut 1 marta, 2 s dan keyin); interceptor
 *     va React Query BITTA natijani ko'radi: «Server javob bermadi» faqat oxirgi urinishdan keyin;
 *   - javob umuman kelmadi (`ERR_NETWORK`: mobil liniyada ulanish uzilishi, Cloudflare/tunnel qisqa xatosi) — jim,
 *     `READ_NETWORK_RETRY_DELAYS_MS` bo'yicha qayta (2 marta: 1 s va 3 s dan keyin, 2026-11-20). Ilgari birinchi
 *     uzilishdayoq «Internet aloqasi yo'q» chiqardi, React Query 1 s dan keyin qayta so'rab odatda muvaffaqiyatli
 *     bo'lardi — qizil va yashil xabar ketma-ket «miltillardi». Brauzer o'zi oflayn (`navigator.onLine === false`)
 *     bo'lsa — kutilmaydi, xabar darhol;
 *   - React Query vaqt chegarasini va adapter qayta uringan tarmoq xatosini qayta urinmaydi (`shouldRetryQuery`) —
 *     ikki qavatli qayta urinish yo'q;
 *   - qayta urinilmaydi: amallar (POST/PATCH/PUT/DELETE — 20 s, avvalgidek; javobsiz amal serverga yetgan bo'lishi
 *     mumkin), o'z vaqti bor so'rov (eksport 120 s), `failFast` (skaner qidiruvi), bekor qilingan so'rov, boshqa
 *     kirish (`loginEpoch`), shu GET dan keyin ayni URL ga yangisi yuborilgan bo'lsa (React Query `invalidate`
 *     tashlab ketgan so'rov — yig'ilib qolmasin).
 */
declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * Tezkor GET (skaner qidiruvi): 20 s (`API_TIMEOUT_MS`) qoladi va vaqt tugasa jim qayta urinilmaydi — operator
     * qayta skanerlaydi, skaner oqimi 2 daqiqa band bo'lmaydi.
     */
    failFast?: boolean;
  }
}

export const READ_TIMEOUT_MS = 60_000;
export const READ_TIMEOUT_RETRY_DELAYS_MS: readonly number[] = [2_000];
/** Javobsiz GET (`ERR_NETWORK`) qayta urinishlari orasidagi kutish — jami ~4 s, keyin xabar. */
export const READ_NETWORK_RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000];

type ReadConfig = InternalAxiosRequestConfig & { _loginEpoch?: number; [NETWORK_RETRIED_FLAG]?: boolean };

/** Javob umuman kelmadi (vaqt tugashi va bekor qilish emas) — brauzer `ERR_NETWORK`. */
const isNoResponse = (error: unknown) =>
  axios.isAxiosError(error) && !error.response && error.code === AxiosError.ERR_NETWORK;

export type ReadRetryOptions = {
  /** Instansiya sukuti (`API_TIMEOUT_MS`) — shu qiymatdagi GET «vaqtini o'zi bermagan» hisoblanadi. */
  defaultTimeout: number;
  /** Joriy kirish davri (`auth/loginEpoch.ts`); so'rov boshqa davrda yuborilgan bo'lsa — qayta urinilmaydi. */
  getLoginEpoch?: () => number;
};

const isRead = (method: string | undefined) => method === "get" || method === "head";

const wait = (ms: number, signal?: GenericAbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener?.("abort", done);
  });

/** Ayni GET ning eng so'nggi yuborilgani (kalit — metod + to'liq URL). */
const latestRead = new Map<string, number>();
let readSeq = 0;

export const withReadTimeoutRetry = (base: AxiosAdapter, options: ReadRetryOptions): AxiosAdapter =>
  async (rawConfig) => {
    const config = rawConfig as ReadConfig;
    const eligible =
      isRead(config.method) &&
      config.failFast !== true &&
      (config.timeout === options.defaultTimeout || config.timeout === READ_TIMEOUT_MS);
    if (!eligible) return base(config);

    config.timeout = READ_TIMEOUT_MS;
    const key = `${config.method} ${axios.getUri(config)}`;
    const seq = ++readSeq;
    latestRead.set(key, seq);
    // Qayta yuborish mumkinmi: shu GET dan keyin ayni URL ga yangisi ketmagan va kirish davri o'zgarmagan.
    const stillWanted = () =>
      latestRead.get(key) === seq &&
      !(options.getLoginEpoch && config._loginEpoch !== undefined && config._loginEpoch !== options.getLoginEpoch());
    // Har xato turi o'z sanog'i bilan (vaqt tugashi va javobsizlik aralashsa ham chegara o'zgarmaydi).
    let timeoutRetries = 0;
    let networkRetries = 0;
    try {
      for (;;) {
        try {
          return await base(config);
        } catch (error) {
          if (config.signal?.aborted || !stillWanted()) throw error;
          let delay: number | undefined;
          if (isRequestTimeout(error)) {
            delay = READ_TIMEOUT_RETRY_DELAYS_MS[timeoutRetries++];
          } else if (isNoResponse(error) && !isBrowserOffline()) {
            delay = READ_NETWORK_RETRY_DELAYS_MS[networkRetries++];
            // Adapter o'z navbatini ishlatdi — React Query bu xatoni yana qayta so'ramaydi (`shouldRetryQuery`).
            if (delay === undefined) config[NETWORK_RETRIED_FLAG] = true;
          }
          if (delay === undefined) throw error;
          await wait(delay, config.signal);
          if (config.signal?.aborted) throw new CanceledError(undefined, config);
          if (!stillWanted()) throw error;
        }
      }
    } finally {
      if (latestRead.get(key) === seq) latestRead.delete(key);
    }
  };
