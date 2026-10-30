/**
 * CHOP ETISH ISHINI BO'LAKLASH (HJ5sLHiz, TZ qabul 8: 200 ta chek — UI 100 ms dan ortiq qotmaydi). Joylash, PDF chizish
 * va HTML yig'ish har birlikdan keyin `checkpoint()` ni chaqiradi: joriy bo'lak `sliceMs` (32 ms) dan oshgan bo'lsa,
 * hodisalar tsikliga navbat beriladi (bosish, skroll, chizish ulguradi), aks holda ish darhol davom etadi. Qat'iy
 * «har 25 tadan» emas — vaqt bo'yicha: sekin qurilmada tez-tez, tezida kam.
 *
 * Navbat — `MessageChannel` xabari (vazifa; `setTimeout(0)` ning ichma-ich 4 ms cheklovi yo'q), u yo'q muhitda —
 * `setTimeout(0)`.
 */

/** Bitta bo'lak ish (ms): ≤ 1 kadr ikki marta — kiritish va chizish 100 ms dan ko'p kutmaydi. */
export const RECEIPT_SLICE_MS = 32;

/** Hodisalar tsikliga navbat beradi (keyingi vazifada davom etadi). */
export const yieldToMain = (): Promise<void> =>
  new Promise<void>((resolve) => {
    if (typeof MessageChannel === "function") {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });

export interface ReceiptScheduler {
  /** Ish oralig'ida chaqiriladi: bo'lak `sliceMs` dan oshgan bo'lsa — navbat beradi, aks holda darhol qaytadi. */
  checkpoint: () => Promise<void>;
  /** Berilgan navbatlar soni (test va o'lchov uchun). */
  readonly yields: number;
}

export interface ReceiptSchedulerOptions {
  sliceMs?: number;
  /** Vaqt manbai (sukut `performance.now`; testda — soxta soat). */
  now?: () => number;
  /** Navbat berish (sukut `yieldToMain`). */
  yieldTo?: () => Promise<void>;
}

export const createReceiptScheduler = ({
  sliceMs = RECEIPT_SLICE_MS,
  now = () => performance.now(),
  yieldTo = yieldToMain,
}: ReceiptSchedulerOptions = {}): ReceiptScheduler => {
  let sliceStart = now();
  let yields = 0;
  return {
    checkpoint: async () => {
      if (now() - sliceStart < sliceMs) return;
      await yieldTo();
      yields += 1;
      sliceStart = now();
    },
    get yields() {
      return yields;
    },
  };
};
