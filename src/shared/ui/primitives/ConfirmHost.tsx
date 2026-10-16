import { useEffect, useState, useSyncExternalStore } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  cancelAllConfirms,
  getConfirmSnapshot,
  registerConfirmHost,
  removeConfirm,
  settleConfirm,
  subscribeConfirm,
  type ConfirmRequest,
} from "./dialog/confirmStore";

/** Va'dami (`then` bor). */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value != null && typeof (value as PromiseLike<unknown>).then === "function";

const runConfirm = (request: ConfirmRequest): unknown => {
  const action = request.options.onConfirm;
  if (!action) {
    settleConfirm(request.id, true);
    return undefined;
  }
  const result = action();
  if (isThenable(result)) return Promise.resolve(result).then(() => settleConfirm(request.id, true));
  settleConfirm(request.id, true);
  return undefined;
};

/**
 * TASDIQLASH OYNALARI MANZILI — `useConfirm()` / `confirm()` so'rovlari shu yerda `ConfirmDialog`
 * bo'lib chiziladi (`overlay` qatlami, 1200; oyna ichidan chaqirilsa — o'sha oyna ustida).
 * Ilovada bir marta, `src/app/providers/UiHost.tsx` orqali. Ikkinchi nusxa (masalan test yordamchisi)
 * hech narsa chizmaydi — faqat birinchi ro'yxatdan o'tgan host.
 *
 * Bir vaqtda bitta oyna; navbatdagisi oldingisi yopilgach. Brauzerda «Orqaga» bosilsa (sahifa
 * almashdi) ochiq so'rovlar bekor qilinadi (`false`).
 */
export const ConfirmHost = () => {
  const [token] = useState(() => Symbol("confirm-host"));
  const { hosts, requests } = useSyncExternalStore(subscribeConfirm, getConfirmSnapshot, getConfirmSnapshot);

  useEffect(() => registerConfirmHost(token), [token]);

  const hasOpen = requests.some((request) => request.open);
  useEffect(() => {
    if (!hasOpen) return;
    window.addEventListener("popstate", cancelAllConfirms);
    return () => window.removeEventListener("popstate", cancelAllConfirms);
  }, [hasOpen]);

  if (hosts[0] !== token) return null;
  const current = requests[0];
  if (!current) return null;

  return (
    <ConfirmDialog
      key={current.id}
      {...current.options}
      open={current.open}
      onCancel={() => settleConfirm(current.id, false)}
      onConfirm={() => runConfirm(current)}
      onExited={() => removeConfirm(current.id)}
    />
  );
};
