import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { IdentityUser, User } from "../model/types";

type UseUsersParams = {
  search?: string;
  status?: User["status"];
  role?: User["role"] | User["role"][];
  page?: number;
  limit?: number;
  enabled?: boolean;
};

const normalizeUsers = (value: unknown): IdentityUser[] => {
  const response = value as Record<string, unknown>;
  const responseData = response.data as unknown;
  const responseDataRecord =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : null;

  if (Array.isArray(value)) return value as IdentityUser[];
  if (Array.isArray(responseData)) return responseData as IdentityUser[];
  if (Array.isArray(response.items)) return response.items as IdentityUser[];
  if (Array.isArray(responseDataRecord?.items)) return responseDataRecord.items as IdentityUser[];

  return [];
};

const dedupeUsers = (users: IdentityUser[]) => {
  const uniqueUsers = new Map<string, IdentityUser>();

  users.forEach((user) => {
    uniqueUsers.set(user.id, user);
  });

  return Array.from(uniqueUsers.values());
};

export const getUsers = async (params?: UseUsersParams): Promise<IdentityUser[]> => {
  const roles = Array.isArray(params?.role) ? params.role : params?.role ? [params.role] : [];

  if (roles.length > 1) {
    const responses = await Promise.all(
      roles.map((role) =>
        api.get(API_ENDPOINTS.USERS.BASE, {
          params: {
            ...params,
            role,
          },
        }),
      ),
    );

    return dedupeUsers(responses.flatMap((response) => normalizeUsers(response.data)));
  }

  const response = await api.get(API_ENDPOINTS.USERS.BASE, { params });
  return normalizeUsers(response.data);
};

export const useUsers = (params?: UseUsersParams) =>
  useQuery({
    queryKey: queryKeys.users.list(params ?? {}),
    queryFn: () => getUsers(params),
    enabled: params?.enabled ?? true,
  });
