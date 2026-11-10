import { useSyncExternalStore } from "react";

/**
 * Brauzer aloqasi (`navigator.onLine` + `online`/`offline`) — maket `superadmin-ai-assistant-offline`: oflaynda
 * kiritish o'chiq («Internet aloqasi yo'q»), uzilgan javobni qayta yuborib bo'lmaydi. «Wi-Fi bor, internet yo'q»
 * holatini bu bilmaydi — u oqim xatosidan («Aloqa uzildi») ko'rinadi.
 */
const subscribe = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

const getSnapshot = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

export const useOnline = () => useSyncExternalStore(subscribe, getSnapshot, () => true);
