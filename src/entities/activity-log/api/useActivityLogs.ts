import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import {
  getActivityActions,
  getActivityLogs,
  getEntityHistory,
  getUserActivity,
} from "./activityLogApi";
import type { ActivityLogParams } from "../model/types";
import { silentErrorMeta, type SilentErrorOption } from "../../../shared/lib/queryErrorEvents";

export const useActivityLogs = (params: ActivityLogParams, options?: SilentErrorOption) =>
  useQuery({
    queryKey: queryKeys.activityLogs.list(params),
    queryFn: () => getActivityLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    ...silentErrorMeta(options),
  });

/**
 * Fe'llar katalogi (y8CxCtcK: fe'llar, reyestr, kategoriyalar) — sessiya davomida keshda. Kalit eski
 * `string[]` javobidan ajratilgan (`"catalog"`), shakl o'zgargan.
 */
export const useActivityActions = () =>
  useQuery({
    queryKey: [...queryKeys.activityLogs.actions, "catalog"],
    queryFn: getActivityActions,
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
