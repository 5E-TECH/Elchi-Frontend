import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { CreateAdminRequest, CreateCourierRequest, CreateMarketRequest, UpdateUserRequest, UserStatus } from "../types/user";

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
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) =>
      api.delete(API_ENDPOINTS.USERS.BY_ID(id)).then((res: any) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  return {
    createAdmin,
    createMarket,
    createCourier,
    getRegions,
    getUser,
    getCouriers,
    getUserById,
    updateUserStatus,
    updateUser,
    deleteUser,
  };
};
