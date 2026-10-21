import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import { toChannelStatus, toCountMap, type ChannelStatusCounts } from "../../../entities/notification-dispatch";
import { BROADCAST_ROLES, type DispatchPayload, type RecipientMode } from "../model/schema";

export type DispatchResult = {
  /** Tarix id'si (`client_request_id`) — `GET /notifications/sent/:dispatch_id`. Yo'q bo'lsa — so'rovdagi id. */
  dispatch_id: string | null;
  dispatched: number;
  recipient_ids: string[];
  channels: string[];
  telegram: unknown;
  /**
   * Ayni `client_request_id` bilan avvalgi urinish bor edi — backend QAYTA YUBORMADI va tarixdagi natijani qaytardi
   * (200). `status` — o'sha urinishning tarixdagi holati: `sent` · `partial` · `inbox_only` · `skipped` (yuborilgan),
   * `running` (hali yuborilmoqda), `failed` (xato bilan tugagan). Yangi yuborishda `status` yo'q (`null`).
   */
  duplicate: boolean;
  status: string | null;
  /** Kanal bo'yicha haqiqatan ketgan / navbatga qo'yilgan son (`in_app` — qutiga yozilgan). */
  by_channel: Record<string, number>;
  /** Kanal × holat soni (`{ telegram: { queued: 131, skipped: 17 } }`); tarix yozilmagan bo'lsa `null`. */
  channel_status: ChannelStatusCounts | null;
  /** Provayderi ulanmagan kanallar. */
  no_provider: string[];
  /** Bildirishnomani o'chirganlar (sozlama bilan tushib qolgan) — qabul qiluvchilar = `dispatched` + shu. */
  skipped_by_preference: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const unwrap = (payload: unknown) => {
  const record = asRecord(payload);
  return "data" in record ? asRecord(record.data) : record;
};

/**
 * ⚠️ `retry: 0` (mutatsiya standarti) — ATAYLAB. Rol/hammaga yuborish sekin:
 * gateway 504 qaytarsa ham qatorlar baribir yozilib ketadi. Avtomatik qayta
 * yuborish dublikat demak. Qo'lda qayta yuborishni `client_request_id`
 * (payload'da, forma qo'yadi) himoyalaydi.
 */
export const useDispatchNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DispatchPayload): Promise<DispatchResult> => {
      const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.DISPATCH, payload);
      const data = unwrap(response.data);
      const skipped = Number(data.skipped_by_preference ?? 0);
      return {
        dispatch_id: typeof data.dispatch_id === "string" && data.dispatch_id ? data.dispatch_id : null,
        dispatched: Number(data.dispatched ?? 0),
        recipient_ids: Array.isArray(data.recipient_ids) ? data.recipient_ids.map(String) : [],
        channels: Array.isArray(data.channels) ? data.channels.map(String) : [],
        telegram: data.telegram ?? null,
        duplicate: data.duplicate === true,
        status: typeof data.status === "string" ? data.status : null,
        by_channel: toCountMap(data.by_channel),
        channel_status: toChannelStatus(data.channel_status),
        no_provider: Array.isArray(data.no_provider) ? data.no_provider.map(String) : [],
        skipped_by_preference: Number.isFinite(skipped) && skipped > 0 ? skipped : 0,
      };
    },
    retry: 0,
    onSuccess: async () => {
      // Yuboruvchi o'zi ham qabul qiluvchi bo'lishi mumkin — inbox yangilansin.
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
    },
  });
};

export type RecipientUser = { id: string; name: string; phone_number?: string; role?: string };

const toUsers = (payload: unknown): { items: RecipientUser[]; total: number } => {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const rawItems = [data.items, data.users, record.items, record.data].find(Array.isArray) as unknown[] | undefined;
  const meta = asRecord(data.meta ?? record.meta ?? data);
  const items = (rawItems ?? []).map((raw) => {
    const user = asRecord(raw);
    return {
      id: String(user.id ?? ""),
      name: String(user.name ?? user.username ?? user.phone_number ?? user.id ?? ""),
      phone_number: user.phone_number ? String(user.phone_number) : undefined,
      role: user.role ? String(user.role) : undefined,
    };
  });
  const total = Number(meta.total ?? meta.totalUsers ?? items.length);
  return { items: items.filter((user) => user.id), total: Number.isFinite(total) ? total : items.length };
};

const fetchUsers = async (params: Record<string, unknown>) =>
  toUsers((await api.get(API_ENDPOINTS.USERS.BASE, { params })).data);

/** "Bitta odam" / "Tanlangan ro'yxat" — ism yoki telefon bo'yicha qidiruv. */
export const useRecipientSearch = (search: string, enabled: boolean) =>
  useQuery({
    queryKey: ["notification-dispatch", "recipients", search],
    queryFn: () => fetchUsers({ search: search || undefined, page: 1, limit: 20 }),
    enabled,
    staleTime: 30_000,
  });

/**
 * "Taxminan N ta qabul qiluvchi". Har rol uchun foydalanuvchilar ro'yxati
 * jami soni (`role` + `limit: 1`) — backend qabul qiluvchini xuddi shu
 * ro'yxatdan yig'adi. ⚠️ Rolsiz ro'yxatda `meta.total` sahifadagi qatorlar
 * soni bo'lib keladi (jonli: `limit=1` → 1), shuning uchun "Hamma" ham
 * rollar yig'indisi.
 */
export const useRecipientEstimate = (
  mode: RecipientMode,
  { roles, listSize }: { roles: string[]; listSize: number },
) => {
  const countedRoles: readonly string[] = mode === "roles" ? roles : mode === "all" ? BROADCAST_ROLES : [];
  const roleCounts = useQueries({
    queries: countedRoles.map((role) => ({
      queryKey: ["notification-dispatch", "count", role],
      queryFn: () => fetchUsers({ role, page: 1, limit: 1 }).then((result) => result.total),
      staleTime: 60_000,
    })),
  });

  if (mode === "single") return { count: 1, loading: false };
  if (mode === "list") return { count: listSize, loading: false };
  if (roleCounts.some((query) => query.isLoading)) return { count: null, loading: true };
  return { count: roleCounts.reduce((sum, query) => sum + (query.data ?? 0), 0), loading: false };
};
