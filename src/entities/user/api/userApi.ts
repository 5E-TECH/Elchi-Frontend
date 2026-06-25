import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import store from "../../../app/config/store";
import { setProfile } from "../model/slice";
import { setName, setRole } from "../../../features/auth/model/loginSlice";
import type {
  CreateAdminRequest,
  CreateCourierRequest,
  CreateManagerRequest,
  CreateMarketRequest,
  CreateRegistratorRequest,
  UpdateUserRequest,
  User,
  UserStatus,
} from "../types/user";
import { unwrapUserResponse } from "../lib/normalizeUser";

export const user = "user";

const getBackendMessageText = (error: unknown): string => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  const collect = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(collect).filter(Boolean).join(" ");
    if (typeof value === "object") {
      return Object.values(value).map(collect).filter(Boolean).join(" ");
    }
    return String(value);
  };

  return collect(data).toLowerCase();
};

const shouldRetryCourierWithoutRegion = (error: unknown) => {
  const message = getBackendMessageText(error);

  return message.includes("region_id") && message.includes("should not exist");
};

export interface IUserFilter {
  search?: string;
  status?: string;
  role?: string;
  region_id?: string;
  branch_id?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

type UserListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalMarket?: number;
  totalEmployees?: number;
  totalUsers?: number;
};

