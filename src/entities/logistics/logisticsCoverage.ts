import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";

export const logiCov = "logi-cov";

export const useLogisticsCoverage = () => {
  const client = useQueryClient();

  // ── DISTRICTS ──────────────────────────────────────────────────────────────

  const useGetDistricts = (params?: any) =>
    useQuery({
      queryKey: [logiCov, "districts", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.DISTRICTS.BASE, { params }).then((res) => res.data),
    });

  const createDistrict = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.DISTRICTS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "districts"] }),
  });

  const useGetDistrictById = (id: string | number, enabled: boolean = true) =>
    useQuery({
      queryKey: [logiCov, "districts", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.DISTRICTS.BY_ID(id)).then((res) => res.data),
      enabled,
    });

  const deleteDistrict = useMutation({
    mutationFn: (id: string | number) =>
      api.delete(API_ENDPOINTS.DISTRICTS.BY_ID(id)),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "districts"] }),
  });

  const updateDistrictName = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: unknown }) =>
      api.patch(API_ENDPOINTS.DISTRICTS.UPDATE_NAME(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "districts"] }),
  });

  const applyDistrictSatoMatch = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.DISTRICTS.SATO_MATCH_APPLY, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "districts"] }),
  });

  const useGetDistrictSatoMatchPreview = (params?: any) =>
    useQuery({
      queryKey: [logiCov, "districts", "sato-match-preview", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.DISTRICTS.SATO_MATCH_PREVIEW, { params })
          .then((res) => res.data),
    });

  const updateDistrictSato = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: unknown }) =>
      api.patch(API_ENDPOINTS.DISTRICTS.SATO_UPDATE(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "districts"] }),
  });

  const useGetDistrictBySatoCode = (satoCode: string | number, enabled: boolean = true) =>
    useQuery({
      queryKey: [logiCov, "districts", "sato", satoCode],
      queryFn: () =>
        api.get(API_ENDPOINTS.DISTRICTS.SATO_BY_CODE(satoCode))
          .then((res) => res.data),
      enabled,
    });

  // ── POSTS ──────────────────────────────────────────────────────────────────

  const useGetPosts = (params?: any) =>
    useQuery({
      queryKey: [logiCov, "posts", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.POSTS.BASE, { params }).then((res) => res.data),
    });

  const useGetPostById = (postId: string | number, enabled: boolean = true) =>
    useQuery({
      queryKey: [logiCov, "posts", postId],
      queryFn: () =>
        api.get(API_ENDPOINTS.POSTS.BY_ID(postId)).then((res) => res.data),
      enabled,
    });

  const deletePost = useMutation({
    mutationFn: (postId: string | number) =>
      api.delete(API_ENDPOINTS.POSTS.BY_ID(postId)),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  const checkPost = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data?: any }) =>
      api.post(API_ENDPOINTS.POSTS.CHECK(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  const checkCancelPost = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data?: any }) =>
      api.post(API_ENDPOINTS.POSTS.CHECK_CANCEL(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  const getCouriersByPost = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data?: any }) =>
      api.post(API_ENDPOINTS.POSTS.COURIERS_BY_POST(id), data),
  });

  const useGetCourierOldPosts = (params?: any) =>
    useQuery({
      queryKey: [logiCov, "posts", "courier-old", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.POSTS.COURIER_OLD, { params }).then((res) => res.data),
    });

  const reassignPost = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: unknown }) =>
      api.patch(API_ENDPOINTS.POSTS.REASSIGN(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  const receivePostOrder = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data?: any }) =>
      api.patch(API_ENDPOINTS.POSTS.RECEIVE_ORDER(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  const receivePostScan = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data?: any }) =>
      api.patch(API_ENDPOINTS.POSTS.RECEIVE_SCAN(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  // OS-3: backend buyurtmalarni bo'laklab yozadi (atomik emas) — xato bo'lsa ham bir qismi omborga
  // qaytgan bo'lishi mumkin, shuning uchun ro'yxatlar har holda (onSettled) yangilanadi: Ops ro'yxati,
  // «Pochta» (`entities/mails` — `["mails", "return" | "old" | "new", …]`) va buyurtmalar.
  const approveReturnRequest = useMutation({
    mutationFn: (data: { order_ids: string[] }) =>
      api.post(API_ENDPOINTS.POSTS.RETURN_REQUESTS_APPROVE, data),
    onSettled: () => {
      client.invalidateQueries({ queryKey: [logiCov, "posts"] });
      client.invalidateQueries({ queryKey: ["mails", "return"] });
      // Kuryer pochtasi SENT → RECEIVED bo'lishi va hisoblagichlari kamayishi mumkin (`entities/mails` tasdig'idagidek).
      client.invalidateQueries({ queryKey: ["mails", "old"] });
      client.invalidateQueries({ queryKey: ["mails", "new"] });
      client.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const useGetReturnRequestsList = (params?: any, options?: SilentErrorOption) =>
    useQuery({
      queryKey: [logiCov, "posts", "return-requests", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.POSTS.RETURN_REQUESTS_LIST, { params })
          .then((res) => res.data),
      ...silentErrorMeta(options),
    });

  const rejectReturnRequest = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.POSTS.RETURN_REQUESTS_REJECT, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "posts"] }),
  });

  const useGetPostByScan = (id: string | number, enabled: boolean = true) =>
    useQuery({
      queryKey: [logiCov, "posts", "scan", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.POSTS.SCAN(id)).then((res) => res.data),
      enabled,
    });

  // ── REGIONS ────────────────────────────────────────────────────────────────

  const createRegion = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.REGIONS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "regions"] }),
  });

  const updateRegion = useMutation({
    mutationFn: ({ regionId, data }: { regionId: string | number; data: unknown }) =>
      api.patch(API_ENDPOINTS.REGIONS.BY_ID(regionId), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "regions"] }),
  });

  const deleteRegion = useMutation({
    mutationFn: (regionId: string | number) =>
      api.delete(API_ENDPOINTS.REGIONS.BY_ID(regionId)),
    onSuccess: () => client.invalidateQueries({ queryKey: [logiCov, "regions"] }),
  });

  return {
    // Districts
    useGetDistricts,
    createDistrict,
    useGetDistrictById,
    deleteDistrict,
    updateDistrictName,
    applyDistrictSatoMatch,
    useGetDistrictSatoMatchPreview,
    updateDistrictSato,
    useGetDistrictBySatoCode,
    // Posts
    useGetPosts,
    useGetPostById,
    deletePost,
    checkPost,
    checkCancelPost,
    getCouriersByPost,
    useGetCourierOldPosts,
    reassignPost,
    receivePostOrder,
    receivePostScan,
    approveReturnRequest,
    useGetReturnRequestsList,
    rejectReturnRequest,
    useGetPostByScan,
    // Regions
    createRegion,
    updateRegion,
    deleteRegion,
  };
};
