import { useEffect, useState } from "react";
import { checkForNewVersion } from "../lib/appVersion";

/** Ilova ochiq va ko'rinib turganda tekshiruv oralig'i. */
export const APP_UPDATE_POLL_MS = 5 * 60_000;
/** Ikki tekshiruv orasidagi eng kam vaqt (fokus / tab almashishi ketma-ket kelganda server qayta so'ralmasin). */
export const APP_UPDATE_MIN_GAP_MS = 60_000;

type Options = {
  /** Sukut: faqat production build (dev'da entry `/src/main.tsx` — baribir aniqlanmaydi). */
  enabled?: boolean;
  /** Test uchun: serverda yangi versiya bormi. Barqaror funksiya bering — o'zgarsa kuzatuv qaytadan boshlanadi. */
  check?: () => Promise<boolean>;
};

/**
 * Ochiq turgan ilovada serverga yangi versiya chiqqanini kuzatadi (`lib/appVersion.ts`). Tekshiruv paytlari:
 *  - ilovaga QAYTILGANDA: `visibilitychange` (telefonda fondan ochish — iPhone PWA ham, kompyuterda tab almashishi),
 *    `focus` (kompyuterda boshqa oynadan qaytish), `pageshow` (Safari orqaga/oldinga keshidan tiklanish),
 *    `online` (internet qaytdi);
 *  - ochiq va ko'rinib turganda har 5 daqiqada.
 * Yashirin tabda va oflaynda so'rov yuborilmaydi; sahifa yuklangandan keyingi 1 daqiqada ham (u hozirgina eng yangi
 * versiyani olgan). Topilgach kuzatuv to'xtaydi — natija sahifa qayta yuklanguncha `true`.
 */
export const useAppUpdateAvailable = ({
  enabled = import.meta.env.PROD,
  check = checkForNewVersion,
}: Options = {}): boolean => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!enabled || available) return undefined;

    let disposed = false;
    let running = false;
    let lastCheckAt = Date.now();

    const run = async () => {
      if (disposed || running) return;
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      const now = Date.now();
      if (now - lastCheckAt < APP_UPDATE_MIN_GAP_MS) return;
      running = true;
      lastCheckAt = now;
      try {
        if ((await check()) && !disposed) setAvailable(true);
      } catch {
        // Tekshiruv xatosi foydalanuvchiga ko'rsatilmaydi — keyingi safar qayta uriniladi.
      } finally {
        running = false;
      }
    };
    const trigger = () => void run();

    document.addEventListener("visibilitychange", trigger);
    window.addEventListener("focus", trigger);
    window.addEventListener("pageshow", trigger);
    window.addEventListener("online", trigger);
    const timer = window.setInterval(trigger, APP_UPDATE_POLL_MS);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", trigger);
      window.removeEventListener("focus", trigger);
      window.removeEventListener("pageshow", trigger);
      window.removeEventListener("online", trigger);
      window.clearInterval(timer);
    };
  }, [enabled, available, check]);

  return available;
};