type NormalizedUserListResponse = {
  success: boolean;
  statusCode?: number;
  message?: string;
  data: {
    items: User[];
    meta: UserListMeta;
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getArray = (...values: unknown[]) =>
  values.find(Array.isArray) as unknown[] | undefined;

const getMetaRecord = (response: Record<string, unknown>, data: Record<string, unknown>) =>
  asRecord(data.meta ?? response.meta ?? data.pagination ?? response.pagination ?? data);

const normalizeUserListResponse = (
  payload: unknown,
  fallbackParams?: IUserFilter,
): NormalizedUserListResponse => {
  const response = asRecord(payload);
  const data = asRecord(response.data);
  const items = (
    getArray(
      data.items,
      data.users,
      data.results,
      response.items,
      response.users,
      response.results,
      response.data,
      payload,
    ) ?? []
  ) as User[];
  const meta = getMetaRecord(response, data);
  const page = toNumber(meta.page ?? fallbackParams?.page, fallbackParams?.page ?? 1);
  const fallbackLimit = fallbackParams?.limit ?? (items.length || 10);
  const limit = toNumber(
    meta.limit ?? meta.perPage ?? meta.per_page ?? fallbackParams?.limit,
    fallbackLimit,
  );
  const total = toNumber(
    meta.total ?? meta.totalUsers ?? meta.total_users ?? meta.count,
    items.length,
  );

  return {
    success: Boolean(response.success ?? true),
    statusCode: response.statusCode === undefined ? undefined : toNumber(response.statusCode),
    message: typeof response.message === "string" ? response.message : undefined,
    data: {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: toNumber(
          meta.totalPages ?? meta.total_pages,
          Math.max(1, Math.ceil(total / Math.max(1, limit))),
        ),
        totalMarket: meta.totalMarket === undefined
          ? undefined
          : toNumber(meta.totalMarket),
        totalEmployees: meta.totalEmployees === undefined
          ? undefined
          : toNumber(meta.totalEmployees),
        totalUsers: meta.totalUsers === undefined
          ? undefined
          : toNumber(meta.totalUsers),
      },
    },
  };
};

const dedupeUsersById = (items: User[]) => {
  const usersById = new Map<string, User>();

  items.forEach((item, index) => {
    const record = asRecord(item);
    const id = String(record.id ?? record._id ?? index);
    usersById.set(id, item);
  });

  return Array.from(usersById.values());
};

const fetchUserList = async (params?: IUserFilter) => {
  const normalizedRole = String(params?.role ?? "").toLowerCase();
  const shouldMergeMarketRoles = normalizedRole === "market" || normalizedRole === "marketing";

  if (!shouldMergeMarketRoles) {
    const response = await api.get(API_ENDPOINTS.USERS.BASE, { params });
    return normalizeUserListResponse(response.data, params);
  }

  const page = Math.max(1, toNumber(params?.page, 1));
  const limit = Math.max(1, toNumber(params?.limit, 100));
  const fetchLimit = Math.max(limit * page, 1000);
  const baseParams = { ...params, page: 1, limit: fetchLimit };

  const responses = await Promise.all(
    ["market", "marketing"].map((role) =>
      api.get(API_ENDPOINTS.USERS.BASE, {
        params: {
          ...baseParams,
          role,
        },
      }),
    ),
  );

  const normalizedResponses = responses.map((response) =>
    normalizeUserListResponse(response.data, baseParams),
  );
  const items = dedupeUsersById(
    normalizedResponses.flatMap((response) => response.data.items),
  );
  const total = items.length;
  const start = (page - 1) * limit;
  const pagedItems = items.slice(start, start + limit);

  return {
    ...normalizedResponses[0],
    data: {
      items: pagedItems,
      meta: {
        ...normalizedResponses[0].data.meta,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalMarket: total,
      },
    },
  };
};

export const useUser = () => {
  const client = useQueryClient();

  const useGetUser = (params?: IUserFilter, enabled: boolean = true) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () => fetchUserList(params),
      enabled,
      placeholderData: (prev: any) => prev,
    });

  const useGetCouriers = (params?: IUserFilter, enabled: boolean = true) =>
    useQuery({
      queryKey: ["couriers", params],
      queryFn: () => api.get(API_ENDPOINTS.COURIERS.BASE, { params }).then((res: any) => res.data),
      enabled,
    });

  const createAdmin = useMutation({
    mutationFn: (data: CreateAdminRequest) => api.post(API_ENDPOINTS.ADMINS.BASE, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const createRegistrator = useMutation({
    mutationFn: (data: CreateRegistratorRequest) =>
      api.post(API_ENDPOINTS.REGISTRATORS.BASE, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const createManager = useMutation({
    mutationFn: (data: CreateManagerRequest) =>
      api.post(API_ENDPOINTS.MANAGERS.BASE, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const createMarket = useMutation({
    mutationFn: (data: CreateMarketRequest) => api.post(API_ENDPOINTS.MARKETS.BASE, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const createCourier = useMutation({
    mutationFn: async (data: CreateCourierRequest) => {
      try {
        return await api.post(API_ENDPOINTS.COURIERS.BASE, data);
      } catch (error) {
        if (!data.region_id || !shouldRetryCourierWithoutRegion(error)) {
          throw error;
        }

        const payloadWithoutRegion = { ...data };
        delete payloadWithoutRegion.region_id;
        return api.post(API_ENDPOINTS.COURIERS.BASE, payloadWithoutRegion);
      }
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const useGetRegions = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["regions"],
      queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res: any) => res.data),
      staleTime: 5 * 60 * 1000,
      enabled,
    });

  const useGetUserById = (id: string, params?: Pick<IUserFilter, "fromDate" | "toDate">) =>
    useQuery({
      queryKey: [user, "detail", id, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.USERS.BY_ID(id), { params }).then((res: any) => res.data),
      enabled: !!id,
    });

  const useGetMyProfile = () =>
    useQuery({
      queryKey: [user, "profile"],
      queryFn: () =>
        api.get(API_ENDPOINTS.AUTH.MY_PROFILE).then((res: any) => res.data),
      staleTime: 60 * 1000,
    });

  const updateUserStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api.patch(API_ENDPOINTS.USERS.STATUS(id), { status }).then((res: any) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      api.patch(API_ENDPOINTS.USERS.BY_ID(id), data).then((res: any) => res.data),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });

      const currentProfile = store.getState().user.user;
      if (!currentProfile || currentProfile.id !== variables.id) {
        return;
      }

      const updatedProfile =
        unwrapUserResponse(response) ??
        ({
          ...currentProfile,
          ...variables.data,
          name: variables.data.name ?? currentProfile.name,
          role: currentProfile.role,
        } as any);

      store.dispatch(setProfile(updatedProfile as any));
      store.dispatch(setName(updatedProfile.name));
      store.dispatch(setRole(updatedProfile.role));
    },
  });

  const updateMyProfile = useMutation({
    mutationFn: (data: UpdateUserRequest) =>
      api.patch(API_ENDPOINTS.AUTH.MY_PROFILE, data).then((res: any) => res.data),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: [user, "profile"] });
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });

      const currentProfile = store.getState().user.user;
      if (!currentProfile) {
        return;
      }

      const updatedProfile =
        unwrapUserResponse(response) ??
        ({
          ...currentProfile,
          ...variables,
          name: variables.name ?? currentProfile.name,
          role: currentProfile.role,
        } as any);

      store.dispatch(setProfile(updatedProfile as any));
      store.dispatch(setName(updatedProfile.name));
      store.dispatch(setRole(updatedProfile.role));
    },
  });

  const updateMarketAddOrder = useMutation({
    mutationFn: ({ id, add_order }: { id: string; add_order: boolean }) =>
      api
        .patch(API_ENDPOINTS.MARKETS.ADD_ORDER(id), { add_order })
        .then((res: any) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });
      client.invalidateQueries({ queryKey: ["markets"], refetchType: "active" });
    },
  });

  const updateMarketExpenseProof = useMutation({
    mutationFn: ({
      id,
      expense_proof_conditions,
    }: {
      id: string;
      expense_proof_conditions: string[];
    }) =>
      api
        .patch(API_ENDPOINTS.MARKETS.EXPENSE_PROOF(id), {
          expense_proof_conditions,
        })
        .then((res: any) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });
      client.invalidateQueries({ queryKey: ["markets"], refetchType: "active" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) =>
      api.delete(API_ENDPOINTS.USERS.BY_ID(id)).then((res: any) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  return {
    createAdmin,
    createRegistrator,
    createManager,
    createMarket,
    createCourier,
    useGetRegions,
    useGetUser,
    useGetCouriers,
    useGetUserById,
    useGetMyProfile,
    updateUserStatus,
    updateUser,
    updateMyProfile,
    updateMarketAddOrder,
    updateMarketExpenseProof,
    deleteUser,
  };
};
