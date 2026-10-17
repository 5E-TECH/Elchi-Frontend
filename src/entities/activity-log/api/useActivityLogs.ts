import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import {
  getActivityActionCatalog,
  getActivityLogs,
  getEntityHistory,
  getUserActivity,
} from "./activityLogApi";
import type { ActivityLogParams } from "../model/types";

export const useActivityLogs = (params: ActivityLogParams) =>
  useQuery({
    queryKey: queryKeys.activityLogs.list(params),
    queryFn: () => getActivityLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

/** Fe'llar katalogi (filtr ro'yxati + yorliqlar) — sessiya davomida keshda. */
export const useActivityActionCatalog = () =>
  useQuery({
    queryKey: [...queryKeys.activityLogs.actions, "catalog"],
    queryFn: getActivityActionCatalog,
    staleTime: 60 * 60_000,
  });

export const useEntityHistory = (entityType?: string, entityId?: string, limit?: number) =>
  useQuery({
    queryKey:
      entityType && entityId
        ? queryKeys.activityLogs.entity(entityType, entityId)
        : queryKeys.activityLogs.all,
    queryFn: () => getEntityHistory(entityType as string, entityId as string, limit),
    enabled: Boolean(entityType && entityId),
  });

export const useUserActivity = (userId?: string, params: ActivityLogParams = {}) =>
  useQuery({
    queryKey: userId ? queryKeys.activityLogs.user(userId, params) : queryKeys.activityLogs.all,
    queryFn: () => getUserActivity(userId as string, params),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
