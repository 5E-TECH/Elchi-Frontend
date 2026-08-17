import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

type QueryParams = Record<string, unknown>;

export const useMiscCoverage = () => {
  const client = useQueryClient();

  // ── ANALYTICS ──────────────────────────────────────────────────────────────

  const useGetAnalyticsKpi = (params?: QueryParams) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-kpi", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.KPI, { params }).then((res) => res.data),
    });

  const useGetAnalyticsReportCouriers = (params?: QueryParams) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-report-couriers", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.REPORT_COURIERS, { params })
          .then((res) => res.data),
    });

  const useGetAnalyticsReportFinance = (params?: QueryParams) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-report-finance", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.REPORT_FINANCE, { params })
          .then((res) => res.data),
    });

  const useGetAnalyticsReportOrders = (params?: QueryParams) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-report-orders", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.REPORT_ORDERS, { params })
          .then((res) => res.data),
    });

  // ── AUTH ───────────────────────────────────────────────────────────────────

  const login = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.AUTH.LOGIN, data),
  });

  const logout = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.AUTH.LOGOUT, data),
    onSuccess: () => client.clear(),
  });

  const refresh = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.AUTH.REFRESH, data),
  });

  const useGetAuthValidate = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["misc-cov", "auth-validate"],
      queryFn: () =>
        api.get(API_ENDPOINTS.AUTH.VALIDATE).then((res) => res.data),
      enabled,
    });

  // ── EXPORT (binary xlsx — returned as any) ─────────────────────────────────

  const useGetExportCashboxHistoryXlsx = (params?: QueryParams) =>
    useQuery<Blob>({
      queryKey: ["misc-cov", "export-cashbox-history-xlsx", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.EXPORT.CASHBOX_HISTORY_XLSX, { params })
          .then((res) => res.data),
    });

  const useGetExportOrdersXlsx = (params?: QueryParams) =>
    useQuery<Blob>({
      queryKey: ["misc-cov", "export-orders-xlsx", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.EXPORT.ORDERS_XLSX, { params })
          .then((res) => res.data),
    });

  const useGetExportShiftsXlsx = (params?: QueryParams) =>
    useQuery<Blob>({
      queryKey: ["misc-cov", "export-shifts-xlsx", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.EXPORT.SHIFTS_XLSX, { params })
          .then((res) => res.data),
    });

  // ── FILES ──────────────────────────────────────────────────────────────────

  const useGetFileByKey = (key: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["misc-cov", "files-by-key", key],
      queryFn: () =>
        api.get(API_ENDPOINTS.FILES.BY_KEY(key)).then((res) => res.data),
      enabled: enabled && !!key,
    });

  const deleteFileByKey = useMutation({
    mutationFn: (key: string) =>
      api.delete(API_ENDPOINTS.FILES.BY_KEY(key)),
  });

  const generatePdf = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.FILES.PDF, data),
  });

  const generateQr = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.FILES.QR, data),
  });

  const uploadFile = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.FILES.UPLOAD, data),
  });

  // ── HEALTH ─────────────────────────────────────────────────────────────────

  const useGetHealthLiveness = () =>
    useQuery({
      queryKey: ["misc-cov", "health-liveness"],
      queryFn: () =>
        api.get(API_ENDPOINTS.HEALTH.LIVENESS).then((res) => res.data),
    });

  const useGetHealthReadiness = () =>
    useQuery({
      queryKey: ["misc-cov", "health-readiness"],
      queryFn: () =>
        api.get(API_ENDPOINTS.HEALTH.READINESS).then((res) => res.data),
    });

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────

  const connectNotificationByToken = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.NOTIFICATIONS.CONNECT_BY_TOKEN, data),
  });

  const useGetNotificationsHealth = () =>
    useQuery({
      queryKey: ["misc-cov", "notifications-health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.NOTIFICATIONS.HEALTH).then((res) => res.data),
    });

  const sendNotification = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.NOTIFICATIONS.SEND, data),
  });

  // ── PRINTER ────────────────────────────────────────────────────────────────

  const printReceipt = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.PRINTER.RECEIPT, data),
  });

  const printThermalPdf = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.PRINTER.THERMAL_PDF, data),
  });

  // ── PRODUCTS ───────────────────────────────────────────────────────────────

  const useGetProductsHealth = () =>
    useQuery({
      queryKey: ["misc-cov", "products-health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.PRODUCTS.HEALTH).then((res) => res.data),
    });

  const updateMyProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(API_ENDPOINTS.PRODUCTS.UPDATE_MY(id), data),
  });

  // ── SCAN ───────────────────────────────────────────────────────────────────

  const useGetScanByToken = (token: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["misc-cov", "scan-by-token", token],
      queryFn: () =>
        api.get(API_ENDPOINTS.SCAN.BY_TOKEN(token)).then((res) => res.data),
      enabled: enabled && !!token,
    });

  // ── SEARCH ─────────────────────────────────────────────────────────────────

  const useGetSearchHealth = () =>
    useQuery({
      queryKey: ["misc-cov", "search-health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.SEARCH.HEALTH).then((res) => res.data),
    });

  return {
    // Analytics
    useGetAnalyticsKpi,
    useGetAnalyticsReportCouriers,
    useGetAnalyticsReportFinance,
    useGetAnalyticsReportOrders,
    // Auth
    login,
    logout,
    refresh,
    useGetAuthValidate,
    // Export
    useGetExportCashboxHistoryXlsx,
    useGetExportOrdersXlsx,
    useGetExportShiftsXlsx,
    // Files
    useGetFileByKey,
    deleteFileByKey,
    generatePdf,
    generateQr,
    uploadFile,
    // Health
    useGetHealthLiveness,
    useGetHealthReadiness,
    // Notifications
    connectNotificationByToken,
    useGetNotificationsHealth,
    sendNotification,
    // Printer
    printReceipt,
    printThermalPdf,
    // Products
    useGetProductsHealth,
    updateMyProduct,
    // Scan
    useGetScanByToken,
    // Search
    useGetSearchHealth,
  };
};
