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

export const useUser = () => {
  const client = useQueryClient();

  const getUser = (params?: IUserFilter, enabled: boolean = true) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () => api.get(API_ENDPOINTS.USERS.BASE, { params }).then((res: any) => res.data),
      enabled,
      placeholderData: (prev: any) => prev,
    });

  const getCouriers = (params?: IUserFilter, enabled: boolean = true) =>
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

        const { region_id: _regionId, ...payloadWithoutRegion } = data;
        return api.post(API_ENDPOINTS.COURIERS.BASE, payloadWithoutRegion);
      }
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const getRegions = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["regions"],
      queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res: any) => res.data),
      staleTime: 5 * 60 * 1000,
      enabled,
    });

  const getUserById = (id: string, params?: Pick<IUserFilter, "fromDate" | "toDate">) =>
    useQuery({
      queryKey: [user, "detail", id, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.USERS.BY_ID(id), { params }).then((res: any) => res.data),
      enabled: !!id,
    });

  const getMyProfile = () =>
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
    getRegions,
    getUser,
    getCouriers,
    getUserById,
    getMyProfile,
    updateUserStatus,
    updateUser,
    updateMyProfile,
    updateMarketAddOrder,
    updateMarketExpenseProof,
    deleteUser,
  };
};
