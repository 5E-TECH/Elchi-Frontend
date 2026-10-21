/** Bir martalik havola muddati (backend: `POST …/link-code` — 10 daqiqa). */
export const LINK_TTL_MS = 10 * 60_000;

/** Qolgan vaqt «m:ss» (9:41, 0:07) — raqamlar har tilda bir xil. */
export const formatLinkTimeLeft = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
