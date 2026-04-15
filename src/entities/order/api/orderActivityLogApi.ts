import { api } from "../../../shared/api/api";
import type { ActivityLogResponse } from "../model/types";

export const orderActivityLogApi = {
  getByOrderId: (orderId: string | number, params?: { page?: number; limit?: number }) =>
    api.get<ActivityLogResponse | ActivityLogResponse["data"]>(`/orders/${orderId}/tracking`, { params }),
};
