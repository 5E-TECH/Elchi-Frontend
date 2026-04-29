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
  CreateOperatorRequest,
  CreateRegistratorRequest,
  UpdateUserRequest,
  UserStatus,
} from "../types/user";
import { unwrapUserResponse } from "../lib/normalizeUser";

export const user = "user";

export interface IUserFilter {
  search?: string;
  status?: string;
  role?: string;
  region_id?: string;
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

  const createOperator = useMutation({
    mutationFn: (data: CreateOperatorRequest) =>
      api.post(API_ENDPOINTS.OPERATORS.BASE, data),
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

  const getRegions = () =>
    useQuery({
      queryKey: ["regions"],
      queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res: any) => res.data),
      staleTime: 5 * 60 * 1000,
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

  //   const getUserById = (id: string | undefined, params?: IUserFilter) =>
  //     useQuery({
  //       queryKey: [user, params, id],
  //       queryFn: () => api.get(`user/${id}`, { params }).then((res) => res.data),
  //     });

  //   const getAdminAndRegister = (enabled = true, params?: IUserFilter) =>
  //     useQuery({
  //       queryKey: [user, params],
  //       queryFn: () =>
  //         api
  //           .get("user/registrator-and-admin", { params })
  //           .then((res) => res.data),
  //       enabled,
  //     });

  //   const updateUser = useMutation({
  //     mutationFn: ({ role, id, data }: { role: string; id: string; data: any }) =>
  //       api.patch(`user/${role}/${id}`, data),
  //     onSuccess: () =>
  //       client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  //   });

  //   const removeUser = useMutation({
  //     mutationFn: (id: string) =>
  //       api.delete(`user/${id}`).then((res) => res.data),
  //     onSuccess: () => client.invalidateQueries({ queryKey: [user] }),
  //   });

  //   const getUsersExceptMarket = (params?: IUserFilter) =>
  //     useQuery({
  //       queryKey: [user, params],
  //       queryFn: () =>
  //         api.get("user/except-market", { params }).then((res) => res.data),
  //     });

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
    createOperator,
    createMarket,
    createCourier,
    getRegions,
    getUser,
    getCouriers,
    getUserById,
    getMyProfile,
    updateUserStatus,
    updateUser,
    deleteUser,
  };
};
