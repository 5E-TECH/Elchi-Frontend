import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const logiCov = "logi-cov";

export const useLogisticsCoverage = () => {
  const client = useQueryClient();

  // Tuman hook'lari (`any` parametrli, iste'molchisiz) SA-2 da olib tashlandi: tumanlar va SATO —
  // `pages/region` dagi tipli so'rovlar (`sato-management`, `districts`, `model/districtMerge.ts`).

  // ── POSTS ──────────────────────────────────────────────────────────────────

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

  // `PATCH post/reassign/:id` (kuryerga qayta biriktirish) backend'da o'chirilgan (410, CODE-12): jo'natilgan
  // pochta boshqa filialga — `useReassignPostToBranch` (`entities/mails`, «Filialga o'tkazish»; EzgWTudf).

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

  // Qaytarish so'rovlari (ro'yxat, tasdiqlash, rad etish) — faqat `entities/mails` da («Pochta → Qaytarish»):
  // Ops'dagi takror hook'lar u5HTJtqK da iste'molchisi (`pages/logistics-ops`) bilan birga olib tashlandi.

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
    // Posts
    useGetPostById,
    deletePost,
    checkPost,
    checkCancelPost,
    getCouriersByPost,
    receivePostOrder,
    receivePostScan,
    // Regions
    createRegion,
    updateRegion,
    deleteRegion,
  };
};
