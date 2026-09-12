import { useMemo } from 'react';
import {
  useGetIntegrations,
  type Integration,
  type IntegrationCategory,
  type IntegrationRole,
} from '../../entities/integrations';
import { usePartners, type Partner } from '../../entities/partners';
import {
  CONNECTION_TYPES,
  type ConnectionField,
  type ConnectionKind,
} from './connections';

/**
 * IKKI RO'YXATNI BITTA RO'YXATGA QO'SHISH.
 *
 * Elchi'da tashqi tizim IKKI xil jadvalda saqlanadi:
 *
 *   `partners`               — bizga API orqali ulanadiganlar (inbound).
 *                              Kalit BIZDAN chiqadi, webhook BIZ yuboramiz.
 *   `external_integrations`  — biz ulanadiganlar (outbound). Kalit ULARDA,
 *                              so'rovni BIZ yuboramiz.
 *
 * Bu texnik jihatdan to'g'ri ajratim, lekin FOYDALANUVCHI uchun ikkisi ham
 * bitta ish: "tashqi tizim bilan ulanishni sozlash". Ikki sahifa, ikki forma,
 * ikki terminologiya — tartibsizlik. Shu hook ularni bitta ro'yxatga
 * keltiradi; backend o'zgarmaydi.
 *
 * ⚠️ `uid` — `kind:id` shaklida. Ikki jadvalda id'lar mustaqil ketadi, ya'ni
 * `partners.id = 1` va `external_integrations.id = 1` bir vaqtda bo'lishi
 * mumkin. Faqat `id` bo'yicha tanlasak, ro'yxatda bir bosishda IKKI ulanish
 * belgilanib qolardi.
 */
export interface Connection {
  /** `partner:7` yoki `integration:12` — ro'yxatdagi noyob kalit. */
  uid: string;
  kind: ConnectionKind;
  id: string;
  name: string;
  role: IntegrationRole;
  category: IntegrationCategory;
  is_active: boolean;
  /**
   * Ikkinchi qatorda ko'rsatiladigan qisqa ma'lumot — ulanish holatini
   * ro'yxatdan turib bilish uchun (manzil, oxirgi sinxron va h.k.).
   */
  subtitle: string;
  /** Asl yozuv — panel undan turga xos maydonlarni o'qiydi. */
  raw: Partner | Integration;
}

const partnerToConnection = (p: Partner): Connection => ({
  uid: `partner:${p.id}`,
  kind: 'partner',
  id: String(p.id),
  name: p.name,
  /**
   * Hamkor — DOIM `source`: u bizga buyurtma beradi. `partners` jadvalida
   * `role` ustuni yo'q va kerak ham emas, chunki bu jadvalning ma'nosi
   * aynan shu.
   */
  role: 'source',
  category: 'marketplace',
  is_active: Boolean(p.is_active),
  subtitle: p.webhook_url
    ? p.webhook_url
    : "webhook manzili yo'q — status qaytmaydi",
  raw: p,
});

const integrationToConnection = (i: Integration): Connection => ({
  uid: `integration:${i.id}`,
  kind: 'integration',
  id: String(i.id),
  name: i.name,
  // Eski yozuvlarda maydon yo'q — migratsiya `carrier`/`cargo` qo'yadi.
  role: i.role ?? 'carrier',
  category: i.category ?? 'cargo',
  is_active: Boolean(i.is_active),
  subtitle: i.base_url || i.api_url || i.slug || '—',
  raw: i,
});

/**
 * Barcha ulanish — bitta ro'yxatda.
 *
 * Ikki so'rov PARALLEL ketadi (react-query o'zi shunday qiladi). Biri
 * yiqilsa ikkinchisi ko'rinishda qoladi: ro'yxat butunlay bo'sh bo'lib
 * qolishdan ko'ra yarmini ko'rsatish yaxshi, va xato alohida bildiriladi.
 */
export const useConnections = () => {
  const partnersQuery = usePartners();
  // `limit: 100` — ulanishlar soni kichik; sahifalash bu ekranda ortiqcha
  // murakkablik bo'lardi.
  const integrationsQuery = useGetIntegrations({ limit: 100 });

  const connections = useMemo<Connection[]>(() => {
    const partners = (partnersQuery.data ?? []).map(partnerToConnection);
    const integrations = (
      integrationsQuery.data?.data?.items ?? []
    ).map(integrationToConnection);
    return [...partners, ...integrations];
  }, [partnersQuery.data, integrationsQuery.data]);

  return {
    connections,
    isLoading: partnersQuery.isLoading || integrationsQuery.isLoading,
    /** Ikkalasi ham yiqilgan bo'lsa — ro'yxat umuman yo'q. */
    isError: partnersQuery.isError && integrationsQuery.isError,
    /** Qismiy xato — ro'yxat to'liq emas, buni aytish kerak. */
    partialError: partnersQuery.isError !== integrationsQuery.isError,
    refetch: () => {
      void partnersQuery.refetch();
      void integrationsQuery.refetch();
    },
  };
};

/** Rol bo'yicha guruhlaydi — ro'yxat shu tartibda chiziladi. */
export const groupByRole = (
  connections: Connection[],
  order: IntegrationRole[],
): Array<{ role: IntegrationRole; items: Connection[] }> =>
  order
    .map((role) => ({
      role,
      items: connections.filter((c) => c.role === role),
    }))
    .filter((g) => g.items.length > 0);

/**
 * Ulanish uchun mos MAYDON ro'yxatini topadi.
 *
 * Nega bu yerda: uni ikki panel (Sozlamalar, Xavfsizlik) va Konsol sarlavhasi
 * ishlatadi. Panel ichida qolsa, ikkinchisi nusxa ko'chirardi va registrga
 * yangi maydon qo'shilganda bittasi eskirib qolardi.
 */
export const fieldsFor = (c: Connection): ConnectionField[] => {
  const match =
    CONNECTION_TYPES.find(
      (t) => t.kind === c.kind && t.role === c.role && t.category === c.category,
    ) ??
    // Aniq mos kelmasa — ayni YO'NALISHdagi birinchi tur. Maydonlar yo'nalish
    // bo'yicha bir xil, farq faqat tasnifda.
    CONNECTION_TYPES.find((t) => t.kind === c.kind);
  return match?.fields ?? [];
};

/**
 * Ulanish ISHLASHGA sozlanganmi.
 *
 * ⚠️ YAGONA QOIDA. Bu javob uch joyda ishlatiladi (Manzara jadvali, Konsol
 * chap ustuni, holat nuqtasi) va ular AYNI qoidaga tayanishi shart — aks
 * holda bir ekranda "sozlangan", boshqasida "e'tibor kerak" ko'rinardi.
 *
 * Savol YO'NALISHGA qarab boshqa:
 *   inbound  — webhook manzili bormi (bo'lmasa hodisa hech qayerga ketmaydi)
 *   outbound — API manzili bormi (bo'lmasa so'rov yuborib bo'lmaydi)
 */
export const isConfigured = (c: Connection): boolean => {
  const raw = c.raw as Record<string, unknown>;
  return c.kind === 'partner'
    ? Boolean(raw.webhook_url)
    : Boolean(raw.base_url || raw.api_url);
};
