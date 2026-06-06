import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const useBranchCoverage = () => {
  const client = useQueryClient();

  // GET branches/:id/analytics/markets
  const getAnalyticsMarkets = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["branch-cov", "analytics-markets", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.BRANCHES.ANALYTICS_MARKETS(id)).then((res) => res.data),
      enabled: enabled && !!id,
    });

  // GET branches/:branchId/config/:key
  const getSettingById = (branchId: string, key: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["branch-cov", "setting-by-id", branchId, key],
      queryFn: () =>
        api.get(API_ENDPOINTS.BRANCHES.SETTING_BY_ID(branchId, key)).then((res) => res.data),
      enabled: enabled && !!branchId && !!key,
    });

  // GET branches/:id/descendants
  const getDescendants = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["branch-cov", "descendants", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.BRANCHES.DESCENDANTS(id)).then((res) => res.data),
      enabled: enabled && !!id,
    });

  // POST branches/:id/return-batches
  const returnBatches = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(API_ENDPOINTS.BRANCHES.RETURN_BATCHES(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["branch-cov"] }),
  });

  // GET branches/new-orders
  const getNewOrders = (params?: any) =>
    useQuery({
      queryKey: ["branch-cov", "new-orders", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.BRANCHES.NEW_ORDERS, { params }).then((res) => res.data),
    });

  // POST branches/posts/:postId/dispatch
  const postDispatch = useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: any }) =>
      api.post(API_ENDPOINTS.BRANCHES.POST_DISPATCH(postId), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["branch-cov"] }),
  });

  // GET branches/tree
  const getTree = (params?: any) =>
    useQuery({
      queryKey: ["branch-cov", "tree", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.BRANCHES.TREE, { params }).then((res) => res.data),
    });

  // POST transfer-batches/:id/cancel
  const cancelBatch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(API_ENDPOINTS.BATCHES.CANCEL(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["branch-cov"] }),
  });

  return {
    getAnalyticsMarkets,
    getSettingById,
    getDescendants,
    returnBatches,
    getNewOrders,
    postDispatch,
    getTree,
    cancelBatch,
  };
};
