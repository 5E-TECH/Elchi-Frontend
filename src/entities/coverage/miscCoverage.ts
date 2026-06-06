import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const useMiscCoverage = () => {
  const client = useQueryClient();

  // ── ANALYTICS ──────────────────────────────────────────────────────────────

  const getAnalyticsKpi = (params?: any) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-kpi", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.KPI, { params }).then((res) => res.data),
    });

  const getAnalyticsReportCouriers = (params?: any) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-report-couriers", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.REPORT_COURIERS, { params })
          .then((res) => res.data),
    });

  const getAnalyticsReportFinance = (params?: any) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-report-finance", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.REPORT_FINANCE, { params })
          .then((res) => res.data),
    });

  const getAnalyticsReportOrders = (params?: any) =>
    useQuery({
      queryKey: ["misc-cov", "analytics-report-orders", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ANALYTICS.REPORT_ORDERS, { params })
          .then((res) => res.data),
    });

  // ── AUTH ───────────────────────────────────────────────────────────────────

  const login = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.AUTH.LOGIN, data),
  });

  const logout = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.AUTH.LOGOUT, data),
    onSuccess: () => client.clear(),
  });

  const refresh = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.AUTH.REFRESH, data),
  });

  const getAuthValidate = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["misc-cov", "auth-validate"],
      queryFn: () =>
        api.get(API_ENDPOINTS.AUTH.VALIDATE).then((res) => res.data),
      enabled,
    });

  // ── EXPORT (binary xlsx — returned as any) ─────────────────────────────────

  const getExportCashboxHistoryXlsx = (params?: any) =>
    useQuery<any>({
      queryKey: ["misc-cov", "export-cashbox-history-xlsx", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.EXPORT.CASHBOX_HISTORY_XLSX, { params })
          .then((res) => res.data),
    });

  const getExportOrdersXlsx = (params?: any) =>
    useQuery<any>({
      queryKey: ["misc-cov", "export-orders-xlsx", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.EXPORT.ORDERS_XLSX, { params })
          .then((res) => res.data),
    });

  const getExportShiftsXlsx = (params?: any) =>
    useQuery<any>({
      queryKey: ["misc-cov", "export-shifts-xlsx", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.EXPORT.SHIFTS_XLSX, { params })
          .then((res) => res.data),
    });

  // ── FILES ──────────────────────────────────────────────────────────────────

  const getFileByKey = (key: string, enabled: boolean = true) =>
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
    mutationFn: (data: any) => api.post(API_ENDPOINTS.FILES.PDF, data),
  });

  const generateQr = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.FILES.QR, data),
  });

  const uploadFile = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.FILES.UPLOAD, data),
  });

  // ── HEALTH ─────────────────────────────────────────────────────────────────

  const getHealthLiveness = () =>
    useQuery({
      queryKey: ["misc-cov", "health-liveness"],
      queryFn: () =>
        api.get(API_ENDPOINTS.HEALTH.LIVENESS).then((res) => res.data),
    });

  const getHealthReadiness = () =>
    useQuery({
      queryKey: ["misc-cov", "health-readiness"],
      queryFn: () =>
        api.get(API_ENDPOINTS.HEALTH.READINESS).then((res) => res.data),
    });

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────

  const connectNotificationByToken = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.NOTIFICATIONS.CONNECT_BY_TOKEN, data),
  });

  const getNotificationsHealth = () =>
    useQuery({
      queryKey: ["misc-cov", "notifications-health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.NOTIFICATIONS.HEALTH).then((res) => res.data),
    });

  const sendNotification = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.NOTIFICATIONS.SEND, data),
  });

  // ── PRINTER ────────────────────────────────────────────────────────────────

  const printReceipt = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.PRINTER.RECEIPT, data),
  });

  const printThermalPdf = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.PRINTER.THERMAL_PDF, data),
  });

  // ── PRODUCTS ───────────────────────────────────────────────────────────────

  const getProductsHealth = () =>
    useQuery({
      queryKey: ["misc-cov", "products-health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.PRODUCTS.HEALTH).then((res) => res.data),
    });

  const updateMyProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(API_ENDPOINTS.PRODUCTS.UPDATE_MY(id), data),
  });

  // ── SCAN ───────────────────────────────────────────────────────────────────

  const getScanByToken = (token: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["misc-cov", "scan-by-token", token],
      queryFn: () =>
        api.get(API_ENDPOINTS.SCAN.BY_TOKEN(token)).then((res) => res.data),
      enabled: enabled && !!token,
    });

  // ── SEARCH ─────────────────────────────────────────────────────────────────

  const getSearchHealth = () =>
    useQuery({
      queryKey: ["misc-cov", "search-health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.SEARCH.HEALTH).then((res) => res.data),
    });

  return {
    // Analytics
    getAnalyticsKpi,
    getAnalyticsReportCouriers,
    getAnalyticsReportFinance,
    getAnalyticsReportOrders,
    // Auth
    login,
    logout,
    refresh,
    getAuthValidate,
    // Export
    getExportCashboxHistoryXlsx,
    getExportOrdersXlsx,
    getExportShiftsXlsx,
    // Files
    getFileByKey,
    deleteFileByKey,
    generatePdf,
    generateQr,
    uploadFile,
    // Health
    getHealthLiveness,
    getHealthReadiness,
    // Notifications
    connectNotificationByToken,
    getNotificationsHealth,
    sendNotification,
    // Printer
    printReceipt,
    printThermalPdf,
    // Products
    getProductsHealth,
    updateMyProduct,
    // Scan
    getScanByToken,
    // Search
    getSearchHealth,
  };
};
