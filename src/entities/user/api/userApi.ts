import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import type { CreateAdminRequest, CreateCourierRequest, CreateMarketRequest, UserStatus } from "../types/user";

export const user = "user";

export interface IUserFilter {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export const useUser = () => {
  const client = useQueryClient();

  const getUser = (params?: IUserFilter) =>
    useQuery({
      queryKey: [user, params],
      queryFn: () => api.get("users", { params }).then((res: any) => res.data),
    });

  const createAdmin = useMutation({
    mutationFn: (data: CreateAdminRequest) => api.post("admins", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const createMarket = useMutation({
    mutationFn: (data: CreateMarketRequest) => api.post("markets", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const createCourier = useMutation({
    mutationFn: (data: CreateCourierRequest) => api.post("couriers", data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  const getRegions = () =>
    useQuery({
      queryKey: ["regions"],
      queryFn: () => api.get("region").then((res: any) => res.data),
      staleTime: 5 * 60 * 1000,
    });

  const getUserById = (id: string) =>
    useQuery({
      queryKey: [user, "detail", id],
      queryFn: () => api.get(`users/${id}`).then((res: any) => res.data),
      enabled: !!id,  // Faqat id mavjud bo'lsa so'rov yuborilsin
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
      api.patch(`users/${id}/status`, { status }).then((res: any) => res.data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [user], refetchType: "active" }),
  });

  return {
    createAdmin,
    createMarket,
    createCourier,
    getRegions,
    getUser,
    getUserById,
    updateUserStatus,
  };
};
