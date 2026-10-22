export const queryKeys = {
  notifications: {
    all: ["notifications"] as const,
    list: (params: object) => ["notifications", "list", params] as const,
    detail: (id: string) => ["notifications", "detail", id] as const,
  },
  notificationsInbox: {
    all: ["notifications-inbox"] as const,
    list: (params: object) => ["notifications-inbox", "list", params] as const,
    detail: (id: string) => ["notifications-inbox", "detail", id] as const,
    unreadCount: ["notifications-inbox", "unread-count"] as const,
    // `all` prefiksi ostida — "Barchasini o'qilgan" va har o'qish sanoqlarni ham yangilaydi.
    counts: ["notifications-inbox", "counts"] as const,
  },
  /** Qo'lda yuborilgan xabarlar tarixi (`/notifications/sent`). */
  notificationsSent: {
    all: ["notifications-sent"] as const,
    detail: (dispatchId: string, params: object) => ["notifications-sent", "detail", dispatchId, params] as const,
  },
  branches: {
    all: ["branches"] as const,
    list: (params: object) => ["branches", "list", params] as const,
    withSentBatches: (params: object) => ["branches", "with-sent-batches", params] as const,
    detail: (id: string) => ["branches", "detail", id] as const,
    employees: (id: string) => ["branches", id, "employees"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params?: object) => ["users", "list", params ?? {}] as const,
  },
  regions: {
    all: ["regions"] as const,
  },
  courierTransfer: {
    all: ["courier-transfer"] as const,
    check: (courierId: string) => ["courier-transfer", "check", courierId] as const,
    destinations: ["courier-transfer", "destinations"] as const,
  },
  /** Kassa xarajati kategoriyalari (`GET finance/cashbox/expense-categories`). */
  expenseCategories: {
    all: ["expense-categories"] as const,
    list: (params: { includeDeleted: boolean }) => ["expense-categories", "list", params] as const,
  },
  activityLogs: {
    all: ["activity-logs"] as const,
    list: (params: object) => ["activity-logs", "list", params] as const,
    actions: ["activity-logs", "actions"] as const,
    entity: (entityType: string, entityId: string) =>
      ["activity-logs", "entity", entityType, entityId] as const,
    user: (userId: string, params: object) =>
      ["activity-logs", "user", userId, params] as const,
  },
} as const;
