import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/api';
import { API_ENDPOINTS } from '../../shared/api';

/**
 * INTEGRATSIYA METRIKASI.
 *
 * Panel ilgari faqat "sozlangan / sozlanmagan" ko'rsatardi. Operatorning
 * haqiqiy savoli esa boshqa — "ISHLAYAPTIMI?". Sozlama to'g'ri bo'lib,
 * hodisalar yetmayotgan bo'lishi mumkin (hamkor 500 qaytaradi, sekret
 * almashtirilgan, manzil o'zgargan).
 *
 * ⚠️ `null` VA 0 NI ARALASHTIRMANG. Backend ataylab `null` qaytaradi:
 *   `avg_ms: null`        — javob vaqti o'lchanmagan (yoki outbound ulanish)
 *   `success_rate: null`  — hali yakunlangan hodisa yo'q
 * UI'da ular "—" bo'lib chiqishi kerak. `0` deb ko'rsatish "bir zumda javob
 * berdi" yoki "hammasi yiqildi" degan YOLG'ON xabar bo'lardi.
 */
export interface ConnectionMetrics {
  /** `partner:7` yoki `integration:12` — ro'yxat kaliti bilan bir xil. */
  uid: string;
  kind: 'partner' | 'integration';
  id: string;
  events: number;
  delivered: number;
  failed: number;
  /** Navbat 24 soatlik oynadan TASHQARI hisoblanadi — eski navbat ham sanaladi. */
  queued: number;
  /** Foiz (0–100) yoki `null` — yakunlangan hodisa bo'lmasa. */
  success_rate: number | null;
  /** Millisekund yoki `null` — o'lchanmagan bo'lsa. */
  avg_ms: number | null;
  last_event_at: string | null;
}

export interface IntegrationMetrics {
  window_hours: number;
  totals: { events: number; failed: number; queued: number };
  connections: ConnectionMetrics[];
}

const EMPTY: IntegrationMetrics = {
  window_hours: 24,
  totals: { events: 0, failed: 0, queued: 0 },
  connections: [],
};

const unwrap = <T,>(raw: unknown, fallback: T): T =>
  ((raw as { data?: T })?.data ?? fallback) as T;

export const metricsKey = ['integration-metrics'] as const;

/**
 * `hours` — oyna. Backend 1..168 oralig'iga qisadi.
 *
 * `refetchInterval` ATAYLAB qo'yilmadi: bu ekran kamdan-kam ochiladi va
 * avtomatik yangilash ochiq turgan sahifadan har daqiqada so'rov yuborardi.
 * Operator "Yangilash" bilan o'zi so'raydi; `staleTime` esa tab almashganda
 * keraksiz so'rovni to'sadi.
 */
export const useIntegrationMetrics = (hours?: number) =>
  useQuery({
    queryKey: [...metricsKey, hours ?? 24],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.METRICS, {
          params: hours ? { hours } : undefined,
        })
        .then((res) => unwrap<IntegrationMetrics>(res.data, EMPTY)),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

/** `uid` bo'yicha tez qidirish uchun xarita. */
export const metricsByUid = (
  data?: IntegrationMetrics,
): Map<string, ConnectionMetrics> =>
  new Map((data?.connections ?? []).map((c) => [c.uid, c]));

/**
 * Ulanish HOLATI — metrika va sozlamadan birga chiqadi.
 *
 * Nega alohida funksiya: holat nuqtasi uch joyda ko'rsatiladi (jadval, chap
 * ro'yxat, detal sarlavhasi) va ular AYNI qoidaga tayanishi kerak. Har joyda
 * qaytadan yozilsa, bir ekranda yashil, boshqasida sariq ko'rinardi.
 */
export type ConnectionHealth = 'ok' | 'attention' | 'off';

export const connectionHealth = (opts: {
  isActive: boolean;
  configured: boolean;
  metrics?: ConnectionMetrics;
}): ConnectionHealth => {
  // O'chirilgan — ataylab to'xtatilgan, xato EMAS.
  if (!opts.isActive) return 'off';
  // Sozlamasi tugallanmagan — hodisalar hech qayerga ketmaydi.
  if (!opts.configured) return 'attention';
  // Yetmagan hodisa bor — sozlama to'g'ri bo'lsa ham e'tibor kerak.
  if ((opts.metrics?.failed ?? 0) > 0) return 'attention';
  return 'ok';
};

/**
 * O'LCHANMAGAN QIYMATNI CHIZISH — bitta joyda.
 *
 * `null` "—" bo'lib chiqadi, HECH QACHON `0` emas. Nega alohida funksiya:
 * bu qoida uch ekranda (Manzara jadvali, Konsol metrika qatori, ro'yxat
 * yon paneli) takrorlanadi. Har joyda qaytadan yozilsa, birida `0` ko'rinib
 * qolishi aniq — va `0 ms` "bir zumda javob berdi", `0%` esa "hammasi
 * yiqildi" degan YOLG'ON xabar bo'lardi.
 */
export const fmtMetric = (
  value: number | null | undefined,
  suffix = '',
): string => (value === null || value === undefined ? '—' : `${value}${suffix}`);
