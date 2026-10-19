import { useCallback, useState, type ReactNode } from "react";
import { notify, type NotifyOptions } from "../notify";
import { isScannerCameraMounted } from "./scannerHost";

/**
 * SKAN OQIMI YORDAMCHILARI (Trello v1eLN2tV, 2-bosqich) — kamera maqsadi (`ScanTarget.list`) va xabarlar.
 *
 *   - `useRecentScans` — skanerlangan kalitlar tartibi: kamera «Ro'yxat»ida va oxirgi skan qatorida yangisi
 *     birinchi (tanlov `Set` tartibni saqlamaydi, qo'lda belgilanganlar esa oxirida);
 *   - `scanNotify` — skan natijasi xabari: kamera ochiq bo'lsa chiqmaydi (natija kamera ichida —
 *     `playScanFeedback(type, message)`; global `ScanFeedbackOverlay` ham shu qoida bilan jim).
 */

/** Kalitlar — qo'shilish tartibida (oxirgisi eng yangi). */
export const useRecentScans = () => {
  const [recent, setRecent] = useState<readonly string[]>([]);

  /** Kalit eng yangi bo'ladi (takror skan ham uni tepaga chiqaradi). */
  const touch = useCallback((key: string) => {
    setRecent((previous) => [...previous.filter((item) => item !== key), key]);
  }, []);

  const forget = useCallback((key: string) => {
    setRecent((previous) => (previous.includes(key) ? previous.filter((item) => item !== key) : previous));
  }, []);

  const clear = useCallback(() => setRecent([]), []);

  return { recent, touch, forget, clear };
};

/** Yangi skanerlanganlar birinchi; skanersiz (qo'lda belgilangan) qatorlar — oxirida, asl tartibda. */
export const orderByRecent = <T,>(items: readonly T[], keyOf: (item: T) => string, recent: readonly string[]): T[] => {
  const rank = new Map(recent.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index, rank: rank.get(keyOf(item)) ?? -1 }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map(({ item }) => item);
};

const unlessCamera =
  (show: (message: ReactNode, options?: NotifyOptions) => string) =>
  (message: ReactNode, options?: NotifyOptions): string | null =>
    isScannerCameraMounted() ? null : show(message, options);

/** Skan natijasi xabari — kamera ochiq bo'lsa jim (natija kamera ichida ko'rinadi). */
export const scanNotify = {
  success: unlessCamera(notify.success),
  info: unlessCamera(notify.info),
  warning: unlessCamera(notify.warning),
  error: unlessCamera(notify.error),
};
