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

type BackendIdentityUser = Partial<IdentityUser> & {
  id?: string | number;
  _id?: string | number;
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_number?: string;
};

const normalizeUser = (value: BackendIdentityUser): IdentityUser => {
  const username = value.username ?? value.phone_number ?? value.phone ?? "";
  const composedName = [value.first_name, value.last_name].filter(Boolean).join(" ");

  return {
    ...value,
    id: String(value.id ?? value._id ?? ""),
    fullName: value.fullName || value.full_name || value.name || composedName || username,
    username,
    phone: value.phone ?? value.phone_number,
  };
};

const normalizeUsers = (value: unknown): IdentityUser[] => {
  const response = value as Record<string, unknown>;
  const responseData = response.data as unknown;
  const responseDataRecord =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : null;

  const users = Array.isArray(value)
    ? value
    : Array.isArray(responseData)
      ? responseData
      : Array.isArray(response.items)
        ? response.items
        : Array.isArray(responseDataRecord?.items)
          ? responseDataRecord.items
          : [];

  return (users as BackendIdentityUser[]).map(normalizeUser);
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
