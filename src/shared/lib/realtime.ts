/**
 * Jonli kanal holati (uRkw6lk0, backend `/realtime` namespace — FRONTEND_CHANGELOG 2026-10-14 m9BOlEbE).
 *
 * Ulanishni `app/providers/RealtimeSync` boshqaradi; bu modul faqat «socket hozir ulanganmi» degan bayroqni
 * saqlaydi — polling shunga qarab sekinlashadi (ulangan: 5 daqiqa, uzilgan: 60 s zaxira).
 */
type Listener = () => void;

let connected = false;
const listeners = new Set<Listener>();

export const isRealtimeConnected = () => connected;

export const setRealtimeConnected = (value: boolean) => {
  if (connected === value) return;
  connected = value;
  for (const listener of listeners) listener();
};

export const subscribeRealtime = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Socket ulangan paytda bildirishnoma sanog'i shu oraliqda zaxira sifatida so'raladi. */
export const REALTIME_FALLBACK_POLL_MS = 5 * 60_000;
/** Socket uzilgan (yoki hali ulanmagan) paytdagi oddiy polling. */
export const OFFLINE_POLL_MS = 60_000;

/** Badge sanog'ining polling oralig'i (`useUnreadCount`): socket ulangan — 5 daqiqa, aks holda — 60 s. */
export const unreadCountPollInterval = () => (connected ? REALTIME_FALLBACK_POLL_MS : OFFLINE_POLL_MS);

/**
 * socket.io manzili: namespace `/realtime` API HOSTIDA (yo'li `/socket.io/`). `BASE_URL` da yo'l bo'lsa ham
 * (`…/api`) namespace unga qo'shilmaydi — faqat origin olinadi.
 */
export const realtimeUrl = (baseUrl: string) => `${new URL(baseUrl, window.location.href).origin}/realtime`;

/** Dev rejimida ulanish holati konsolda, prod'da jim (kartaning 6-bandi). */
export const logRealtime = (message: string, detail?: unknown) => {
  if (!import.meta.env.DEV) return;
  if (detail === undefined) console.info(`[realtime] ${message}`);
  else console.info(`[realtime] ${message}`, detail);
};
