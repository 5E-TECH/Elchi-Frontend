import { useQueries } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

/**
 * Kuryer va filial NOMLARI — detal javobida faqat id bor.
 *
 * Faqat backend ruxsat bergan rollar so'raydi (aks holda 403 — foydasiz
 * so'rov). Xato yoki ruxsat yo'q bo'lsa nom `null` qoladi va UI `#id`
 * ko'rsatadi: id ham foydali, yolg'on nom esa emas.
 */

export interface PersonContact {
  name: string | null;
  phone: string | null;
}

const unwrap = (payload: unknown): Record<string, unknown> => {
  const outer = (payload ?? {}) as { data?: unknown };
  const inner = (outer.data ?? outer) as { data?: unknown };
  const value = (inner && typeof inner === "object" && "data" in inner ? inner.data : inner) as unknown;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
};

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export const orderMetaUserKey = (id: string) => ["order-meta", "user", id] as const;
export const orderMetaBranchKey = (id: string) => ["order-meta", "branch", id] as const;

export const useOrderMetaLookups = (params: {
  userIds: string[];
  branchIds: string[];
  canUsers: boolean;
  canBranches: boolean;
}) => {
  const userIds = params.canUsers ? [...new Set(params.userIds)] : [];
  const branchIds = params.canBranches ? [...new Set(params.branchIds)] : [];

  const users = useQueries({
    queries: userIds.map((id) => ({
      queryKey: orderMetaUserKey(id),
      queryFn: () =>
        api.get(API_ENDPOINTS.USERS.BY_ID(id)).then((res): PersonContact => {
          const user = unwrap(res.data);
          return { name: str(user.name), phone: str(user.phone_number) };
        }),
      staleTime: 5 * 60_000,
      retry: false,
      meta: { silentError: true },
    })),
  });

  const branches = useQueries({
    queries: branchIds.map((id) => ({
      queryKey: orderMetaBranchKey(id),
      queryFn: () =>
        api.get(API_ENDPOINTS.BRANCHES.BY_ID(id)).then((res) => str(unwrap(res.data).name)),
      staleTime: 5 * 60_000,
      retry: false,
      meta: { silentError: true },
    })),
  });

  const userById = new Map<string, PersonContact>();
  userIds.forEach((id, index) => {
    const data = users[index]?.data;
    if (data) userById.set(id, data);
  });
  const branchNameById = new Map<string, string>();
  branchIds.forEach((id, index) => {
    const name = branches[index]?.data;
    if (name) branchNameById.set(id, name);
  });

  return { userById, branchNameById };
};
