/**
 * Ro'yxat javobini antd Table uchun massivga keltiradi.
 *
 * Backend ro'yxatlarni konvertda qaytaradi: `{ statusCode, message, data: { items } }`.
 * Konvertni to'g'ridan-to'g'ri `dataSource` ga berish antd ichida
 * `te.some is not a function` bilan butun ilovani /runtime-error ga otadi.
 * Qabul qilinadigan shakllar: massiv | `{ items }` | `{ data: [] }` | `{ data: { items } }`.
 * Boshqa har qanday shaklda bo'sh massiv qaytadi.
 */
export const toRows = <T = Record<string, unknown>>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as { items?: unknown; data?: unknown };
  if (Array.isArray(record.items)) return record.items as T[];
  if (record.data !== undefined) return toRows<T>(record.data);
  return [];
};
