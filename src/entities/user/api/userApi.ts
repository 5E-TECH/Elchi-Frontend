import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { useDispatch, useStore } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { setProfile } from "../model/slice";
import { setName, setRole } from "../../../shared/model/roleSlice";
import type {
  CreateAdminRequest,
  CreateCourierRequest,
  CreateLogistRequest,
  CreateManagerRequest,
  CreateMarketRequest,
  CreateRegistratorRequest,
  UpdateUserRequest,
  User,
  UserStatus,
} from "../types/user";
import { unwrapUserResponse } from "../lib/normalizeUser";
import { silentErrorMeta, type SilentErrorOption } from "../../../shared/lib/queryErrorEvents";

export const user = "user";

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

/**
 * `GET /users` ro'yxati — bitta so'rov, server sahifalashi (FY-1). Backend `Roles` da `marketing` roli yo'q:
 * avvalgi «market + marketing» ikki so'rovi va klientdagi sahifalash olib tashlandi (`role=market` — oddiy so'rov).
 */
export const fetchUserList = async (params?: IUserFilter) => {
  const response = await api.get(API_ENDPOINTS.USERS.BASE, { params });
  return normalizeUserListResponse(response.data, params);
};

export const useUser = () => {
  const client = useQueryClient();
  const dispatch = useDispatch();
  const reduxStore = useStore<RootState>();

  /** `silentError` — sahifa xatoni o'zi ko'rsatadi (`ErrorState`), global xabar takrorlanmaydi. */
  const useGetUser = (params?: IUserFilter, enabled: boolean = true, options?: { silentError?: boolean }) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () => fetchUserList(params),
      enabled,
      placeholderData: (prev) => prev,
      ...(options?.silentError ? { meta: { silentError: true } } : {}),
    });

  const useGetCouriers = (params?: IUserFilter, enabled: boolean = true) =>
    useQuery({
      queryKey: ["couriers", params],
      queryFn: () => api.get(API_ENDPOINTS.COURIERS.BASE, { params }).then((res) => res.data),
      enabled,
    });

  const useGetManagers = (params?: IUserFilter, enabled: boolean = true) =>
    useQuery({
      queryKey: ["managers", params],
      queryFn: () => api.get(API_ENDPOINTS.MANAGERS.BASE, { params }).then((res: any) => res.data),
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
    mutationFn: (data: CreateCourierRequest) => api.post(API_ENDPOINTS.COURIERS.BASE, data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  /** `POST /logists` (LG-2). Logistlar ro'yxati (`["logists"]`, «Logist biriktirish») ham yangilanadi. */
  const createLogist = useMutation({
    mutationFn: (data: CreateLogistRequest) => api.post(API_ENDPOINTS.LOGISTS.BASE, data),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
        client.invalidateQueries({ queryKey: ["logists"] }),
      ]),
  });

  const useGetRegions = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["regions"],
      queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => res.data),
      staleTime: 5 * 60 * 1000,
      enabled,
    });

  const useGetUserById = (
    id: string,
    params?: Pick<IUserFilter, "fromDate" | "toDate">,
    options?: { silentError?: boolean },
  ) =>
    useQuery({
      queryKey: [user, "detail", id, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.USERS.BY_ID(id), { params }).then((res) => res.data),
      enabled: !!id,
      ...(options?.silentError ? { meta: { silentError: true } } : {}),
    });

  /** `silentError` — sahifa xatoni o'zi ko'rsatadi (`QueryBoundary`), global xabar takrorlanmaydi. */
  const useGetMyProfile = (options?: SilentErrorOption & { enabled?: boolean }) =>
    useQuery({
      queryKey: [user, "profile"],
      queryFn: () =>
        api.get(API_ENDPOINTS.AUTH.MY_PROFILE).then((res) => res.data),
      staleTime: 60 * 1000,
      // `enabled` — ixtiyoriy (sukut: so'raladi); buyurtma yaratishda faqat market rolida (CS-B).
      enabled: options?.enabled ?? true,
      ...silentErrorMeta(options),
    });

  const updateUserStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api.patch(API_ENDPOINTS.USERS.STATUS(id), { status }).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      api.patch(API_ENDPOINTS.USERS.BY_ID(id), data).then((res) => res.data),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });

      const currentProfile = reduxStore.getState().user.user;
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

      dispatch(setProfile(updatedProfile as any));
      dispatch(setName(updatedProfile.name));
      dispatch(setRole(updatedProfile.role));
    },
  });

  const updateMyProfile = useMutation({
    mutationFn: (data: UpdateUserRequest) =>
      api.patch(API_ENDPOINTS.AUTH.MY_PROFILE, data).then((res) => res.data),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: [user, "profile"] });
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });

      const currentProfile = reduxStore.getState().user.user;
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

      dispatch(setProfile(updatedProfile as any));
      dispatch(setName(updatedProfile.name));
      dispatch(setRole(updatedProfile.role));
    },
  });

  const updateMarketAddOrder = useMutation({
    mutationFn: ({ id, add_order }: { id: string; add_order: boolean }) =>
      api
        .patch(API_ENDPOINTS.MARKETS.ADD_ORDER(id), { add_order })
        .then((res) => res.data),
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

  const updateMarketCancelledHandoverQr = useMutation({
    mutationFn: ({
      id,
      cancelled_handover_qr_required,
    }: {
      id: string;
      cancelled_handover_qr_required: boolean;
    }) =>
      api
        .patch(API_ENDPOINTS.MARKETS.CANCELLED_HANDOVER_QR(id), {
          cancelled_handover_qr_required,
        })
        .then((res: any) => res.data),
    onSuccess: (response, variables) => {
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });
      client.invalidateQueries({ queryKey: ["markets"], refetchType: "active" });
      client.invalidateQueries({ queryKey: ["orders", "markets", "cancelled"], refetchType: "active" });

      const currentProfile = reduxStore.getState().user.user;
      if (!currentProfile || currentProfile.id !== variables.id) {
        return;
      }

      const responseProfile = unwrapUserResponse(response);
      const updatedProfile = {
        ...currentProfile,
        ...(responseProfile ?? {}),
        id: currentProfile.id,
        role: currentProfile.role,
        name: responseProfile?.name ?? currentProfile.name,
        cancelled_handover_qr_required: variables.cancelled_handover_qr_required,
      };

      dispatch(setProfile(updatedProfile as any));
    },
  });

  /**
   * (ysBqD9Nx) Market Telegram guruhi kartasida mijoz ismi/telefoni — `PATCH markets/:id/telegram-group-pii`.
   * Superadmin/admin istalgan market uchun, market — faqat o'zi uchun (boshqasi 403).
   */
  const updateMarketTelegramGroupPii = useMutation({
    mutationFn: ({
      id,
      tg_group_show_customer_pii,
    }: {
      id: string;
      tg_group_show_customer_pii: boolean;
    }) =>
      api
        .patch(API_ENDPOINTS.MARKETS.TELEGRAM_GROUP_PII(id), { tg_group_show_customer_pii })
        .then((res) => res.data),
    onSuccess: () => {
      // `[user]` — tafsilot (`[user, "detail", id]`) va o'z profili (`[user, "profile"]`) ham.
      client.invalidateQueries({ queryKey: [user], refetchType: "active" });
      client.invalidateQueries({ queryKey: ["markets"], refetchType: "active" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) =>
      api.delete(API_ENDPOINTS.USERS.BY_ID(id)).then((res) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  return {
    createAdmin,
    createRegistrator,
    createManager,
    createMarket,
    createCourier,
    createLogist,
    useGetRegions,
    useGetUser,
    useGetCouriers,
    useGetManagers,
    useGetUserById,
    useGetMyProfile,
    updateUserStatus,
    updateUser,
    updateMyProfile,
    updateMarketAddOrder,
    updateMarketExpenseProof,
    updateMarketCancelledHandoverQr,
    updateMarketTelegramGroupPii,
    deleteUser,
  };
};
