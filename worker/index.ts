/**
 * Bir domenli API (same-origin) — Worker kirish nuqtasi (`wrangler.jsonc` → `env.staging.main`).
 *
 * ⚠️ Bu modul FAQAT `default` eksport qiladi: workerd asosiy modulning har nomli eksportini entrypoint (handler yoki
 * klass) deb biladi — oddiy konstanta (`API_PREFIX`) Worker'ni ishga tushirmaydi. Proksi qoidalari va yordamchilar —
 * `./proxy.ts` (testlar: `src/test/apiProxyWorker.test.ts`).
 */
import { type Env, handleRequest } from "./proxy";

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
