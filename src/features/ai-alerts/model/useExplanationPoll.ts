import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADVISOR_EXPLAIN_POLL_MAX_WAIT_MS,
  explanationPollInterval,
  useAdvisorAlert,
} from "../../../entities/ai-advisor";

/**
 * Ogohlantirish tafsiloti + AI izohini kutish (D15). Izoh `pending` bo'lsa GET tafsilot server bergan oraliqda
 * (`explanation_poll_after_ms`, ≥ 1 s, sukut 2 s) qayta so'raladi — `pending` birinchi ko'ringan paytdan ko'pi bilan
 * 60 s. Shundan keyin `expired` (poll to'xtaydi, UI «Izoh hali tayyor emas — keyinroq oching» + «Qayta urinish»).
 * `restart()` — yangi 60 s (izoh qayta so'ralganda). Oyna qayta ochilsa (`enabled` → `true`) kutish ham yangidan.
 *
 * ⚠️ Tafsilot GET'i ogohlantirishni «Ko'rildi» qiladi: `enabled` — faqat oyna ochiq bo'lsa (yopilganda ma'lumot keshda
 * qoladi — yopilish harakati uchun, lekin fokusda qayta so'ralmaydi).
 */
export const useExplanationPoll = (id: string | null, { enabled = true }: { enabled?: boolean } = {}) => {
  // Kutish oynasining kaliti: ogohlantirish · ochilish · qayta so'rash. Kalit almashsa — yangi 60 s.
  const [session, setSession] = useState(0);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) setSession((value) => value + 1);
  }
  const [generation, setGeneration] = useState(0);
  const key = id === null ? null : `${id}:${session}:${generation}`;
  const [expiredKey, setExpiredKey] = useState<string | null>(null);
  const windowExpired = key !== null && expiredKey === key;

  const query = useAdvisorAlert(id, { poll: !windowExpired, enabled });
  const data = query.data;
  const pending = id !== null && data?.id === id && data.explanation_status === "pending";

  const started = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (!pending || !enabled || key === null) {
      started.current = null;
      return;
    }
    if (started.current?.key !== key) started.current = { key, at: Date.now() };
    const remaining = started.current.at + ADVISOR_EXPLAIN_POLL_MAX_WAIT_MS - Date.now();
    const timer = setTimeout(() => setExpiredKey(key), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [enabled, key, pending]);

  const restart = useCallback(() => {
    started.current = null;
    setGeneration((value) => value + 1);
  }, []);

  const expired = pending && windowExpired;
  const pollMs = pending && !expired ? explanationPollInterval(data?.explanation_poll_after_ms) : 0;

  return { query, pollMs, expired, restart };
};
