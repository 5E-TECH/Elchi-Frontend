import axios, { CanceledError, type AxiosAdapter, type GenericAbortSignal, type InternalAxiosRequestConfig } from "axios";
import { isRequestTimeout } from "../lib/errorKind";

/**
 * O'QISH SO'ROVLARI — SEKIN INTERNET (2026-11-07). EDGE / Slow 3G da liniya 15–20 s+ «qotib» qoladi; 20 s chegara
 * (qJjLP109) ma'lumotni yuklamay taslim bo'lardi.
 *
 *   - GET / HEAD, vaqtini o'zi bermagan (`API_TIMEOUT_MS`) — 60 s (`READ_TIMEOUT_MS`);
 *   - vaqt tugasa — jim, `READ_TIMEOUT_RETRY_DELAYS_MS` bo'yicha qayta (sukut 1 marta, 2 s dan keyin); interceptor
 *     va React Query BITTA natijani ko'radi: «Server javob bermadi» faqat oxirgi urinishdan keyin;
 *   - React Query vaqt chegarasini qayta urinmaydi (`shouldRetryQuery`) — ikki qavatli qayta urinish yo'q;
 *   - qayta urinilmaydi: amallar (POST/PATCH/PUT/DELETE — 20 s, avvalgidek), o'z vaqti bor so'rov (eksport 120 s),
 *     `failFast` (skaner qidiruvi), bekor qilingan so'rov, boshqa kirish (`loginEpoch`), shu GET dan keyin ayni
 *     URL ga yangisi yuborilgan bo'lsa (React Query `invalidate` tashlab ketgan so'rov — yig'ilib qolmasin).
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

type ReadConfig = InternalAxiosRequestConfig & { _loginEpoch?: number };

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
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await base(config);
        } catch (error) {
          const delay = READ_TIMEOUT_RETRY_DELAYS_MS[attempt];
          if (delay === undefined || !isRequestTimeout(error) || config.signal?.aborted || !stillWanted()) throw error;
          await wait(delay, config.signal);
          if (config.signal?.aborted) throw new CanceledError(undefined, config);
          if (!stillWanted()) throw error;
        }
      }
    } finally {
      if (latestRead.get(key) === seq) latestRead.delete(key);
    }
  };
